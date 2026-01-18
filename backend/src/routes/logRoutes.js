const express = require('express');
const router = express.Router();
const { promisePool } = require('../config/database');
const { verifyToken } = require('../middlewares/auth');

// GET /api/logs/system - Listar logs de atividades do sistema
router.get('/system', verifyToken, async (req, res) => {
  try {
    const { dateFrom, dateTo, action, userId } = req.query;

    // Verificar se a tabela existe
    const [tables] = await promisePool.query(
      "SHOW TABLES LIKE 'tb_system_logs'"
    );

    if (tables.length === 0) {
      // Tabela não existe, retornar array vazio
      return res.json({
        success: true,
        logs: [],
        message: 'Tabela de logs ainda não foi criada',
      });
    }

    // Verificar se a tabela de usuários existe para o JOIN
    const [userTables] = await promisePool.query(
      "SHOW TABLES LIKE 'tb_user'"
    );

    let query;
    if (userTables.length > 0) {
      query = `
        SELECT
          l.*,
          u.user_name
        FROM tb_system_logs l
        LEFT JOIN tb_user u ON l.log_user_id = u.user_id
        WHERE 1=1
      `;
    } else {
      query = `
        SELECT
          l.*,
          NULL as user_name
        FROM tb_system_logs l
        WHERE 1=1
      `;
    }

    const params = [];

    // Filtro de data inicial
    if (dateFrom) {
      query += ` AND DATE(l.log_date_insert) >= ?`;
      params.push(dateFrom);
    }

    // Filtro de data final
    if (dateTo) {
      query += ` AND DATE(l.log_date_insert) <= ?`;
      params.push(dateTo);
    }

    // Filtro de ação
    if (action) {
      query += ` AND l.log_action = ?`;
      params.push(action);
    }

    // Filtro de usuário
    if (userId) {
      query += ` AND l.log_user_id = ?`;
      params.push(userId);
    }

    // Ordenar por data decrescente
    query += ` ORDER BY l.log_date_insert DESC LIMIT 1000`;

    const [logs] = await promisePool.query(query, params);

    // Parse JSON fields (se ainda for string, caso contrário já é objeto)
    const parsedLogs = logs.map(log => {
      try {
        return {
          ...log,
          log_old_data: log.log_old_data
            ? (typeof log.log_old_data === 'string' ? JSON.parse(log.log_old_data) : log.log_old_data)
            : null,
          log_new_data: log.log_new_data
            ? (typeof log.log_new_data === 'string' ? JSON.parse(log.log_new_data) : log.log_new_data)
            : null,
        };
      } catch (parseError) {
        // Se falhar ao fazer parse do JSON, retornar como está
        return {
          ...log,
          log_old_data: log.log_old_data || null,
          log_new_data: log.log_new_data || null,
        };
      }
    });

    res.json({
      success: true,
      logs: parsedLogs,
    });
  } catch (error) {
    console.error('Erro ao buscar logs do sistema:', error);

    // Verificar se é erro de tabela não existente ou coluna não existente
    if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR') {
      return res.json({
        success: true,
        logs: [],
        message: 'Tabela de logs ainda não foi configurada corretamente',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erro ao buscar logs do sistema',
      error: error.message,
    });
  }
});

// GET /api/logs/access - Listar logs de acesso
router.get('/access', verifyToken, async (req, res) => {
  try {
    const { dateFrom, dateTo, accessType, userId } = req.query;

    // Verificar se a tabela existe
    const [tables] = await promisePool.query(
      "SHOW TABLES LIKE 'tb_access_logs'"
    );

    if (tables.length === 0) {
      // Tabela não existe, retornar array vazio
      return res.json({
        success: true,
        logs: [],
        message: 'Tabela de logs ainda não foi criada',
      });
    }

    // Verificar se a tabela de usuários existe para o JOIN
    const [userTables] = await promisePool.query(
      "SHOW TABLES LIKE 'tb_user'"
    );

    let query;
    if (userTables.length > 0) {
      query = `
        SELECT
          l.*,
          u.user_name,
          u.user_email
        FROM tb_access_logs l
        LEFT JOIN tb_user u ON l.access_user_id = u.user_id
        WHERE 1=1
      `;
    } else {
      query = `
        SELECT
          l.*,
          NULL as user_name,
          NULL as user_email
        FROM tb_access_logs l
        WHERE 1=1
      `;
    }

    const params = [];

    // Filtro de data inicial
    if (dateFrom) {
      query += ` AND DATE(l.access_date_insert) >= ?`;
      params.push(dateFrom);
    }

    // Filtro de data final
    if (dateTo) {
      query += ` AND DATE(l.access_date_insert) <= ?`;
      params.push(dateTo);
    }

    // Filtro de tipo de acesso
    if (accessType) {
      query += ` AND l.access_type = ?`;
      params.push(accessType);
    }

    // Filtro de usuário
    if (userId) {
      query += ` AND l.access_user_id = ?`;
      params.push(userId);
    }

    // Ordenar por data decrescente
    query += ` ORDER BY l.access_date_insert DESC LIMIT 1000`;

    const [logs] = await promisePool.query(query, params);

    res.json({
      success: true,
      logs,
    });
  } catch (error) {
    console.error('Erro ao buscar logs de acesso:', error);

    // Verificar se é erro de tabela não existente ou coluna não existente
    if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR') {
      return res.json({
        success: true,
        logs: [],
        message: 'Tabela de logs ainda não foi configurada corretamente',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erro ao buscar logs de acesso',
      error: error.message,
    });
  }
});

module.exports = router;
