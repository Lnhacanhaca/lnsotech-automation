const BotService = require('../services/BotService');

class BotController {
    async listBots(req, res) {
        try {
            const bots = await BotService.listBots();
            res.json(bots);
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    }

    async createBot(req, res) {
        try {
            const { nome, tipos_permitidos } = req.body;
            const bot = await BotService.createBot(nome, tipos_permitidos);
            res.status(201).json(bot);
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    }

    async updateBot(req, res) {
        try {
            const { nome, tipos_permitidos } = req.body;
            await BotService.updateBot(req.params.id, nome, tipos_permitidos);
            res.json({ mensagem: 'Bot atualizado com sucesso' });
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    }

    async deleteBot(req, res) {
        try {
            await BotService.deleteBot(req.params.id);
            res.json({ mensagem: 'Bot removido' });
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    }

    async reconnect(req, res) {
        try {
            await BotService.reconnectBot(req.params.id);
            res.json({ mensagem: 'Reiniciando bot para novo QR Code...' });
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    }

    async triggerRemindersNow(req, res) {
        try {
            const total = await BotService.dispararLembretesAgora();
            res.json({ mensagem: `Lembretes processados nas instâncias ativas. Total aproximado: ${total}` });
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    }

    async listGroups(req, res) {
        try {
            const { botId } = req.query;
            const groups = await BotService.listarGrupos(botId);
            res.json(groups);
        } catch (err) {
            res.status(503).json({ erro: err.message });
        }
    }

    async disconnect(req, res) {
        try {
            await BotService.disconnectBot(req.params.id);
            res.json({ mensagem: 'Instância desconectada com sucesso.' });
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    }

    async testConnection(req, res) {
        try {
            const { botId, grupo_id } = req.body;
            await BotService.enviarTesteConexao(botId, grupo_id);
            res.json({ mensagem: 'Teste enviado!' });
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    }
}

module.exports = new BotController();
