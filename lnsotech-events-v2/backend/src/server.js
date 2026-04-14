require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { connectToWhatsApp } = require('./bot/engine');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do DB para partilhar com as rotas
const pool = new Pool({
    host: process.env.DB_HOST || 'database',   
    user: process.env.DB_USER || 'lnso_admin',         
    password: process.env.DB_PASSWORD || 'luis@nhaca',     
    database: process.env.DB_NAME || 'lnsotech_db',    
    port: process.env.DB_PORT || 5432,
});

// Middlewares
app.use(cors());
app.use(express.json());

// Logger Global para Debug de rotas
app.use((req, res, next) => {
    console.log(`[REQ] ${req.method} ${req.url}`);
    next();
});

// Expor pasta de uploads publicamente para fotos dos eventos
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Injetar Pool no Request para facilitar uso nas rotas
app.use((req, res, next) => {
    req.db = pool;
    next();
});

// Importar rotas
const eventosRoutes = require('./routes/eventos');
const authRoutes = require('./routes/auth');

app.use('/api/eventos', eventosRoutes);
app.use('/api/auth', authRoutes);

// Rota raiz (Health Check)
app.get('/', (req, res) => {
    res.json({ mensagem: '🚀 API LNSOTECH V2 Funcionando!', botStatus: 'Online' });
});

// ========== ROTA DE ARQUIVOS (RAIZ) ========== //
app.get('/ver-arquivo', (req, res) => {
    const filename = req.query.f;
    if (!filename) return res.status(400).send('Ficheiro não especificado');
    const cleanName = filename.replace('/uploads/', '').replace('uploads/', '');
    const filePath = path.join(__dirname, '../uploads/', cleanName);
    
    if (fs.existsSync(filePath)) {
        res.header('Content-Type', 'image/jpeg'); // Forçar tipo imagem
        res.sendFile(filePath);
    } else {
        res.status(404).send('Arquivo não encontrado');
    }
});

// Iniciar Servidor web e Bot simultaneamente
app.listen(PORT, async () => {
    console.log(`\n🌐 [API] Servidor Express rodando na porta ${PORT}`);
    
    // Iniciar o motor do WhatsApp
    try {
        await connectToWhatsApp();
    } catch (err) {
        console.error('❌ Erro Fatal ao iniciar o Baileys:', err);
    }
});
