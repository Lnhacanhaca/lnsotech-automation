-- lnsotech-events-v2/postgres/v4_users.sql
-- Garantir privilégios root e criar usuários de teste

-- 1. Forçar conta admin
UPDATE usuarios SET nivel_acesso = 'admin', senha = '$2b$10$GgLIq09TO1IPnYdGZT3lsOr2JZW96xbYDG1JxSxf78zvW4CFPgQgq' WHERE email = 'admin@lnsotech.com';

-- 2. Limpar os de teste se existirem para recriar
DELETE FROM usuarios WHERE email IN ('editor@teu.bot', 'leitor@teu.bot');

-- 3. Inserir a conta de Editor e Leitor com senha = "123"
INSERT INTO usuarios (nome, email, senha, nivel_acesso) 
VALUES 
('Equipa Edição', 'editor@teu.bot', '$2b$10$eE/.C7yHOnwO00MAlXQZtOuF7G2K.UToS/CgB43s7zXy8Q8yXoBwO', 'editor'),
('Visitante Stats', 'leitor@teu.bot', '$2b$10$eE/.C7yHOnwO00MAlXQZtOuF7G2K.UToS/CgB43s7zXy8Q8yXoBwO', 'leitor');
