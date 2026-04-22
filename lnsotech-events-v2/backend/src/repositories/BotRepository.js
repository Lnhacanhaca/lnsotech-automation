const db = require('../config/database');

class BotRepository {
    async findAll() {
        const { rows } = await db.query('SELECT * FROM whatsapp_bots ORDER BY id ASC');
        return rows;
    }

    async findById(id) {
        const { rows } = await db.query('SELECT * FROM whatsapp_bots WHERE id = $1', [id]);
        return rows[0];
    }

    async create(nome, tipos_permitidos = []) {
        const pasta = `session_bot_${Date.now()}`;
        const { rows } = await db.query(
            'INSERT INTO whatsapp_bots (nome, pasta_sessao, tipos_permitidos) VALUES ($1, $2, $3) RETURNING *',
            [nome, pasta, JSON.stringify(tipos_permitidos)]
        );
        return rows[0];
    }

    async update(id, nome, tipos_permitidos) {
        await db.query(
            'UPDATE whatsapp_bots SET nome = $1, tipos_permitidos = $2 WHERE id = $3',
            [nome, JSON.stringify(tipos_permitidos), id]
        );
    }

    async updateStatus(id, status) {
        await db.query('UPDATE whatsapp_bots SET status = $1 WHERE id = $2', [status, id]);
    }

    async delete(id) {
        await db.query('DELETE FROM whatsapp_bots WHERE id = $1', [id]);
    }
}

module.exports = new BotRepository();
