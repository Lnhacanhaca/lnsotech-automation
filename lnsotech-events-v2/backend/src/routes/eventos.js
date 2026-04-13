const express = require('express');
const router = express.Router();

// Estatísticas reais para os Cartões
router.get('/stats', async (req, res) => {
    try {
        const eventosCount = await req.db.query('SELECT COUNT(*) FROM eventos');
        const bodasCount = await req.db.query("SELECT COUNT(*) FROM eventos WHERE tipo_evento = 'casamento'");
        const aniversariosCount = await req.db.query("SELECT COUNT(*) FROM eventos WHERE tipo_evento = 'aniversario'");
        const gruposCountRes = await req.db.query("SELECT COUNT(DISTINCT grupo_id) FROM eventos WHERE grupo_id IS NOT NULL");
        // Se a tabela logs_envio não existir ou não estiver povoada, fazemos count de logs ou mock para agora
        const logsCount = await req.db.query("SELECT COUNT(*) FROM logs_envio").catch(() => ({rows: [{count: 0}]})); 

        res.json({
            totalEventos: parseInt(eventosCount.rows[0].count),
            totalBodas: parseInt(bodasCount.rows[0].count),
            totalAniversarios: parseInt(aniversariosCount.rows[0].count),
            gruposAtivos: parseInt(gruposCountRes.rows[0].count),
            lembretesEnviados: parseInt(logsCount.rows[0].count)
        });
    } catch (err) {
        console.error('Erro nas stats:', err);
        res.status(500).json({ erro: 'Erro ao buscar estastísticas' });
    }
});

// Exportação CSV e Listar
router.get('/', async (req, res) => {
    try {
        const { search, exportCsv } = req.query;
        let query = 'SELECT * FROM eventos';
        let params = [];
        
        if (search) {
            query += ' WHERE nomes_principais ILIKE $1 OR data_evento::text ILIKE $1';
            params.push(`%${search}%`);
        }
        
        query += ' ORDER BY data_evento DESC';
        const { rows } = await req.db.query(query, params);

        if (exportCsv === 'true') {
            const csvRows = ['ID,Nomes,Data,Tipo,Grupo,Criado Em'];
            rows.forEach(r => {
                const rowStr = `${r.id},"${r.nomes_principais}",${new Date(r.data_evento).toLocaleDateString()},${r.tipo_evento},${r.grupo_id || 'N/A'},${new Date(r.criado_em).toLocaleDateString()}`;
                csvRows.push(rowStr);
            });
            res.header('Content-Type', 'text/csv');
            res.attachment('lnsotech_eventos.csv');
            return res.send(csvRows.join('\n'));
        }

        res.json(rows);
    } catch (err) {
        console.error('Erro ao buscar eventos:', err);
        res.status(500).json({ erro: 'Erro interno ao buscar eventos' });
    }
});

// ==== TEMPLATES DE MENSAGENS ==== //
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
        await req.db.query('UPDATE templates_mensagem SET mensagem = $1 WHERE id = $2', [mensagem, req.params.id]);
        res.json({sucesso: true});
    } catch (error) {
        res.status(500).json({erro: 'Falha atualizar template'});
    }
});

// Adicionar um novo evento manualmente via painel
router.post('/', async (req, res) => {
    const { nomes_principais, data_evento, tipo_evento, grupo_id, criado_por } = req.body;
    try {
        const query = `
            INSERT INTO eventos (nomes_principais, data_evento, tipo_evento, grupo_id, criado_por)
            VALUES ($1, $2, $3, $4, $5) RETURNING id
        `;
        const { rows } = await req.db.query(query, [nomes_principais, data_evento, tipo_evento, grupo_id, criado_por]);
        res.status(201).json({ mensagem: 'Evento criado com sucesso', id: rows[0].id });
    } catch (err) {
        console.error('Erro ao criar evento:', err);
        res.status(500).json({ erro: 'Erro interno ao salvar evento' });
    }
});

// Deletar um evento
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

// Upload de foto do evento usando Multer
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads/')),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

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

module.exports = router;
