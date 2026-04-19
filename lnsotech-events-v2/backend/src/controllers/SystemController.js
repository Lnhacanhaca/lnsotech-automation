const SystemRepository = require('../repositories/SystemRepository');

class SystemController {
    // Tipos
    async listTipos(req, res) {
        try {
            const rows = await SystemRepository.findAllTipos();
            res.json(rows);
        } catch (error) {
            res.status(500).json({ erro: 'Falha buscar tipos de evento' });
        }
    }

    async createTipo(req, res) {
        const { nome, cor, template_resposta } = req.body;
        try {
            await SystemRepository.createTipo(nome.toLowerCase(), cor || '#3b82f6', template_resposta || '');
            res.json({ sucesso: true });
        } catch (error) {
            res.status(500).json({ erro: 'Falha ao criar tipo de evento' });
        }
    }

    async updateTipo(req, res) {
        const { nome, cor, template_resposta } = req.body;
        try {
            await SystemRepository.updateTipo(req.params.id, nome.toLowerCase(), cor, template_resposta);
            res.json({ sucesso: true });
        } catch (error) {
            res.status(500).json({ erro: error.message });
        }
    }

    async deleteTipo(req, res) {
        try {
            await SystemRepository.deleteTipo(req.params.id);
            res.json({ sucesso: true });
        } catch (error) {
            res.status(500).json({ erro: 'Falha ao apagar tipo de evento' });
        }
    }

    // Templates
    async listTemplates(req, res) {
        try {
            const rows = await SystemRepository.findAllTemplates();
            res.json(rows);
        } catch (error) {
            res.status(500).json({ erro: 'Falha buscar templates' });
        }
    }

    async updateTemplate(req, res) {
        try {
            await SystemRepository.updateTemplate(req.params.id, req.body.mensagem);
            res.json({ sucesso: true });
        } catch (error) {
            res.status(500).json({ erro: 'Falha atualizar template' });
        }
    }

    // Logs
    async listLogs(req, res) {
        try {
            const rows = await SystemRepository.findAllLogs();
            res.json(rows);
        } catch (error) {
            res.status(500).json({ erro: 'Falha buscar logs' });
        }
    }

    async clearAllLogs(req, res) {
        try {
            await SystemRepository.deleteAllLogs();
            res.json({ sucesso: true, mensagem: 'Todo o histórico foi apagado' });
        } catch (error) {
            res.status(500).json({ erro: 'Falha ao apagar histórico' });
        }
    }

    async deleteLog(req, res) {
        try {
            await SystemRepository.deleteLog(req.params.id);
            res.json({ sucesso: true });
        } catch (error) {
            res.status(500).json({ erro: 'Falha ao apagar log' });
        }
    }

    // Configs
    async listConfigs(req, res) {
        try {
            const configs = await SystemRepository.findAllConfigs();
            res.json(configs);
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    }

    async updateConfig(req, res) {
        try {
            await SystemRepository.upsertConfig(req.body.chave, req.body.valor);
            res.json({ mensagem: 'Configuração atualizada!' });
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    }
}

module.exports = new SystemController();
