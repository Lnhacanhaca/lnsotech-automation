CREATE TABLE IF NOT EXISTS aniversarios (
    id SERIAL PRIMARY KEY,
    nomes VARCHAR(255) NOT NULL,
    data_casamento DATE NOT NULL
);

-- Dados iniciais (opcional)
INSERT INTO aniversarios (nomes, data_casamento)
VALUES 
('João e Maria', '2010-05-12'),
('Carlos e Ana', '2015-08-20');
