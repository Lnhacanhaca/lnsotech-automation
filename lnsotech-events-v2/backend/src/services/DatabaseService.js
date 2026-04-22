const db = require('../config/database');

class DatabaseService {
    async initialize() {
        console.log('⏳ [DB] Verificando tabelas e configurações...');
        
        await db.query(`
            CREATE TABLE IF NOT EXISTS configuracoes (chave TEXT PRIMARY KEY, valor TEXT);
            CREATE TABLE IF NOT EXISTS tipos_evento (id SERIAL PRIMARY KEY, nome TEXT UNIQUE, cor TEXT, template_resposta TEXT);
            CREATE TABLE IF NOT EXISTS grupos_config (grupo_id TEXT PRIMARY KEY, nome TEXT, is_muted BOOLEAN DEFAULT FALSE, atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
            
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                nome VARCHAR(255),
                email VARCHAR(255) UNIQUE,
                senha TEXT,
                nivel_acesso VARCHAR(20) DEFAULT 'leitor',
                tentativas_falhas INT DEFAULT 0,
                bloqueado_ate TIMESTAMP,
                grupos_permitidos JSONB DEFAULT '[]'::jsonb,
                tipos_permitidos JSONB DEFAULT '[]'::jsonb,
                two_factor_secret TEXT,
                two_factor_enabled BOOLEAN DEFAULT FALSE,
                criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS eventos (
                id SERIAL PRIMARY KEY,
                nomes_principais TEXT NOT NULL,
                data_evento DATE NOT NULL,
                tipo_evento VARCHAR(50) DEFAULT 'casamento',
                grupo_id TEXT,
                foto_url TEXT,
                criado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
                frequencia_lembrete VARCHAR(20) DEFAULT 'anual',
                prioridade VARCHAR(20) DEFAULT 'normal',
                criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Garantir colunas se não existirem
            DO $$ 
            BEGIN 
                -- Usuarios
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
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuarios' AND column_name='two_factor_secret') THEN
                    ALTER TABLE usuarios ADD COLUMN two_factor_secret TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuarios' AND column_name='two_factor_enabled') THEN
                    ALTER TABLE usuarios ADD COLUMN two_factor_enabled BOOLEAN DEFAULT FALSE;
                END IF;

                -- Eventos
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eventos' AND column_name='prioridade') THEN
                    ALTER TABLE eventos ADD COLUMN prioridade VARCHAR(20) DEFAULT 'normal';
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eventos' AND column_name='frequencia_lembrete') THEN
                    ALTER TABLE eventos ADD COLUMN frequencia_lembrete VARCHAR(20) DEFAULT 'anual';
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eventos' AND column_name='foto_url') THEN
                    ALTER TABLE eventos ADD COLUMN foto_url TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eventos' AND column_name='criado_em') THEN
                    ALTER TABLE eventos ADD COLUMN criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eventos' AND column_name='atualizado_em') THEN
                    ALTER TABLE eventos ADD COLUMN atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
                END IF;
            END $$;

            CREATE TABLE IF NOT EXISTS auditoria (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
                nome_usuario VARCHAR(255),
                acao VARCHAR(50),
                entidade VARCHAR(50),
                detalhes TEXT,
                data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS whatsapp_bots (
                id SERIAL PRIMARY KEY,
                nome VARCHAR(255) NOT NULL,
                pasta_sessao VARCHAR(255) UNIQUE NOT NULL,
                status VARCHAR(50) DEFAULT 'desconectado',
                tipos_permitidos JSONB DEFAULT '[]'::jsonb
            );

            CREATE TABLE IF NOT EXISTS historico_eventos (
                id SERIAL PRIMARY KEY,
                evento_id INTEGER REFERENCES eventos(id) ON DELETE CASCADE,
                usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
                dados_anteriores JSONB,
                dados_novos JSONB,
                data_alteracao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS tipos_evento (
                id SERIAL PRIMARY KEY,
                nome VARCHAR(255) UNIQUE NOT NULL,
                cor VARCHAR(7) DEFAULT '#3b82f6',
                template_resposta TEXT,
                criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS mensagens_fila (
                id SERIAL PRIMARY KEY,
                bot_id INTEGER,
                grupo_id VARCHAR(255) NOT NULL,
                mensagem TEXT NOT NULL,
                foto_url TEXT,
                prioridade INTEGER DEFAULT 0,
                tentativas INTEGER DEFAULT 0,
                status VARCHAR(50) DEFAULT 'pendente',
                erro TEXT,
                agendado_para TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                enviado_em TIMESTAMP,
                criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS templates_mensagem (
                id SERIAL PRIMARY KEY,
                tipo_evento VARCHAR(100) UNIQUE NOT NULL,
                mensagem TEXT NOT NULL,
                atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS configuracoes (
                id SERIAL PRIMARY KEY,
                chave VARCHAR(100) UNIQUE NOT NULL,
                valor TEXT,
                atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS grupos_config (
                id SERIAL PRIMARY KEY,
                grupo_id VARCHAR(255) UNIQUE NOT NULL,
                nome VARCHAR(255),
                is_muted BOOLEAN DEFAULT FALSE,
                last_seen_by_bot_id INTEGER,
                atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS logs_envio (
                id SERIAL PRIMARY KEY,
                evento_id INTEGER REFERENCES eventos(id) ON DELETE CASCADE,
                grupo_id TEXT,
                tipo_log VARCHAR(50),
                mensagem TEXT,
                status VARCHAR(20),
                criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Garantir renomeação e criação de colunas em tabelas antigas
        await db.query(`
            DO $$ 
            BEGIN
                IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='logs_envio' AND column_name='data_hora') THEN
                    ALTER TABLE logs_envio RENAME COLUMN data_hora TO criado_em;
                ELSIF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='logs_envio' AND column_name='data_envio') THEN
                    ALTER TABLE logs_envio RENAME COLUMN data_envio TO criado_em;
                END IF;

                IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='logs_envio' AND column_name='grupo_id') THEN
                    ALTER TABLE logs_envio ADD COLUMN grupo_id TEXT;
                END IF;
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='logs_envio' AND column_name='tipo_log') THEN
                    ALTER TABLE logs_envio ADD COLUMN tipo_log VARCHAR(50);
                END IF;
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='logs_envio' AND column_name='mensagem') THEN
                    ALTER TABLE logs_envio ADD COLUMN mensagem TEXT;
                END IF;

                IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='tipos_evento' AND column_name='template_resposta') THEN
                    ALTER TABLE tipos_evento ADD COLUMN template_resposta TEXT;
                END IF;
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='grupos_config' AND column_name='last_seen_by_bot_id') THEN
                    ALTER TABLE grupos_config ADD COLUMN last_seen_by_bot_id INTEGER;
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
            { nome: 'casamento', cor: '#3b82f6', resposta: 'A LNSOTECH agradece o carinho partilhado neste momento especial! 🥰' },
            { nome: 'aniversario', cor: '#10b981', resposta: 'A LNSOTECH deseja que esta data assinale o início de um novo ciclo com muita luz! 🎂' },
            { nome: 'batizado', cor: '#8b5cf6', resposta: 'A LNSOTECH celebra esta bênção e agradece a felicitação! 🙏' }
        ];

        for (const tipo of tipos) {
            await db.query(
                "INSERT INTO tipos_evento (nome, cor, template_resposta) VALUES ($1, $2, $3) ON CONFLICT (nome) DO NOTHING", 
                [tipo.nome, tipo.cor, tipo.resposta]
            );
        }
        
        // Garantir que todos os tipos_evento tenham um template inicial na tabela de envio
        const templatesExclusivos = {
            'casamento': 'Bom dia, {nomes}! ✨ Hoje o dia amanheceu com um brilho especial porque celebramos **{anos} anos** da vossa linda união. Que as vossas Bodas de {bodas} tragam ainda mais cumplicidade. 💍\n\n✨ *Sabiam que o significado desta boda é:* {significado}?\nParabéns por cada capítulo desta história que continuam a escrever juntos! ❤️',
            'aniversario': 'Parabéns, {nomes}! 🎉 Hoje o dia é todo teu! Que este novo ciclo que começa agora seja repleto de sorrisos, saúde e daqueles momentos inesquecíveis que aquecem o coração. 🎂 Aproveita cada segundo do teu dia!',
            'batizado': 'Um bom dia abençoado para toda a família! ✨ Celebramos hoje o batismo de {nomes}. Que este momento de luz traga muita proteção e guie sempre o caminho desta criança com muito amor e sabedoria. 🕊️'
        };

        const { rows: todosTipos } = await db.query("SELECT nome FROM tipos_evento");
        for (const t of todosTipos) {
            const mensagemDefeito = templatesExclusivos[t.nome.toLowerCase()] || `Lembrete LNSOTECH: Hoje celebramos {nomes} (${t.nome})! 🎉`;
            await db.query(`
                INSERT INTO templates_mensagem (tipo_evento, mensagem) 
                VALUES ($1, $2) 
                ON CONFLICT (tipo_evento) DO NOTHING
            `, [t.nome, mensagemDefeito]);
        }
        
        console.log('✅ [DB] Tabelas e configurações verificadas.');
    }
}

module.exports = new DatabaseService();
