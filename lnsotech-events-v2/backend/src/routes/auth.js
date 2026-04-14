const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');


const JWT_SECRET = process.env.JWT_SECRET || 'lnsotech_super_secret_key_2026';

router.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    
    if (!email || !senha) {
        return res.status(400).json({ erro: 'Por favor envie email e senha' });
    }

    try {
        const { rows } = await req.db.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        
        if (rows.length === 0) {
            return res.status(401).json({ erro: 'Credenciais inválidas' });
        }

        const usuario = rows[0];
        const senhaValida = await bcrypt.compare(senha, usuario.senha);

        if (!senhaValida) {
            return res.status(401).json({ erro: 'Credenciais inválidas' });
        }

        const token = jwt.sign(
            { id: usuario.id, nome: usuario.nome, nivel_acesso: usuario.nivel_acesso },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, nivel_acesso: usuario.nivel_acesso } });
    } catch (err) {
        console.error('Erro no login:', err);
        res.status(500).json({ erro: 'Erro interno no servidor' });
    }
});

// Middleware opcional para usar ao longo de todas as outras rotas seguras!
const verificarToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ erro: 'Token não fornecido' });

    jwt.verify(token.split(' ')[1], JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ erro: 'Token inválido ou expirado' });
        req.usuarioLogado = decoded;
        next();
    });
};

router.get('/me', verificarToken, (req, res) => {
    res.json(req.usuarioLogado);
});

// ====== Gestão de Usuários (Admin) ====== //

// Listar Usuários
router.get('/usuarios', async (req, res) => {
    // Na prática, deve-se extrair e validar o Token JWT aqui antes (middleware).
    // Por simplicidade, assumindo que a chamada foi protegida no frontend.
    try {
        const { rows } = await req.db.query('SELECT id, nome, email, nivel_acesso FROM usuarios ORDER BY id ASC');
        res.json(rows);
    } catch (error) {
        console.error('Erro ao listar usuarios:', error.message);
        res.status(500).json({ erro: 'Falha ao buscar utilizadores' });
    }
});

// Criar Novo Usuário
router.post('/usuarios', async (req, res) => {
    const { nome, email, senha, nivel_acesso } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(senha, 10);
        await req.db.query(
            'INSERT INTO usuarios (nome, email, senha, nivel_acesso) VALUES ($1, $2, $3, $4)',
            [nome, email, hashedPassword, nivel_acesso || 'leitor']
        );
        res.status(201).json({ mensagem: 'Usuário registado com sucesso' });
    } catch (err) {
        res.status(500).json({ erro: 'O email já existe ou ocorreu um erro interno.' });
    }
});

// Apagar Usuário
router.delete('/usuarios/:id', async (req, res) => {
    try {
        // Bloquear apagar o ID 1 (Admin Root)
        if (req.params.id === '1') return res.status(403).json({ erro: 'Não podes apagar o Super Admin!' });
        await req.db.query('DELETE FROM usuarios WHERE id = $1', [req.params.id]);
        res.json({ mensagem: 'Utilizador removido' });
    } catch (error) {
        res.status(500).json({ erro: 'Falha a remover utilizador' });
    }
});

// Editar Usuário
router.put('/usuarios/:id', async (req, res) => {
    const { nome, email, senha, nivel_acesso } = req.body;
    try {
        if (senha && senha.trim() !== '') {
            const hashedPassword = await bcrypt.hash(senha, 10);
            await req.db.query(
                'UPDATE usuarios SET nome=$1, email=$2, senha=$3, nivel_acesso=$4 WHERE id=$5',
                [nome, email, hashedPassword, nivel_acesso, req.params.id]
            );
        } else {
            await req.db.query(
                'UPDATE usuarios SET nome=$1, email=$2, nivel_acesso=$3 WHERE id=$4',
                [nome, email, nivel_acesso, req.params.id]
            );
        }
        res.json({ mensagem: 'Utilizador atualizado com sucesso' });
    } catch (err) {
        res.status(500).json({ erro: 'Falha ao atualizar utilizador. O email pode já estar em uso.' });
    }
});

// Listar Backups (apenas Admin idealmente, assumindo UI auth gorfed)
router.get('/backups', (req, res) => {
    const backupDir = path.resolve(__dirname, '../../src/uploads/backups');
    if (!fs.existsSync(backupDir)) return res.json([]);
    
    fs.readdir(backupDir, (err, files) => {
        if (err) return res.status(500).json({ erro: 'Erro ao ler diretoria de backups' });
        const list = files.map(file => {
            const stats = fs.statSync(path.join(backupDir, file));
            return {
                name: file,
                size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
                date: stats.mtime
            };
        }).sort((a,b) => b.date - a.date);
        res.json(list);
    });
});

// Download de Backup
router.get('/backups/download/:filename', (req, res) => {
    const backupDir = path.resolve(__dirname, '../../src/uploads/backups');
    const file = path.join(backupDir, req.params.filename);
    if (fs.existsSync(file)) {
        res.download(file);
    } else {
        res.status(404).json({ erro: 'Ficheiro não encontrado' });
    }
});

// Restaurar Backup
router.post('/backups/restore/:filename', (req, res) => {
    const backupDir = path.resolve(__dirname, '../../src/uploads/backups');
    const filePath = path.join(backupDir, req.params.filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ erro: 'Ficheiro de backup não encontrado' });
    }

    const host = process.env.DB_HOST || 'lnsotech-db-bot-v2';
    const user = process.env.DB_USER || 'lnso_admin';
    const pass = process.env.DB_PASS || 'n4VbB6#SjG';
    const db   = process.env.DB_NAME || 'lnsotech_db';

    // O '-c' limpa a BD antes de restaurar, '-1' assegura transação única
    // '-F c' é usado porque o pg_dump exportou em custom format
    const restoreCmd = `PGPASSWORD='${pass}' pg_restore -h ${host} -U ${user} -d ${db} -c -1 "${filePath}"`;

    exec(restoreCmd, (error, stdout, stderr) => {
        // pg_restore dita muitos avisos que não são travamentos reais (ex: role permissions), por isso filtramos falhas críticas:
        if (error && !stderr.includes('already exists')) {
            console.error('❌ Erro no restore: ', stderr);
            return res.status(500).json({ erro: 'Erro ao restaurar', detalhes: stderr });
        }
        res.json({ mensagem: 'Backup restaurado com sucesso!' });
    });
});

// ========== CONFIGURAÇÕES DO SISTEMA (Via Auth para Nginx) ========== //
router.get('/configuracoes', async (req, res) => {
    try {
        const result = await req.db.query('SELECT * FROM configuracoes');
        const configs = {};
        result.rows.forEach(r => configs[r.chave] = r.valor);
        res.json(configs);
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.post('/configuracoes', async (req, res) => {
    try {
        const { chave, valor } = req.body;
        // Upsert compatível: tenta update, se não der faz insert
        const resUpnd = await req.db.query('UPDATE configuracoes SET valor = $1 WHERE chave = $2', [valor, chave]);
        if (resUpnd.rowCount === 0) {
            await req.db.query('INSERT INTO configuracoes (chave, valor) VALUES ($1, $2)', [chave, valor]);
        }
        res.json({ mensagem: 'Configuração atualizada!' });
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

module.exports = router;
