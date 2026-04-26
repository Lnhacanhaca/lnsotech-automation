const db = require('../config/database');

class EventoRepository {
    async findAll(search = '') {
        let query = 'SELECT * FROM eventos';
        let params = [];
        
        if (search) {
            query += ' WHERE nomes_principais ILIKE $1 OR tipo_evento ILIKE $1 OR data_evento::text ILIKE $1';
            params.push(`%${search}%`);
        }
        
        query += ' ORDER BY data_evento DESC';
        const { rows } = await db.query(query, params);
        return rows;
    }

    async findById(id) {
        const { rows } = await db.query('SELECT * FROM eventos WHERE id = $1', [id]);
        return rows[0];
    }

    async create(dados) {
        const { nomes_principais, data_evento, tipo_evento, grupo_id, criado_por, frequencia_lembrete, prioridade } = dados;
        const query = `
            INSERT INTO eventos (nomes_principais, data_evento, tipo_evento, grupo_id, criado_por, frequencia_lembrete, prioridade)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
        `;
        const { rows } = await db.query(query, [
            nomes_principais, 
            data_evento, 
            tipo_evento || 'casamento', 
            grupo_id, 
            criado_por, 
            frequencia_lembrete || 'anual',
            prioridade || 'normal'
        ]);
        return rows[0].id;
    }

    async update(id, dados) {
        const { nomes_principais, data_evento, tipo_evento, grupo_id, frequencia_lembrete, prioridade } = dados;
        const query = `
            UPDATE eventos 
            SET nomes_principais = $1, data_evento = $2, tipo_evento = $3, 
                grupo_id = $4, frequencia_lembrete = $5, prioridade = $6,
                atualizado_em = CURRENT_TIMESTAMP
            WHERE id = $7
        `;
        await db.query(query, [nomes_principais, data_evento, tipo_evento, grupo_id, frequencia_lembrete, prioridade || 'normal', id]);
    }

    async delete(id) {
        await db.query('DELETE FROM eventos WHERE id = $1', [id]);
    }

    async updateFoto(id, fotoUrl) {
        await db.query('UPDATE eventos SET foto_url = $1 WHERE id = $2', [fotoUrl, id]);
    }

    async getStats() {
        const queries = {
            totalEventos: 'SELECT COUNT(*) FROM eventos',
            totalBodas: "SELECT COUNT(*) FROM eventos WHERE tipo_evento = 'casamento'",
            totalAniversarios: "SELECT COUNT(*) FROM eventos WHERE tipo_evento = 'aniversario'",
            gruposAtivos: `
                SELECT COUNT(DISTINCT e.grupo_id) 
                FROM eventos e
                LEFT JOIN grupos_config g ON e.grupo_id = g.grupo_id
                WHERE e.grupo_id IS NOT NULL 
                AND (g.is_muted IS FALSE OR g.is_muted IS NULL)
            `,
            lembretesEnviados: "SELECT COUNT(*) FROM logs_envio WHERE tipo_log IN ('lembrete_enviado', 'envio_sucesso')",
            falhasHoje: "SELECT COUNT(*) FROM logs_envio WHERE status = 'falha'"
        };

        const results = {};
        for (const [key, sql] of Object.entries(queries)) {
            const res = await db.query(sql).catch(() => ({ rows: [{ count: 0 }] }));
            results[key] = parseInt(res.rows[0].count);
        }
        return results;
    }

    // Historico
    async getHistorico(eventoId) {
        const query = `
            SELECT h.*, u.nome as usuario_nome 
            FROM historico_eventos h
            LEFT JOIN usuarios u ON h.usuario_id = u.id
            WHERE h.evento_id = $1
            ORDER BY h.data_alteracao DESC
        `;
        const { rows } = await db.query(query, [eventoId]);
        return rows;
    }

    async addHistorico(eventoId, usuarioId, oldData, newData) {
        await db.query(
            'INSERT INTO historico_eventos (evento_id, usuario_id, dados_anteriores, dados_novos) VALUES ($1, $2, $3, $4)',
            [eventoId, usuarioId, JSON.stringify(oldData), JSON.stringify(newData)]
        );
    }
}

module.exports = new EventoRepository();
