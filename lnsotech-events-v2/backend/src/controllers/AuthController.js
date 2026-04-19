const AuthService = require('../services/AuthService');
const UserService = require('../services/UserService');

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
        res.json(req.usuarioLogado);
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
            res.status(201).json({ mensagem: 'Usuário registado com sucesso' });
        } catch (err) {
            res.status(500).json({ erro: 'O email já existe ou erro interno.' });
        }
    }

    async updateUser(req, res) {
        try {
            await UserService.atualizar(req.params.id, req.body);
            res.json({ mensagem: 'Utilizador atualizado' });
        } catch (err) {
            res.status(500).json({ erro: 'Falha ao atualizar utilizador' });
        }
    }

    async deleteUser(req, res) {
        try {
            await UserService.eliminar(req.params.id);
            res.json({ mensagem: 'Utilizador removido' });
        } catch (err) {
            if (err.message === 'ROOT_PROTECTED') return res.status(403).json({ erro: 'Não podes apagar o Super Admin!' });
            res.status(500).json({ erro: 'Falha a remover utilizador' });
        }
    }
}

module.exports = new AuthController();
