const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ========== ESTATÍSTICAS ========== //
router.get('/stats', async (req, res) => {
    try {
        const eventosCount = await req.db.query('SELECT COUNT(*) FROM eventos');
        const bodasCount = await req.db.query("SELECT COUNT(*) FROM eventos WHERE tipo_evento = 'casamento'");
        const aniversariosCount = await req.db.query("SELECT COUNT(*) FROM eventos WHERE tipo_evento = 'aniversario'");
        const gruposCountRes = await req.db.query("SELECT COUNT(DISTINCT grupo_id) FROM eventos WHERE grupo_id IS NOT NULL");
        const logsCount = await req.db.query("SELECT COUNT(*) FROM logs_envio WHERE tipo_log = 'lembrete_enviado'").catch(() => ({rows: [{count: 0}]})); 
        const falhasCount = await req.db.query("SELECT COUNT(*) FROM logs_envio WHERE status = 'falha'").catch(() => ({rows: [{count: 0}]})); 

        res.json({
            totalEventos: parseInt(eventosCount.rows[0].count),
            totalBodas: parseInt(bodasCount.rows[0].count),
            totalAniversarios: parseInt(aniversariosCount.rows[0].count),
            gruposAtivos: parseInt(gruposCountRes.rows[0].count),
            lembretesEnviados: parseInt(logsCount.rows[0].count),
            falhasHoje: parseInt(falhasCount.rows[0].count)
        });
    } catch (err) {
        console.error('Erro nas stats:', err);
        res.status(500).json({ erro: 'Erro ao buscar estatísticas' });
    }
});

// ========== LISTAR EVENTOS (com Search + Export CSV) ========== //
router.get('/', async (req, res) => {
    try {
        const { search, exportCsv } = req.query;
        let query = 'SELECT * FROM eventos';
        let params = [];
        
        if (search) {
            query += ' WHERE nomes_principais ILIKE $1 OR tipo_evento ILIKE $1 OR data_evento::text ILIKE $1';
            params.push(`%${search}%`);
        }
        
        query += ' ORDER BY data_evento DESC';
        const { rows } = await req.db.query(query, params);

        if (exportCsv === 'true') {
            const csvRows = ['ID,Nomes,Data,Tipo,Grupo,Foto,Criado Em'];
            rows.forEach(r => {
                const rowStr = `${r.id},"${r.nomes_principais}",${new Date(r.data_evento).toLocaleDateString()},${r.tipo_evento},"${r.grupo_id || 'N/A'}","${r.foto_url || ''}",${new Date(r.criado_em).toLocaleDateString()}`;
                csvRows.push(rowStr);
            });
            res.header('Content-Type', 'text/csv; charset=utf-8');
            res.attachment('lnsotech_eventos.csv');
            return res.send(csvRows.join('\n'));
        }

        res.json(rows);
    } catch (err) {
        console.error('Erro ao buscar eventos:', err);
        res.status(500).json({ erro: 'Erro interno ao buscar eventos' });
    }
});

// ========== FEED ICAL (GOOGLE CALENDAR SYNC) ========== //
router.get('/feed.ics', async (req, res) => {
    try {
        const { rows } = await req.db.query('SELECT * FROM eventos');
        
        let icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//LNSOTECH Events CRM//PT',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'X-WR-CALNAME:Eventos LNSOTECH',
            'X-WR-TIMEZONE:Africa/Maputo',
            'X-WR-CALDESC:Sincronização automática de eventos CRM LNSOTECH'
        ];

        rows.forEach(ev => {
            const dateObj = new Date(ev.data_evento);
            const freq = ev.frequencia_lembrete || 'anual';
            const yearStr = dateObj.getFullYear();
            const monthStr = String(dateObj.getMonth() + 1).padStart(2, '0');
            const dayStr = String(dateObj.getDate()).padStart(2, '0');
            const dtStart = `${yearStr}${monthStr}${dayStr}`;
            
            // Generate RRULE based on frequency
            let rrule = '';
            if (freq === 'anual') rrule = 'RRULE:FREQ=YEARLY';
            else if (freq === 'mensal') rrule = 'RRULE:FREQ=MONTHLY';
            else if (freq === 'semanal') rrule = 'RRULE:FREQ=WEEKLY';
            else if (freq === 'diario') rrule = 'RRULE:FREQ=DAILY';

            const summary = ev.tipo_evento === 'casamento' 
                ? `Bodas: ${ev.nomes_principais}` 
                : `${ev.tipo_evento?.charAt(0).toUpperCase() + ev.tipo_evento?.slice(1)}: ${ev.nomes_principais}`;

            icsContent.push(
                'BEGIN:VEVENT',
                `UID:lnso-evento-${ev.id}@lnsotech.com`,
                `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
                // Make it an all-day event
                `DTSTART;VALUE=DATE:${dtStart}`,
                `SUMMARY:${summary}`,
                `DESCRIPTION:Grupo WhatsApp associado: ${ev.grupo_id || 'N/A'}\\nFrequência: ${freq}`,
                rrule,
                'STATUS:CONFIRMED',
                'END:VEVENT'
            );
        });

        icsContent.push('END:VCALENDAR');

        res.header('Content-Type', 'text/calendar; charset=utf-8');
        res.header('Content-Disposition', 'attachment; filename="lnsotech_eventos.ics"');
        res.send(icsContent.join('\r\n'));

    } catch (error) {
        console.error('Erro ao gerar feed ICS:', error);
        res.status(500).send('Erro ao gerar calendário');
    }
});

// ========== TIPOS DE EVENTOS ========== //
router.get('/tipos', async (req, res) => {
    try {
        const { rows } = await req.db.query('SELECT * FROM tipos_evento ORDER BY nome ASC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({erro: 'Falha buscar tipos de evento'});
    }
});

router.post('/tipos', async (req, res) => {
    const { nome, cor } = req.body;
    const lowerNome = nome.toLowerCase();
    try {
        await req.db.query('BEGIN');
        // 1. Criar o tipo
        await req.db.query('INSERT INTO tipos_evento (nome, cor) VALUES ($1, $2)', [lowerNome, cor || '#3b82f6']);
        // 2. Criar template padrão para este tipo
        await req.db.query(
            'INSERT INTO templates_mensagem (tipo_evento, mensagem) VALUES ($1, $2) ON CONFLICT DO NOTHING', 
            [lowerNome, `Lembrete LNSOTECH: Hoje celebramos {nomes} (${lowerNome})! 🎉`]
        );
        await req.db.query('COMMIT');
        res.json({sucesso: true});
    } catch (error) {
        await req.db.query('ROLLBACK');
        console.error('Erro criar tipo:', error);
        res.status(500).json({erro: 'Falha ao criar tipo de evento. Nome pode já existir.'});
    }
});

router.put('/tipos/:id', async (req, res) => {
    const { nome, cor } = req.body;
    const lowerNome = nome.toLowerCase();
    try {
        // Buscar nome antigo para atualizar referências
        const old = await req.db.query('SELECT nome FROM tipos_evento WHERE id = $1', [req.params.id]);
        if (old.rows.length === 0) return res.status(404).json({erro: 'Tipo não encontrado'});
        
        const oldNome = old.rows[0].nome;

        await req.db.query('BEGIN');
        // 1. Atualizar o tipo
        await req.db.query('UPDATE tipos_evento SET nome = $1, cor = $2 WHERE id = $3', [lowerNome, cor, req.params.id]);
        
        if (lowerNome !== oldNome) {
            // 2. Atualizar eventos associados
            await req.db.query('UPDATE eventos SET tipo_evento = $1 WHERE tipo_evento = $2', [lowerNome, oldNome]);
            // 3. Atualizar templates associados
            await req.db.query('UPDATE templates_mensagem SET tipo_evento = $1 WHERE tipo_evento = $2', [lowerNome, oldNome]);
        }
        
        await req.db.query('COMMIT');
        res.json({sucesso: true});
    } catch (error) {
        await req.db.query('ROLLBACK');
        res.status(500).json({erro: 'Falha ao atualizar tipo de evento'});
    }
});

router.delete('/tipos/:id', async (req, res) => {
    try {
        const old = await req.db.query('SELECT nome FROM tipos_evento WHERE id = $1', [req.params.id]);
        if (old.rows.length > 0) {
            const nome = old.rows[0].nome;
            await req.db.query('BEGIN');
            await req.db.query('DELETE FROM tipos_evento WHERE id = $1', [req.params.id]);
            await req.db.query('DELETE FROM templates_mensagem WHERE tipo_evento = $1', [nome]);
            await req.db.query('COMMIT');
        } else {
            await req.db.query('DELETE FROM tipos_evento WHERE id = $1', [req.params.id]);
        }
        res.json({sucesso: true});
    } catch (error) {
        await req.db.query('ROLLBACK');
        res.status(500).json({erro: 'Falha ao apagar tipo de evento'});
    }
});

// ========== TEMPLATES DE MENSAGENS ========== //
router.get('/templates', async (req, res) => {
    try {
        const { rows } = await req.db.query('SELECT * FROM templates_mensagem ORDER BY tipo_evento ASC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({erro: 'Falha buscar templates'});
    }
});

router.put('/templates/:id', async (req, res) => {
    const { mensagem } = req.body;
    try {
        await req.db.query('UPDATE templates_mensagem SET mensagem = $1, atualizado_em = CURRENT_TIMESTAMP WHERE id = $2', [mensagem, req.params.id]);
        res.json({sucesso: true});
    } catch (error) {
        res.status(500).json({erro: 'Falha atualizar template'});
    }
});

// ========== EDITAR EVENTO (PUT com Histórico) ========== //
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { nomes_principais, data_evento, tipo_evento, grupo_id, frequencia_lembrete, prioridade, usuario_id } = req.body;

    try {
        // 1. Buscar dados atuais para o histórico
        const oldState = await req.db.query('SELECT * FROM eventos WHERE id = $1', [id]);
        if (oldState.rows.length === 0) return res.status(404).json({ erro: 'Evento não encontrado' });

        // 2. Atualizar evento
        const query = `
            UPDATE eventos 
            SET nomes_principais = $1, data_evento = $2, tipo_evento = $3, 
                grupo_id = $4, frequencia_lembrete = $5, prioridade = $6,
                atualizado_em = CURRENT_TIMESTAMP
            WHERE id = $7
        `;
        await req.db.query(query, [nomes_principais, data_evento, tipo_evento, grupo_id, frequencia_lembrete, prioridade || 'normal', id]);

        // 3. Registar no histórico
        await req.db.query(
            'INSERT INTO historico_eventos (evento_id, usuario_id, dados_anteriores, dados_novos) VALUES ($1, $2, $3, $4)',
            [id, usuario_id, JSON.stringify(oldState.rows[0]), JSON.stringify(req.body)]
        );

        res.json({ mensagem: 'Evento atualizado com sucesso' });
    } catch (err) {
        console.error('Erro ao atualizar evento:', err);
        res.status(500).json({ erro: 'Erro ao atualizar evento' });
    }
});

// ========== HISTÓRICO DE UM EVENTO ========== //
router.get('/:id/historico', async (req, res) => {
    try {
        const query = `
            SELECT h.*, u.nome as usuario_nome 
            FROM historico_eventos h
            LEFT JOIN usuarios u ON h.usuario_id = u.id
            WHERE h.evento_id = $1
            ORDER BY h.data_alteracao DESC
        `;
        const { rows } = await req.db.query(query, [req.params.id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: 'Falha buscar histórico' });
    }
});

// ========== CRIAR EVENTO (POST) ========== //
router.post('/', async (req, res) => {
    const { nomes_principais, data_evento, tipo_evento, grupo_id, criado_por, frequencia_lembrete, prioridade } = req.body;
    try {
        const query = `
            INSERT INTO eventos (nomes_principais, data_evento, tipo_evento, grupo_id, criado_por, frequencia_lembrete, prioridade)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
        `;
        const { rows } = await req.db.query(query, [
            nomes_principais, 
            data_evento, 
            tipo_evento || 'casamento', 
            grupo_id, 
            criado_por, 
            frequencia_lembrete || 'anual',
            prioridade || 'normal'
        ]);
        res.status(201).json({ mensagem: 'Evento criado com sucesso', id: rows[0].id });
    } catch (err) {
        console.error('Erro ao criar evento:', err.message);
        res.status(500).json({ erro: 'Erro ao salvar: ' + err.message });
    }
});

// ========== APAGAR EVENTO ========== //
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await req.db.query('DELETE FROM eventos WHERE id = $1', [id]);
        res.json({ mensagem: 'Evento apagado com sucesso' });
    } catch (err) {
        console.error('Erro ao deletar evento:', err);
        res.status(500).json({ erro: 'Erro interno ao deletar evento' });
    }
});

// ========== UPLOAD DE FOTO ========== //
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB max

router.post('/:id/foto', upload.single('foto'), async (req, res) => {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ erro: 'Nenhuma foto enviada' });

    const fotoUrl = `/uploads/${req.file.filename}`;
    
    try {
        await req.db.query('UPDATE eventos SET foto_url = $1 WHERE id = $2', [fotoUrl, id]);
        res.json({ mensagem: 'Foto anexada com sucesso', fotoUrl });
    } catch (err) {
        console.error('Erro ao salvar foto:', err);
        res.status(500).json({ erro: 'Erro ao atualizar base de dados' });
    }
});

// ========== IMPORT CSV ========== //
const uploadCSV = multer({ dest: path.join(__dirname, '../uploads/tmp/') });

router.post('/importar', uploadCSV.single('csv'), async (req, res) => {
    if (!req.file) return res.status(400).json({ erro: 'Nenhum ficheiro CSV enviado' });

    try {
        const csvContent = fs.readFileSync(req.file.path, 'utf-8');
        const lines = csvContent.split('\n').filter(l => l.trim());
        
        // Ignorar cabeçalho se existir
        const startIndex = lines[0].toLowerCase().includes('nome') ? 1 : 0;
        let imported = 0;
        let errors = 0;

        for (let i = startIndex; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.replace(/"/g, '').trim());
            // Espera formato: Nomes, Data, Tipo, Grupo (mínimo 2 colunas)
            if (cols.length < 2) { errors++; continue; }
            
            const nomes = cols[0];
            const data = cols[1];
            const tipo = cols[2] || 'casamento';
            const grupo = cols[3] || 'Importacao_CSV';

            try {
                await req.db.query(
                    'INSERT INTO eventos (nomes_principais, data_evento, tipo_evento, grupo_id) VALUES ($1, $2, $3, $4)',
                    [nomes, data, tipo, grupo]
                );
                imported++;
            } catch (e) {
                errors++;
            }
        }

        // Limpar ficheiro temporário
        fs.unlinkSync(req.file.path);

        res.json({ mensagem: `Importação concluída: ${imported} registos importados, ${errors} erros.`, imported, errors });
    } catch (err) {
        console.error('Erro na importação CSV:', err);
        res.status(500).json({ erro: 'Falha ao processar CSV' });
    }
});

// ========== LOGS DETALHADOS ========== //
router.get('/logs', async (req, res) => {
    try {
        const { rows } = await req.db.query('SELECT * FROM logs_envio ORDER BY criado_em DESC LIMIT 100');
        res.json(rows);
    } catch (error) {
        res.status(500).json({erro: 'Falha ao buscar logs'});
    }
});

router.delete('/logs', async (req, res) => {
    try {
        await req.db.query('BEGIN');
        await req.db.query('DELETE FROM logs_envio');
        await req.db.query('DELETE FROM historico_eventos');
        await req.db.query('COMMIT');
        res.json({ sucesso: true, mensagem: 'Histórico limpo' });
    } catch (error) {
        await req.db.query('ROLLBACK');
        res.status(500).json({ erro: 'Falha ao limpar' });
    }
});

// Rota de fallback usando POST (mais compatível com alguns proxies/firewalls)
router.post('/logs/limpar', async (req, res) => {
    try {
        await req.db.query('BEGIN');
        await req.db.query('DELETE FROM logs_envio');
        await req.db.query('DELETE FROM historico_eventos');
        await req.db.query('COMMIT');
        res.json({ sucesso: true, mensagem: 'Histórico completo limpo via POST' });
    } catch (error) {
        await req.db.query('ROLLBACK');
        console.error('Erro ao limpar logs (POST):', error);
        res.status(500).json({ erro: 'Falha ao limpar histórico via POST' });
    }
});

// ========== DISPARO MANUAL DE LEMBRETES (REAL) ========== //
router.post('/testar-lembretes', async (req, res) => {
    try {
        if (global.waSocket) {
            const { executarLembretes } = require('../bot/engine');
            const total = await executarLembretes(global.waSocket, true); // true = force manual
            res.json({ mensagem: `Lembretes disparados manualmente com sucesso! Total: ${total}` });
        } else {
            res.status(503).json({ erro: 'WhatsApp não está conectado ao Bot.' });
        }
    } catch (err) {
        console.error('Erro lembretes manuais:', err);
        res.status(500).json({ erro: err.message });
    }
});

// ========== LISTAR GRUPOS WHATSAPP ========== //
router.get('/grupos', async (req, res) => {
    try {
        if (!global.waSocket) {
            return res.status(503).json({ erro: 'Bot não está conectado ao WhatsApp' });
        }
        const groups = await global.waSocket.groupFetchAllParticipating();
        const groupsArray = Object.values(groups).map(g => ({
            id: g.id,
            nome: g.subject,
            participantes: g.participants?.length || 0,
            descricao: g.desc || ''
        }));
        res.json(groupsArray);
    } catch (err) {
        console.error('Erro ao listar grupos:', err);
        res.status(500).json({ erro: 'Falha ao obter grupos' });
    }
});

// ========== TESTAR COMUNICAÇÃO COM GRUPO ESPECÍFICO ========== //
router.post('/teste-conexao', async (req, res) => {
    try {
        const { grupo_id } = req.body;
        if (!grupo_id) return res.status(400).json({ erro: 'ID do grupo é necessário' });
        
        if (!global.waSocket) {
            return res.status(503).json({ erro: 'Bot não está conectado ao WhatsApp' });
        }

        await global.waSocket.sendMessage(grupo_id, { 
            text: '🤖 *LNSOTECH BOT - TESTE DE COMUNICAÇÃO*\n\n✅ A conexão com este grupo está ativa e funcionando perfeitamente!' 
        });

        res.json({ mensagem: 'Mensagem de teste enviada com sucesso!' });
    } catch (err) {
        console.error('Erro no teste de conexão:', err);
        res.status(500).json({ erro: 'Falha ao enviar mensagem de teste: ' + err.message });
    }
});
// ========== ESTADO DA CONEXÃO WHATSAPP + QR CODE ========== //
router.get('/whatsapp-status', (req, res) => {
    res.json(global.waState || { qr: null, status: 'desconhecido', lastUpdate: null });
});

// ========== RECONECTAR WHATSAPP (gera novo QR) ========== //
router.post('/whatsapp-reconectar', async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const authDir = path.resolve(__dirname, '../../auth_info_baileys');
        
        // Em vez de apagar a pasta toda (que está montada em volume Docker e dá EBUSY), limpamos o conteúdo
        if (fs.existsSync(authDir)) {
            const files = fs.readdirSync(authDir);
            for (const file of files) {
                try {
                    fs.rmSync(path.join(authDir, file), { recursive: true, force: true });
                } catch (e) {
                    console.log(`[Reconectar] Aviso ao apagar ${file}:`, e.message);
                }
            }
            console.log('[Admin] Conteúdo da sessão WhatsApp apagado para reconexão');
        }

        // Se o socket existe, tentamos fazer logout (destrói as credenciais com mais segurança, se estiver logado)
        if (global.waSocket) {
            try { await global.waSocket.logout(); } catch(e) {}
        }
        
        global.waState = { qr: null, status: 'a_reconectar', lastUpdate: new Date().toISOString() };
        
        // Reiniciar o bot (o próprio Docker vai reiniciar o container)
        res.json({ mensagem: 'Sessão apagada! O sistema vai reiniciar para gerar novo QR Code (pode demorar 10 a 20 segundos).' });
        
        // Forçar saída para o Docker reiniciar o container
        setTimeout(() => { process.exit(0); }, 2000);
    } catch (err) {
        res.status(500).json({ erro: 'Falha: ' + err.message });
    }
});

module.exports = router;
