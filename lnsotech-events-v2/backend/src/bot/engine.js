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

// 1. Objeto de Bodas
const listaBodas = {
    1: "Papel", 2: "Algodão", 3: "Couro", 4: "Flores e Frutas", 5: "Madeira",
    6: "Perfume ou Açúcar", 7: "Lã ou Latão", 8: "Papoula ou Barro", 9: "Cerâmica ou Vime", 10: "Estanho",
    11: "Aço", 12: "Seda ou Ônix", 13: "Renda", 14: "Marfim", 15: "Cristal",
    20: "Porcelana", 25: "Prata", 30: "Pérola", 35: "Coral", 40: "Esmeralda",
    45: "Rubi", 50: "Ouro", 60: "Diamante"
};

// 2. Configuração do Banco de Dados (Apontando para a v2 - eventos)
const pool = new Pool({
    host: process.env.DB_HOST || 'database',   
    user: process.env.DB_USER || 'lnso_admin',         
    password: process.env.DB_PASSWORD || 'luis@nhaca',     
    database: process.env.DB_NAME || 'lnsotech_db',    
    port: process.env.DB_PORT || 5432,
});

async function connectToWhatsApp() {
    const authDir = path.resolve(__dirname, '../../auth_info_baileys');
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    console.log(`[Baileys] Ligando com a versão do WA v${version.join('.')}, isLatest: ${isLatest}`);

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }), // Trocar para 'level: silent' evita a poluição no terminal
        printQRInTerminal: true, // Substitui a necessidade do qrcode-terminal
        auth: state,
        generateHighQualityLinkPreview: true,
    });

    // 3. Gerenciamento de Conexão e QR
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('[QR Code] Novo QR gerado! Faça a leitura com o WhatsApp.');
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

            // Teste de conexão para um grupo configurado (se existir)
            if (process.env.GRUPO_ID && process.env.GRUPO_ID !== 'pendente') {
                try {
                    await sock.sendMessage(process.env.GRUPO_ID, { text: "🤖 Teste de conexão: O bot leve (v2) está ativo!" });
                    console.log("✅ Mensagem de teste enviada com sucesso!");
                } catch (err) {
                    console.error("❌ Erro ao enviar mensagem de teste:", err.message);
                }
            }

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
            
            iniciarCron(sock); // Inicia o Cron Job apenas se estiver ligado!
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // 4. Ouvir mensagens (!reg adaptado para o novo modelo de dados "eventos")
    sock.ev.on('messages.upsert', async (m) => {
        if (!m.messages || m.messages.length === 0) return;
        const msg = m.messages[0];

        // Ignorar mensagens minhas
        if (msg.key.fromMe) return;

        // Extrair texto da mensagem na biblioteca Baileys (pode vir em properties diferentes)
        const textMessage = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

        if (textMessage && textMessage.startsWith('!reg ')) {
            console.log("🎯 Comando !reg identificado!");

            const dados = textMessage.slice(5).split(',');

            if (dados.length !== 2) {
                console.log("⚠️ Formato de comando errado.");
                return sock.sendMessage(msg.key.remoteJid, { text: '❌ Formato inválido! Use: !reg Nome do Casal, AAAA-MM-DD' }, { quoted: msg });
            }

            const nomesPrincipais = dados[0].trim();
            const dataEvento = dados[1].trim();
            const grupoId = msg.key.remoteJid; // Associamos diretamente ao grupo de onde o comando foi enviado

            try {
                // Inserindo no novo banco de dados (tabela eventos ao invés de aniversarios)
                const query = `
                    INSERT INTO eventos (nomes_principais, data_evento, tipo_evento, grupo_id) 
                    VALUES ($1, $2, 'casamento', $3)
                `;
                await pool.query(query, [nomesPrincipais, dataEvento, grupoId]);
                
                console.log(`✅ Sucesso: ${nomesPrincipais} inserido no banco (v2).`);
                await sock.sendMessage(
                    msg.key.remoteJid, 
                    { text: `✅ Evento Registado na v2!\nNomes: ${nomesPrincipais}\nData: ${dataEvento}\nLembrete ativado neste grupo.` }, 
                    { quoted: msg }
                );
            } catch (err) {
                console.error('❌ Erro no Banco de Dados:', err.message);
                await sock.sendMessage(msg.key.remoteJid, { text: '❌ Ouve um erro ao salvar no banco de dados. Verifique o formato AAAA-MM-DD.' }, { quoted: msg });
            }
        }
    });

    return sock;
}

// 5. Função agendada com cron
function iniciarCron(sock) {
    console.log('⏳ Cron Job iniciado (Horário: 08:00 Maputo)');
    
    cron.schedule('0 8 * * *', async () => {
        console.log('🔍 LNSOTECH: Verificando eventos de hoje na v2...');
        try {
            // Nova query adaptada para a tabela "eventos" e considerando o tipo 'casamento'
            const res = await pool.query(`
                SELECT nomes_principais, grupo_id, EXTRACT(YEAR FROM data_evento) as ano_origem 
                FROM eventos 
                WHERE tipo_evento = 'casamento'
                AND EXTRACT(DAY FROM data_evento) = EXTRACT(DAY FROM CURRENT_DATE) 
                AND EXTRACT(MONTH FROM data_evento) = EXTRACT(MONTH FROM CURRENT_DATE)
            `);

            for (let evento of res.rows) {
                const anos = new Date().getFullYear() - evento.ano_origem;
                if (anos <= 0) continue;

                const nomeBoda = listaBodas[anos] || "União e Amor";
                const mensagem = `🎉 *LNSOTECH CONGRATULATIONS* 🎉\n\n` +
                                 `Hoje o casal *${evento.nomes_principais}* celebra ${anos} anos de união!\n` +
                                 `💍 Felizes *Bodas de ${nomeBoda}*!\n\n` +
                                 `A equipe LNSOTECH deseja muitas felicidades e bênçãos ❤️`;

                // Envia diretamente para o grupo onde foi registado
                await sock.sendMessage(evento.grupo_id, { text: mensagem });
                console.log(`✅ Mensagem de felicitação enviada para: ${evento.nomes_principais} (Grupo: ${evento.grupo_id})`);
            }
        } catch (err) {
            console.error('❌ Erro no Cron Job:', err);
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
