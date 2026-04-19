const BotService = require('../services/BotService');

class BotController {
    async getStatus(req, res) {
        const status = await BotService.getStatus();
        res.json(status);
    }

    async reconnect(req, res) {
        try {
            await BotService.reconnect();
            res.json({ mensagem: 'Sessão apagada! O sistema vai reiniciar para gerar novo QR Code.' });
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    }

    async listGroups(req, res) {
        try {
            const groups = await BotService.listarGrupos();
            res.json(groups);
        } catch (err) {
            res.status(503).json({ erro: err.message });
        }
    }

    async testConnection(req, res) {
        try {
            const { grupo_id } = req.body;
            if (!grupo_id) return res.status(400).json({ erro: 'ID do grupo é necessário' });
            await BotService.enviarTesteConexao(grupo_id);
            res.json({ mensagem: 'Mensagem de teste enviada com sucesso!' });
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    }

    async runManualReminders(req, res) {
        try {
            const total = await BotService.dispararLembretesManuais();
            res.json({ mensagem: `Lembretes disparados manualmente com sucesso! Total: ${total}` });
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    }
}

module.exports = new BotController();
