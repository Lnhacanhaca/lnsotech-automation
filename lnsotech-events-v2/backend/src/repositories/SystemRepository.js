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

    // Gestão de Grupos
    async findAllGruposMuted() {
        const { rows } = await db.query('SELECT * FROM grupos_config WHERE is_muted = TRUE');
        return rows;
    }

    async toggleGrupoMute(grupo_id, nome, is_muted, usuario_id) {
        const res = await db.query('UPDATE grupos_config SET is_muted = $1, nome = $2, atualizado_em = CURRENT_TIMESTAMP WHERE grupo_id = $3', [is_muted, nome, grupo_id]);
        if (res.rowCount === 0) {
            await db.query('INSERT INTO grupos_config (grupo_id, nome, is_muted) VALUES ($1, $2, $3)', [grupo_id, nome, is_muted]);
        }
        
        // Adicionar ao histórico de auditoria
        const acao = is_muted ? 'DESCONECTADO (Silenciado)' : 'CONECTADO (Ativado)';
        await db.query(
            'INSERT INTO logs_envio (grupo_id, tipo_log, mensagem, status) VALUES ($1, $2, $3, $4)',
            [grupo_id, 'config_grupo', `Grupo "${nome}" foi ${acao}`, 'sucesso']
        );
    }

    async saveGruposFromBot(botId, groups) {
        for (const g of groups) {
            const res = await db.query(
                'UPDATE grupos_config SET nome = $1, last_seen_by_bot_id = $2, atualizado_em = CURRENT_TIMESTAMP WHERE grupo_id = $3',
                [g.nome, botId, g.id]
            );
            if (res.rowCount === 0) {
                await db.query(
                    'INSERT INTO grupos_config (grupo_id, nome, last_seen_by_bot_id) VALUES ($1, $2, $3)',
                    [g.id, g.nome, botId]
                );
            }
        }
    }

    async findGruposByBot(botId) {
        const { rows } = await db.query('SELECT grupo_id as id, nome, is_muted FROM grupos_config WHERE last_seen_by_bot_id = $1', [botId]);
        return rows;
    }

    async bulkMuteGrupos(groupIds, botId = null) {
        if (botId) {
            await db.query('UPDATE grupos_config SET is_muted = TRUE, atualizado_em = CURRENT_TIMESTAMP WHERE last_seen_by_bot_id = $1', [botId]);
        } else if (groupIds && groupIds.length > 0) {
            await db.query('UPDATE grupos_config SET is_muted = TRUE, atualizado_em = CURRENT_TIMESTAMP WHERE grupo_id = ANY($1)', [groupIds]);
        }
    }

    async getAnalyticsStats() {
        const stats = {};
        
        // Sucesso vs Erro
        const logRes = await db.query(`
            SELECT tipo_log, status, COUNT(*) as total 
            FROM logs_envio 
            WHERE tipo_log IN ('envio_sucesso', 'envio_erro', 'auto_resposta')
            GROUP BY tipo_log, status
        `);
        stats.logs = logRes.rows;

        // Volume por Bot (estimado via logs de envio_sucesso)
        const botRes = await db.query(`
            SELECT mensagem, COUNT(*) as total 
            FROM logs_envio 
            WHERE tipo_log = 'envio_sucesso' 
            GROUP BY mensagem
        `); // Nota: mensagem contém o nome do bot nas versões atuais, mas idealmente usaríamos bot_id
        stats.bots = botRes.rows;

        return stats;
    }

    async predictFutureEvents(days = 30) {
        // Busca todos os eventos para processar recorrências localmente
        const { rows: eventos } = await db.query("SELECT nomes_principais, data_evento, tipo_evento, frequencia_lembrete FROM eventos");
        const predictions = [];
        const today = new Date();
        const end = new Date();
        end.setDate(today.getDate() + days);

        for (let d = new Date(today); d <= end; d.setDate(d.getDate() + 1)) {
            const dStr = d.toISOString().split('T')[0];
            const dShort = dStr.substring(5); // MM-DD

            eventos.forEach(ev => {
                const evDate = new Date(ev.data_evento);
                const evShort = ev.data_evento.toISOString().split('T')[0].substring(5);
                const freq = ev.frequencia_lembrete?.toLowerCase() || 'anual';

                let match = false;
                if (freq === 'diario') match = true;
                else if (freq === 'semanal' && d.getDay() === evDate.getDay()) match = true;
                else if (freq === 'mensal' && d.getDate() === evDate.getDate()) match = true;
                else if (freq === 'anual' && dShort === evShort) match = true;

                if (match) {
                    predictions.push({ date: dStr, type: ev.tipo_evento });
                }
            });
        }

        // Agrupar por data para o gráfico
        const aggregated = {};
        predictions.forEach(p => {
            aggregated[p.date] = (aggregated[p.date] || 0) + 1;
        });

        return Object.entries(aggregated).map(([date, count]) => ({ date, count })).sort((a,b) => a.date.localeCompare(b.date));
    }

    // Feedback
    async createFeedback(usuario_id, nota, comentario, modulo) {
        await db.query(
            'INSERT INTO feedbacks (usuario_id, nota, comentario, modulo) VALUES ($1, $2, $3, $4)',
            [usuario_id, nota, comentario, modulo]
        );
    }

    async findAllFeedbacks() {
        const { rows } = await db.query(`
            SELECT f.*, u.nome as usuario_nome 
            FROM feedbacks f 
            JOIN usuarios u ON f.usuario_id = u.id 
            ORDER BY f.criado_em DESC
        `);
        return rows;
    }

    // Inicialização de tabelas extras (se necessário)
    async initSystem() {
        await db.query(`
            CREATE TABLE IF NOT EXISTS feedbacks (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
                nota INTEGER CHECK (nota >= 1 AND nota <= 5),
                comentario TEXT,
                modulo VARCHAR(50),
                criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }
}

module.exports = new SystemRepository();
