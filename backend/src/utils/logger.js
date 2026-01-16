const { promisePool } = require('../config/database');

/**
 * Registrar log de atividade do sistema
 * @param {Object} logData - Dados do log
 * @param {number} logData.userId - ID do usuário que executou a ação
 * @param {string} logData.userName - Nome do usuário (para exibição no console)
 * @param {string} logData.action - Ação realizada (CREATE, UPDATE, DELETE, etc)
 * @param {string} logData.module - Módulo do sistema (users, roles, clients, etc)
 * @param {string} logData.entityType - Tipo de entidade afetada
 * @param {number} logData.entityId - ID da entidade afetada
 * @param {string} logData.description - Descrição detalhada da ação
 * @param {Object} logData.oldData - Dados anteriores (para UPDATE/DELETE)
 * @param {Object} logData.newData - Dados novos (para CREATE/UPDATE)
 * @param {string} logData.ipAddress - IP do usuário
 * @param {string} logData.userAgent - User agent do navegador
 */
async function logSystemActivity(logData) {
  try {
    // Garantir que o entityId seja um inteiro ou null para evitar erros de truncamento
    let sanitizedEntityId = null;
    if (logData.entityId !== undefined && logData.entityId !== null) {
      // Se for número, usar direto
      if (typeof logData.entityId === 'number' && Number.isInteger(logData.entityId)) {
        sanitizedEntityId = logData.entityId;
      } else if (typeof logData.entityId === 'string') {
        // Tentar extrair um inteiro da string (por exemplo quando recebem '123')
        const digits = logData.entityId.match(/^\d+$/);
        if (digits) sanitizedEntityId = parseInt(logData.entityId, 10);
        else sanitizedEntityId = null; // não-numérico (UUID, etc) -> armazenar null
      } else {
        // Qualquer outro tipo (objeto, array) -> null
        sanitizedEntityId = null;
      }
    }

    await promisePool.query(
      `INSERT INTO tb_system_logs (
        log_user_id,
        log_action,
        log_module,
        log_entity_type,
        log_entity_id,
        log_description,
        log_old_data,
        log_new_data,
        log_ip_address,
        log_user_agent,
        log_date_insert
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        logData.userId || null,
        logData.action,
        logData.module,
        logData.entityType || null,
        sanitizedEntityId,
        logData.description,
        logData.oldData ? JSON.stringify(logData.oldData) : null,
        logData.newData ? JSON.stringify(logData.newData) : null,
        logData.ipAddress || null,
        logData.userAgent || null
      ]
    );

    console.log(`✓ Log registrado: ${logData.action} em ${logData.module} por ${logData.userName || 'Sistema'}`);
  } catch (error) {
    console.error('Erro ao registrar log de sistema:', error.message);
    console.error('Dados do log:', JSON.stringify({
      userId: logData.userId,
      userName: logData.userName,
      action: logData.action,
      module: logData.module,
      entityType: logData.entityType,
      entityId: logData.entityId
    }));
    // Não lançar erro para não quebrar o fluxo principal
  }
}

/**
 * Registrar log de acesso (login/logout)
 * @param {Object} accessData - Dados do acesso
 * @param {number} accessData.userId - ID do usuário
 * @param {string} accessData.userName - Nome do usuário
 * @param {string} accessData.userEmail - Email do usuário
 * @param {string} accessData.type - Tipo de acesso (LOGIN, LOGOUT, FAILED_LOGIN, SESSION_EXPIRED)
 * @param {string} accessData.ipAddress - IP do usuário
 * @param {string} accessData.userAgent - User agent
 * @param {string} accessData.sessionId - ID da sessão
 * @param {string} accessData.failedReason - Motivo da falha (se aplicável)
 */
async function logAccessActivity(accessData) {
  try {
    const accessUuid = uuidv4();
    
    await promisePool.query(
      `INSERT INTO tb_access_logs (
        access_uuid,
        access_user_id,
        access_user_name,
        access_user_email,
        access_type,
        access_ip_address,
        access_user_agent,
        access_session_id,
        access_failed_reason,
        access_status,
        access_date_insert
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
      [
        accessUuid,
        accessData.userId || null,
        accessData.userName || null,
        accessData.userEmail || null,
        accessData.type,
        accessData.ipAddress || null,
        accessData.userAgent || null,
        accessData.sessionId || null,
        accessData.failedReason || null
      ]
    );

    console.log(`✓ Log de acesso registrado: ${accessData.type} por ${accessData.userName || accessData.userEmail || 'Usuário'}`);
  } catch (error) {
    console.error('Erro ao registrar log de acesso:', error);
    // Não lançar erro para não quebrar o fluxo principal
  }
}

/**
 * Obter IP do usuário da requisição
 */
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.headers['x-real-ip'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         null;
}

/**
 * Obter User Agent da requisição
 */
function getUserAgent(req) {
  return req.headers['user-agent'] || null;
}

module.exports = {
  logSystemActivity,
  logAccessActivity,
  getClientIp,
  getUserAgent
};
