const EventoService = require('../services/EventoService');
const EventoRepository = require('../repositories/EventoRepository');
const AuditService = require('../services/AuditService');

class EventoController {
    async getStats(req, res) {
        try {
            const stats = await EventoService.obterEstatisticas();
            res.json(stats);
        } catch (err) {
            res.status(500).json({ erro: 'Erro ao buscar estatísticas' });
        }
    }

    async list(req, res) {
        try {
            const user = req.usuarioLogado;
            const { search, exportCsv } = req.query;
            let eventos = await EventoService.listarEventos(search);

            // Filtro de Backend para utilizadores restritos
            if (user && user.nivel_acesso !== 'admin') {
                const hasTypeRest = user.tipos_permitidos && JSON.parse(user.tipos_permitidos).length > 0;
                const hasGroupRest = user.grupos_permitidos && JSON.parse(user.grupos_permitidos).length > 0;
                
                if (hasTypeRest || hasGroupRest) {
                    const tipos = hasTypeRest ? JSON.parse(user.tipos_permitidos) : [];
                    const grupos = hasGroupRest ? JSON.parse(user.grupos_permitidos) : [];

                    eventos = eventos.filter(ev => {
                        const tipoPermitido = !hasTypeRest || tipos.includes(ev.tipo_evento);
                        const grupoPermitido = !hasGroupRest || grupos.includes(ev.grupo_id);
                        return tipoPermitido && grupoPermitido;
                    });
                }
            }

            if (exportCsv === 'true') {
                const csv = await EventoService.gerarCSV(eventos);
                res.header('Content-Type', 'text/csv; charset=utf-8');
                res.attachment('lnsotech_eventos.csv');
                return res.send(csv);
            }

            res.json(eventos);
        } catch (err) {
            res.status(500).json({ erro: 'Erro interno ao buscar eventos' });
        }
    }

    async getFeed(req, res) {
        try {
            const ical = await EventoService.gerarICal();
            res.header('Content-Type', 'text/calendar; charset=utf-8');
            res.header('Content-Disposition', 'attachment; filename="lnsotech_eventos.ics"');
            res.send(ical);
        } catch (error) {
            res.status(500).send('Erro ao gerar calendário');
        }
    }

    async create(req, res) {
        try {
            const user = req.usuarioLogado;
            const { grupo_id, tipo_evento } = req.body;
            
            // Verificação de permissões (Backend Security)
            if (user && user.nivel_acesso !== 'admin') {
                const hasTypeRest = user.tipos_permitidos && JSON.parse(user.tipos_permitidos).length > 0;
                const hasGroupRest = user.grupos_permitidos && JSON.parse(user.grupos_permitidos).length > 0;
                
                if (hasTypeRest) {
                    const tipos = JSON.parse(user.tipos_permitidos);
                    if (!tipos.includes(tipo_evento)) {
                        return res.status(403).json({ erro: 'Acesso Negado: Categoria não autorizada para o seu utilizador.' });
                    }
                }
                if (hasGroupRest) {
                    const gruposPerm = JSON.parse(user.grupos_permitidos);
                    if (!gruposPerm.includes(grupo_id)) {
                        return res.status(403).json({ erro: 'Acesso Negado: Grupo WhatsApp não autorizado para o seu utilizador.' });
                    }
                }
            }

            const id = await EventoService.criarEvento(req.body);
            await AuditService.log(req.usuarioLogado?.id, req.usuarioLogado?.nome, 'CRIAR', 'Evento', `Criou evento de ${req.body.nomes_principais || 'N/A'}`);
            res.status(201).json({ mensagem: 'Evento criado com sucesso', id });
        } catch (err) {
            res.status(500).json({ erro: 'Erro ao salvar: ' + err.message });
        }
    }

    async update(req, res) {
        try {
            const { id } = req.params;
            const { usuario_id, grupo_id, tipo_evento } = req.body;
            const user = req.usuarioLogado;

            // Verificação de permissões (Backend Security)
            if (user && user.nivel_acesso !== 'admin') {
                const hasTypeRest = user.tipos_permitidos && JSON.parse(user.tipos_permitidos).length > 0;
                const hasGroupRest = user.grupos_permitidos && JSON.parse(user.grupos_permitidos).length > 0;
                
                if (hasTypeRest) {
                    const tipos = JSON.parse(user.tipos_permitidos);
                    if (tipo_evento && !tipos.includes(tipo_evento)) {
                        return res.status(403).json({ erro: 'Acesso Negado: Categoria não autorizada.' });
                    }
                }
                if (hasGroupRest) {
                    const gruposPerm = JSON.parse(user.grupos_permitidos);
                    if (grupo_id && !gruposPerm.includes(grupo_id)) {
                        return res.status(403).json({ erro: 'Acesso Negado: Grupo WhatsApp não autorizado.' });
                    }
                }
            }

            await EventoService.atualizarEvento(id, req.body, usuario_id);
            await AuditService.log(req.usuarioLogado?.id, req.usuarioLogado?.nome, 'ATUALIZAR', 'Evento', `Atualizou evento ID: ${id}`);
            res.json({ mensagem: 'Evento atualizado com sucesso' });
        } catch (err) {
            res.status(err.message === 'Evento não encontrado' ? 404 : 500).json({ erro: err.message });
        }
    }

    async delete(req, res) {
        try {
            await EventoService.eliminarEvento(req.params.id);
            await AuditService.log(req.usuarioLogado?.id, req.usuarioLogado?.nome, 'REMOVER', 'Evento', `Apagou o evento ID: ${req.params.id}`);
            res.json({ mensagem: 'Evento apagado com sucesso' });
        } catch (err) {
            res.status(500).json({ erro: 'Erro interno ao deletar evento' });
        }
    }

    async uploadFoto(req, res) {
        try {
            if (!req.file) return res.status(400).json({ erro: 'Nenhuma foto enviada' });
            const fotoUrl = await EventoService.atualizarFoto(req.params.id, req.file.filename);
            res.json({ mensagem: 'Foto anexada com sucesso', fotoUrl });
        } catch (err) {
            res.status(500).json({ erro: 'Erro ao atualizar foto' });
        }
    }

    async importar(req, res) {
        try {
            if (!req.file) return res.status(400).json({ erro: 'Nenhum ficheiro CSV enviado' });
            const result = await EventoService.importarCSV(req.file.path);
            const fs = require('fs');
            fs.unlinkSync(req.file.path); // Limpar arquivo temporário
            
            await AuditService.log(req.usuarioLogado?.id, req.usuarioLogado?.nome, 'IMPORTAR', 'Evento', `Realizou importação CSV. Importados: ${result.imported}, Erros: ${result.errors}`);

            res.json({ 
                mensagem: `Importação concluída: ${result.imported} registos importados, ${result.errors} erros.`, 
                ...result 
            });
        } catch (err) {
            res.status(500).json({ erro: 'Falha ao processar CSV' });
        }
    }

    async getHistorico(req, res) {
        try {
            const rows = await EventoRepository.getHistorico(req.params.id);
            res.json(rows);
        } catch (err) {
            res.status(500).json({ erro: 'Falha buscar histórico' });
        }
    }

    async serveImage(req, res) {
        try {
            const { id } = req.params;
            const evento = await EventoRepository.findById(id);
            
            if (!evento || !evento.foto_url) {
                return res.status(404).send('Evento ou foto não encontrada');
            }

            const path = require('path');
            const fs = require('fs');
            const fotoUrl = evento.foto_url;
            const cleanName = fotoUrl.replace('/uploads/', '').replace('uploads/', '');
            const filePath = path.join(__dirname, '../../uploads/', cleanName);

            if (fs.existsSync(filePath)) {
                if (filePath.endsWith('.png')) res.header('Content-Type', 'image/png');
                else if (filePath.endsWith('.webp')) res.header('Content-Type', 'image/webp');
                else res.header('Content-Type', 'image/jpeg');

                res.sendFile(filePath);
            } else {
                res.status(404).send('Arquivo físico não encontrado');
            }
        } catch (err) {
            res.status(500).send('Erro interno');
        }
    }
}

module.exports = new EventoController();
