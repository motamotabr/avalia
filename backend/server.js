const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

const JWT_SECRET = process.env.JWT_SECRET || 'seu-segredo';
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// Middleware de autenticação
const autenticar = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ erro: 'Token não fornecido' });
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ erro: 'Token inválido' });
        req.usuarioId = decoded.id;
        req.cargo = decoded.cargo;
        next();
    });
};

// Log de auditoria
const logAcao = async (usuarioId, acao, detalhes) => {
    await db.query('INSERT INTO logs (usuario_id, acao, detalhes) VALUES (?, ?, ?)', [usuarioId, acao, detalhes]);
};

// Login
app.post('/api/login', [
    body('email').isEmail(),
    body('senha').notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ erros: errors.array() });

    const { email, senha } = req.body;
    console.log('Tentativa de login:', { email, senha });
    const [rows] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);
    const usuario = rows[0];
    if (!usuario) {
        console.log(`Usuário com email ${email} não encontrado`);
        return res.status(401).json({ erro: 'Credenciais inválidas - Usuário não encontrado' });
    }
    try {
        const senhaValida = await bcrypt.compare(senha, usuario.senha);
        console.log('Senha fornecida:', senha, 'Hash no banco:', usuario.senha, 'Validação:', senhaValida);
        if (!senhaValida) {
            return res.status(401).json({ erro: 'Credenciais inválidas - Senha incorreta' });
        }
        const token = jwt.sign({ id: usuario.id, cargo: usuario.cargo }, JWT_SECRET, { expiresIn: '1h' });
        logAcao(usuario.id, 'login', `Usuário ${usuario.nome} fez login`);
        res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, cargo: usuario.cargo } });
    } catch (err) {
        console.error('Erro no bcrypt.compare:', err);
        return res.status(500).json({ erro: 'Erro interno no servidor' });
    }
});





// CRUD Usuários
app.post('/api/usuarios', autenticar, [
    body('nome').notEmpty(),
    body('email').isEmail(),
    body('senha').isLength({ min: 6 }),
    body('cargo').isIn(['admin', 'diretor', 'gerente', 'coordenador', 'analista', 'assistente', 'estagiario'])
], async (req, res) => {
    if (req.cargo !== 'admin') return res.status(403).json({ erro: 'Apenas admin pode registrar usuários' });
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ erros: errors.array() });

    const { nome, email, senha, cargo, departamento_id, superior_id } = req.body;
    const senhaHash = await bcrypt.hash(senha, 10);

    // Converte '' em NULL para superior_id e departamento_id
    const superiorIdValue = superior_id === '' || superior_id === undefined ? null : parseInt(superior_id);
    const departamentoIdValue = departamento_id === '' || departamento_id === undefined ? null : parseInt(departamento_id);

    try {
        await db.query(
            'INSERT INTO usuarios (nome, email, senha, cargo, departamento_id, superior_id) VALUES (?, ?, ?, ?, ?, ?)',
            [nome, email, senhaHash, cargo, departamentoIdValue, superiorIdValue]
        );
        logAcao(req.usuarioId, 'registro_usuario', `Novo usuário ${nome} registrado`);
        res.status(201).json({ mensagem: 'Usuário criado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao criar usuário' });
    }
});

app.get('/api/usuarios', autenticar, async (req, res) => {
    const [rows] = await db.query('SELECT id, nome, email, cargo, departamento_id, superior_id FROM usuarios');
    res.json(rows);
});



app.put('/api/usuarios/:id', autenticar, [
    body('nome').notEmpty(),
    body('email').isEmail(),
    body('cargo').isIn(['admin', 'diretor', 'gerente', 'coordenador', 'analista', 'assistente', 'estagiario'])
], async (req, res) => {
    if (req.cargo !== 'admin') return res.status(403).json({ erro: 'Apenas admin pode editar usuários' });
    const { id } = req.params;
    const { nome, email, cargo, departamento_id, superior_id } = req.body;
    await db.query('UPDATE usuarios SET nome = ?, email = ?, cargo = ?, departamento_id = ?, superior_id = ? WHERE id = ?', 
        [nome, email, cargo, departamento_id, superior_id, id]);
    logAcao(req.usuarioId, 'editar_usuario', `Usuário ${id} editado`);
    res.json({ mensagem: 'Usuário atualizado' });
});

app.delete('/api/usuarios/:id', autenticar, async (req, res) => {
    if (req.cargo !== 'admin') return res.status(403).json({ erro: 'Apenas admin pode excluir usuários' });
    const { id } = req.params;
    await db.query('DELETE FROM usuarios WHERE id = ?', [id]);
    logAcao(req.usuarioId, 'excluir_usuario', `Usuário ${id} excluído`);
    res.json({ mensagem: 'Usuário excluído' });
});





// CRUD Departamentos
app.post('/api/departamentos', autenticar, [
    body('nome').notEmpty()
], async (req, res) => {
    if (req.cargo !== 'admin') return res.status(403).json({ erro: 'Apenas admin pode criar departamentos' });
    const { nome, diretor_id } = req.body;
    await db.query('INSERT INTO departamentos (nome, diretor_id) VALUES (?, ?)', [nome, diretor_id]);
    logAcao(req.usuarioId, 'criar_departamento', `Departamento ${nome} criado`);
    res.status(201).json({ mensagem: 'Departamento criado' });
});

app.get('/api/departamentos', autenticar, async (req, res) => {
    const [rows] = await db.query('SELECT * FROM departamentos');
    res.json(rows);
});

app.put('/api/departamentos/:id', autenticar, [
    body('nome').notEmpty()
], async (req, res) => {
    if (req.cargo !== 'admin') return res.status(403).json({ erro: 'Apenas admin pode editar departamentos' });
    const { id } = req.params;
    const { nome, diretor_id } = req.body;
    await db.query('UPDATE departamentos SET nome = ?, diretor_id = ? WHERE id = ?', [nome, diretor_id, id]);
    logAcao(req.usuarioId, 'editar_departamento', `Departamento ${id} editado`);
    res.json({ mensagem: 'Departamento atualizado' });
});

app.delete('/api/departamentos/:id', autenticar, async (req, res) => {
    if (req.cargo !== 'admin') return res.status(403).json({ erro: 'Apenas admin pode excluir departamentos' });
    const { id } = req.params;
    await db.query('DELETE FROM departamentos WHERE id = ?', [id]);
    logAcao(req.usuarioId, 'excluir_departamento', `Departamento ${id} excluído`);
    res.json({ mensagem: 'Departamento excluído' });
});

// CRUD Ciclos
app.post('/api/ciclos', autenticar, [
    body('nome').notEmpty(),
    body('data_inicio').isISO8601(),
    body('data_fim').isISO8601(),
    body('perguntas').isArray({ min: 1 })
], async (req, res) => {
    if (req.cargo !== 'admin') return res.status(403).json({ erro: 'Apenas admin pode criar ciclos' });
    const { nome, data_inicio, data_fim, perguntas } = req.body;
    const [result] = await db.query('INSERT INTO ciclos_avaliacao (nome, data_inicio, data_fim, ativo) VALUES (?, ?, ?, ?)', 
        [nome, data_inicio, data_fim, true]);
    const cicloId = result.insertId;
    for (const texto of perguntas) {
        await db.query('INSERT INTO perguntas (texto, ciclo_id) VALUES (?, ?)', [texto, cicloId]);
    }
    logAcao(req.usuarioId, 'criar_ciclo', `Ciclo ${nome} criado`);
    res.status(201).json({ mensagem: 'Ciclo criado' });
});

app.get('/api/ciclos', autenticar, async (req, res) => {
    const [rows] = await db.query('SELECT * FROM ciclos_avaliacao');
    res.json(rows);
});

app.put('/api/ciclos/:id', autenticar, [
    body('nome').notEmpty(),
    body('data_inicio').isISO8601(),
    body('data_fim').isISO8601(),
    body('perguntas').isArray({ min: 1 })
], async (req, res) => {
    if (req.cargo !== 'admin') return res.status(403).json({ erro: 'Apenas admin pode editar ciclos' });
    const { id } = req.params;
    const { nome, data_inicio, data_fim, perguntas } = req.body;
    await db.query('UPDATE ciclos_avaliacao SET nome = ?, data_inicio = ?, data_fim = ? WHERE id = ?', [nome, data_inicio, data_fim, id]);
    await db.query('DELETE FROM perguntas WHERE ciclo_id = ?', [id]);
    for (const texto of perguntas) {
        await db.query('INSERT INTO perguntas (texto, ciclo_id) VALUES (?, ?)', [texto, id]);
    }
    logAcao(req.usuarioId, 'editar_ciclo', `Ciclo ${id} editado`);
    res.json({ mensagem: 'Ciclo atualizado' });
});

app.delete('/api/ciclos/:id', autenticar, async (req, res) => {
    if (req.cargo !== 'admin') return res.status(403).json({ erro: 'Apenas admin pode excluir ciclos' });
    const { id } = req.params;
    await db.query('DELETE FROM perguntas WHERE ciclo_id = ?', [id]);
    await db.query('DELETE FROM ciclos_avaliacao WHERE id = ?', [id]);
    logAcao(req.usuarioId, 'excluir_ciclo', `Ciclo ${id} excluído`);
    res.json({ mensagem: 'Ciclo excluído' });
});

// Outros Endpoints (mantidos como estavam)
app.get('/api/perguntas', autenticar, async (req, res) => {
    const [ciclo] = await db.query('SELECT id FROM ciclos_avaliacao WHERE ativo = TRUE AND CURDATE() BETWEEN data_inicio AND data_fim');
    if (!ciclo.length) return res.status(404).json({ erro: 'Nenhum ciclo ativo' });
    const [rows] = await db.query('SELECT id, texto FROM perguntas WHERE ciclo_id = ?', [ciclo[0].id]);
    res.json(rows);
});

app.get('/api/subordinados', autenticar, async (req, res) => {
    const [rows] = await db.query(`
        SELECT u.id, u.nome, u.cargo, d.nome AS departamento
        FROM usuarios u
        LEFT JOIN departamentos d ON u.departamento_id = d.id
        WHERE u.superior_id = ? OR (u.id = (SELECT superior_id FROM usuarios WHERE id = ?) AND u.id != ?)
    `, [req.usuarioId, req.usuarioId, req.usuarioId]);
    res.json(rows);
});

//app.post('/api/avaliacoes', autenticar, async (req, res) => {
//    const [ciclo] = await db.query('SELECT id FROM ciclos_avaliacao WHERE ativo = TRUE AND CURDATE() BETWEEN data_inicio AND data_fim');
//    if (!ciclo.length) return res.status(403).json({ erro: 'Nenhum ciclo ativo' });
//
//   const { avaliado_id, respostas, comentario } = req.body;
//    await db.query('INSERT INTO avaliacoes (avaliador_id, avaliado_id, ciclo_id, respostas, comentario) VALUES (?, ?, ?, ?, ?)', 
//        [req.usuarioId, avaliado_id, ciclo[0].id, JSON.stringify(respostas), comentario]);
//    
//    const [avaliado] = await db.query('SELECT email FROM usuarios WHERE id = ?', [avaliado_id]);
//    await transporter.sendMail({
//        from: process.env.EMAIL_USER,
//        to: avaliado[0].email,
//        subject: 'Nova Avaliação Recebida',
//        text: 'Você recebeu uma nova avaliação no sistema.'
//    });
//
//    logAcao(req.usuarioId, 'avaliacao', `Avaliação para usuário ${avaliado_id} salva`);
//    res.status(201).json({ mensagem: 'Avaliação salva' });
//});

app.post('/api/avaliacoes', autenticar, async (req, res) => {
    const [ciclo] = await db.query('SELECT id FROM ciclos_avaliacao WHERE ativo = TRUE AND CURDATE() BETWEEN data_inicio AND data_fim');
    if (!ciclo.length) return res.status(403).json({ erro: 'Nenhum ciclo ativo' });

    const { avaliado_id, respostas, comentario } = req.body;
    try {
        await db.query(
            'INSERT INTO avaliacoes (avaliador_id, avaliado_id, ciclo_id, respostas, comentario) VALUES (?, ?, ?, ?, ?)',
            [req.usuarioId, avaliado_id, ciclo[0].id, JSON.stringify(respostas), comentario]
        );
        logAcao(req.usuarioId, 'avaliacao', `Avaliação para usuário ${avaliado_id} salva`);
        res.status(201).json({ mensagem: 'Avaliação salva' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao salvar avaliação' });
    }
});





//app.get('/api/relatorio/:usuarioId', autenticar, async (req, res) => {
//    const { usuarioId } = req.params;
//    const [rows] = await db.query('SELECT respostas, comentario FROM avaliacoes WHERE avaliado_id = ?', [usuarioId]);
//    if (!rows.length) return res.status(404).json({ mensagem: 'Nenhuma avaliação' });
//
//    const medias = {};
//    rows.forEach(row => {
//        const respostas = JSON.parse(row.respostas);
//        Object.keys(respostas).forEach(key => {
//            medias[key] = (medias[key] || 0) + respostas[key] / rows.length;
//        });
//    });
//    res.json({ medias, comentarios: rows.map(r => r.comentario) });
//});

app.get('/api/relatorio/:usuarioId', autenticar, async (req, res) => {
    const { usuarioId } = req.params;
    try {
        const [rows] = await db.query('SELECT respostas, comentario FROM avaliacoes WHERE avaliado_id = ?', [usuarioId]);
        if (!rows.length) return res.status(404).json({ mensagem: 'Nenhuma avaliação' });

        const medias = {};
        rows.forEach(row => {
            const respostas = row.respostas; // Removido JSON.parse(), já é um objeto
            Object.keys(respostas).forEach(key => {
                medias[key] = (medias[key] || 0) + respostas[key] / rows.length;
            });
        });
        res.json({ medias, comentarios: rows.map(r => r.comentario) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao gerar relatório' });
    }
});




app.get('/api/relatorio/:usuarioId/pdf', autenticar, async (req, res) => {
    const { usuarioId } = req.params;
    const [rows] = await db.query('SELECT respostas FROM avaliacoes WHERE avaliado_id = ?', [usuarioId]);
    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);
    doc.text(`Relatório de Desempenho - Usuário ${usuarioId}`);
    rows.forEach((row, i) => {
        doc.text(`Avaliação ${i + 1}: ${JSON.stringify(JSON.parse(row.respostas))}`);
    });
    doc.end();
});



app.get('/api/resultados-por-area', autenticar, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                d.nome AS departamento,
                AVG(JSON_EXTRACT(respostas, '$."1"')) AS p1,
                AVG(JSON_EXTRACT(respostas, '$."2"')) AS p2,
                AVG(JSON_EXTRACT(respostas, '$."3"')) AS p3,
                AVG(JSON_EXTRACT(respostas, '$."4"')) AS p4,
                AVG(JSON_EXTRACT(respostas, '$."5"')) AS p5,
                AVG(JSON_EXTRACT(respostas, '$."6"')) AS p6,
                AVG(JSON_EXTRACT(respostas, '$."7"')) AS p7,
                AVG(JSON_EXTRACT(respostas, '$."8"')) AS p8,
                AVG(JSON_EXTRACT(respostas, '$."9"')) AS p9,
                AVG(JSON_EXTRACT(respostas, '$."10"')) AS p10
            FROM avaliacoes a
            JOIN usuarios u ON a.avaliado_id = u.id
            LEFT JOIN departamentos d ON u.departamento_id = d.id
            GROUP BY d.id, d.nome
        `);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao buscar resultados por área' });
    }
});




//const PORT = process.env.PORT || 3001;
//app.listen(PORT,() => console.log(`Servidor na porta ${PORT}`));
app.listen(3001, '0.0.0.0', () => console.log("Servidor rodando na porta 3001"));
