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
const qrcode = require('qrcode-terminal');

// 1. Objeto de Bodas
const listaBodas = {
    1: "Papel", 2: "Algodão", 3: "Couro", 4: "Flores e Frutas", 5: "Madeira",
    6: "Perfume ou Açúcar", 7: "Lã ou Latão", 8: "Papoula ou Barro", 9: "Cerâmica ou Vime", 10: "Estanho",
    11: "Aço", 12: "Seda ou Ônix", 13: "Renda", 14: "Marfim", 15: "Cristal",
    20: "Porcelana", 25: "Prata", 30: "Pérola", 35: "Coral", 40: "Esmeralda",
    45: "Rubi", 50: "Ouro", 60: "Diamante"
};

// 2. Configuração do Banco de Dados
const pool = new Pool({
    host: process.env.DB_HOST || 'database',   
    user: process.env.DB_USER || 'lnso_admin',         
    password: process.env.DB_PASSWORD || 'luis@nhaca',     
    database: process.env.DB_NAME || 'lnsotech_db',    
    port: process.env.DB_PORT || 5432,
});

// Helper: Registar log no banco de dados
async function registarLog(eventoId, grupoId, tipoLog, mensagem, status) {
    try {
        await pool.query(
            'INSERT INTO logs_envio (evento_id, grupo_id, tipo_log, mensagem, status) VALUES ($1, $2, $3, $4, $5)',
            [eventoId, grupoId, tipoLog, mensagem, status]
        );
    } catch (err) {
        console.error('Erro ao registar log:', err.message);
    }
}

async function connectToWhatsApp() {
    const authDir = path.resolve(__dirname, '../../auth_info_baileys');
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    console.log(`[Baileys] Ligando com a versão do WA v${version.join('.')}, isLatest: ${isLatest}`);

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
        generateHighQualityLinkPreview: true,
    });

    // 3. Gerenciamento de Conexão e QR
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('[QR Code] Novo QR gerado! Faça a leitura com o WhatsApp.');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('[Connection] Conexão encerrada pelo motivo:', lastDisconnect.error, ', deve reconectar:', shouldReconnect);
            
            if (shouldReconnect) {
                connectToWhatsApp();
            } else {
                console.log('[Connection] Utilizador desconectou-se. Apague a pasta auth_info_baileys e reinicie para ler um novo QR Code.');
            }
        } else if (connection === 'open') {
            console.log("🚀 LNSOTECH Bot v2 (Baileys) Online!");

            // SEM mensagem de teste automática — só é enviada via painel admin

            // Listar grupos para o utilizador poder configurar
            setTimeout(async () => {
                try {
                    const groups = await sock.groupFetchAllParticipating();
                    const groupsArray = Object.values(groups);
                    if (groupsArray.length > 0) {
                        console.log("📋 LISTA DE GRUPOS (NOME | ID):");
                        groupsArray.forEach(g => {
                            console.log(`${g.subject} | ID: ${g.id}`);
                        });
                    } else {
                        console.log("Ainda sem grupos participados na conta.");
                    }
                } catch (err) {
                    console.error("Erro ao listar grupos:", err.message);
                }
            }, 15000);
            
            iniciarCron(sock);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // 4. Ouvir mensagens (!reg adaptado para o novo modelo de dados "eventos")
    sock.ev.on('messages.upsert', async (m) => {
        if (!m.messages || m.messages.length === 0) return;
        const msg = m.messages[0];

        // Ignorar mensagens minhas
        if (msg.key.fromMe) return;

        // Extrair texto da mensagem na biblioteca Baileys
        const textMessage = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

        if (textMessage && textMessage.startsWith('!reg ')) {
            console.log("🎯 Comando !reg identificado!");

            const dados = textMessage.slice(5).split(',');

            if (dados.length < 2) {
                console.log("⚠️ Formato de comando errado.");
                return sock.sendMessage(msg.key.remoteJid, { text: '❌ Formato inválido! Use: !reg Nome do Casal, AAAA-MM-DD' }, { quoted: msg });
            }

            const nomesPrincipais = dados[0].trim();
            const dataEvento = dados[1].trim();
            // O tipo de evento pode ser passado como terceiro argumento opcional
            const tipoEvento = dados[2] ? dados[2].trim().toLowerCase() : 'casamento';
            const grupoId = msg.key.remoteJid; // Associamos ao grupo de onde veio

            try {
                const query = `
                    INSERT INTO eventos (nomes_principais, data_evento, tipo_evento, grupo_id) 
                    VALUES ($1, $2, $3, $4) RETURNING id
                `;
                const result = await pool.query(query, [nomesPrincipais, dataEvento, tipoEvento, grupoId]);
                
                await registarLog(result.rows[0].id, grupoId, 'registo_whatsapp', `Registado via !reg: ${nomesPrincipais}`, 'sucesso');

                console.log(`✅ Sucesso: ${nomesPrincipais} inserido no banco (v2).`);
                await sock.sendMessage(
                    msg.key.remoteJid, 
                    { text: `✅ Evento Registado!\nNomes: ${nomesPrincipais}\nData: ${dataEvento}\nTipo: ${tipoEvento}\nLembrete ativado neste grupo.` }, 
                    { quoted: msg }
                );
            } catch (err) {
                console.error('❌ Erro no Banco de Dados:', err.message);
                await registarLog(null, grupoId, 'erro_registo', err.message, 'falha');
                await sock.sendMessage(msg.key.remoteJid, { text: '❌ Ouve um erro ao salvar no banco de dados. Verifique o formato AAAA-MM-DD.' }, { quoted: msg });
            }
        }
    });

    // Expor sock globalmente para que o servidor API possa usá-lo (ex: teste de conexão manual)
    global.waSocket = sock;

    return sock;
}

// 5. Função agendada com cron
function iniciarCron(sock) {
    console.log('⏳ Cron Job iniciado (Horário: 08:00 Maputo)');
    
    cron.schedule('0 8 * * *', async () => {
        console.log('🔍 LNSOTECH: Verificando eventos de hoje...');
        try {
            // Buscar TODOS os tipos de evento (casamento, aniversario, batizado, formatura)
            const res = await pool.query(`
                SELECT id, nomes_principais, grupo_id, tipo_evento, EXTRACT(YEAR FROM data_evento) as ano_origem 
                FROM eventos 
                WHERE EXTRACT(DAY FROM data_evento) = EXTRACT(DAY FROM CURRENT_DATE) 
                AND EXTRACT(MONTH FROM data_evento) = EXTRACT(MONTH FROM CURRENT_DATE)
            `);

            // Buscar templates dinâmicos
            const templatesRes = await pool.query('SELECT * FROM templates_mensagem');
            const templatesMap = {};
            templatesRes.rows.forEach(t => { templatesMap[t.tipo_evento] = t.mensagem; });

            for (let evento of res.rows) {
                const anos = new Date().getFullYear() - evento.ano_origem;
                if (anos <= 0) continue;

                let mensagem;
                if (evento.tipo_evento === 'casamento') {
                    const nomeBoda = listaBodas[anos] || "União e Amor";
                    const template = templatesMap['casamento'] || 'Feliz Aniversário de Casamento, {nomes}! 💍 Bodas de {bodas}!';
                    mensagem = template.replace('{nomes}', evento.nomes_principais).replace('{bodas}', nomeBoda);
                } else {
                    const template = templatesMap[evento.tipo_evento] || 'Parabéns {nomes}! 🎉 Celebrando mais um ano!';
                    mensagem = template.replace('{nomes}', evento.nomes_principais);
                }

                try {
                    // Envia para o grupo específico do evento (cada evento pode ter grupo diferente)
                    await sock.sendMessage(evento.grupo_id, { text: mensagem });
                    await registarLog(evento.id, evento.grupo_id, 'lembrete_enviado', mensagem, 'sucesso');
                    console.log(`✅ Enviado para: ${evento.nomes_principais} (Grupo: ${evento.grupo_id})`);
                } catch (sendErr) {
                    await registarLog(evento.id, evento.grupo_id, 'lembrete_falha', sendErr.message, 'falha');
                    console.error(`❌ Falha ao enviar para ${evento.grupo_id}:`, sendErr.message);
                }
            }
        } catch (err) {
            console.error('❌ Erro no Cron Job:', err);
            await registarLog(null, null, 'cron_erro', err.message, 'falha');
        }
    }, {
        timezone: "Africa/Maputo"
    });
}

// Iniciar conexão
if (require.main === module) {
    connectToWhatsApp().catch(err => console.log('Erro inesperado: ' + err));
}

module.exports = { connectToWhatsApp };
