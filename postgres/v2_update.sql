-- Criar tabela de usuários para o Painel
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    nivel_acesso TEXT CHECK (nivel_acesso IN ('admin', 'editor', 'leitor')) DEFAULT 'leitor'
);

-- Tabela de Eventos atualizada para fotos e categorias
CREATE TABLE IF NOT EXISTS eventos (
    id SERIAL PRIMARY KEY,
    nomes_principais TEXT NOT NULL,
    data_evento DATE NOT NULL,
    tipo_evento TEXT NOT NULL, -- 'casamento', 'batizado', 'formatura'
    foto_url TEXT, 
    grupo_id TEXT NOT NULL,
    criado_por INTEGER REFERENCES usuarios(id)
);

-- Tabela de Logs para o Gráfico do Dashboard
CREATE TABLE IF NOT EXISTS logs_envio (
    id SERIAL PRIMARY KEY,
    evento_id INTEGER REFERENCES eventos(id),
    status TEXT, -- 'sucesso' ou 'erro'
    data_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin user (password: lnso2026 hash)
INSERT INTO usuarios (nome, email, senha, nivel_acesso) 
VALUES ('Luís Nhacanhaca', 'admin@lnsotech.com', '$2a$10$uujCRYGtaYz584sWFIIrnuV9RChQQQtpnysdxC2aWDawb4p3for.a', 'admin');
