class BotService {
    async getStatus() {
        return global.waState || { qr: null, status: 'desconhecido', lastUpdate: null };
    }

    async reconnect() {
        const fs = require('fs');
        const path = require('path');
        const authDir = path.resolve(__dirname, '../../auth_info_baileys');
        
        if (fs.existsSync(authDir)) {
            const files = fs.readdirSync(authDir);
            for (const file of files) {
                try {
                    fs.rmSync(path.join(authDir, file), { recursive: true, force: true });
                } catch (e) {}
            }
        }

        if (global.waSocket) {
            try { await global.waSocket.logout(); } catch(e) {}
        }
        
        global.waState = { qr: null, status: 'a_reconectar', lastUpdate: new Date().toISOString() };
        
        setTimeout(() => { process.exit(0); }, 2000);
    }

    async listarGrupos() {
        if (!global.waSocket) throw new Error('Bot não está conectado ao WhatsApp');
        const groups = await global.waSocket.groupFetchAllParticipating();
        return Object.values(groups).map(g => ({
            id: g.id,
            nome: g.subject,
            participantes: g.participants?.length || 0,
            descricao: g.desc || ''
        }));
    }

    async enviarTesteConexao(grupoId) {
        if (!global.waSocket) throw new Error('Bot não está conectado ao WhatsApp');
        await global.waSocket.sendMessage(grupoId, { 
            text: '🤖 *LNSOTECH BOT - TESTE DE COMUNICAÇÃO*\n\n✅ A conexão com este grupo está ativa e funcionando perfeitamente!' 
        });
    }

    async dispararLembretesManuais() {
        if (!global.waSocket) throw new Error('WhatsApp não está conectado ao Bot.');
        const { executarLembretes } = require('../bot/engine');
        return await executarLembretes(global.waSocket, true);
    }
}

module.exports = new BotService();
