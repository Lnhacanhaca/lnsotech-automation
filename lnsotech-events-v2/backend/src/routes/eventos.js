const express = require('express');
const router = express.Router();

// Listar todos os eventos
router.get('/', async (req, res) => {
    try {
        const { rows } = await req.db.query('SELECT * FROM eventos ORDER BY data_evento DESC');
        res.json(rows);
    } catch (err) {
        console.error('Erro ao buscar eventos:', err);
        res.status(500).json({ erro: 'Erro interno ao buscar eventos' });
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
