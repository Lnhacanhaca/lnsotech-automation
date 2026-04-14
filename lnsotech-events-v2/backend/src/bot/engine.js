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
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');

// Estado global da conexão WhatsApp
global.waState = { qr: null, status: 'desconectado', lastUpdate: null };

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
    
    // Garantir tabela de configurações
    await pool.query("CREATE TABLE IF NOT EXISTS configuracoes (chave TEXT PRIMARY KEY, valor TEXT)");
    const hasConfig = await pool.query("SELECT 1 FROM configuracoes WHERE chave = 'hora_lembrete'");
    if (hasConfig.rowCount === 0) {
        await pool.query("INSERT INTO configuracoes (chave, valor) VALUES ('hora_lembrete', '07:00')");
    }

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
            console.log('[QR Code] Novo QR gerado! Disponível no painel web.');
            qrcodeTerminal.generate(qr, { small: true });
            // Gerar imagem base64 para o painel web
            try {
                const qrDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
                global.waState = { qr: qrDataUrl, status: 'aguardando_qr', lastUpdate: new Date().toISOString() };
            } catch (e) { console.error('Erro ao gerar QR image:', e); }
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
            global.waState = { qr: null, status: 'conectado', lastUpdate: new Date().toISOString() };

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

            if (msg.key.fromMe) return;

            const textMessage = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

            // TESTE DE CONEXÃO DIRETO
            if (textMessage === '!ping') {
                console.log('🏓 PING recebido!');
                return await sock.sendMessage(msg.key.remoteJid, { text: '🏓 PONG! O robô está vivo e a ouvir.' }, { quoted: msg });
            }

            // ========== RESPOSTAS AUTOMÁTICAS (AUTO-REPLY) ========== //
            const myId = sock.user.id.split(':')[0];
            const myLid = sock.user.lid?.split(':')[0] || '24868565323955'; // Forçamos a deteção do LID visto nos logs
            
            const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
            const repliedJid = contextInfo?.participant;
            const mentionedJids = contextInfo?.mentionedJid || [];
            
            // Verifica se a resposta ou menção é para QUALQUER um dos IDs do bot
            const isReplyToBot = (repliedJid?.includes(myId)) || (repliedJid?.includes(myLid));
            const isMentioningBot = mentionedJids.some(jid => jid.includes(myId) || jid.includes(myLid)) || 
                                    textMessage?.includes(myId) || textMessage?.includes(myLid);

            if ((isReplyToBot || isMentioningBot) && textMessage) {
                console.log(`🤖 Auto-Reply Ativado para: "${textMessage}"`);
            const textLower = textMessage.toLowerCase();
            
            if (textLower.includes('obrigad') || textLower.includes('obg') || textLower.includes('grato') || textLower.includes('amem') || textLower.includes('amém')) {
                await sock.sendMessage(msg.key.remoteJid, { text: 'A LNSOTECH agradece! ✨ Que este dia seja repleto de muitas bênçãos.' }, { quoted: msg });
            } else if (textLower.includes('parab') || textLower.includes('felic') || textLower.includes('feliz')) {
                await sock.sendMessage(msg.key.remoteJid, { text: 'Muito obrigado! 🎉 Estamos felizes em celebrar mais um momento inesquecível!' }, { quoted: msg });
            } else {
                await sock.sendMessage(msg.key.remoteJid, { text: 'Recebemos a tua mensagem! 🤖 Se precisares de algo, a equipa LNSOTECH está ao dispor.' }, { quoted: msg });
            }
            
            await registarLog(null, msg.key.remoteJid, 'auto_resposta', `Respondido a user: ${textMessage.substring(0,30)}...`, 'sucesso');
        }
    });

    // Expor sock globalmente para que o servidor API possa usá-lo (ex: teste de conexão manual)
    global.waSocket = sock;

    return sock;
}

// 5. Função agendada com cron (Dinâmica)
function iniciarCron(sock) {
    console.log('⏳ Monitor de Cron Job iniciado (Verificação a cada minuto)');
    
    // Verifica a cada minuto se é a hora de enviar
    cron.schedule('* * * * *', async () => {
        try {
            const dataMaputo = new Date().toLocaleTimeString("pt-PT", {timeZone: "Africa/Maputo", hour: '2-digit', minute: '2-digit'});
            
            // Buscar hora configurada
            const configRes = await pool.query("SELECT valor FROM configuracoes WHERE chave = 'hora_lembrete'");
            const horaAgendada = configRes.rows[0]?.valor || '07:00';

            if (dataMaputo === horaAgendada) {
                console.log(`⏰ Hora de enviar lembretes automático! (${dataMaputo})`);
                const total = await executarLembretes(sock);
                console.log(`✅ Ciclo automático finalizado. Total: ${total}`);
            }
        } catch (err) {
            console.error('❌ Erro no monitor de Cron:', err);
        }
    }, { timezone: "Africa/Maputo" });

    // ========== CRON JOB PARA BACKUP DA BASE DE DADOS (00:00) ========== //
    cron.schedule('0 0 * * *', () => {
        console.log('💾 LNSOTECH: Iniciando backup diário da base de dados...');
        const backupDir = path.resolve(__dirname, '../../src/uploads/backups');
        
        // Garante que a directoria de backups existe
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const dateStr = new Date().toISOString().slice(0, 10);
        const fileName = `lnsotech_backup_${dateStr}.sql`;
        const filePath = path.join(backupDir, fileName);

        // O POSTGRES_URL do pool.options ou process.env.DATABASE_URL
        const host = process.env.DB_HOST || 'lnsotech-db-bot-v2';
        const user = process.env.DB_USER || 'lnso_admin';
        const pass = process.env.DB_PASS || 'n4VbB6#SjG';
        const db   = process.env.DB_NAME || 'lnsotech_db';

        // Usa pg_dump para exportar
        const dumpCommand = `PGPASSWORD='${pass}' pg_dump -h ${host} -U ${user} -d ${db} -F c -f "${filePath}"`;

        exec(dumpCommand, (error, stdout, stderr) => {
            if (error) {
                console.error('❌ Erro ao criar backup:', error.message);
                return;
            }
            console.log(`✅ Backup guardado com sucesso: ${fileName}`);

            // Limpeza: apagar backups com mais de 15 dias
            fs.readdir(backupDir, (err, files) => {
                if (err) return;
                const now = Date.now();
                const dias15 = 15 * 24 * 60 * 60 * 1000;
                files.forEach(file => {
                    const fullPath = path.join(backupDir, file);
                    fs.stat(fullPath, (err, stats) => {
                        if (err) return;
                        if (now - stats.mtimeMs > dias15) {
                            fs.unlink(fullPath, err => {
                                if (!err) console.log(`🗑️ Backup antigo removido: ${file}`);
                            });
                        }
                    });
                });
            });
        });
    }, {
        timezone: "Africa/Maputo"
    });

    // ========== CRON JOB PARA RELATÓRIO SEMANAL (Sexta-feira 17:00) ========== //
    cron.schedule('0 17 * * 5', async () => {
        const adminNumber = process.env.REPORT_PHONE_NUMBER;
        if (!adminNumber) {
            console.log('📉 LNSOTECH: Relatório semanal criado, mas REPORT_PHONE_NUMBER não está definido no .env para envio.');
            return;
        }

        console.log('📊 LNSOTECH: Gerando relatório PDF semanal...');
        const adminJid = adminNumber.includes('@s.whatsapp.net') ? adminNumber : `${adminNumber.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
        
        try {
            // Buscar stats básicas para preencher o PDF
            const eventosCount = await pool.query('SELECT COUNT(*) FROM eventos');
            const logsRecentes = await pool.query("SELECT COUNT(*) FROM logs_envio WHERE criado_em >= NOW() - INTERVAL '7 days' AND tipo_log = 'lembrete_enviado'");
            const falhasRecentes = await pool.query("SELECT COUNT(*) FROM logs_envio WHERE criado_em >= NOW() - INTERVAL '7 days' AND status = 'falha'");

            const numEventos = parseInt(eventosCount.rows[0].count);
            const numLogs = parseInt(logsRecentes.rows[0].count);
            const numFalhas = parseInt(falhasRecentes.rows[0].count);

            const doc = new PDFDocument({ margin: 50 });
            const reportDir = path.resolve(__dirname, '../../src/uploads/relatorios');
            if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
            
            const filePath = path.join(reportDir, `Relatorio-Semanal-${new Date().toISOString().slice(0, 10)}.pdf`);
            const writeStream = fs.createWriteStream(filePath);
            
            doc.pipe(writeStream);
            
            // Design simples de PDF
            doc.fontSize(20).text('LNSOTECH Automation CRM', { align: 'center' });
            doc.moveDown();
            doc.fontSize(14).text('Relatório Semanal de Atividades', { align: 'center' });
            doc.moveDown(2);
            
            doc.fontSize(12).text(`Data: ${new Date().toLocaleDateString('pt-PT')}`);
            doc.moveDown();
            doc.text('Estatísticas da Semana:');
            doc.moveDown();
            doc.text(`• Total de Clientes/Eventos Registados: ${numEventos}`);
            doc.text(`• Lembretes Disparados (Últimos 7 dias): ${numLogs}`);
            doc.text(`• Lembretes Falhados (Erros do Bot): ${numFalhas}`);
            
            doc.moveDown(3);
            doc.fontSize(10).fillColor('grey').text('Sistema Automático de Gestão de Eventos • LNSOTECH', { align: 'center' });
            doc.end();

            // Esperar o PDF ser completamente escrito no disco
            writeStream.on('finish', async () => {
                const captionMsg = `📊 *LNSOTECH CRM - Resumo da Semana*\n\nTotal de Base de Dados: ${numEventos}\nLembretes na semana: ${numLogs}\n\nSegue o anexo oficial em PDF. Bom fim de semana!`;
                
                await sock.sendMessage(adminJid, { 
                    document: { url: filePath }, 
                    mimetype: 'application/pdf', 
                    fileName: `LNSO-Relatorio-${new Date().toISOString().slice(0, 10)}.pdf`, 
                    caption: captionMsg 
                });
                console.log(`✅ Relatório enviado para o Administrador: ${adminJid}`);
            });

        } catch (err) {
            console.error('❌ Erro na geração do Relatório Semanal:', err);
        }
    }, {
        timezone: "Africa/Maputo"
    });
}

// Iniciar conexão
if (require.main === module) {
    connectToWhatsApp().catch(err => console.log('Erro inesperado: ' + err));
}

async function executarLembretes(sock, manual = false) {
    const agoraMaputo = new Date().toLocaleString("pt-PT", {timeZone: "Africa/Maputo"});
    console.log(`🔍 [${agoraMaputo}] ${manual ? 'DISPARO MANUAL' : 'SISTEMA'}: Verificando eventos...`);
    let enviados = 0;
    
    try {
        const query = `
            SELECT id, nomes_principais, grupo_id, tipo_evento, foto_url,
                   frequencia_lembrete,
                   EXTRACT(YEAR FROM data_evento) as ano_origem 
            FROM eventos 
            WHERE grupo_id IS NOT NULL AND (
                -- ANUAL: mesmo dia e mês
                ((frequencia_lembrete = 'anual' OR frequencia_lembrete IS NULL)
                 AND TO_CHAR(data_evento, 'DD-MM') = TO_CHAR(CURRENT_DATE AT TIME ZONE 'Africa/Maputo', 'DD-MM'))
                OR
                -- MENSAL: mesmo dia do mês
                (frequencia_lembrete = 'mensal'
                 AND TO_CHAR(data_evento, 'DD') = TO_CHAR(CURRENT_DATE AT TIME ZONE 'Africa/Maputo', 'DD'))
                OR
                -- SEMANAL: mesmo dia da semana (0-6)
                (frequencia_lembrete = 'semanal'
                 AND EXTRACT(DOW FROM data_evento) = EXTRACT(DOW FROM (CURRENT_DATE AT TIME ZONE 'Africa/Maputo')))
                OR
                -- DIÁRIO
                frequencia_lembrete = 'diario'
            )
        `;
        const res = await pool.query(query);
        console.log(`📊 [DB Query] Eventos encontrados para hoje: ${res.rows.length}`);
        
        if (res.rows.length === 0) {
            console.log("ℹ️ Nenhum evento corresponde aos critérios de data de hoje.");
        }

        const templatesRes = await pool.query('SELECT * FROM templates_mensagem');
        const templatesMap = {};
        templatesRes.rows.forEach(t => { templatesMap[t.tipo_evento] = t.mensagem; });

        for (let evento of res.rows) {
            const freq = evento.frequencia_lembrete || 'anual';
            const anos = new Date().getFullYear() - evento.ano_origem;
            if (freq === 'anual' && anos <= 0 && !manual) continue;

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
                if (evento.foto_url) {
                    const fotoPath = path.resolve(__dirname, '../../uploads', path.basename(evento.foto_url));
                    if (fs.existsSync(fotoPath)) {
                        await sock.sendMessage(evento.grupo_id, {
                            image: { url: fotoPath },
                            caption: mensagem
                        });
                    } else {
                        await sock.sendMessage(evento.grupo_id, { text: mensagem });
                    }
                } else {
                    await sock.sendMessage(evento.grupo_id, { text: mensagem });
                }
                await registarLog(evento.id, evento.grupo_id, manual ? 'teste_manual' : 'lembrete_enviado', mensagem, 'sucesso');
                console.log(`✅ Enviado para: ${evento.nomes_principais} (Grupo: ${evento.grupo_id})`);
            } catch (sendErr) {
                await registarLog(evento.id, evento.grupo_id, 'lembrete_falha', sendErr.message, 'falha');
                console.error(`❌ Falha ao enviar para ${evento.grupo_id}:`, sendErr.message);
            }
            enviados++;
        }
        return enviados;
    } catch (err) {
        console.error('❌ Erro na execução de lembretes:', err);
        return 0;
    }
}

module.exports = { connectToWhatsApp, executarLembretes };
