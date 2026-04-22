const UserRepository = require('../repositories/UserRepository');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'lnsotech_super_secret_key_2026';

class AuthService {
    async login(email, senha) {
        const usuario = await UserRepository.findByEmail(email);
        
        if (!usuario) {
            throw new Error('Credenciais inválidas');
        }

        // Verificar bloqueio
        if (usuario.bloqueado_ate && new Date(usuario.bloqueado_ate) > new Date()) {
            const minutos = Math.ceil((new Date(usuario.bloqueado_ate) - new Date()) / 60000);
            throw new Error(`BLOQUEADO|${minutos}`);
        }

        const senhaValida = await bcrypt.compare(senha, usuario.senha);

        if (!senhaValida) {
            const novasFalhas = (usuario.tentativas_falhas || 0) + 1;
            let bloqueio = null;

            if (novasFalhas >= 5) {
                bloqueio = new Date(Date.now() + 3 * 60000); // 3 min
            }

            await UserRepository.updateLoginAttempts(usuario.id, novasFalhas, bloqueio);
            throw new Error(novasFalhas >= 5 ? 'EXCESSO_TENTATIVAS' : 'Credenciais inválidas');
        }

        await UserRepository.resetLoginAttempts(usuario.id);

        if (usuario.two_factor_enabled) {
            return { require2FA: true, userId: usuario.id };
        }

        const token = this.gerarTokenFinal(usuario);

        return { 
            token, 
            usuario: { 
                id: usuario.id, 
                nome: usuario.nome, 
                nivel_acesso: usuario.nivel_acesso,
                grupos_permitidos: usuario.grupos_permitidos || '[]',
                tipos_permitidos: usuario.tipos_permitidos || '[]'
            } 
        };
    }

    gerarTokenFinal(usuario) {
        return jwt.sign(
            { 
                id: usuario.id, 
                nome: usuario.nome, 
                nivel_acesso: usuario.nivel_acesso,
                grupos_permitidos: usuario.grupos_permitidos || '[]',
                tipos_permitidos: usuario.tipos_permitidos || '[]'
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
    }

    verificarToken(token) {
        try {
            return jwt.verify(token.split(' ')[1], JWT_SECRET);
        } catch (e) {
            throw new Error('Token inválido');
        }
    }
}

module.exports = new AuthService();
