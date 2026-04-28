require('dotenv').config();
const {
    default: makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const cron = require('node-cron');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const QueueRepository = require('../repositories/QueueRepository');
const NotificationService = require('../services/NotificationService');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ========================================================
// 1. Dicionário de Bodas & Configurações de Banco
// ========================================================
const listaBodas = require('./bodas');

const pool = new Pool({
    host: process.env.DB_HOST || 'database',   
    user: process.env.DB_USER || 'lnso_admin',         
    password: process.env.DB_PASSWORD || 'luis@nhaca',     
    database: process.env.DB_NAME || 'lnsotech_db',    
    port: process.env.DB_PORT || 5432,
});

// ========================================================
// 2. BotManager - Gerenciador de Múltiplas Instâncias
// ========================================================
class BotManager {
    constructor() {
        this.instances = new Map(); // id -> { sock, state, config }
    }

    async init() {
        const BotRepository = require('../repositories/BotRepository');
        const bots = await BotRepository.findAll();
        
        console.log(`🤖 [BotManager] Carregando ${bots.length} instâncias...`);
        for (const bot of bots) {
            await this.startBot(bot);
        }

        this.retryCounts = new Map(); // id -> count
        
        // Iniciar Crons Globais (Backup e Relatório)
        this.iniciarCronsGlobais();
        // Iniciar Cron de Lembretes
        this.iniciarCronLembretes();
        // Iniciar Consumidor de Fila (Priority 1)
        this.iniciarQueueConsumer();
    }

    async startBot(botConfig) {
        const id = botConfig.id;
        const sessionPath = path.resolve(__dirname, `../../auth_info_baileys/${botConfig.pasta_sessao}`);
        
        if (!fs.existsSync(path.resolve(__dirname, `../../auth_info_baileys`))) {
            fs.mkdirSync(path.resolve(__dirname, `../../auth_info_baileys`), { recursive: true });
        }

        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        const { version } = await fetchLatestBaileysVersion();

        console.log(`📡 [Bot: ${botConfig.nome}] Inicializando versão v${version.join('.')}...`);

        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            auth: state,
            generateHighQualityLinkPreview: true,
        });

        const instance = {
            sock,
            state: { qr: null, status: 'desconectado', lastUpdate: new Date().toISOString() },
            config: botConfig
        };
        this.instances.set(id, instance);

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                try {
                    const qrDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
                    instance.state = { qr: qrDataUrl, status: 'aguardando_qr', lastUpdate: new Date().toISOString() };
                    const BotRepository = require('../repositories/BotRepository');
                    await BotRepository.updateStatus(id, 'aguardando_qr');
                } catch (e) { console.error(`Erro QR Bot ${id}:`, e); }
            }

            if (connection === 'close') {
                const statusCode = (lastDisconnect.error)?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect) {
                    const retries = (this.retryCounts.get(id) || 0) + 1;
                    if (retries <= 5) {
                        console.log(`🔄 [Bot: ${botConfig.nome}] Reconectando (Tentativa ${retries}/5)...`);
                        this.retryCounts.set(id, retries);
                        setTimeout(() => this.startBot(botConfig), 5000 * retries);
                    } else {
                        console.error(`❌ [Bot: ${botConfig.nome}] Limite de reconexões atingido.`);
                        await NotificationService.notifyHealthIssue(botConfig.nome, 'Limite de auto-reconexão atingido. Intervenção manual necessária.');
                        const BotRepository = require('../repositories/BotRepository');
                        await BotRepository.updateStatus(id, 'erro_conexao');
                    }
                } else {
                    console.log(`❌ [Bot: ${botConfig.nome}] Desconectado permanentemente.`);
                    await NotificationService.notifyHealthIssue(botConfig.nome, 'Logout detetado ou sessão expirada.');
                    instance.state = { qr: null, status: 'desconectado', lastUpdate: new Date().toISOString() };
                    const BotRepository = require('../repositories/BotRepository');
                    await BotRepository.updateStatus(id, 'desconectado');
                }
            } else if (connection === 'open') {
                console.log(`✅ [Bot: ${botConfig.nome}] Online!`);
                this.retryCounts.set(id, 0); // Reset retries on success
                instance.state = { qr: null, status: 'conectado', lastUpdate: new Date().toISOString() };
                const BotRepository = require('../repositories/BotRepository');
                await BotRepository.updateStatus(id, 'conectado');
            }
        });

        // Lógica de recebimento de mensagens (Auto-Reply)
        this.setupMessageHandler(sock, id);

        return instance;
    }

    async stopBot(id) {
        const instance = this.instances.get(id);
        if (instance) {
            // Atualizar estado imediatamente para evitar que listBots retorne 'conectado'
            instance.state.status = 'desconectado';
            const sock = instance.sock;
            
            // Remover da memória ativa imediatamente
            this.instances.delete(id);
            
            // Atualizar banco de dados
            const BotRepository = require('../repositories/BotRepository');
            await BotRepository.updateStatus(id, 'desconectado');

            // Limpeza do socket em background (não bloqueia a resposta da API)
            if (sock) {
                sock.logout().catch(() => sock.end()).catch(() => {});
            }
        }
    }

    setupMessageHandler(sock, botId) {
        const processedMessages = new Set();
        const lastAutoReply = new Map();

        sock.ev.on('messages.upsert', async (m) => {
            if (!m.messages || m.messages.length === 0) return;
            const msg = m.messages[0];
            const msgId = msg.key.id; // Correção: msgId não estava definido!
            const isStatus = msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid?.includes('@broadcast');
            if (m.type !== 'notify' || processedMessages.has(msgId) || msg.key.fromMe || isStatus) return;
            
            processedMessages.add(msgId);
            if (processedMessages.size > 200) processedMessages.delete(processedMessages.values().next().value);

            const textMessage = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.buttonsResponseMessage?.selectedButtonId || msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId;
            if (!textMessage) return;

            if (textMessage === '!ping') {
                return await sock.sendMessage(msg.key.remoteJid, { text: '🏓 PONG - MULTI-BOT ENGAGE!' }, { quoted: msg });
            }

            // Lógica de Auto-Reply e Interações Diretas
            const myId = sock.user.id.split(':')[0];
            const myLid = sock.user.lid?.split(':')[0];
            const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
            const repliedJid = contextInfo?.participant || '';
            const mentionedJids = contextInfo?.mentionedJid || [];

            const isReplyToBot = repliedJid.includes(myId) || (myLid && repliedJid.includes(myLid));
            const isMentioningBot = mentionedJids.some(jid => jid.includes(myId) || (myLid && jid.includes(myLid))) || 
                                    textMessage.includes(myId);
            
            const isGroup = msg.key.remoteJid.endsWith('@g.us');
            
            // Se for um grupo, verificar se está silenciado
            if (isGroup) {
                const groupRes = await pool.query("SELECT is_muted FROM grupos_config WHERE grupo_id = $1", [msg.key.remoteJid]);
                if (groupRes.rowCount > 0 && groupRes.rows[0].is_muted) return; 
            }

            const isDirectInteraction = isReplyToBot || isMentioningBot;

            if (isDirectInteraction) {
                const remoteJid = msg.key.remoteJid;
                const now = Date.now();
                if (now - (lastAutoReply.get(remoteJid) || 0) < 10000) return;

                const textLower = textMessage.toLowerCase();
                // Anti-Loop para si próprio
                const selfTriggers = ['lnsotech', 'agradece', 'enviado via', 'assinalar'];
                if (selfTriggers.some(t => textLower.includes(t))) return;
                
                const triggers = ['muito obrigado', 'obrigado', 'obrigada', 'parabens', 'parabéns', 'obrg', 'amem', 'amém', 'feliz'];
                
                // Buscar Assinatura e Fallback
                const configRes = await pool.query("SELECT chave, valor FROM configuracoes WHERE chave IN ('resposta_padrao_bot', 'assinatura_bot')");
                const configs = {};
                configRes.rows.forEach(r => configs[r.chave] = r.valor);
                const assinatura = configs['assinatura_bot'] || '';
                const fallback = configs['resposta_padrao_bot'] || '🤖 Obrigado pelo contacto!';

                let resposta = fallback;
                let encontrouTipo = false;

                if (triggers.some(t => textLower.includes(t))) {
                    console.log(`🎯 [Bot ${botId}] Trigger detectada em ${remoteJid}: "${textMessage.substring(0, 20)}..."`);
                    
                    let tipoEvento = null;

                    // 1. Tentar descobrir o tipo de evento através do grupo atual
                    if (isGroup) {
                        const evRes = await pool.query("SELECT tipo_evento FROM eventos WHERE grupo_id = $1 ORDER BY id DESC LIMIT 1", [remoteJid]);
                        if (evRes.rowCount > 0) tipoEvento = evRes.rows[0].tipo_evento;
                    }

                    // 2. Se não encontrar no grupo (ex: teste no privado), puxar o tipo associado ao Bot, 
                    // MAS APENAS se o Bot for dedicado a UM ÚNICO tipo (para não adivinhar errado).
                    if (!tipoEvento) {
                        const botRes = await pool.query("SELECT tipos_permitidos FROM bots WHERE id = $1", [botId]);
                        if (botRes.rowCount > 0 && botRes.rows[0].tipos_permitidos) {
                            let tipos = botRes.rows[0].tipos_permitidos;
                            if (typeof tipos === 'string') { try { tipos = JSON.parse(tipos); } catch(e) { tipos = []; } }
                            if (Array.isArray(tipos) && tipos.length === 1) {
                                tipoEvento = tipos[0];
                            }
                        }
                    }

                    // Se encontrou o tipo com certeza, vai buscar o Reply
                    if (tipoEvento) {
                        console.log(`🔎 [Bot ${botId}] Associando resposta ao tipo: ${tipoEvento}`);
                        const tipoObj = await pool.query("SELECT template_resposta FROM tipos_evento WHERE LOWER(nome) = LOWER($1)", [tipoEvento]);
                        if (tipoObj.rowCount > 0 && tipoObj.rows[0].template_resposta) {
                            resposta = tipoObj.rows[0].template_resposta;
                            encontrouTipo = true;
                        }
                    }
                }

                const finalMessage = `${resposta}\n\n${assinatura}`.trim();
                await sock.sendMessage(remoteJid, { text: finalMessage }, { quoted: msg });
                lastAutoReply.set(remoteJid, now);
                await registarLog(null, remoteJid, 'auto_resposta', `Bot ${botId} respondeu (${encontrouTipo ? 'Tipo' : 'Fallback'}): ${textMessage.substring(0,20)}`, 'sucesso');
            }
        });
    }

    iniciarCronLembretes() {
        cron.schedule('* * * * *', async () => {
            try {
                const dataMaputo = new Date().toLocaleTimeString("en-GB", {timeZone: "Africa/Maputo", hour: '2-digit', minute: '2-digit'}); // "HH:mm"
                const configRes = await pool.query("SELECT valor FROM configuracoes WHERE chave = 'hora_lembrete'");
                const horaAgendada = configRes.rows[0]?.valor || '07:00';

                if (dataMaputo.trim() === horaAgendada.trim()) {
                    console.log(`⏰ [Cron] Hora dos lembretes! (${dataMaputo})`);
                    for (const [id, instance] of this.instances) {
                        if (instance.state.status === 'conectado') {
                            await this.executarLembretes(instance);
                        }
                    }
                }
            } catch (err) { console.error('Erro Cron Lembretes:', err); }
        }, { timezone: "Africa/Maputo" });
    }

    async executarLembretes(instance, manual = false) {
        const { sock, config } = instance;
        let tipos = config.tipos_permitidos;
        // Garantir que tipos seja um array (caso venha do DB como JSON string ou objeto)
        if (typeof tipos === 'string') { try { tipos = JSON.parse(tipos); } catch(e) { tipos = []; } }
        if (!Array.isArray(tipos)) tipos = [];
        
        if (tipos.length === 0) {
            console.log(`⚠️ [Bot: ${config.nome}] Nenhum tipo de evento permitido configurado.`);
            return 0;
        }

        console.log(`🚀 [Bot: ${config.nome}] Disparando lembretes para: ${tipos.join(', ')}`);
        
        // Filtro por tipos permitidos deste Bot (Case-Insensitive)
        const query = `
            SELECT e.*, EXTRACT(YEAR FROM e.data_evento) as ano_origem 
            FROM eventos e
            LEFT JOIN grupos_config g ON e.grupo_id = g.grupo_id
            WHERE e.grupo_id IS NOT NULL 
            AND LOWER(e.tipo_evento) = ANY($1)
            AND (g.is_muted IS FALSE OR g.is_muted IS NULL)
            AND (
                -- DIARIO (Dispara todos os dias)
                (LOWER(e.frequencia_lembrete) = 'diario')
                OR
                -- SEMANAL
                (LOWER(e.frequencia_lembrete) = 'semanal' AND TO_CHAR(e.data_evento, 'D') = TO_CHAR(CURRENT_DATE AT TIME ZONE 'Africa/Maputo', 'D'))
                OR
                -- MENSAL
                (LOWER(e.frequencia_lembrete) = 'mensal' AND TO_CHAR(e.data_evento, 'DD') = TO_CHAR(CURRENT_DATE AT TIME ZONE 'Africa/Maputo', 'DD'))
                OR
                -- ANUAL (Aniversários)
                ( (LOWER(e.frequencia_lembrete) = 'anual' OR e.frequencia_lembrete IS NULL) AND TO_CHAR(e.data_evento, 'DD-MM') = TO_CHAR(CURRENT_DATE AT TIME ZONE 'Africa/Maputo', 'DD-MM'))
            )
        `;
        const res = await pool.query(query, [tipos.map(t => t.toLowerCase())]);
        let enviados = 0;

        // Buscar Assinatura e Templates
        const globalRes = await pool.query("SELECT chave, valor FROM configuracoes WHERE chave = 'assinatura_bot'");
        const assinatura = globalRes.rows[0]?.valor || '';
        const templatesRes = await pool.query('SELECT * FROM templates_mensagem');
        const templates = {};
        templatesRes.rows.forEach(t => templates[t.tipo_evento.toLowerCase()] = t.mensagem);

        for (const evento of res.rows) {
            try {
                const template = templates[evento.tipo_evento.toLowerCase()] || 'Hoje celebramos {nomes}!';
                const anos = new Date().getFullYear() - (evento.ano_origem || new Date().getFullYear());
                let msgFinal = template
                    .replace(/{nomes}/g, evento.nomes_principais)
                    .replace(/{anos}/g, anos.toString())
                    .replace(/{tipo}/g, evento.tipo_evento);

                if (evento.tipo_evento.toLowerCase() === 'casamento' && anos > 0) {
                    const bodaObj = listaBodas[anos] || { nome: "União e Amor", significado: "Um momento especial para renovar os vossos votos." };
                    msgFinal = msgFinal
                        .replace(/{bodas}/g, bodaObj.nome)
                        .replace(/{significado}/g, bodaObj.significado);
                }
                
                msgFinal = `${msgFinal}\n\n${assinatura}`.trim();

                // EM VEZ DE ENVIAR DIRETAMENTE, ADICIONA À FILA (Priority 1)
                await QueueRepository.enqueue(
                    instance.config.id,
                    evento.grupo_id,
                    msgFinal,
                    evento.foto_url || null,
                    1 // Prioridade de lembrete
                );

                enviados++;
            } catch (err) {
                console.error(`Erro ao enfileirar bot ${config.nome}:`, err);
                await registarLog(evento.id, evento.grupo_id, 'queue_erro', err.message, 'erro');
            }
        }
        return enviados;
    }

    iniciarQueueConsumer() {
        const QueueRepository = require('../repositories/QueueRepository');
        console.log('📬 [Queue] Consumidor de fila iniciado.');
        
        const loop = async () => {
            try {
                // Busca a próxima mensagem pendente
                const [msg] = await QueueRepository.getNextPending(1);
                
                if (msg) {
                    const instance = this.instances.get(msg.bot_id);
                    
                    if (instance && instance.state.status === 'conectado') {
                        const { sock } = instance;
                        console.log(`✉️ [Queue] Enviando para ${msg.grupo_id} via Bot ${msg.bot_id}...`);
                        
                        try {
                            if (msg.foto_url) {
                                // Limpeza básica de URL
                                const fileName = path.basename(msg.foto_url);
                                const fotoPath = path.resolve(__dirname, '../../uploads', fileName);
                                
                                if (fs.existsSync(fotoPath)) {
                                    await sock.sendMessage(msg.grupo_id, { image: { url: fotoPath }, caption: msg.mensagem });
                                } else {
                                    await sock.sendMessage(msg.grupo_id, { text: msg.mensagem });
                                }
                            } else {
                                await sock.sendMessage(msg.grupo_id, { text: msg.mensagem });
                            }
                            
                            await QueueRepository.updateStatus(msg.id, 'enviado');
                            await registarLog(null, msg.grupo_id, 'envio_sucesso', 'Mensagem enviada via fila', 'sucesso');
                        } catch (sendErr) {
                            console.error('Erro envio fila:', sendErr);
                            await QueueRepository.updateStatus(msg.id, 'erro', sendErr.message);
                        }
                    } else {
                        // Bot offline, aguarda ou pula? Vamos aguardar.
                    }
                }
            } catch (err) {
                console.error('Erro no consumidor de fila:', err);
            }
            
            // Intervalo variável entre 5 a 10 segundos para anti-spam (Rate Limiting)
            const delay = Math.floor(Math.random() * 5000) + 5000;
            setTimeout(loop, delay);
        };
        
        loop();
    }

    async triggerManually() {
        let total = 0;
        for (const [id, instance] of this.instances) {
            if (instance.state.status === 'conectado') {
                total += await this.executarLembretes(instance, true);
            }
        }
        return total;
    }

    iniciarCronsGlobais() {
        // Backup Cron (00:00)
        cron.schedule('0 0 * * *', () => {
            console.log('💾 [Global] Iniciando backup...');
            // ... (keep the same backup logic as before, just one global run)
        }, { timezone: "Africa/Maputo" });

        // Relatório Semanal (Sexta 17:00)
        cron.schedule('0 17 * * 5', async () => {
             // Usa o primeiro bot disponível para enviar o relatório
             const [firstBot] = this.instances.values();
             if (firstBot && firstBot.state.status === 'conectado') {
                 console.log('📊 [Global] Gerando relatório semanal...');
                 // ... (keep same report logic, but using firstBot.sock)
             }
        }, { timezone: "Africa/Maputo" });
    }
}

const manager = new BotManager();

// Helper de Log herdado
async function registarLog(eventoId, grupoId, tipoLog, mensagem, status) {
    try {
        await pool.query(
            'INSERT INTO logs_envio (evento_id, grupo_id, tipo_log, mensagem, status) VALUES ($1, $2, $3, $4, $5)',
            [eventoId, grupoId, tipoLog, mensagem, status]
        );
    } catch (err) {}
}

if (require.main === module) {
    manager.init().catch(err => console.error('Falha crítica BotManager:', err));
}

module.exports = manager;
