const db = require('../config/database');

class UserRepository {
    async findByEmail(email) {
        const { rows } = await db.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        return rows[0];
    }

    async findById(id) {
        const { rows } = await db.query('SELECT id, nome, email, nivel_acesso FROM usuarios WHERE id = $1', [id]);
        return rows[0];
    }

    async findAll() {
        const { rows } = await db.query('SELECT id, nome, email, nivel_acesso FROM usuarios ORDER BY id ASC');
        return rows;
    }

    async create(nome, email, hashedPassword, nivel_acesso) {
        await db.query(
            'INSERT INTO usuarios (nome, email, senha, nivel_acesso) VALUES ($1, $2, $3, $4)',
            [nome, email, hashedPassword, nivel_acesso || 'leitor']
        );
    }

    async update(id, dados) {
        const { nome, email, senha, nivel_acesso } = dados;
        if (senha) {
            await db.query(
                'UPDATE usuarios SET nome=$1, email=$2, senha=$3, nivel_acesso=$4 WHERE id=$5',
                [nome, email, senha, nivel_acesso, id]
            );
        } else {
            await db.query(
                'UPDATE usuarios SET nome=$1, email=$2, nivel_acesso=$3 WHERE id=$4',
                [nome, email, nivel_acesso, id]
            );
        }
    }

    async delete(id) {
        await db.query('DELETE FROM usuarios WHERE id = $1', [id]);
    }

    async updateLoginAttempts(id, attempts, lockUntil) {
        await db.query(
            'UPDATE usuarios SET tentativas_falhas = $1, bloqueado_ate = $2 WHERE id = $3',
            [attempts, lockUntil, id]
        );
    }

    async resetLoginAttempts(id) {
        await db.query('UPDATE usuarios SET tentativas_falhas = 0, bloqueado_ate = NULL WHERE id = $1', [id]);
    }
}

module.exports = new UserRepository();
