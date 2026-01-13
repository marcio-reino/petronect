const bcrypt = require('bcrypt');
const { promisePool } = require('../src/config/database');
const { v4: uuidv4 } = require('uuid');

async function createUser() {
  try {
    const email = 'marcioreino@gmail.com';
    const password = '123456';
    const name = 'Marcio Reino';
    const username = 'marcioreino';
    const roleId = 1; // Administrador

    // Verificar se usuário já existe
    const [existing] = await promisePool.query(
      'SELECT user_id FROM tb_user WHERE user_email = ?',
      [email]
    );

    if (existing.length > 0) {
      console.log('Usuário já existe com este email');
      process.exit(0);
    }

    // Gerar hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);
    const userKey = uuidv4();

    // Inserir usuário
    const [result] = await promisePool.query(
      `INSERT INTO tb_user (
        user_name, user_email, user_username, user_password,
        user_role_id, user_date_insert, user_status
      ) VALUES (?, ?, ?, ?, ?, NOW(), 'active')`,
      [name, email, username, hashedPassword, roleId]
    );

    console.log('Usuário criado com sucesso!');
    console.log('ID:', result.insertId);
    console.log('Email:', email);
    console.log('Senha:', password);

    process.exit(0);
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    process.exit(1);
  }
}

createUser();
