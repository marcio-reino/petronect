const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { promisePool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Gerar Access Token
const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user.user_id,
      email: user.user_email,
      username: user.user_username,
      idrole: user.user_role_id
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Gerar Refresh Token
const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user.user_id,
      email: user.user_email
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '15m' }
  );
};

// Registro de novo usuário
exports.register = async (req, res) => {
  try {
    const { name, email, username, password, cellphone, idgroup } = req.body;

    // Validar campos obrigatórios
    if (!name || !email || !username || !password || !idgroup) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios: name, email, username, password, idgroup'
      });
    }

    // Verificar se o email já existe
    const [existingEmail] = await promisePool.query(
      'SELECT user_id FROM tb_user WHERE user_email = ?',
      [email]
    );

    if (existingEmail.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email já cadastrado'
      });
    }

    // Verificar se o username já existe
    const [existingUsername] = await promisePool.query(
      'SELECT user_id FROM tb_user WHERE user_username = ?',
      [username]
    );

    if (existingUsername.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Username já cadastrado'
      });
    }

    // Verificar se role existe
    const [roleCheck] = await promisePool.query(
      'SELECT role_id FROM tb_roles WHERE role_id = ?',
      [idgroup]
    );

    if (roleCheck.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Role não encontrado'
      });
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);
    const userKey = uuidv4();

    // Inserir novo usuário
    const [result] = await promisePool.query(
      `INSERT INTO tb_user (
        user_uuid, user_name, user_email, user_username, user_password,
        user_role_id, user_date_insert, user_status
      ) VALUES (?, ?, ?, ?, ?, ?, NOW(), 1)`,
      [userKey, name, email, username, hashedPassword, idgroup]
    );

    res.status(201).json({
      success: true,
      message: 'Usuário cadastrado com sucesso',
      data: {
        user_id: result.insertId,
        user_uuid: userKey,
        user_name: name,
        user_email: email,
        user_username: username
      }
    });

  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao cadastrar usuário',
      error: error.message
    });
  }
};

// Login de usuário
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validar campos
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email e senha são obrigatórios'
      });
    }

    // Buscar usuário por email
    const [users] = await promisePool.query(`
      SELECT
        u.*,
        r.role_name,
        r.role_permissions
      FROM tb_user u
      LEFT JOIN tb_roles r ON u.user_role_id = r.role_id
      WHERE u.user_email = ?
        AND u.user_status = 'active'
    `, [email]);

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas ou usuário inativo'
      });
    }

    const user = users[0];

    // Verificar senha
    const isValidPassword = await bcrypt.compare(password, user.user_password);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas'
      });
    }

    // Gerar tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Atualizar último login
    await promisePool.query(
      `UPDATE tb_user SET user_last_login = NOW() WHERE user_id = ?`,
      [user.user_id]
    );

    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      data: {
        user: {
          user_id: user.user_id,
          user_uuid: user.user_uuid,
          user_name: user.user_name,
          user_email: user.user_email,
          user_username: user.user_username,
          user_avatar: user.user_avatar,
          role_name: user.role_name,
          role_permissions: user.role_permissions
        },
        accessToken,
        refreshToken
      }
    });

  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao fazer login',
      error: error.message
    });
  }
};

// Refresh Token
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token não fornecido'
      });
    }

    // Verificar refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Buscar usuário
    const [users] = await promisePool.query(
      `SELECT * FROM tb_user WHERE user_id = ? AND user_status = 'active'`,
      [decoded.id]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Usuário inativo ou não encontrado'
      });
    }

    const user = users[0];

    // Gerar novo access token
    const newAccessToken = generateAccessToken(user);

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken
      }
    });

  } catch (error) {
    console.error('Erro no refresh token:', error);
    res.status(401).json({
      success: false,
      message: 'Refresh token inválido ou expirado',
      error: error.message
    });
  }
};

// Verificar Token (para login automático)
exports.verifyToken = async (req, res) => {
  try {
    // O middleware verifyToken já validou o token
    // Apenas retornamos sucesso com os dados do usuário
    res.json({
      success: true,
      message: 'Token válido',
      data: {
        user: req.user
      }
    });

  } catch (error) {
    console.error('Erro na verificação do token:', error);
    res.status(401).json({
      success: false,
      message: 'Token inválido'
    });
  }
};

// Logout
exports.logout = async (req, res) => {
  try {
    // O logout é feito no frontend removendo os tokens
    // Aqui apenas confirmamos o logout
    res.json({
      success: true,
      message: 'Logout realizado com sucesso'
    });

  } catch (error) {
    console.error('Erro no logout:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao fazer logout',
      error: error.message
    });
  }
};
