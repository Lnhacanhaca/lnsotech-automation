const db = require('../config/database');

class DatabaseService {
    async initialize() {
        console.log('⏳ [DB] Verificando tabelas e configurações...');
        
        await db.query(`
            CREATE TABLE IF NOT EXISTS configuracoes (chave TEXT PRIMARY KEY, valor TEXT);
            CREATE TABLE IF NOT EXISTS tipos_evento (id SERIAL PRIMARY KEY, nome TEXT UNIQUE, cor TEXT, template_resposta TEXT);
            CREATE TABLE IF NOT EXISTS grupos_config (grupo_id TEXT PRIMARY KEY, nome TEXT, is_muted BOOLEAN DEFAULT FALSE, atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
            
            -- Garantir colunas se não existirem
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuarios' AND column_name='tentativas_falhas') THEN
                    ALTER TABLE usuarios ADD COLUMN tentativas_falhas INT DEFAULT 0;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuarios' AND column_name='bloqueado_ate') THEN
                    ALTER TABLE usuarios ADD COLUMN bloqueado_ate TIMESTAMP;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuarios' AND column_name='grupos_permitidos') THEN
                    ALTER TABLE usuarios ADD COLUMN grupos_permitidos JSONB DEFAULT '[]'::jsonb;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuarios' AND column_name='tipos_permitidos') THEN
                    ALTER TABLE usuarios ADD COLUMN tipos_permitidos JSONB DEFAULT '[]'::jsonb;
                END IF;
            END $$;
        `);

        // Configurações iniciais
        const configs = [
            { chave: 'hora_lembrete', valor: '07:00' },
            { chave: 'assinatura_bot', valor: '⚡ Enviado via LNSOTECH Automation' }
        ];

        for (const config of configs) {
            const check = await db.query("SELECT * FROM configuracoes WHERE chave = $1", [config.chave]);
            if (check.rowCount === 0) {
                await db.query("INSERT INTO configuracoes (chave, valor) VALUES ($1, $2)", [config.chave, config.valor]);
            }
        }
        
        // Tipos de evento padrão
        const tipos = [
            { nome: 'casamento', cor: '#3b82f6' },
            { nome: 'aniversario', cor: '#10b981' },
            { nome: 'batizado', cor: '#8b5cf6' }
        ];

        for (const tipo of tipos) {
            await db.query("INSERT INTO tipos_evento (nome, cor) VALUES ($1, $2) ON CONFLICT (nome) DO NOTHING", [tipo.nome, tipo.cor]);
        }
        
        console.log('✅ [DB] Tabelas e configurações verificadas.');
    }
}

module.exports = new DatabaseService();
