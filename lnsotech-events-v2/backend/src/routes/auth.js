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
            { id: usuario.id, nome: usuario.nome, nivel: usuario.nivel_acesso },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, nivel: usuario.nivel_acesso } });
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

module.exports = router;
