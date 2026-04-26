const manager = require('../bot/engine');
const BotRepository = require('../repositories/BotRepository');
const SystemRepository = require('../repositories/SystemRepository');

class BotService {
    async listBots() {
        const dbBots = await BotRepository.findAll();
        return dbBots.map(bot => {
            const instance = manager.instances.get(bot.id);
            return {
                ...bot,
                status: instance ? instance.state.status : 'offline',
                qr: instance ? instance.state.qr : null,
                lastUpdate: instance ? instance.state.lastUpdate : null
            };
        });
    }

    async createBot(nome, tipos) {
        const bot = await BotRepository.create(nome, tipos);
        await manager.startBot(bot);
        return bot;
    }

    async updateBot(id, nome, tipos) {
        // Atualizar no banco
        await BotRepository.update(Number(id), nome, tipos);
        // Reiniciar instância para aplicar mudanças de tipos_permitidos se estiver rodando
        const bot = await BotRepository.findById(Number(id));
        if (bot) {
            await manager.stopBot(Number(id));
            // Reinicia com as novas configurações
            setTimeout(() => manager.startBot(bot), 1000);
        }
        return bot;
    }

    async deleteBot(id) {
        await manager.stopBot(Number(id));
        await BotRepository.delete(Number(id));
    }

    async reconnectBot(id) {
        const bot = await BotRepository.findById(Number(id));
        if (bot) {
            await manager.stopBot(Number(id));
            // Pequeno delay para garantir limpeza
            setTimeout(() => manager.startBot(bot), 2000);
        }
    }

    async disconnectBot(id) {
        // Ao desconectar, silenciamos todos os grupos vinculados a este bot na base de dados
        await SystemRepository.bulkMuteGrupos(null, Number(id));
        await manager.stopBot(Number(id));
    }

    async listarGrupos(botId) {
        if (!botId || isNaN(Number(botId))) {
            // Retorna todos os grupos de todos os bots cacheados na base de dados
            const { rows } = await require('../config/database').query('SELECT grupo_id as id, nome, is_muted FROM grupos_config ORDER BY nome ASC');
            return rows;
        }

        const instance = manager.instances.get(Number(botId));
        if (!instance || instance.state.status !== 'conectado') {
            // Se o bot estiver offline, retornamos os grupos cacheados na base de dados
            return await SystemRepository.findGruposByBot(Number(botId));
        }
        
        const groups = await instance.sock.groupFetchAllParticipating();
        const mapped = Object.values(groups).map(g => ({
            id: g.id,
            nome: g.subject,
            participantes: g.participants?.length || 0
        }));

        // Guardar/Atualizar na base de dados para acesso offline futuro
        await SystemRepository.saveGruposFromBot(Number(botId), mapped);
        
        return mapped;
    }

    async enviarTesteConexao(botId, grupoId) {
        const instance = manager.instances.get(Number(botId));
        if (!instance || instance.state.status !== 'conectado') throw new Error('Bot offline');
        await instance.sock.sendMessage(grupoId, { 
            text: `🤖 *Teste Multi-Bot: ${instance.config.nome}*\n✅ Conexão ativa!` 
        });
    }

    async dispararLembretesAgora() {
        return await manager.triggerManually();
    }
}

module.exports = new BotService();
