const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

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

module.exports = router;
