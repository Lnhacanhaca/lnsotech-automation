const db = require('../config/database');

class UserRepository {
    async findByEmail(email) {
        const { rows } = await db.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        return rows[0];
    }

    async findById(id) {
        const { rows } = await db.query('SELECT id, nome, email, nivel_acesso, grupos_permitidos, tipos_permitidos FROM usuarios WHERE id = $1', [id]);
        return rows[0];
    }

    async findAll() {
        const { rows } = await db.query('SELECT id, nome, email, nivel_acesso, grupos_permitidos, tipos_permitidos FROM usuarios ORDER BY id ASC');
        return rows;
    }

    async create(nome, email, hashedPassword, nivel_acesso, grupos_permitidos = [], tipos_permitidos = []) {
        await db.query(
            'INSERT INTO usuarios (nome, email, senha, nivel_acesso, grupos_permitidos, tipos_permitidos) VALUES ($1, $2, $3, $4, $5, $6)',
            [nome, email, hashedPassword, nivel_acesso || 'leitor', JSON.stringify(grupos_permitidos), JSON.stringify(tipos_permitidos)]
        );
    }

    async update(id, dados) {
        const { nome, email, senha, nivel_acesso, grupos_permitidos, tipos_permitidos } = dados;
        // Se os arrays não forem fornecidos, cai como undefined e mantém-se vazio se tratarmos; mas melhor passar os arrays do controller.
        const gp = grupos_permitidos ? JSON.stringify(grupos_permitidos) : '[]';
        const tp = tipos_permitidos ? JSON.stringify(tipos_permitidos) : '[]';

        if (senha) {
            await db.query(
                'UPDATE usuarios SET nome=$1, email=$2, senha=$3, nivel_acesso=$4, grupos_permitidos=$5, tipos_permitidos=$6 WHERE id=$7',
                [nome, email, senha, nivel_acesso, gp, tp, id]
            );
        } else {
            await db.query(
                'UPDATE usuarios SET nome=$1, email=$2, nivel_acesso=$3, grupos_permitidos=$4, tipos_permitidos=$5 WHERE id=$6',
                [nome, email, nivel_acesso, gp, tp, id]
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
