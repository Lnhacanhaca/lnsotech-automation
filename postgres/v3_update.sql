-- lnsotech-events-v2/backend/postgres/v3_update.sql
-- Novas tabelas para o super sistema V3

-- 1. Tabela de Templates de Mensagem Dinâmicos
CREATE TABLE IF NOT EXISTS templates_mensagem (
    id SERIAL PRIMARY KEY,
    tipo_evento VARCHAR(50) UNIQUE NOT NULL, -- ex: casamento, aniversario, formatura, batizado
    mensagem TEXT NOT NULL,
    url_imagem TEXT,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserir alguns templates padrão
INSERT INTO templates_mensagem (tipo_evento, mensagem) 
VALUES 
('casamento', 'Feliz Aniversário de Casamento, {nomes}! 🎉 Que o vosso amor continue a florescer. Hoje celebram as bodas de {bodas}! 💍'),
('aniversario', 'Parabéns {nomes}! 🎂 Que o teu dia seja repleto de alegrias!'),
('batizado', 'Que a luz divina guie sempre os passos de {nomes}. Feliz aniversário de Batizado! 🕊️')
ON CONFLICT (tipo_evento) DO NOTHING;

-- Garantir que a tabela usuários existe (já criada, mas adicionando restrições de nível se possível no frontend)
