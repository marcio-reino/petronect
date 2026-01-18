const { promisePool } = require('../config/database');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { logSystemActivity, getClientIp } = require('../utils/logger');
const path = require('path');
const fs = require('fs');

// Listar todos os usuários
exports.getAllUsers = async (req, res) => {
  try {
    const [users] = await promisePool.query(`
      SELECT
        u.user_id,
        u.user_uuid,
        u.user_name,
        u.user_email,
        u.user_username,
        u.user_phone,
        u.user_avatar,
        u.user_role_id,
        r.role_name,
        u.user_last_login,
        u.user_date_insert,
        u.user_status
      FROM tb_user u
      LEFT JOIN tb_roles r ON u.user_role_id = r.role_id
      ORDER BY u.user_date_insert DESC
    `);

    res.json({
      success: true,
      data: users
    });

  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar usuários',
      error: error.message
    });
  }
};

// Buscar usuário por ID
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const [users] = await promisePool.query(`
      SELECT
        u.user_id,
        u.user_uuid,
        u.user_name,
        u.user_email,
        u.user_username,
        u.user_phone,
        u.user_avatar,
        u.user_role_id,
        r.role_name,
        r.role_description,
        r.role_permissions,
        u.user_last_login,
        u.user_date_insert,
        u.user_date_update,
        u.user_status
      FROM tb_user u
      LEFT JOIN tb_roles r ON u.user_role_id = r.role_id
      WHERE u.user_id = ?
    `, [id]);

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    res.json({
      success: true,
      data: users[0]
    });

  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar usuário',
      error: error.message
    });
  }
};

// Criar usuário
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, cellphone, phone, role, avatar, status } = req.body;

    // Validar campos obrigatórios
    if (!name || !email || !role) {
      return res.status(400).json({
        success: false,
        message: 'Nome, email e função são obrigatórios'
      });
    }

    // Validar senha
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Senha é obrigatória'
      });
    }

    // Verificar se email já existe
    const [emailCheck] = await promisePool.query(
      'SELECT user_id FROM tb_user WHERE user_email = ?',
      [email]
    );

    if (emailCheck.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email já está em uso'
      });
    }

    // Buscar role_id pelo nome do role
    const [roleData] = await promisePool.query(
      'SELECT role_id FROM tb_roles WHERE role_name = ?',
      [role]
    );

    if (roleData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Função não encontrada'
      });
    }

    const idgroup = roleData[0].role_id;

    // Gerar username automaticamente a partir do email (parte antes do @)
    let username = email.split('@')[0];

    // Verificar se username já existe e adicionar número se necessário
    let usernameExists = true;
    let usernameAttempt = username;
    let counter = 1;

    while (usernameExists) {
      const [usernameCheck] = await promisePool.query(
        'SELECT user_id FROM tb_user WHERE user_username = ?',
        [usernameAttempt]
      );

      if (usernameCheck.length === 0) {
        usernameExists = false;
        username = usernameAttempt;
      } else {
        usernameAttempt = `${username}${counter}`;
        counter++;
      }
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);
    const userKey = uuidv4();

    // Inserir novo usuário
    const [result] = await promisePool.query(
      `INSERT INTO tb_user (
        user_uuid, user_name, user_email, user_username, user_password,
        user_phone, user_role_id, user_avatar,
        user_date_insert, user_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [userKey, name, email, username, hashedPassword,
       phone || null, idgroup, avatar || null, status || 1]
    );

    // Registrar log de atividade
    await logSystemActivity({
      userId: req.user?.id,
      userName: req.user?.username,
      action: 'CREATE',
      module: 'users',
      entityType: 'user',
      entityId: result.insertId,
      description: `Criou o usuário: ${name} (${email})`,
      newData: { name, email, username, role, status: status || 1 },
      ipAddress: getClientIp(req)
    });

    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso',
      data: {
        user_id: result.insertId,
        user_uuid: userKey,
        user_name: name,
        user_email: email,
        user_username: username
      }
    });

  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar usuário',
      error: error.message
    });
  }
};

// Atualizar usuário
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, username, password, cellphone, phone, idgroup, avatar, status } = req.body;

    // Buscar dados antigos do usuário para log
    const [oldUserData] = await promisePool.query(
      'SELECT user_name, user_email, user_username, user_phone, user_role_id, user_status FROM tb_user WHERE user_id = ?',
      [id]
    );

    if (oldUserData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    const oldData = oldUserData[0];

    // Preparar campos para atualização
    let updateFields = [];
    let updateValues = [];

    if (name) {
      updateFields.push('user_name = ?');
      updateValues.push(name);
    }

    if (email) {
      // Verificar se email já existe em outro usuário
      const [emailCheck] = await promisePool.query(
        'SELECT user_id FROM tb_user WHERE user_email = ? AND user_id != ?',
        [email, id]
      );

      if (emailCheck.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Email já está em uso'
        });
      }

      updateFields.push('user_email = ?');
      updateValues.push(email);
    }

    if (username) {
      // Verificar se username já existe em outro usuário
      const [usernameCheck] = await promisePool.query(
        'SELECT user_id FROM tb_user WHERE user_username = ? AND user_id != ?',
        [username, id]
      );

      if (usernameCheck.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Username já está em uso'
        });
      }

      updateFields.push('user_username = ?');
      updateValues.push(username);
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateFields.push('user_password = ?');
      updateValues.push(hashedPassword);
    }

    if (phone !== undefined) {
      updateFields.push('user_phone = ?');
      updateValues.push(phone);
    }

    if (idgroup) {
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

      updateFields.push('user_role_id = ?');
      updateValues.push(idgroup);
    }

    if (avatar !== undefined) {
      updateFields.push('user_avatar = ?');
      updateValues.push(avatar);
    }

    if (status !== undefined) {
      updateFields.push('user_status = ?');
      updateValues.push(status);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum campo para atualizar'
      });
    }

    updateFields.push('user_date_update = NOW()');
    updateValues.push(id);

    await promisePool.query(
      `UPDATE tb_user SET ${updateFields.join(', ')} WHERE user_id = ?`,
      updateValues
    );

    // Registrar log de atividade
    const newData = {};
    if (name) newData.name = name;
    if (email) newData.email = email;
    if (username) newData.username = username;
    if (phone !== undefined) newData.phone = phone;
    if (idgroup) newData.idgroup = idgroup;
    if (status !== undefined) newData.status = status;

    await logSystemActivity({
      userId: req.user?.id,
      userName: req.user?.username,
      action: 'UPDATE',
      module: 'users',
      entityType: 'user',
      entityId: id,
      description: `Atualizou o usuário: ${name || oldData.user_name} (${email || oldData.user_email})`,
      oldData: {
        name: oldData.user_name,
        email: oldData.user_email,
        username: oldData.user_username,
        phone: oldData.user_phone,
        idgroup: oldData.user_role_id,
        status: oldData.user_status
      },
      newData,
      ipAddress: getClientIp(req)
    });

    res.json({
      success: true,
      message: 'Usuário atualizado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar usuário',
      error: error.message
    });
  }
};

// Deletar usuário (soft delete - atualiza status)
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query; // ?permanent=true para delete permanente

    // Buscar dados do usuário antes de deletar
    const [userData] = await promisePool.query(
      'SELECT user_name, user_email, user_username FROM tb_user WHERE user_id = ?',
      [id]
    );

    if (userData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    const user = userData[0];

    if (permanent === 'true') {
      // Delete permanente
      const [result] = await promisePool.query(
        'DELETE FROM tb_user WHERE user_id = ?',
        [id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }

      // Registrar log de atividade - delete permanente
      await logSystemActivity({
        userId: req.user?.id,
        userName: req.user?.username,
        action: 'DELETE_PERMANENT',
        module: 'users',
        entityType: 'user',
        entityId: id,
        description: `Deletou permanentemente o usuário: ${user.user_name} (${user.user_email})`,
        oldData: { name: user.user_name, email: user.user_email, username: user.user_username },
        ipAddress: getClientIp(req)
      });

      return res.json({
        success: true,
        message: 'Usuário deletado permanentemente com sucesso'
      });
    }

    // Soft delete - apenas inativa o usuário
    const [result] = await promisePool.query(
      'UPDATE tb_user SET user_status = \'inactive\', user_date_update = NOW() WHERE user_id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Registrar log de atividade - soft delete
    await logSystemActivity({
      userId: req.user?.id,
      userName: req.user?.username,
      action: 'DELETE_SOFT',
      module: 'users',
      entityType: 'user',
      entityId: id,
      description: `Inativou o usuário: ${user.user_name} (${user.user_email})`,
      oldData: { name: user.user_name, email: user.user_email, status: 1 },
      newData: { status: 0 },
      ipAddress: getClientIp(req)
    });

    res.json({
      success: true,
      message: 'Usuário inativado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao deletar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar usuário',
      error: error.message
    });
  }
};

// Obter perfil do usuário logado
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const [users] = await promisePool.query(`
      SELECT
        u.user_id,
        u.user_uuid,
        u.user_name,
        u.user_email,
        u.user_username,
        u.user_phone,
        u.user_avatar,
        u.user_role_id,
        r.role_name,
        r.role_description,
        r.role_permissions,
        u.user_last_login,
        u.user_date_insert,
        u.user_status
      FROM tb_user u
      LEFT JOIN tb_roles r ON u.user_role_id = r.role_id
      WHERE u.user_id = ?
    `, [userId]);

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    res.json({
      success: true,
      data: users[0]
    });

  } catch (error) {
    console.error('Erro ao buscar perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar perfil',
      error: error.message
    });
  }
};

// Listar todos os roles/cargos
exports.getAllRoles = async (req, res) => {
  try {
    const [roles] = await promisePool.query(`
      SELECT
        role_id,
        role_uuid,
        role_name,
        role_description,
        role_permissions,
        role_status
      FROM tb_roles
      ORDER BY role_name ASC
    `);

    res.json({
      success: true,
      data: roles
    });

  } catch (error) {
    console.error('Erro ao listar roles:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar roles',
      error: error.message
    });
  }
};

// Atualizar perfil do usuário logado
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email, phone, role } = req.body;

    // Validar dados obrigatórios
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Nome e email são obrigatórios'
      });
    }

    // Verificar se email já existe para outro usuário
    const [existingUser] = await promisePool.query(
      'SELECT user_id FROM tb_user WHERE user_email = ? AND user_id != ?',
      [email, userId]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email já cadastrado para outro usuário'
      });
    }

    // Buscar role_id se role foi fornecido
    let roleId = null;
    if (role) {
      const [roleData] = await promisePool.query(
        'SELECT role_id FROM tb_roles WHERE role_name = ?',
        [role]
      );
      if (roleData.length > 0) {
        roleId = roleData[0].role_id;
      }
    }

    // Preparar campos para atualização
    const updateFields = {
      user_name: name,
      user_email: email,
      user_phone: phone || null,
      user_date_update: new Date()
    };

    if (roleId) {
      updateFields.user_role_id = roleId;
    }

    // Atualizar usuário
    await promisePool.query(
      'UPDATE tb_user SET ? WHERE user_id = ?',
      [updateFields, userId]
    );

    // Buscar dados atualizados
    const [updatedUser] = await promisePool.query(`
      SELECT
        u.user_id,
        u.user_uuid,
        u.user_name,
        u.user_email,
        u.user_username,
        u.user_phone,
        u.user_avatar,
        u.user_role_id,
        r.role_name,
        r.role_description,
        r.role_permissions,
        u.user_date_insert,
        u.user_date_update
      FROM tb_user u
      LEFT JOIN tb_roles r ON u.user_role_id = r.role_id
      WHERE u.user_id = ?
    `, [userId]);

    res.json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      data: updatedUser[0]
    });

  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar perfil',
      error: error.message
    });
  }
};

// Alterar senha do usuário logado
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // Validar dados
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Senha atual e nova senha são obrigatórias'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'A nova senha deve ter no mínimo 6 caracteres'
      });
    }

    // Buscar usuário
    const [users] = await promisePool.query(
      'SELECT user_password FROM tb_user WHERE user_id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Verificar senha atual
    const isPasswordValid = await bcrypt.compare(currentPassword, users[0].user_password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Senha atual incorreta'
      });
    }

    // Criptografar nova senha
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Atualizar senha
    await promisePool.query(
      'UPDATE tb_user SET user_password = ?, user_date_update = ? WHERE user_id = ?',
      [hashedPassword, new Date(), userId]
    );

    res.json({
      success: true,
      message: 'Senha alterada com sucesso'
    });

  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao alterar senha',
      error: error.message
    });
  }
};

// Criar um novo role
exports.createRole = async (req, res) => {
  try {
    const { name, description } = req.body;

    // Validar dados
    if (!name || !description) {
      return res.status(400).json({
        success: false,
        message: 'Nome e descrição são obrigatórios'
      });
    }

    // Verificar se já existe um role com o mesmo nome
    const [existingRole] = await promisePool.query(
      'SELECT role_id FROM tb_roles WHERE role_name = ?',
      [name]
    );

    if (existingRole.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Já existe um cargo com este nome'
      });
    }

    // Gerar role_uuid
    const roleUuid = uuidv4();

    // Inserir novo role com status ativo (1) e permissões vazias
    const [result] = await promisePool.query(
      `INSERT INTO tb_roles (
        role_uuid, role_name, role_description, role_permissions,
        role_dateinsert, role_status
      ) VALUES (?, ?, ?, ?, NOW(), 1)`,
      [roleUuid, name, description, '{}']
    );

    // Registrar log de atividade
    await logSystemActivity({
      userId: req.user?.id,
      userName: req.user?.username,
      action: 'CREATE',
      module: 'roles',
      entityType: 'role',
      entityId: result.insertId,
      description: `Criou o cargo: ${name}`,
      newData: { name, description, status: 1 },
      ipAddress: getClientIp(req)
    });

    res.status(201).json({
      success: true,
      message: 'Cargo criado com sucesso',
      data: {
        role_id: result.insertId,
        role_uuid: roleUuid,
        role_name: name,
        role_description: description,
        role_status: 1
      }
    });

  } catch (error) {
    console.error('Erro ao criar cargo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar cargo',
      error: error.message
    });
  }
};

// Atualizar permissões de um role
exports.updateRolePermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, permissions } = req.body;

    // Validar dados
    if (!name || !description || !permissions) {
      return res.status(400).json({
        success: false,
        message: 'Nome, descrição e permissões são obrigatórios'
      });
    }

    // Verificar se role existe e buscar dados antigos
    const [roles] = await promisePool.query(
      'SELECT role_id, role_name, role_description, role_permissions FROM tb_roles WHERE role_id = ?',
      [id]
    );

    if (roles.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cargo não encontrado'
      });
    }

    const oldData = roles[0];

    // Atualizar role completo
    await promisePool.query(
      'UPDATE tb_roles SET role_name = ?, role_description = ?, role_permissions = ?, role_date_update = ? WHERE role_id = ?',
      [name, description, permissions, new Date(), id]
    );

    // Registrar log de atividade
    await logSystemActivity({
      userId: req.user?.id,
      userName: req.user?.username,
      action: 'UPDATE',
      module: 'roles',
      entityType: 'role',
      entityId: id,
      description: `Atualizou o cargo: ${name}`,
      oldData: {
        name: oldData.role_name,
        description: oldData.role_description,
        permissions: oldData.role_permissions
      },
      newData: { name, description, permissions },
      ipAddress: getClientIp(req)
    });

    res.json({
      success: true,
      message: 'Cargo atualizado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao atualizar cargo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar cargo',
      error: error.message
    });
  }
};

// Deletar role (soft delete ou permanente)
exports.deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query; // ?permanent=true para delete permanente

    if (permanent === 'true') {
      // Buscar dados do cargo antes de deletar
      const [roleData] = await promisePool.query(
        'SELECT role_name, role_description FROM tb_roles WHERE role_id = ?',
        [id]
      );

      if (roleData.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Cargo não encontrado'
        });
      }

      const role = roleData[0];

      // Delete permanente
      const [result] = await promisePool.query(
        'DELETE FROM tb_roles WHERE role_id = ?',
        [id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Cargo não encontrado'
        });
      }

      // Registrar log de atividade
      await logSystemActivity({
        userId: req.user?.id,
        userName: req.user?.username,
        action: 'DELETE_PERMANENT',
        module: 'roles',
        entityType: 'role',
        entityId: id,
        description: `Deletou permanentemente o cargo: ${role.role_name}`,
        oldData: { name: role.role_name, description: role.role_description },
        ipAddress: getClientIp(req)
      });

      return res.json({
        success: true,
        message: 'Cargo deletado permanentemente com sucesso'
      });
    }

    // Buscar dados do cargo
    const [roleData] = await promisePool.query(
      'SELECT role_name, role_description FROM tb_roles WHERE role_id = ?',
      [id]
    );

    if (roleData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cargo não encontrado'
      });
    }

    const role = roleData[0];

    // Soft delete - apenas inativa o cargo
    const [result] = await promisePool.query(
      'UPDATE tb_roles SET role_status = 0, role_date_update = NOW() WHERE role_id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cargo não encontrado'
      });
    }

    // Registrar log de atividade
    await logSystemActivity({
      userId: req.user?.id,
      userName: req.user?.username,
      action: 'DELETE_SOFT',
      module: 'roles',
      entityType: 'role',
      entityId: id,
      description: `Inativou o cargo: ${role.role_name}`,
      oldData: { name: role.role_name, description: role.role_description, status: 1 },
      newData: { status: 0 },
      ipAddress: getClientIp(req)
    });

    res.json({
      success: true,
      message: 'Cargo inativado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao deletar cargo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar cargo',
      error: error.message
    });
  }
};

// Upload de avatar do usuário
exports.uploadAvatar = async (req, res) => {
  try {
    const userId = req.user.id;

    // Verificar se um arquivo foi enviado
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum arquivo foi enviado'
      });
    }

    // Buscar dados do usuário para pegar o avatar antigo
    const [users] = await promisePool.query(
      'SELECT user_avatar FROM tb_user WHERE user_id = ?',
      [userId]
    );

    if (users.length === 0) {
      // Deletar arquivo enviado se usuário não existir
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    const oldAvatar = users[0].user_avatar;

    // Gerar URL do novo avatar (relativo ao servidor)
    const avatarUrl = `/uploads/users/${req.file.filename}`;

    // Atualizar avatar no banco de dados
    await promisePool.query(
      'UPDATE tb_user SET user_avatar = ?, user_date_update = NOW() WHERE user_id = ?',
      [avatarUrl, userId]
    );

    // Deletar avatar antigo se existir
    if (oldAvatar) {
      const oldAvatarPath = path.join(__dirname, '../../', oldAvatar);
      if (fs.existsSync(oldAvatarPath)) {
        try {
          fs.unlinkSync(oldAvatarPath);
          console.log('Avatar antigo deletado:', oldAvatarPath);
        } catch (error) {
          console.error('Erro ao deletar avatar antigo:', error);
        }
      }
    }

    // Registrar log de atividade
    await logSystemActivity({
      userId: req.user?.id,
      userName: req.user?.username,
      action: 'UPDATE',
      module: 'users',
      entityType: 'user',
      entityId: userId,
      description: 'Atualizou a foto de perfil',
      oldData: { avatar: oldAvatar },
      newData: { avatar: avatarUrl },
      ipAddress: getClientIp(req)
    });

    res.json({
      success: true,
      message: 'Foto de perfil atualizada com sucesso',
      data: {
        avatar: avatarUrl
      }
    });

  } catch (error) {
    // Se houver erro, tentar deletar o arquivo enviado
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error('Erro ao fazer upload do avatar:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao fazer upload do avatar',
      error: error.message
    });
  }
};

// Listar empresas atribuídas ao usuário
exports.getUserCompanies = async (req, res) => {
  try {
    const { id } = req.params;

    const [companies] = await promisePool.query(`
      SELECT 
        c.comp_id,
        c.comp_key,
        c.comp_name,
        c.comp_razaosocial,
        c.comp_cnpj,
        c.comp_status,
        cu.compuser_date_insert,
        cu.compuser_status
      FROM tb_company_user cu
      INNER JOIN tb_company c ON cu.compuser_idcompany = c.comp_id
      WHERE cu.compuser_iduser = ? AND cu.compuser_status = 1
      ORDER BY c.comp_name
    `, [id]);

    res.json({
      success: true,
      data: companies
    });

  } catch (error) {
    console.error('Erro ao listar empresas do usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar empresas do usuário',
      error: error.message
    });
  }
};

// Atribuir empresa ao usuário
exports.assignCompanyToUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId } = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'ID da empresa é obrigatório'
      });
    }

    // Verificar se usuário existe
    const [users] = await promisePool.query('SELECT user_id FROM tb_user WHERE user_id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Verificar se empresa existe
    const [companies] = await promisePool.query('SELECT comp_id FROM tb_company WHERE comp_id = ?', [companyId]);
    if (companies.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Empresa não encontrada'
      });
    }

    // Verificar se já existe atribuição
    const [existing] = await promisePool.query(
      'SELECT compuser_id, compuser_status FROM tb_company_user WHERE compuser_iduser = ? AND compuser_idcompany = ?',
      [id, companyId]
    );

    if (existing.length > 0) {
      // Se existe mas está inativo, reativar
      if (existing[0].compuser_status === 0) {
        await promisePool.query(
          'UPDATE tb_company_user SET compuser_status = 1, compuser_date_update = NOW() WHERE compuser_id = ?',
          [existing[0].compuser_id]
        );

        await logSystemActivity(
          req.user.userId,
          'UPDATE',
          'Reativou empresa para usuário',
          getClientIp(req)
        );

        return res.json({
          success: true,
          message: 'Empresa reativada para o usuário'
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Esta empresa já está atribuída ao usuário'
        });
      }
    }

    // Criar nova atribuição
    const companyUserKey = uuidv4();
    await promisePool.query(
      `INSERT INTO tb_company_user 
        (compuser_uuid, compuser_iduser, compuser_idcompany, compuser_date_insert, compuser_status) 
       VALUES (?, ?, ?, NOW(), 1)`,
      [companyUserKey, id, companyId]
    );

    await logSystemActivity(
      req.user.userId,
      'INSERT',
      `Atribuiu empresa ${companyId} ao usuário ${id}`,
      getClientIp(req)
    );

    res.json({
      success: true,
      message: 'Empresa atribuída ao usuário com sucesso'
    });

  } catch (error) {
    console.error('Erro ao atribuir empresa ao usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atribuir empresa ao usuário',
      error: error.message
    });
  }
};

// Remover empresa do usuário
exports.removeCompanyFromUser = async (req, res) => {
  try {
    const { id, companyId } = req.params;

    // Verificar se atribuição existe
    const [existing] = await promisePool.query(
      'SELECT compuser_id FROM tb_company_user WHERE compuser_iduser = ? AND compuser_idcompany = ? AND compuser_status = 1',
      [id, companyId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Atribuição não encontrada'
      });
    }

    // Soft delete - inativar atribuição
    await promisePool.query(
      'UPDATE tb_company_user SET compuser_status = 0, compuser_date_update = NOW() WHERE compuser_id = ?',
      [existing[0].compuser_id]
    );

    await logSystemActivity(
      req.user.userId,
      'UPDATE',
      `Removeu empresa ${companyId} do usuário ${id}`,
      getClientIp(req)
    );

    res.json({
      success: true,
      message: 'Empresa removida do usuário com sucesso'
    });

  } catch (error) {
    console.error('Erro ao remover empresa do usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao remover empresa do usuário',
      error: error.message
    });
  }
};

// Buscar usuários de uma empresa
exports.getUsersByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;

    // Por enquanto, retorna todos os usuários ativos do sistema
    // TODO: Implementar tabela tb_user_company quando necessário relacionamento usuário-empresa
    const [users] = await promisePool.query(`
      SELECT DISTINCT
        u.user_id,
        u.user_name,
        u.user_email,
        u.user_username,
        r.role_name as user_role
      FROM tb_user u
      LEFT JOIN tb_roles r ON u.user_role_id = r.role_id
      WHERE u.user_status = 'active'
      ORDER BY u.user_name ASC
    `);

    res.json({
      success: true,
      data: users
    });

  } catch (error) {
    console.error('Erro ao buscar usuários da empresa:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar usuários da empresa',
      error: error.message
    });
  }
};
