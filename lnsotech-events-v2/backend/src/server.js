require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const db = require('./config/database');
const DatabaseService = require('./services/DatabaseService');
const manager = require('./bot/engine');

// Importar rotas
const eventosRoutes = require('./routes/eventos');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Confiar no Reverse Proxy (NGINX/Docker) para o Rate Limiter ler os IPs reais e não bloquear toda a gente
app.set('trust proxy', 1);

// Configuração do Rate Limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 3000, // Aumentado para 3000 para não bloquear o polling de 3 em 3 segundos do frontend
    message: { erro: 'Muitos pedidos efetuados a partir deste IP. Tente novamente mais tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Middlewares
app.use(helmet({ crossOriginResourcePolicy: false })); // Proteção de cabeçalhos, permitindo imagens cross-origin
app.use(cors());
app.use('/api/', apiLimiter); // Aplica o limitador de tráfego a todas as rotas da API
app.use(express.json());

// Injetar Pool no Request (Manter compatibilidade legado se necessário, mas novos controllers usam singleton)
app.use((req, res, next) => {
    req.db = db;
    next();
});

// Arquivos estáticos
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Registo de Rotas
app.use('/api/eventos', eventosRoutes);
app.use('/api/auth', authRoutes);

// Rota de Imagem (Global para compatibilidade)
const EventoController = require('./controllers/EventoController');
app.get('/api/imagem-evento/:id', EventoController.serveImage);

// Health Check
app.get('/', (req, res) => {
    res.json({ mensagem: '🚀 API LNSOTECH V2 com Padrões Modernos Funcionando!', botStatus: 'Online' });
});

// Inicialização
const start = async () => {
    try {
        // 1. Inicializar Base de Dados
        await DatabaseService.initialize();

        // 2. Iniciar Sistema Multi-Bot
        await manager.init().catch(err => {
            console.error('❌ Erro ao iniciar motor Multi-Bot:', err.message);
        });

        // 3. Iniciar Servidor Web
        app.listen(PORT, () => {
            console.log(`\n🌐 [API] Servidor rodando na porta ${PORT}`);
        });
    } catch (error) {
        console.error('❌ Erro Fatal no arranque do sistema:', error);
        process.exit(1);
    }
};

start();

