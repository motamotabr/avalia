-- Criação do Banco de Dados
CREATE DATABASE IF NOT EXISTS avaliacao_desempenho;
USE avaliacao_desempenho;

-- Tabela de Departamentos
CREATE TABLE departamentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    diretor_id INT,
    FOREIGN KEY (diretor_id) REFERENCES usuarios(id)
);

-- Tabela de Usuários
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    cargo ENUM('admin', 'diretor', 'gerente', 'coordenador', 'analista', 'assistente', 'estagiario') NOT NULL,
    departamento_id INT,
    superior_id INT,
    FOREIGN KEY (departamento_id) REFERENCES departamentos(id),
    FOREIGN KEY (superior_id) REFERENCES usuarios(id)
);

-- Tabela de Ciclos de Avaliação
CREATE TABLE ciclos_avaliacao (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    ativo BOOLEAN DEFAULT FALSE
);

-- Tabela de Perguntas
CREATE TABLE perguntas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    texto VARCHAR(255) NOT NULL,
    ciclo_id INT,
    FOREIGN KEY (ciclo_id) REFERENCES ciclos_avaliacao(id)
);

-- Tabela de Avaliações
CREATE TABLE avaliacoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    avaliador_id INT,
    avaliado_id INT,
    ciclo_id INT,
    respostas JSON NOT NULL,
    comentario TEXT,
    data_avaliacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (avaliador_id) REFERENCES usuarios(id),
    FOREIGN KEY (avaliado_id) REFERENCES usuarios(id),
    FOREIGN KEY (ciclo_id) REFERENCES ciclos_avaliacao(id)
);

-- Tabela de Logs
CREATE TABLE logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT,
    acao VARCHAR(100) NOT NULL,
    detalhes TEXT,
    data TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Inserção de Dados Iniciais

-- Departamentos
INSERT INTO departamentos (nome, diretor_id) VALUES
('TI', NULL),
('RH', NULL);

-- Usuários
INSERT INTO usuarios (nome, email, senha, cargo, departamento_id, superior_id) VALUES
('Admin', 'admin@empresa.com', '$2a$10$XURP2XU7z7l9e1s1Qz2s0e5g5Qz5Qz5Qz5Qz5Qz5Qz5Qz5Qz5Qz5Q', 'admin', NULL, NULL), -- Senha: admin123
('Diretor TI', 'diretor.ti@empresa.com', '$2a$10$XURP2XU7z7l9e1s1Qz2s0e5g5Qz5Qz5Qz5Qz5Qz5Qz5Qz5Qz5Qz5Q', 'diretor', 1, 1),
('Gerente TI', 'gerente.ti@empresa.com', '$2a$10$XURP2XU7z7l9e1s1Qz2s0e5g5Qz5Qz5Qz5Qz5Qz5Qz5Qz5Qz5Qz5Q', 'gerente', 1, 2),
('Analista TI', 'analista.ti@empresa.com', '$2a$10$XURP2XU7z7l9e1s1Qz2s0e5g5Qz5Qz5Qz5Qz5Qz5Qz5Qz5Qz5Qz5Q', 'analista', 1, 3);

-- Atualiza o diretor_id dos departamentos
UPDATE departamentos SET diretor_id = 2 WHERE id = 1;

-- Ciclos de Avaliação
INSERT INTO ciclos_avaliacao (nome, data_inicio, data_fim, ativo) VALUES
('Ciclo Q1 2025', '2025-01-01', '2025-03-31', TRUE);

-- Perguntas
INSERT INTO perguntas (texto, ciclo_id) VALUES
('Competência técnica', 1),
('Pontualidade', 1),
('Colaboração', 1),
('Proatividade', 1),
('Comunicação', 1),
('Resolução de problemas', 1),
('Comprometimento', 1),
('Qualidade do trabalho', 1),
('Adaptabilidade', 1),
('Liderança', 1);

-- Avaliações de Exemplo
INSERT INTO avaliacoes (avaliador_id, avaliado_id, ciclo_id, respostas, comentario) VALUES
(3, 4, 1, '{"1": 4, "2": 5, "3": 3, "4": 4, "5": 5, "6": 4, "7": 5, "8": 4, "9": 3, "10": 2}', 'Bom desempenho geral.'),
(2, 3, 1, '{"1": 5, "2": 4, "3": 5, "4": 5, "5": 4, "6": 5, "7": 4, "8": 5, "9": 4, "10": 5}', 'Excelente liderança.');
