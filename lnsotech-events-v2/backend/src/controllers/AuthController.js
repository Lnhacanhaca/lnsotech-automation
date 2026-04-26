const AuthService = require('../services/AuthService');
const UserService = require('../services/UserService');
const AuditService = require('../services/AuditService');
const TwoFactorService = require('../services/TwoFactorService');
const UserRepository = require('../repositories/UserRepository');

class AuthController {
    async login(req, res) {
        const { email, senha } = req.body;
        if (!email || !senha) return res.status(400).json({ erro: 'Envie email e senha' });

        try {
            const data = await AuthService.login(email, senha);
            res.json(data);
        } catch (err) {
            if (err.message.startsWith('BLOQUEADO|')) {
                const min = err.message.split('|')[1];
                return res.status(423).json({ erro: `Conta bloqueada. Tente em ${min} min.` });
            }
            if (err.message === 'EXCESSO_TENTATIVAS') {
                return res.status(401).json({ erro: 'Conta bloqueada por 3 min devido a excesso de tentativas.' });
            }
            res.status(401).json({ erro: err.message });
        }
    }

    async me(req, res) {
        try {
            const user = await UserRepository.findById(req.usuarioLogado.id);
            if (!user) return res.status(404).json({ erro: 'Utilizador não encontrado' });
            
            // Não retornar a senha nem o segredo 2FA
            const { senha, two_factor_secret, ...safeUser } = user;
            res.json(safeUser);
        } catch (err) {
            res.status(500).json({ erro: 'Erro ao obter dados do utilizador' });
        }
    }

    async getLogsAuditoria(req, res) {
        try {
            const logs = await AuditService.obterLogs(200);
            res.json(logs);
        } catch (err) {
            res.status(500).json({ erro: 'Falha ao buscar logs' });
        }
    }

    // Gestão de Usuários
    async listUsers(req, res) {
        try {
            const users = await UserService.listarTodos();
            res.json(users);
        } catch (err) {
            res.status(500).json({ erro: 'Falha ao buscar utilizadores' });
        }
    }

    async createUser(req, res) {
        try {
            await UserService.criar(req.body);
            await AuditService.log(req.usuarioLogado?.id, req.usuarioLogado?.nome, 'CRIAR', 'Utilizador', `Criou o utilizador ${req.body.email} (${req.body.nivel_acesso})`);
            res.status(201).json({ mensagem: 'Usuário registado com sucesso' });
        } catch (err) {
            res.status(500).json({ erro: 'O email já existe ou erro interno.' });
        }
    }

    async updateUser(req, res) {
        try {
            await UserService.atualizar(req.params.id, req.body);
            await AuditService.log(req.usuarioLogado?.id, req.usuarioLogado?.nome, 'ATUALIZAR', 'Utilizador', `Atualizou o utilizador ID: ${req.params.id} (${req.body.email})`);
            res.json({ mensagem: 'Utilizador atualizado' });
        } catch (err) {
            res.status(500).json({ erro: 'Falha ao atualizar utilizador' });
        }
    }

    async deleteUser(req, res) {
        try {
            await UserService.eliminar(req.params.id);
            await AuditService.log(req.usuarioLogado?.id, req.usuarioLogado?.nome, 'REMOVER', 'Utilizador', `Apagou o utilizador ID: ${req.params.id}`);
            res.json({ mensagem: 'Utilizador removido' });
        } catch (err) {
            if (err.message === 'ROOT_PROTECTED') return res.status(403).json({ erro: 'Não podes apagar o Super Admin!' });
            res.status(500).json({ erro: 'Falha a remover utilizador' });
        }
    }

    // 2FA Methods
    async setup2FA(req, res) {
        try {
            const userId = req.usuarioLogado?.id;
            if (!userId) return res.status(401).json({ erro: 'Utilizador não identificado' });

            const user = await UserRepository.findById(userId);
            if (!user) return res.status(404).json({ erro: 'Utilizador não encontrado na base de dados' });
            if (!user.email) return res.status(400).json({ erro: 'Utilizador sem email configurado (obrigatório para 2FA)' });

            const { secret, otpauth } = TwoFactorService.generateSecret(user.email);
            const qrCode = await TwoFactorService.generateQRCode(otpauth);
            
            res.json({ secret, qrCode });
        } catch (err) {
            console.error('[2FA_SETUP_ERROR]', err);
            res.status(500).json({ erro: 'Erro interno ao configurar 2FA: ' + err.message });
        }
    }

    async enable2FA(req, res) {
        try {
            const { token, secret } = req.body;
            if (!token || !secret) return res.status(400).json({ erro: 'Token e Segredo são obrigatórios' });

            const valid = TwoFactorService.verifyToken(token, secret);
            if (valid) {
                await UserRepository.update2FA(req.usuarioLogado.id, secret, true);
                await AuditService.log(req.usuarioLogado.id, req.usuarioLogado.nome, 'ATIVAR_2FA', 'Segurança', 'Ativou a autenticação de dois fatores');
                res.json({ sucesso: true });
            } else {
                res.status(400).json({ erro: 'Código de verificação 2FA estancado ou inválido' });
            }
        } catch (err) {
            console.error('[2FA_ENABLE_ERROR]', err);
            res.status(500).json({ erro: 'Erro ao ativar 2FA: ' + err.message });
        }
    }

    async verify2FA(req, res) {
        const { userId, token } = req.body;
        try {
            const user = await UserRepository.findById(userId);
            if (!user) return res.status(404).json({ erro: 'Utilizador não encontrado' });

            const valid = TwoFactorService.verifyToken(token, user.two_factor_secret);
            if (valid) {
                const authToken = AuthService.gerarTokenFinal(user);
                res.json({ 
                    token: authToken, 
                    usuario: { 
                        id: user.id, 
                        nome: user.nome, 
                        nivel_acesso: user.nivel_acesso,
                        grupos_permitidos: user.grupos_permitidos || '[]',
                        tipos_permitidos: user.tipos_permitidos || '[]'
                    } 
                });
            } else {
                res.status(401).json({ erro: 'Código 2FA inválido' });
            }
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    }
    // Admin 2FA Management
    async adminSetup2FA(req, res) {
        try {
            if (req.usuarioLogado.id !== 1) return res.status(403).json({ erro: 'Apenas o Super Admin pode gerir 2FA de terceiros' });
            
            const { id } = req.params;
            const user = await UserRepository.findById(id);
            if (!user) return res.status(404).json({ erro: 'Utilizador não encontrado' });

            const { secret, otpauth } = TwoFactorService.generateSecret(user.email);
            const qrCode = await TwoFactorService.generateQRCode(otpauth);
            
            res.json({ secret, qrCode });
        } catch (err) {
            res.status(500).json({ erro: 'Erro ao configurar 2FA: ' + err.message });
        }
    }

    async adminEnable2FA(req, res) {
        try {
            if (req.usuarioLogado.id !== 1) return res.status(403).json({ erro: 'Ação não permitida' });
            const { id } = req.params;
            const { secret, token } = req.body;
            
            if (!secret || !token) return res.status(400).json({ erro: 'Segredo e Token são obrigatórios' });

            const valid = TwoFactorService.verifyToken(token, secret);
            if (!valid) return res.status(400).json({ erro: 'Código de verificação 2FA inválido ou expirado' });

            await UserRepository.update2FA(id, secret, true);
            await AuditService.log(req.usuarioLogado.id, req.usuarioLogado.nome, 'ATIVAR_2FA_ADMIN', 'Segurança', `Ativou 2FA para o utilizador ID: ${id}`);
            res.json({ sucesso: true });
        } catch (err) {
            console.error('[ADMIN_2FA_ENABLE_ERROR]', err);
            res.status(500).json({ erro: 'Erro ao ativar 2FA' });
        }
    }

    async adminDisable2FA(req, res) {
        try {
            if (req.usuarioLogado.id !== 1) return res.status(403).json({ erro: 'Ação não permitida' });
            const { id } = req.params;
            
            await UserRepository.update2FA(id, null, false);
            await AuditService.log(req.usuarioLogado.id, req.usuarioLogado.nome, 'DESATIVAR_2FA_ADMIN', 'Segurança', `Desativou 2FA para o utilizador ID: ${id}`);
            res.json({ sucesso: true });
        } catch (err) {
            res.status(500).json({ erro: 'Erro ao desativar 2FA' });
        }
    }
}

module.exports = new AuthController();
