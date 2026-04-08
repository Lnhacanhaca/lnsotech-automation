// 1. Carregar variáveis de ambiente e dependências principais
require('dotenv').config();
const cron = require('node-cron');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { Pool } = require('pg');

// 2. Objeto de Bodas
const listaBodas = {
    1: "Papel", 2: "Algodão", 3: "Couro", 4: "Flores e Frutas", 5: "Madeira",
    6: "Perfume ou Açúcar", 7: "Lã ou Latão", 8: "Papoula ou Barro", 9: "Cerâmica ou Vime", 10: "Estanho",
    11: "Aço", 12: "Seda ou Ônix", 13: "Renda", 14: "Marfim", 15: "Cristal",
    20: "Porcelana", 25: "Prata", 30: "Pérola", 35: "Coral", 40: "Esmeralda",
    45: "Rubi", 50: "Ouro", 60: "Diamante"
};

// 3. Configuração do Banco de Dados
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: 5432,
});

// 4. Configuração do Cliente WhatsApp
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './sessions/lnsotech'  }),
    puppeteer: {
        executablePath:'/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        protocolTimeout: 120000 // 2 minutos
    }
});

// 5. Eventos do WhatsApp
client.on('qr', qr => qrcode.generate(qr, { small: true }));

client.on('ready', () => {
  console.log("🚀 LNSOTECH Bot Online!");

  const tentarListarGrupos = async () => {
    try {
      const chats = await client.getChats();
      const groups = chats.filter(c => c.isGroup);

      if (groups.length > 0) {
        console.log("Grupos carregados:", groups.map(g => g.name));
      } else {
        console.log("Ainda sem grupos, tentando novamente em 15s...");
        setTimeout(tentarListarGrupos, 15000);
      }
    } catch (err) {
      console.error("Erro ao listar chats:", err.message);
      setTimeout(tentarListarGrupos, 15000);
    }
  };

  // primeira tentativa após 20 segundos
  setTimeout(tentarListarGrupos, 20000);
});



// 6. Lógica de Registro via WhatsApp
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

// 7. Função agendada com cron
cron.schedule('0 8 * * *', async () => {
    console.log('🔍 LNSOTECH: Verificando aniversários de hoje...');
    try {
        const res = await pool.query(
            "SELECT nomes, EXTRACT(YEAR FROM data_casamento) as ano_origem FROM aniversarios " +
            "WHERE EXTRACT(DAY FROM data_casamento) = EXTRACT(DAY FROM CURRENT_DATE) " +
            "AND EXTRACT(MONTH FROM data_casamento) = EXTRACT(MONTH FROM CURRENT_DATE)"
        );

        for (let casal of res.rows) {
            const anos = new Date().getFullYear() - casal.ano_origem;
            if (anos <= 0) continue;

            const nomeBoda = listaBodas[anos] || "União e Amor";
            const mensagem = `🎉 *LNSOTECH CELEBRAÇÃO* 🎉\n\n` +
                             `Hoje o casal *${casal.nomes}* celebra ${anos} anos de união!\n` +
                             `💍 Felizes *Bodas de ${nomeBoda}*!\n\n` +
                             `Desejamos muitas felicidades e bênçãos ❤️`;

            await client.sendMessage(process.env.GRUPO_ID, mensagem);
            console.log(`✅ Mensagem enviada para: ${casal.nomes}`);
        }
    } catch (err) {
        console.error('❌ Erro no Cron Job:', err);
    }
}, {
    timezone: "Africa/Maputo"
});

// 8. Inicializar o cliente
client.initialize();
