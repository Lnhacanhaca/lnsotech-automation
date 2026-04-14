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

// 1. Dicionário Completo de Bodas (1 a 100 anos - Tradição Portugal)
const listaBodas = {
    1: { nome: "Papel", significado: "Simboliza a fragilidade e a flexibilidade do início da relação." },
    2: { nome: "Algodão", significado: "Representa o conforto e a suavidade de dois anos de convivência." },
    3: { nome: "Couro", significado: "Simboliza a resistência e a durabilidade que o casal está a construir." },
    4: { nome: "Flores e Frutas", significado: "Indica a vitalidade e a doçura da união que está a florescer." },
    5: { nome: "Madeira", significado: "Representa raízes fortes e um crescimento sólido." },
    6: { nome: "Açúcar ou Perfume", significado: "Celebra o aroma doce e a essência suave da vida a dois." },
    7: { nome: "Lã ou Latão", significado: "Simboliza o calor que protege o lar e a resistência dos laços." },
    8: { nome: "Barro ou Papoula", significado: "Representa a fertilidade e a união que ganha forma com o tempo." },
    9: { nome: "Cerâmica ou Vime", significado: "Indica a arte de moldar a convivência com paciência e dedicação." },
    10: { nome: "Estanho ou Zinco", significado: "Simboliza a maleabilidade necessária para manter a união por uma década." },
    11: { nome: "Aço", significado: "Representa uma união que se tornou inquebrável sob pressão." },
    12: { nome: "Seda ou Ônix", significado: "Simboliza a suavidade, a sofisticação e a proteção mútua." },
    13: { nome: "Renda", significado: "Representa a delicadeza e a transparência de 13 anos de história." },
    14: { nome: "Marfim", significado: "Um símbolo de nobreza e da força acumulada ao longo dos anos." },
    15: { nome: "Cristal", significado: "Representa a transparência, confiança e clareza da relação." },
    16: { nome: "Turmalina", significado: "Simboliza a vitalidade e a pedra que revigora as energias do casal." },
    17: { nome: "Rosa", significado: "A celebração do amor que continua a florescer e a exalar perfume." },
    18: { nome: "Turquesa", significado: "Símbolo de tranquilidade e o azul profundo da união serena." },
    19: { nome: "Cretone", significado: "Representa a força de um tecido resistente que une as partes." },
    20: { nome: "Porcelana", significado: "Simboliza a beleza e o cuidado necessário para manter a união preciosa." },
    21: { nome: "Zircão", significado: "Representa o brilho e a resistência que o tempo lapidou." },
    22: { nome: "Louça", significado: "Símbolo da utilidade e da arte de servir um ao outro diariamente." },
    23: { nome: "Palha", significado: "Representa a construção paciente de um ninho seguro e acolhedor." },
    24: { nome: "Opala", significado: "Simboliza a variedade de cores e emoções vividas em quase 25 anos." },
    25: { nome: "Prata", significado: "Um marco de brilho e resistência após um quarto de século." },
    26: { nome: "Alexandrita", significado: "Representa a transformação e a adaptação constante do casal." },
    27: { nome: "Crisoprásio", significado: "Simboliza a fidelidade e a esperança que nunca desvanecem." },
    28: { nome: "Hematita", significado: "Representa a força do sangue e o vigor da vida partilhada." },
    29: { nome: "Erva", significado: "Simboliza a renovação constante e a vida que brota do cuidado." },
    30: { nome: "Pérola", significado: "Representa algo precioso construído camada por camada ao longo do tempo." },
    31: { nome: "Nácar", significado: "A substância que protege a pérola, simbolizando proteção mútua." },
    32: { nome: "Pinho", significado: "Representa a imortalidade do amor e a resistência aos invernos." },
    33: { nome: "Crizo", significado: "Simboliza o valor espiritual e a pureza da vossa caminhada." },
    34: { nome: "Oliveira", significado: "O símbolo da paz e da longevidade que colhem hoje." },
    35: { nome: "Coral", significado: "Representa o amadurecimento e a beleza das profundezas marinhas." },
    36: { nome: "Cedro", significado: "Simboliza a dignidade e a força de uma árvore milenar." },
    37: { nome: "Aventurira", significado: "Representa a sorte de se terem encontrado e a aventura contínua." },
    38: { nome: "Carvalho", significado: "A árvore da sabedoria e da resistência inabalável." },
    39: { nome: "Mármore", significado: "Simboliza a polidez e a estabilidade da vossa estrutura familiar." },
    40: { nome: "Esmeralda", significado: "Simboliza o amor incondicional e a paciência eterna." },
    41: { nome: "Seda", significado: "Volta ao toque suave, agora com a força de quatro décadas." },
    42: { nome: "Prata Dourada", significado: "A combinação do valor da prata com o nobre brilho do ouro." },
    43: { nome: "Azevinho", significado: "Símbolo de proteção e de um amor que brilha mesmo no inverno." },
    44: { nome: "Carbonato", significado: "Representa a cristalização final de uma vida em comum." },
    45: { nome: "Rubi", significado: "A cor da paixão que permanece viva e ardente após décadas." },
    46: { nome: "Alabastro", significado: "Simboliza a pureza e a luz que emana de uma vida bem vivida." },
    47: { nome: "Jaspe", significado: "Representa a alegria, a coragem e o conforto espiritual." },
    48: { nome: "Feldspato", significado: "Símbolo da criatividade e da renovação espiritual do casal." },
    49: { nome: "Heliotrópio", significado: "Representa o foco no sol e na luz que guia o vosso caminho." },
    50: { nome: "Ouro", significado: "O metal mais precioso para celebrar uma vida inteira de partilha." },
    51: { nome: "Bronze", significado: "Simboliza a liga inseparável de dois metais que se tornaram um só." },
    52: { nome: "Argila", significado: "A terra que vos sustenta e a capacidade de se moldarem sempre." },
    53: { nome: "Antimônio", significado: "Simboliza a proteção contra as adversidades externas." },
    54: { nome: "Níquel", significado: "Representa a resistência à corrosão e ao desgaste do tempo." },
    55: { nome: "Ametista", significado: "Símbolo da paz, da espiritualidade e da sobriedade emocional." },
    56: { nome: "Malaquita", significado: "Representa o progresso e a cura através do amor mútuo." },
    57: { nome: "Lápis Lazúli", significado: "Simboliza a verdade, a sabedoria e a união celestial." },
    58: { nome: "Vidro", significado: "Representa a transparência total e a luz que atravessa o vosso lar." },
    59: { nome: "Cereja", significado: "Simboliza a doçura e a colheita dos frutos de uma vida longa." },
    60: { nome: "Diamante", significado: "Representa a indestrutibilidade absoluta da vossa união." },
    61: { nome: "Cobre", significado: "Simboliza a condutividade do amor e o brilho avermelhado da vida." },
    62: { nome: "Telurita", significado: "Representa a ligação profunda com a terra e as origens." },
    63: { nome: "Sândalo", significado: "O perfume que resiste ao tempo e acalma a alma." },
    64: { nome: "Fabulita", significado: "A celebração de uma história que parece uma fábula real." },
    65: { nome: "Platina", significado: "O metal mais raro e nobre para celebrar a raridade do vosso amor." },
    66: { nome: "Ébano", significado: "Representa a profundidade e a resistência de uma base escura e sólida." },
    67: { nome: "Neve", significado: "Simboliza a pureza absoluta e o silêncio respeitoso de décadas." },
    68: { nome: "Chumbo", significado: "Representa a densidade e o peso de uma história inamovível." },
    69: { nome: "Mercúrio", significado: "Simboliza a fluidez e a capacidade de se adaptarem a tudo." },
    70: { nome: "Vinho", significado: "Representa uma união que envelheceu com dignidade e se tornou melhor." },
    71: { nome: "Zinco", significado: "Proteção constante contra qualquer sinal de desgaste." },
    72: { nome: "Aveia", significado: "Símbolo da nutrição e do sustento que deram um ao outro." },
    73: { nome: "Cafu", significado: "Representa a raridade e o valor de uma caminhada única." },
    74: { nome: "Maçã", significado: "Simboliza a vitalidade e a saúde de um amor que nutre." },
    75: { nome: "Brilhante", significado: "A luz máxima que emana de 75 anos de transparência e amor." },
    76: { nome: "Cipreste", significado: "Simboliza a imortalidade e a glória de uma vida honrada." },
    77: { nome: "Alfazema", significado: "O aroma da tranquilidade e da harmonia plena." },
    78: { nome: "Benjoim", significado: "Representa a proteção espiritual e o perfume sagrado do lar." },
    79: { nome: "Café", significado: "A energia e o calor matinal que sustentam a vossa jornada." },
    80: { nome: "Carvalho", significado: "A força inabalável que resiste a todos os ventos da história." },
    81: { nome: "Manjerona", significado: "Simboliza a alegria, o conforto e o bem-estar duradouro." },
    82: { nome: "Salvia", significado: "Representa a saúde, a longevidade e a sabedoria acumulada." },
    83: { nome: "Resina", significado: "A substância que une e cura, mantendo tudo coeso e forte." },
    84: { nome: "Hortênsia", significado: "Simboliza a gratidão por serem compreendidos e amados." },
    85: { nome: "Girassol", significado: "Foco total na luz e na positividade após 85 anos juntos." },
    86: { nome: "Hortelã", significado: "Representa o frescor e a renovação dos sentimentos." },
    87: { nome: "Cássia", significado: "Simboliza a proteção divina e o aroma da retidão." },
    88: { nome: "Estrela-do-mar", significado: "Representa a regeneração e a capacidade de se renovar." },
    89: { nome: "Álamo", significado: "A árvore que sussurra segredos de paz e proteção." },
    90: { nome: "Diamante Negro", significado: "A raridade extrema e o mistério de uma união quase centenária." },
    91: { nome: "Pinheiro", significado: "Simboliza o crescimento eterno e a esperança que nunca morre." },
    92: { nome: "Salgueiro", significado: "Representa a flexibilidade e a resiliência perante as marés da vida." },
    93: { nome: "Figueira", significado: "Símbolo da prosperidade e do fruto doce da vossa descendência." },
    94: { nome: "Palmeira", significado: "Representa a vitória e a glória de quem atravessou o deserto unido." },
    95: { nome: "Sândalo", significado: "O aroma sagrado que marca o fim de um século de história." },
    96: { nome: "Oliveira", significado: "A confirmação da paz eterna e da sabedoria plena." },
    97: { nome: "Abeto", significado: "Símbolo da elevação espiritual e da vida que sempre se renova." },
    98: { nome: "Pinheiro", significado: "A resistência final antes do grande marco centenário." },
    99: { nome: "Pinheiro", significado: "A contagem final para um século de amor indestrutível." },
    100: { nome: "Jequitibá ou Ossos", significado: "Simboliza a eternidade absoluta, a imortalidade e a força indestrutível da vossa alma gémea." }
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
            global.waSocket = sock; // GUARDAR SOCKET GLOBALMENTE PARA O PAINEL PODER TESTAR
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
        const backupDir = path.resolve(__dirname, '../../../uploads/backups');
        
        // Garante que a directoria de backups existe
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const dateStr = new Date().toISOString().slice(0, 10);
        const fileName = `lnsotech_backup_${dateStr}.sql`;
        const filePath = path.join(backupDir, fileName);

        // O POSTGRES_URL do pool.options ou process.env.DATABASE_URL
        const host = process.env.DB_HOST || 'database';
        const user = process.env.DB_USER || 'lnso_admin';
        const pass = process.env.DB_PASSWORD || 'luis@nhaca';
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

        const configRes = await pool.query("SELECT valor FROM configuracoes WHERE chave = 'assinatura_bot'");
        const assinatura = configRes.rows[0]?.valor || '';

        for (let evento of res.rows) {
            const freq = evento.frequencia_lembrete || 'anual';
            const anos = new Date().getFullYear() - evento.ano_origem;
            if (freq === 'anual' && anos <= 0 && !manual) continue;

            let mensagem;
            if (evento.tipo_evento === 'casamento') {
                const bodaObj = listaBodas[anos] || { nome: "União e Amor", significado: "Um momento especial para renovar os vossos votos." };
                let template = templatesMap['casamento'] || 'Feliz Aniversário de Casamento, {nomes}! 💍 Bodas de {bodas}!\n✨ *Significado:* {significado}';
                
                // Se o template personalizado NÃO tem o marcador de significado, vamos anexar automaticamente para garantir que é enviado
                if (!template.includes('{significado}')) {
                    template += '\n✨ *Significado:* {significado}';
                }

                mensagem = template
                    .replace('{nomes}', evento.nomes_principais)
                    .replace('{bodas}', bodaObj.nome)
                    .replace('{significado}', bodaObj.significado);
            } else {
                const template = templatesMap[evento.tipo_evento] || 'Parabéns {nomes}! 🎉 Celebrando mais um ano!';
                mensagem = template.replace('{nomes}', evento.nomes_principais);
            }

            if (assinatura) {
                mensagem += `\n\n${assinatura}`;
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
