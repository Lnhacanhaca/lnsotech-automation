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

// 3. Configuração do Banco de Dados (Valores Fixos para Teste)
const pool = new Pool({
    host: 'database',           // Nome do serviço no docker-compose
    user: 'lnso_admin',         // O user que está no seu init.sql
    password: 'luis@nhaca',     // A sua senha
    database: 'lnsotech_db',    // O nome da base de dados
    port: 5432,
});

// 4. Configuração do Cliente WhatsApp
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './sessions/lnsotech'  }),
    puppeteer: {
        executablePath: '/usr/bin/chromium',
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-zygote',
            '--single-process' // Isto ajuda a não criar múltiplos processos de perfil
        ],
        protocolTimeout: 120000
    }
});

// 5. Eventos do WhatsApp
client.on('qr', qr => qrcode.generate(qr, { small: true }));

client.on('ready', () => {
  console.log("🚀 LNSOTECH Bot Online!");

  // Envia mensagem de teste imediata para o grupo configurado no .env
  if (process.env.GRUPO_ID && process.env.GRUPO_ID !== 'pendente') {
      client.sendMessage(process.env.GRUPO_ID, "🤖 Teste de conexão: O bot está ativo e configurado para este grupo!")
          .then(() => console.log("✅ Mensagem de teste enviada com sucesso!"))
          .catch(err => console.error("❌ Erro ao enviar mensagem de teste:", err.message));
  } else {
      console.log("⚠️ GRUPO_ID não configurado no .env. Pulando mensagem de teste.");
  }

  const tentarListarGrupos = async () => {
    try {
      const chats = await client.getChats();
      const groups = chats.filter(c => c.isGroup);

      if (groups.length > 0) {
        console.log("📋 LISTA DE GRUPOS (NOME | ID):");
        groups.forEach(g => {
          console.log(`${g.name} | ID: ${g.id._serialized}`);
        });
      } else {
        console.log("Ainda sem grupos, tentando novamente em 15s...");
        setTimeout(tentarListarGrupos, 15000);
      }
    } catch (err) {
      console.error("Erro ao listar chats:", err.message);
      setTimeout(tentarListarGrupos, 15000);
    }
  };

  // Primeira tentativa de listar grupos após 20 segundos
  setTimeout(tentarListarGrupos, 20000);
});


// 6. Ouvir mensagens (Usando message_create para máxima compatibilidade)
client.on('message_create', async (msg) => {
    // Log para ver se o bot está "a ouvir" qualquer coisa
    // console.log(`Mensagem detectada: ${msg.body} | De: ${msg.from}`);

    // Comando para registrar: !reg Nome do Casal, AAAA-MM-DD
    if (msg.body.startsWith('!reg ')) {
        console.log("🎯 Comando !reg identificado!");

        const dados = msg.body.slice(5).split(',');

        if (dados.length !== 2) {
            console.log("⚠️ Formato de comando errado.");
            return msg.reply('❌ Formato inválido! Use: !reg Nome, AAAA-MM-DD');
        }

        const nomes = dados[0].trim();
        const dataCasamento = dados[1].trim();

        try {
            const query = 'INSERT INTO aniversarios (nomes, data_casamento) VALUES ($1, $2)';
            await pool.query(query, [nomes, dataCasamento]);
            
            console.log(`✅ Sucesso: ${nomes} inserido no banco.`);
            msg.reply(`✅ Registado com sucesso: ${nomes} - ${dataCasamento}`);
        } catch (err) {
            console.error('❌ Erro no Banco de Dados:', err.message);
            msg.reply('❌ Erve um erro ao salvar no banco de dados. Verifique a data (AAAA-MM-DD).');
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
