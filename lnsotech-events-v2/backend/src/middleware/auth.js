const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'lnsotech_super_secret_key_2026';

const verificarToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ erro: 'Token não fornecido' });

    jwt.verify(token.split(' ')[1], JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ erro: 'Token inválido ou expirado' });
        req.usuarioLogado = decoded;
        next();
    });
};

module.exports = { verificarToken };
