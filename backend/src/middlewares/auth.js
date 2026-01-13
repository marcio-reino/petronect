const jwt = require('jsonwebtoken');
const { promisePool } = require('../config/database');
require('dotenv').config();

// Middleware para verificar JWT
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Token não fornecido'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Adiciona os dados do usuário na requisição
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token inválido ou expirado'
    });
  }
};

// Middleware para verificar se é Admin
const isAdmin = async (req, res, next) => {
  try {
    // Buscar o role do usuário
    const [roles] = await promisePool.query(
      'SELECT role_name FROM tb_roles WHERE role_id = ?',
      [req.user.idrole]
    );

    if (roles.length === 0 || roles[0].role_name !== 'Administrador') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas administradores.'
      });
    }
    
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Erro ao verificar permissões'
    });
  }
};

// Middleware para verificar se é Instrutor ou Admin
const isInstrutor = async (req, res, next) => {
  try {
    // Buscar o role do usuário
    const [roles] = await promisePool.query(
      'SELECT role_name FROM tb_roles WHERE role_id = ?',
      [req.user.idrole]
    );

    if (roles.length === 0 || (roles[0].role_name !== 'Instrutor' && roles[0].role_name !== 'Administrador')) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas instrutores e administradores.'
      });
    }
    
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Erro ao verificar permissões'
    });
  }
};

// Middleware para verificar se é Aluno
const isAluno = async (req, res, next) => {
  try {
    // Buscar o role do usuário
    const [roles] = await promisePool.query(
      'SELECT role_name FROM tb_roles WHERE role_id = ?',
      [req.user.idrole]
    );

    if (roles.length === 0 || (roles[0].role_name !== 'Aluno' && roles[0].role_name !== 'Administrador')) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas alunos.'
      });
    }
    
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Erro ao verificar permissões'
    });
  }
};

module.exports = {
  verifyToken,
  isAdmin,
  isInstrutor,
  isAluno
};
