const UserRepository = require('../repositories/UserRepository');
const bcrypt = require('bcryptjs');

class UserService {
    async listarTodos() {
        return await UserRepository.findAll();
    }

    async criar(dados) {
        const { nome, email, senha, nivel_acesso, grupos_permitidos, tipos_permitidos } = dados;
        const hashedPassword = await bcrypt.hash(senha, 10);
        await UserRepository.create(nome, email, hashedPassword, nivel_acesso, grupos_permitidos, tipos_permitidos);
    }

    async atualizar(id, dados) {
        if (dados.senha && dados.senha.trim() !== '') {
            dados.senha = await bcrypt.hash(dados.senha, 10);
        } else {
            delete dados.senha;
        }
        await UserRepository.update(id, dados);
    }

    async eliminar(id) {
        if (id === '1') throw new Error('ROOT_PROTECTED');
        await UserRepository.delete(id);
    }
}

module.exports = new UserService();
