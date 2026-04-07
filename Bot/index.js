require('dotenv').config();
const cron = require('node-cron');

// Configuração do Banco de Dados
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: 5432,
});

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
    puppeteer: {
        executablePath: process.env.CHROME_PATH || '/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', qr => qrcode.generate(qr, { small: true }));

client.on('ready', async () => {
    console.log('🚀 LNSOTECH Bot Online!');
    try {
        const chats = await client.getChats();
        const grupos = chats.filter(c => c.isGroup);
        console.log('--- LISTA DE GRUPOS ---');
        grupos.forEach(g => {
            console.log(`Grupo: ${g.name} | ID: ${g.id._serialized}`);
        });
        console.log('-----------------------');
    } catch (err) {
        console.error('Erro ao listar chats:', err);
    }
});

// Lógica de Registro via WhatsApp
client.on('message', async msg => {
    if (msg.body.startsWith('!reg ')) {
        const partes = msg.body.slice(5).split(',');
        if (partes.length < 2) return msg.reply('❌ Use: !reg Casal, AAAA-MM-DD');

        const nomes = partes[0].trim();
        const data = partes[1].trim();

        try {
            await pool.query('INSERT INTO aniversarios (nomes, data_casamento) VALUES ($1, $2)', [nomes, data]);
            msg.reply(`✅ Registado: ${nomes} - ${data}`);
        } catch (e) {
            console.error(e);
            msg.reply('❌ Erro ao salvar no banco. Verifique a data!');
        }
    }
});

client.initialize();
