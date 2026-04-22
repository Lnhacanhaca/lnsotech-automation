const QueueRepository = require('../repositories/QueueRepository');
const db = require('../config/database');

class NotificationService {
    async notifyHealthIssue(botName, issue) {
        console.warn(`🚨 [Notificação] Saúde do Bot ${botName}: ${issue}`);
        
        // 1. Registar na base de dados
        await db.query(
            'INSERT INTO logs_envio (tipo_log, mensagem, status) VALUES ($1, $2, $3)',
            ['alerta_sistema', `ERRO SAÚDE BOT (${botName}): ${issue}`, 'erro']
        );

        // 2. Futuro: Enviar para Telegram ou WhatsApp de Admin
        // const adminPhone = await this.getAdminPhone();
        // if (adminPhone) { ... }
    }

    async getAdminPhone() {
        const res = await db.query("SELECT valor FROM configuracoes WHERE chave = 'telefone_admin_alertas'");
        return res.rows[0]?.valor;
    }
}

module.exports = new NotificationService();
