-- V5 UPGRADE: Logs detalhados, suporte a fotos, e contagem real de lembretes

-- 1. Tabela de Logs Detalhados
CREATE TABLE IF NOT EXISTS logs_envio (
    id SERIAL PRIMARY KEY,
    evento_id INTEGER REFERENCES eventos(id) ON DELETE SET NULL,
    grupo_id TEXT,
    tipo_log VARCHAR(50) DEFAULT 'lembrete_enviado', -- lembrete_enviado, falha, teste, importacao
    mensagem TEXT,
    status VARCHAR(20) DEFAULT 'sucesso', -- sucesso, falha
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Adicionar coluna foto_url se não existir (pode já existir do v2)
DO $$ BEGIN
    ALTER TABLE eventos ADD COLUMN IF NOT EXISTS foto_url TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 3. Garantir que templates_mensagem existe (do v3)
CREATE TABLE IF NOT EXISTS templates_mensagem (
    id SERIAL PRIMARY KEY,
    tipo_evento VARCHAR(50) UNIQUE NOT NULL,
    mensagem TEXT NOT NULL,
    url_imagem TEXT,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO templates_mensagem (tipo_evento, mensagem) 
VALUES 
('casamento', 'Feliz Aniversário de Casamento, {nomes}! 🎉 Que o vosso amor continue a florescer. Hoje celebram as bodas de {bodas}! 💍'),
('aniversario', 'Parabéns {nomes}! 🎂 Que o teu dia seja repleto de alegrias!'),
('batizado', 'Que a luz divina guie sempre os passos de {nomes}. Feliz aniversário de Batizado! 🕊️'),
('formatura', 'Parabéns {nomes}! 🎓 Mais um ano desde a tua conquista académica!')
ON CONFLICT (tipo_evento) DO NOTHING;
