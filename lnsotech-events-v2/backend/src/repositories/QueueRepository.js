const db = require('../config/database');

class QueueRepository {
    async enqueue(botId, grupoId, mensagem, fotoUrl, prioridade = 0) {
        const query = `
            INSERT INTO mensagens_fila (bot_id, grupo_id, mensagem, foto_url, prioridade)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;
        const { rows } = await db.query(query, [botId, grupoId, mensagem, fotoUrl, prioridade]);
        return rows[0];
    }

    async getNextPending(limit = 1) {
        const query = `
            SELECT * FROM mensagens_fila 
            WHERE status = 'pendente' 
            AND agendado_para <= CURRENT_TIMESTAMP
            ORDER BY prioridade DESC, criado_em ASC
            LIMIT $1
            FOR UPDATE SKIP LOCKED
        `;
        const { rows } = await db.query(query, [limit]);
        return rows;
    }

    async updateStatus(id, status, erro = null) {
        const query = `
            UPDATE mensagens_fila 
            SET status = $1, 
                erro = $2, 
                enviado_em = CASE WHEN $1 = 'enviado' THEN CURRENT_TIMESTAMP ELSE enviado_em END,
                tentativas = tentativas + 1
            WHERE id = $3
        `;
        await db.query(query, [status, erro, id]);
    }

    async resetFailed() {
        await db.query("UPDATE mensagens_fila SET status = 'pendente' WHERE status = 'erro' AND tentativas < 3");
    }
}

module.exports = new QueueRepository();
