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
            const { search, exportCsv } = req.query;
            const eventos = await EventoService.listarEventos(search);

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
            const { usuario_id } = req.body;
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
