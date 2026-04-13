-- v7_fix_schema.sql: Corrigir colunas em falta na tabela eventos
DO $$ 
BEGIN 
    -- 1. Adicionar criado_em
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eventos' AND column_name='criado_em') THEN
        ALTER TABLE eventos ADD COLUMN criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;

    -- 2. Adicionar atualizado_em
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eventos' AND column_name='atualizado_em') THEN
        ALTER TABLE eventos ADD COLUMN atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;

    -- 3. Garantir que frequencia_lembrete tem valor padrão se for nulo
    UPDATE eventos SET frequencia_lembrete = 'anual' WHERE frequencia_lembrete IS NULL;
END $$;
