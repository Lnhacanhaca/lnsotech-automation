-- v6_upgrade.sql: Tipos de Eventos Dinâmicos e Histórico de Alterações

-- 1. Tabela para Tipos de Evento Customizáveis
CREATE TABLE IF NOT EXISTS tipos_evento (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(50) UNIQUE NOT NULL,
    cor VARCHAR(20) DEFAULT '#3b82f6',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserir tipos padrão se não existirem
INSERT INTO tipos_evento (nome, cor) VALUES 
('casamento', '#3b82f6'),
('aniversario', '#10b981'),
('batizado', '#8b5cf6'),
('formatura', '#f59e0b')
ON CONFLICT (nome) DO NOTHING;

-- 2. Tabela de Histórico de Alterações (Audit Log)
CREATE TABLE IF NOT EXISTS historico_eventos (
    id SERIAL PRIMARY KEY,
    evento_id INTEGER REFERENCES eventos(id) ON DELETE CASCADE,
    usuario_id INTEGER, 
    dados_anteriores JSONB,
    dados_novos JSONB,
    data_alteracao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Adicionar coluna de prioridade se ainda não existir (pedida anteriormente)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eventos' AND column_name='prioridade') THEN
        ALTER TABLE eventos ADD COLUMN prioridade VARCHAR(20) DEFAULT 'normal';
    END IF;
END $$;
