const db = require('../config/database');

class SystemRepository {
    // Tipos de Evento
    async findAllTipos() {
        const { rows } = await db.query('SELECT * FROM tipos_evento ORDER BY nome ASC');
        return rows;
    }

    async createTipo(nome, cor, template_resposta) {
        await db.pool.query('BEGIN');
        try {
            await db.query('INSERT INTO tipos_evento (nome, cor, template_resposta) VALUES ($1, $2, $3)', [nome, cor, template_resposta]);
            await db.query(
                'INSERT INTO templates_mensagem (tipo_evento, mensagem) VALUES ($1, $2) ON CONFLICT DO NOTHING', 
                [nome, `Lembrete LNSOTECH: Hoje celebramos {nomes} (${nome})! 🎉`]
            );
            await db.pool.query('COMMIT');
        } catch (e) {
            await db.pool.query('ROLLBACK');
            throw e;
        }
    }

    async updateTipo(id, nome, cor, template_resposta) {
        const old = await db.query('SELECT nome FROM tipos_evento WHERE id = $1', [id]);
        if (old.rows.length === 0) throw new Error('Tipo não encontrado');
        
        const oldNome = old.rows[0].nome;
        await db.pool.query('BEGIN');
        try {
            await db.query('UPDATE tipos_evento SET nome = $1, cor = $2, template_resposta = $3 WHERE id = $4', [nome, cor, template_resposta, id]);
            if (nome !== oldNome) {
                await db.query('UPDATE eventos SET tipo_evento = $1 WHERE tipo_evento = $2', [nome, oldNome]);
                await db.query('UPDATE templates_mensagem SET tipo_evento = $1 WHERE tipo_evento = $2', [nome, oldNome]);
            }
            await db.pool.query('COMMIT');
        } catch (e) {
            await db.pool.query('ROLLBACK');
            throw e;
        }
    }

    async deleteTipo(id) {
        const old = await db.query('SELECT nome FROM tipos_evento WHERE id = $1', [id]);
        await db.pool.query('BEGIN');
        try {
            if (old.rows.length > 0) {
                const nome = old.rows[0].nome;
                await db.query('DELETE FROM tipos_evento WHERE id = $1', [id]);
                await db.query('DELETE FROM templates_mensagem WHERE tipo_evento = $1', [nome]);
            } else {
                await db.query('DELETE FROM tipos_evento WHERE id = $1', [id]);
            }
            await db.pool.query('COMMIT');
        } catch (e) {
            await db.pool.query('ROLLBACK');
            throw e;
        }
    }

    // Templates
    async findAllTemplates() {
        const { rows } = await db.query('SELECT * FROM templates_mensagem ORDER BY tipo_evento ASC');
        return rows;
    }

    async updateTemplate(id, mensagem) {
        await db.query('UPDATE templates_mensagem SET mensagem = $1, atualizado_em = CURRENT_TIMESTAMP WHERE id = $2', [mensagem, id]);
    }

    // Logs
    async findAllLogs(limit = 100) {
        const { rows } = await db.query('SELECT * FROM logs_envio ORDER BY criado_em DESC LIMIT $1', [limit]);
        return rows;
    }

    async deleteAllLogs() {
        await db.query('DELETE FROM logs_envio');
        await db.query('DELETE FROM historico_eventos');
    }

    async deleteLog(id) {
        await db.query('DELETE FROM logs_envio WHERE id = $1', [id]);
    }

    async cleanOldLogs(days = 7) {
        await db.query(`DELETE FROM logs_envio WHERE criado_em < NOW() - INTERVAL '$1 days'`, [days]);
    }

    // Configurações
    async findAllConfigs() {
        const result = await db.query('SELECT * FROM configuracoes');
        const configs = {};
        result.rows.forEach(r => configs[r.chave] = r.valor);
        return configs;
    }

    async upsertConfig(chave, valor) {
        const resUpnd = await db.query('UPDATE configuracoes SET valor = $1 WHERE chave = $2', [valor, chave]);
        if (resUpnd.rowCount === 0) {
            await db.query('INSERT INTO configuracoes (chave, valor) VALUES ($1, $2)', [chave, valor]);
        }
    }
}

module.exports = new SystemRepository();
