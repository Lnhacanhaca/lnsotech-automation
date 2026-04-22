const manager = require('../bot/engine');
const BotRepository = require('../repositories/BotRepository');

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
        await BotRepository.update(id, nome, tipos);
        // Reiniciar instância para aplicar mudanças de tipos_permitidos se estiver rodando
        const bot = await BotRepository.findById(id);
        if (bot) {
            await manager.stopBot(id);
            setTimeout(() => manager.startBot(bot), 1000);
        }
        return bot;
    }

    async deleteBot(id) {
        await manager.stopBot(id);
        await BotRepository.delete(id);
    }

    async reconnectBot(id) {
        const bot = await BotRepository.findById(id);
        if (bot) {
            await manager.stopBot(id);
            // Pequeno delay para garantir limpeza
            setTimeout(() => manager.startBot(bot), 2000);
        }
    }

    async disconnectBot(id) {
        await manager.stopBot(id);
    }

    async listarGrupos(botId) {
        const instance = manager.instances.get(Number(botId));
        if (!instance || instance.state.status !== 'conectado') {
            throw new Error('Bot não está conectado');
        }
        const groups = await instance.sock.groupFetchAllParticipating();
        return Object.values(groups).map(g => ({
            id: g.id,
            nome: g.subject,
            participantes: g.participants?.length || 0
        }));
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
