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

// ========== CRIAR EVENTO (POST) ========== //
router.post('/', async (req, res) => {
    const { nomes_principais, data_evento, tipo_evento, grupo_id, criado_por } = req.body;
    try {
        const query = `
            INSERT INTO eventos (nomes_principais, data_evento, tipo_evento, grupo_id, criado_por)
            VALUES ($1, $2, $3, $4, $5) RETURNING id
        `;
        const { rows } = await req.db.query(query, [nomes_principais, data_evento, tipo_evento || 'casamento', grupo_id, criado_por]);
        res.status(201).json({ mensagem: 'Evento criado com sucesso', id: rows[0].id });
    } catch (err) {
        console.error('Erro ao criar evento:', err);
        res.status(500).json({ erro: 'Erro interno ao salvar evento' });
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
        const uploadDir = path.join(__dirname, '../uploads/');
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

// ========== TESTE DE CONEXÃO MANUAL (Admin) ========== //
router.post('/teste-conexao', async (req, res) => {
    const { grupo_id } = req.body;
    try {
        if (global.waSocket) {
            const targetGroup = grupo_id || process.env.GRUPO_ID;
            await global.waSocket.sendMessage(targetGroup, { text: "🤖 Teste de conexão manual: O bot está ativo!" });
            
            // Registar log
            await req.db.query(
                'INSERT INTO logs_envio (grupo_id, tipo_log, mensagem, status) VALUES ($1, $2, $3, $4)',
                [targetGroup, 'teste_manual', 'Teste de conexão via painel admin', 'sucesso']
            );
            
            res.json({ sucesso: true, mensagem: 'Mensagem de teste enviada!' });
        } else {
            res.status(503).json({ erro: 'Bot não está conectado ao WhatsApp' });
        }
    } catch (err) {
        res.status(500).json({ erro: 'Falha ao enviar teste: ' + err.message });
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
        
        // Apagar sessão para forçar novo QR
        if (fs.existsSync(authDir)) {
            fs.rmSync(authDir, { recursive: true, force: true });
            console.log('[Admin] Sessão WhatsApp apagada para reconexão');
        }
        
        global.waState = { qr: null, status: 'a_reconectar', lastUpdate: new Date().toISOString() };
        
        // Reiniciar o bot (o próprio Docker vai reiniciar o container)
        res.json({ mensagem: 'Sessão apagada! O container vai reiniciar automaticamente. Aguarde o novo QR Code aparecer no painel (pode demorar 10-30 segundos).' });
        
        // Forçar saída para o Docker reiniciar o container
        setTimeout(() => { process.exit(0); }, 2000);
    } catch (err) {
        res.status(500).json({ erro: 'Falha: ' + err.message });
    }
});

module.exports = router;
