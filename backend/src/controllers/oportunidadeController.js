const { promisePool } = require('../config/database');

// Listar todas as oportunidades com filtros
exports.getAllOportunidades = async (req, res) => {
  try {
    const {
      numero,
      descricao,
      dataInicio,
      dataFim,
      status,
      page = 1,
      limit = 10
    } = req.query;

    let query = `
      SELECT
        opt_id,
        opt_numero,
        opt_datainicio,
        opt_datafim,
        opt_descricao,
        opt_totalitens,
        opt_totalempresas,
        opt_status
      FROM tb_oportunidades
      WHERE 1=1
    `;

    const params = [];

    // Filtro por número da oportunidade
    if (numero) {
      query += ` AND opt_numero LIKE ?`;
      params.push(`%${numero}%`);
    }

    // Filtro por descrição
    if (descricao) {
      query += ` AND opt_descricao LIKE ?`;
      params.push(`%${descricao}%`);
    }

    // Filtro por data início
    if (dataInicio) {
      query += ` AND opt_datainicio >= ?`;
      params.push(dataInicio);
    }

    // Filtro por data fim
    if (dataFim) {
      query += ` AND opt_datafim <= ?`;
      params.push(dataFim);
    }

    // Filtro por status (0 = Baixando, 1 = Completa)
    if (status !== undefined && status !== '') {
      query += ` AND opt_status = ?`;
      params.push(parseInt(status));
    }

    // Ordenação
    query += ` ORDER BY opt_datainicio DESC, opt_id DESC`;

    // Paginação
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const [oportunidades] = await promisePool.query(query, params);

    // Contar total de registros para paginação
    let countQuery = `
      SELECT COUNT(*) as total
      FROM tb_oportunidades
      WHERE 1=1
    `;
    const countParams = [];

    if (numero) {
      countQuery += ` AND opt_numero LIKE ?`;
      countParams.push(`%${numero}%`);
    }
    if (descricao) {
      countQuery += ` AND opt_descricao LIKE ?`;
      countParams.push(`%${descricao}%`);
    }
    if (dataInicio) {
      countQuery += ` AND opt_datainicio >= ?`;
      countParams.push(dataInicio);
    }
    if (dataFim) {
      countQuery += ` AND opt_datafim <= ?`;
      countParams.push(dataFim);
    }
    if (status !== undefined && status !== '') {
      countQuery += ` AND opt_status = ?`;
      countParams.push(parseInt(status));
    }

    const [countResult] = await promisePool.query(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: oportunidades,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Erro ao listar oportunidades:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar oportunidades',
      error: error.message
    });
  }
};

// Buscar oportunidade por ID
exports.getOportunidadeById = async (req, res) => {
  try {
    const { id } = req.params;

    const [oportunidades] = await promisePool.query(`
      SELECT
        opt_id,
        opt_numero,
        opt_datainicio,
        opt_datafim,
        opt_descricao,
        opt_totalitens,
        opt_totalempresas,
        opt_status
      FROM tb_oportunidades
      WHERE opt_id = ?
    `, [id]);

    if (oportunidades.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Oportunidade não encontrada'
      });
    }

    res.json({
      success: true,
      data: oportunidades[0]
    });

  } catch (error) {
    console.error('Erro ao buscar oportunidade:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar oportunidade',
      error: error.message
    });
  }
};

// Buscar itens de uma oportunidade
exports.getOportunidadeItens = async (req, res) => {
  try {
    const { id } = req.params;

    const [itens] = await promisePool.query(`
      SELECT
        optitem_id,
        optitem_idop,
        optitem_item,
        optitem_descricao,
        optitem_quantidade,
        optitem_unidade,
        optitem_obs,
        optitem_dataresgate,
        optitem_robo,
        optitem_dataedicao,
        optitem_iduser
      FROM tb_oportunidades_itens
      WHERE optitem_idop = ?
      ORDER BY optitem_item ASC
    `, [id]);

    res.json({
      success: true,
      data: itens
    });

  } catch (error) {
    console.error('Erro ao buscar itens da oportunidade:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar itens da oportunidade',
      error: error.message
    });
  }
};

// Criar nova oportunidade
exports.createOportunidade = async (req, res) => {
  try {
    const { numero, datainicio, datafim, descricao, totalitens, totalempresas, status } = req.body;

    // Validações
    if (!numero) {
      return res.status(400).json({
        success: false,
        message: 'Número da oportunidade é obrigatório'
      });
    }

    const [result] = await promisePool.query(`
      INSERT INTO tb_oportunidades (opt_numero, opt_datainicio, opt_datafim, opt_descricao, opt_totalitens, opt_totalempresas, opt_status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [numero, datainicio || null, datafim || null, descricao || null, totalitens || null, totalempresas || null, status || 0]);

    res.status(201).json({
      success: true,
      message: 'Oportunidade criada com sucesso',
      data: {
        opt_id: result.insertId
      }
    });

  } catch (error) {
    console.error('Erro ao criar oportunidade:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar oportunidade',
      error: error.message
    });
  }
};

// Atualizar oportunidade
exports.updateOportunidade = async (req, res) => {
  try {
    const { id } = req.params;
    const { numero, datainicio, datafim, descricao, totalitens, totalempresas, status } = req.body;

    // Verificar se oportunidade existe
    const [existing] = await promisePool.query('SELECT opt_id FROM tb_oportunidades WHERE opt_id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Oportunidade não encontrada'
      });
    }

    const updateFields = [];
    const params = [];

    if (numero !== undefined) {
      updateFields.push('opt_numero = ?');
      params.push(numero);
    }
    if (datainicio !== undefined) {
      updateFields.push('opt_datainicio = ?');
      params.push(datainicio);
    }
    if (datafim !== undefined) {
      updateFields.push('opt_datafim = ?');
      params.push(datafim);
    }
    if (descricao !== undefined) {
      updateFields.push('opt_descricao = ?');
      params.push(descricao);
    }
    if (totalitens !== undefined) {
      updateFields.push('opt_totalitens = ?');
      params.push(totalitens);
    }
    if (totalempresas !== undefined) {
      updateFields.push('opt_totalempresas = ?');
      params.push(totalempresas);
    }
    if (status !== undefined) {
      updateFields.push('opt_status = ?');
      params.push(status);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum campo para atualizar'
      });
    }

    params.push(id);

    await promisePool.query(`
      UPDATE tb_oportunidades
      SET ${updateFields.join(', ')}
      WHERE opt_id = ?
    `, params);

    res.json({
      success: true,
      message: 'Oportunidade atualizada com sucesso'
    });

  } catch (error) {
    console.error('Erro ao atualizar oportunidade:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar oportunidade',
      error: error.message
    });
  }
};

// Atualizar item da oportunidade (comentário)
exports.updateOportunidadeItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { optitem_obs } = req.body;

    // Verificar se item existe
    const [existing] = await promisePool.query('SELECT optitem_id FROM tb_oportunidades_itens WHERE optitem_id = ?', [itemId]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Item não encontrado'
      });
    }

    await promisePool.query(`
      UPDATE tb_oportunidades_itens
      SET optitem_obs = ?, optitem_dataedicao = NOW()
      WHERE optitem_id = ?
    `, [optitem_obs || null, itemId]);

    res.json({
      success: true,
      message: 'Comentário atualizado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao atualizar item:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar item',
      error: error.message
    });
  }
};

// Deletar oportunidade
exports.deleteOportunidade = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se oportunidade existe
    const [existing] = await promisePool.query('SELECT opt_id FROM tb_oportunidades WHERE opt_id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Oportunidade não encontrada'
      });
    }

    // Os itens serão deletados automaticamente pelo ON DELETE CASCADE
    await promisePool.query('DELETE FROM tb_oportunidades WHERE opt_id = ?', [id]);

    res.json({
      success: true,
      message: 'Oportunidade deletada com sucesso'
    });

  } catch (error) {
    console.error('Erro ao deletar oportunidade:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar oportunidade',
      error: error.message
    });
  }
};

// Sincronizar oportunidade (chamado pelo bot-runner)
exports.syncOportunidade = async (req, res) => {
  try {
    const {
      numero,
      descricao,
      datainicio,
      datafim,
      totalitens,
      bottag
    } = req.body;

    if (!numero) {
      return res.status(400).json({
        success: false,
        message: 'Número da oportunidade é obrigatório'
      });
    }

    // Converter datas do formato DD.MM.YYYY para YYYY-MM-DD
    const parseDate = (dateStr) => {
      if (!dateStr) return null;
      const parts = dateStr.split('.');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return dateStr;
    };

    const dataInicioFormatada = parseDate(datainicio);
    const dataFimFormatada = parseDate(datafim);

    // Verificar se a oportunidade já existe
    const [existing] = await promisePool.query(
      'SELECT opt_id FROM tb_oportunidades WHERE opt_numero = ?',
      [numero]
    );

    let optId;

    if (existing.length > 0) {
      // Atualizar oportunidade existente
      optId = existing[0].opt_id;
      await promisePool.query(`
        UPDATE tb_oportunidades
        SET opt_descricao = ?, opt_datainicio = ?, opt_datafim = ?, opt_totalitens = ?, opt_status = 0
        WHERE opt_id = ?
      `, [descricao, dataInicioFormatada, dataFimFormatada, totalitens || 0, optId]);

      console.log(`[SyncOP] Oportunidade ${numero} atualizada (ID: ${optId})`);
    } else {
      // Criar nova oportunidade
      const [result] = await promisePool.query(`
        INSERT INTO tb_oportunidades (opt_numero, opt_descricao, opt_datainicio, opt_datafim, opt_totalitens, opt_status)
        VALUES (?, ?, ?, ?, ?, 0)
      `, [numero, descricao, dataInicioFormatada, dataFimFormatada, totalitens || 0]);

      optId = result.insertId;
      console.log(`[SyncOP] Oportunidade ${numero} criada (ID: ${optId})`);
    }

    res.json({
      success: true,
      message: `Oportunidade ${numero} sincronizada`,
      data: {
        opt_id: optId,
        opt_numero: numero
      }
    });

  } catch (error) {
    console.error('Erro ao sincronizar oportunidade:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao sincronizar oportunidade',
      error: error.message
    });
  }
};

// Sincronizar item da oportunidade (chamado pelo bot-runner)
exports.syncItem = async (req, res) => {
  try {
    const {
      opNumero,
      itemNumero,
      descricao,
      quantidade,
      unidade,
      bottag
    } = req.body;

    if (!opNumero || !itemNumero) {
      return res.status(400).json({
        success: false,
        message: 'Número da OP e do item são obrigatórios'
      });
    }

    // Buscar ID da oportunidade
    const [op] = await promisePool.query(
      'SELECT opt_id FROM tb_oportunidades WHERE opt_numero = ?',
      [opNumero]
    );

    if (op.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Oportunidade ${opNumero} não encontrada`
      });
    }

    const optId = op[0].opt_id;

    // Verificar se o item já existe
    const [existingItem] = await promisePool.query(
      'SELECT optitem_id FROM tb_oportunidades_itens WHERE optitem_idop = ? AND optitem_item = ?',
      [optId, itemNumero]
    );

    let itemId;

    if (existingItem.length > 0) {
      // Atualizar item existente
      itemId = existingItem[0].optitem_id;
      await promisePool.query(`
        UPDATE tb_oportunidades_itens
        SET optitem_descricao = ?, optitem_quantidade = ?, optitem_unidade = ?,
            optitem_dataresgate = NOW(), optitem_robo = ?
        WHERE optitem_id = ?
      `, [descricao, quantidade, unidade, bottag, itemId]);
    } else {
      // Criar novo item
      const [result] = await promisePool.query(`
        INSERT INTO tb_oportunidades_itens
        (optitem_idop, optitem_item, optitem_descricao, optitem_quantidade, optitem_unidade, optitem_dataresgate, optitem_robo)
        VALUES (?, ?, ?, ?, ?, NOW(), ?)
      `, [optId, itemNumero, descricao, quantidade, unidade, bottag]);
      itemId = result.insertId;
    }

    res.json({
      success: true,
      message: `Item ${itemNumero} sincronizado`,
      data: { optitem_id: itemId }
    });

  } catch (error) {
    console.error('Erro ao sincronizar item:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao sincronizar item',
      error: error.message
    });
  }
};

// Finalizar oportunidade (marcar como completa)
exports.finishOportunidade = async (req, res) => {
  try {
    const { numero } = req.body;

    if (!numero) {
      return res.status(400).json({
        success: false,
        message: 'Número da oportunidade é obrigatório'
      });
    }

    const [result] = await promisePool.query(`
      UPDATE tb_oportunidades SET opt_status = 1 WHERE opt_numero = ?
    `, [numero]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Oportunidade não encontrada'
      });
    }

    console.log(`[SyncOP] Oportunidade ${numero} finalizada`);

    res.json({
      success: true,
      message: `Oportunidade ${numero} finalizada`
    });

  } catch (error) {
    console.error('Erro ao finalizar oportunidade:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao finalizar oportunidade',
      error: error.message
    });
  }
};
