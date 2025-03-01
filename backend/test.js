// test_all_users.js
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

async function testUsers() {
    const db = await mysql.createPool({
        host: 'localhost',
        user: 'avalia',
        password: 'Mota@1237',
        database: 'avaliacao_desempenho'
    });

    const [rows] = await db.query('SELECT email, senha FROM usuarios');
    for (const user of rows) {
        const isValid = await bcrypt.compare('admin123', user.senha);
        console.log(`Email: ${user.email}, Hash: ${user.senha}, Validação: ${isValid}`);
    }
    db.end();
}

testUsers().catch(console.error);
