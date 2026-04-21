const db = require('../config/database');

class AuditService {
    async log(usuario_id, nome_usuario, acao, entidade, detalhes) {
        try {
            await db.query(
                'INSERT INTO auditoria (usuario_id, nome_usuario, acao, entidade, detalhes) VALUES ($1, $2, $3, $4, $5)',
                [usuario_id || null, nome_usuario || 'Sistema', acao, entidade, detalhes]
            );
        } catch (error) {
            console.error('Erro ao registar auditoria:', error);
        }
    }

    async obterLogs(limit = 100) {
        const { rows } = await db.query('SELECT * FROM auditoria ORDER BY data_hora DESC LIMIT $1', [limit]);
        return rows;
    }
}

module.exports = new AuditService();
