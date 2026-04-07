require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { Pool } = require('pg');
const cron = require('node-cron');

// Configuração do Banco de Dados usando Variáveis de Ambiente
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
    // Listar IDs de grupos no log para facilitar o deploy
    const chats = await client.getChats();
    chats.filter(c => c.isGroup).forEach(g => console.log(`Grupo: ${g.name} | ID: ${g.id._serialized}`));
});

// Lógica de Registro via WhatsApp
client.on('message', async msg => {
    if (msg.body.startsWith('!reg ')) {
        const [nomes, data] = msg.body.slice(5).split(',');
        try {
            await pool.query('INSERT INTO aniversarios (nomes, data_casamento) VALUES ($1, $2)', [nomes.trim(), data.trim()]);
            msg.reply('✅ Registado com sucesso!');
        } catch (e) { msg.reply('❌ Erro no formato! Use: !reg Casal, AAAA-MM-DD'); }
    }
});

client.initialize();
