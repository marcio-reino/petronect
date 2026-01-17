const { promisePool } = require('../config/database');
const botManager = require('../services/botManager');
const fs = require('fs');
const path = require('path');

// Armazena códigos de verificação pendentes por robo_id
const pendingVerificationCodes = new Map();

// Armazena clientes SSE conectados para notificações em tempo real
// Map: roboId -> Set de objetos response
const sseClients = new Map();

// Listar todos os robôs com filtros
exports.getAllRobos = async (req, res) => {
  try {
    const {
      nome,
      tipo,
      status,
      page = 1,
      limit = 10
    } = req.query;

    let query = `
      SELECT
        robo_id,
        robo_datacriacao,
        robo_nome,
        robo_dec,
        robo_tipo,
        robo_data,
        robo_user,
        robo_senha,
        robo_tempo,
        robo_ultimaatividade,
        robo_velocidade,
        robo_opresgate,
        robo_datahoraatv,
        robo_datainiciofim,
        robo_ordemop,
        robo_status
      FROM tb_robo
      WHERE 1=1
    `;

    const params = [];

    // Filtro por nome
    if (nome) {
      query += ` AND (robo_nome LIKE ? OR robo_dec LIKE ?)`;
      params.push(`%${nome}%`, `%${nome}%`);
    }

    // Filtro por tipo (0 = OP, 1 = RT)
    if (tipo !== undefined && tipo !== '') {
      query += ` AND robo_tipo = ?`;
      params.push(parseInt(tipo));
    }

    // Filtro por status (0 = Inativo, 1 = Ativo)
    if (status !== undefined && status !== '') {
      query += ` AND robo_status = ?`;
      params.push(parseInt(status));
    }

    // Ordenação
    query += ` ORDER BY robo_nome ASC`;

    // Paginação
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const [robos] = await promisePool.query(query, params);

    // Contar total de registros para paginação
    let countQuery = `
      SELECT COUNT(*) as total
      FROM tb_robo
      WHERE 1=1
    `;
    const countParams = [];

    if (nome) {
      countQuery += ` AND (robo_nome LIKE ? OR robo_dec LIKE ?)`;
      countParams.push(`%${nome}%`, `%${nome}%`);
    }
    if (tipo !== undefined && tipo !== '') {
      countQuery += ` AND robo_tipo = ?`;
      countParams.push(parseInt(tipo));
    }
    if (status !== undefined && status !== '') {
      countQuery += ` AND robo_status = ?`;
      countParams.push(parseInt(status));
    }

    const [countResult] = await promisePool.query(countQuery, countParams);
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: robos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages
      }
    });
  } catch (error) {
    console.error('Erro ao buscar robôs:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao buscar robôs'
    });
  }
};

// Buscar robô por ID
exports.getRoboById = async (req, res) => {
  try {
    const { id } = req.params;

    const [robos] = await promisePool.query(
      `SELECT * FROM tb_robo WHERE robo_id = ?`,
      [id]
    );

    if (robos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Robô não encontrado'
      });
    }

    res.json({
      success: true,
      data: robos[0]
    });
  } catch (error) {
    console.error('Erro ao buscar robô:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao buscar robô'
    });
  }
};

// Atualizar robô
exports.updateRobo = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nome,
      descricao,
      tipo,
      data,
      user,
      senha,
      tempo,
      velocidade,
      opresgate,
      datainiciofim,
      ordemop,
      status
    } = req.body;

    // Verificar se o robô existe
    const [existing] = await promisePool.query(
      'SELECT robo_id FROM tb_robo WHERE robo_id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Robô não encontrado'
      });
    }

    // Verificar se o nome já existe em outro robô
    if (nome !== undefined) {
      const [duplicateName] = await promisePool.query(
        'SELECT robo_id FROM tb_robo WHERE robo_nome = ? AND robo_id != ?',
        [nome, id]
      );

      if (duplicateName.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Já existe um agente com este nome'
        });
      }
    }

    // Construir query de atualização
    let updateFields = [];
    let updateValues = [];

    if (nome !== undefined) {
      updateFields.push('robo_nome = ?');
      updateValues.push(nome);
    }
    if (descricao !== undefined) {
      updateFields.push('robo_dec = ?');
      updateValues.push(descricao);
    }
    if (tipo !== undefined) {
      updateFields.push('robo_tipo = ?');
      updateValues.push(tipo);
    }
    if (data !== undefined) {
      updateFields.push('robo_data = ?');
      updateValues.push(data);
    }
    if (user !== undefined) {
      updateFields.push('robo_user = ?');
      updateValues.push(user);
    }
    if (senha !== undefined) {
      updateFields.push('robo_senha = ?');
      updateValues.push(senha);
    }
    if (tempo !== undefined) {
      updateFields.push('robo_tempo = ?');
      updateValues.push(tempo);
    }
    if (velocidade !== undefined) {
      updateFields.push('robo_velocidade = ?');
      updateValues.push(velocidade);
    }
    if (opresgate !== undefined) {
      updateFields.push('robo_opresgate = ?');
      updateValues.push(opresgate);
    }
    if (datainiciofim !== undefined) {
      updateFields.push('robo_datainiciofim = ?');
      updateValues.push(datainiciofim);
    }
    if (ordemop !== undefined) {
      updateFields.push('robo_ordemop = ?');
      updateValues.push(ordemop);
    }
    if (status !== undefined) {
      updateFields.push('robo_status = ?');
      updateValues.push(status);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum campo para atualizar'
      });
    }

    updateValues.push(id);

    await promisePool.query(
      `UPDATE tb_robo SET ${updateFields.join(', ')} WHERE robo_id = ?`,
      updateValues
    );

    res.json({
      success: true,
      message: 'Robô atualizado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao atualizar robô:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao atualizar robô'
    });
  }
};

// Criar novo robô
exports.createRobo = async (req, res) => {
  try {
    const {
      nome,
      descricao,
      tipo = 0,
      data = 1,
      user,
      senha,
      tempo = 10,
      velocidade = 0,
      opresgate,
      datainiciofim = 0,
      ordemop = 0,
      status = 0
    } = req.body;

    if (!nome) {
      return res.status(400).json({
        success: false,
        message: 'Nome do agente é obrigatório'
      });
    }

    // Verificar limite de agentes
    const maxAgents = parseInt(process.env.MAX_AGENTS) || 5;
    const [countResult] = await promisePool.query('SELECT COUNT(*) as total FROM tb_robo');
    const totalAgents = countResult[0].total;

    if (totalAgents >= maxAgents) {
      return res.status(403).json({
        success: false,
        message: `Limite de ${maxAgents} agente(s) atingido. Entre em contato com o suporte para aumentar o limite.`
      });
    }

    // Verificar se o nome já existe
    const [duplicateName] = await promisePool.query(
      'SELECT robo_id FROM tb_robo WHERE robo_nome = ?',
      [nome]
    );

    if (duplicateName.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Já existe um agente com este nome'
      });
    }

    const [result] = await promisePool.query(
      `INSERT INTO tb_robo (
        robo_datacriacao,
        robo_nome,
        robo_dec,
        robo_tipo,
        robo_data,
        robo_user,
        robo_senha,
        robo_tempo,
        robo_velocidade,
        robo_opresgate,
        robo_datainiciofim,
        robo_ordemop,
        robo_status
      ) VALUES (NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nome, descricao, tipo, data, user, senha, tempo, velocidade, opresgate, datainiciofim, ordemop, status]
    );

    res.status(201).json({
      success: true,
      message: 'Robô criado com sucesso',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Erro ao criar robô:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao criar robô'
    });
  }
};

// Deletar robô
exports.deleteRobo = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se o robô existe
    const [existing] = await promisePool.query(
      'SELECT robo_id FROM tb_robo WHERE robo_id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Robô não encontrado'
      });
    }

    await promisePool.query('DELETE FROM tb_robo WHERE robo_id = ?', [id]);

    res.json({
      success: true,
      message: 'Robô excluído com sucesso'
    });
  } catch (error) {
    console.error('Erro ao excluir robô:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao excluir robô'
    });
  }
};

// =============================================
// OPORTUNIDADES ESPECÍFICAS
// =============================================

// Listar oportunidades específicas de um robô
exports.getOportunidadesEspecificas = async (req, res) => {
  try {
    const { roboId } = req.params;

    const [oportunidades] = await promisePool.query(`
      SELECT
        opesp_id,
        opesp_numero,
        opesp_robo_id,
        opesp_ordem,
        opesp_datacadastro
      FROM tb_oportunidades_especificas
      WHERE opesp_robo_id = ?
      ORDER BY opesp_ordem ASC
    `, [roboId]);

    res.json({
      success: true,
      data: oportunidades
    });
  } catch (error) {
    console.error('Erro ao buscar oportunidades específicas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao buscar oportunidades específicas'
    });
  }
};

// Adicionar oportunidade específica
exports.addOportunidadeEspecifica = async (req, res) => {
  try {
    const { roboId } = req.params;
    const { numero, forceAdd } = req.body;

    if (!numero) {
      return res.status(400).json({
        success: false,
        message: 'Número da oportunidade é obrigatório'
      });
    }

    // Verificar se o robô existe
    const [robo] = await promisePool.query(
      'SELECT robo_id FROM tb_robo WHERE robo_id = ?',
      [roboId]
    );

    if (robo.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Robô não encontrado'
      });
    }

    // Verificar se a oportunidade já existe para este robô
    const [existing] = await promisePool.query(
      'SELECT opesp_id FROM tb_oportunidades_especificas WHERE opesp_numero = ? AND opesp_robo_id = ?',
      [numero, roboId]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Esta oportunidade já está na lista'
      });
    }

    // Verificar se a oportunidade já está cadastrada em outro robô (apenas se não for forceAdd)
    if (!forceAdd) {
      const [existingInOther] = await promisePool.query(`
        SELECT oe.opesp_id, r.robo_nome
        FROM tb_oportunidades_especificas oe
        INNER JOIN tb_robo r ON r.robo_id = oe.opesp_robo_id
        WHERE oe.opesp_numero = ? AND oe.opesp_robo_id != ?
      `, [numero, roboId]);

      if (existingInOther.length > 0) {
        const roboNome = existingInOther[0].robo_nome;
        return res.status(409).json({
          success: false,
          warning: true,
          message: `Esta oportunidade já está cadastrada no agente "${roboNome}"`,
          existingRobo: roboNome
        });
      }
    }

    // Buscar a maior ordem atual
    const [maxOrdem] = await promisePool.query(
      'SELECT MAX(opesp_ordem) as max_ordem FROM tb_oportunidades_especificas WHERE opesp_robo_id = ?',
      [roboId]
    );
    const novaOrdem = (maxOrdem[0].max_ordem || 0) + 1;

    const [result] = await promisePool.query(`
      INSERT INTO tb_oportunidades_especificas (opesp_numero, opesp_robo_id, opesp_ordem)
      VALUES (?, ?, ?)
    `, [numero, roboId, novaOrdem]);

    res.status(201).json({
      success: true,
      message: 'Oportunidade adicionada com sucesso',
      data: {
        opesp_id: result.insertId,
        opesp_numero: numero,
        opesp_robo_id: parseInt(roboId),
        opesp_ordem: novaOrdem
      }
    });
  } catch (error) {
    console.error('Erro ao adicionar oportunidade específica:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao adicionar oportunidade específica'
    });
  }
};

// Adicionar múltiplas oportunidades específicas em lote
exports.addOportunidadesLote = async (req, res) => {
  try {
    const { roboId } = req.params;
    const { numeros } = req.body;

    if (!numeros || !Array.isArray(numeros) || numeros.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Lista de números de oportunidades é obrigatória'
      });
    }

    // Verificar se o robô existe
    const [robo] = await promisePool.query(
      'SELECT robo_id FROM tb_robo WHERE robo_id = ?',
      [roboId]
    );

    if (robo.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Robô não encontrado'
      });
    }

    const cadastradas = [];
    const naoPermitidas = [];

    // Buscar a maior ordem atual
    const [maxOrdemResult] = await promisePool.query(
      'SELECT MAX(opesp_ordem) as max_ordem FROM tb_oportunidades_especificas WHERE opesp_robo_id = ?',
      [roboId]
    );
    let ordemAtual = (maxOrdemResult[0].max_ordem || 0);

    for (const numero of numeros) {
      const numeroTrimmed = numero.trim();
      if (!numeroTrimmed) continue;

      // Verificar se já existe neste robô
      const [existingInThis] = await promisePool.query(
        'SELECT opesp_id FROM tb_oportunidades_especificas WHERE opesp_numero = ? AND opesp_robo_id = ?',
        [numeroTrimmed, roboId]
      );

      if (existingInThis.length > 0) {
        naoPermitidas.push({
          numero: numeroTrimmed,
          motivo: 'Já está cadastrada neste agente'
        });
        continue;
      }

      // Verificar se já existe em outro robô
      const [existingInOther] = await promisePool.query(`
        SELECT oe.opesp_id, r.robo_nome
        FROM tb_oportunidades_especificas oe
        INNER JOIN tb_robo r ON r.robo_id = oe.opesp_robo_id
        WHERE oe.opesp_numero = ? AND oe.opesp_robo_id != ?
      `, [numeroTrimmed, roboId]);

      if (existingInOther.length > 0) {
        naoPermitidas.push({
          numero: numeroTrimmed,
          motivo: `Já cadastrada no agente "${existingInOther[0].robo_nome}"`
        });
        continue;
      }

      // Cadastrar a oportunidade
      ordemAtual++;
      const [result] = await promisePool.query(`
        INSERT INTO tb_oportunidades_especificas (opesp_numero, opesp_robo_id, opesp_ordem)
        VALUES (?, ?, ?)
      `, [numeroTrimmed, roboId, ordemAtual]);

      cadastradas.push({
        opesp_id: result.insertId,
        opesp_numero: numeroTrimmed,
        opesp_robo_id: parseInt(roboId),
        opesp_ordem: ordemAtual
      });
    }

    res.status(201).json({
      success: true,
      message: `${cadastradas.length} oportunidade(s) cadastrada(s)`,
      data: {
        cadastradas,
        naoPermitidas
      }
    });
  } catch (error) {
    console.error('Erro ao adicionar oportunidades em lote:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao adicionar oportunidades'
    });
  }
};

// Remover oportunidade específica
exports.removeOportunidadeEspecifica = async (req, res) => {
  try {
    const { roboId, opespId } = req.params;

    const [existing] = await promisePool.query(
      'SELECT opesp_id FROM tb_oportunidades_especificas WHERE opesp_id = ? AND opesp_robo_id = ?',
      [opespId, roboId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Oportunidade não encontrada'
      });
    }

    await promisePool.query(
      'DELETE FROM tb_oportunidades_especificas WHERE opesp_id = ?',
      [opespId]
    );

    res.json({
      success: true,
      message: 'Oportunidade removida com sucesso'
    });
  } catch (error) {
    console.error('Erro ao remover oportunidade específica:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao remover oportunidade específica'
    });
  }
};

// Reordenar oportunidades específicas
exports.reorderOportunidadesEspecificas = async (req, res) => {
  try {
    const { roboId } = req.params;
    const { items } = req.body; // Array de { opesp_id, opesp_ordem }

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: 'Lista de itens é obrigatória'
      });
    }

    // Atualizar ordem de cada item
    for (const item of items) {
      await promisePool.query(
        'UPDATE tb_oportunidades_especificas SET opesp_ordem = ? WHERE opesp_id = ? AND opesp_robo_id = ?',
        [item.opesp_ordem, item.opesp_id, roboId]
      );
    }

    res.json({
      success: true,
      message: 'Ordem atualizada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao reordenar oportunidades:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao reordenar oportunidades'
    });
  }
};

// =============================================
// CONTROLE DO BOT (MONITOR)
// =============================================

// URL base do Playwright Service
const PLAYWRIGHT_BASE = process.env.PLAYWRIGHT_BASE || 'http://localhost:3003';

// Retorna screenshot do bot (busca do Playwright Service via HTTP)
exports.getScreenshot = async (req, res) => {
  try {
    const { id } = req.params;

    // Buscar nome do robô
    const [robos] = await promisePool.query(
      'SELECT robo_nome FROM tb_robo WHERE robo_id = ?',
      [id]
    );

    if (robos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Robô não encontrado'
      });
    }

    const bottag = robos[0].robo_nome.replace(/ /g, '_');

    // Buscar screenshot do Playwright Service
    const screenshotUrl = `${PLAYWRIGHT_BASE}/screenshots/${bottag}`;

    const response = await fetch(screenshotUrl);

    if (!response.ok) {
      return res.status(404).json({
        success: false,
        message: 'Screenshot não disponível'
      });
    }

    // Fazer proxy da imagem
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');

    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Erro ao buscar screenshot:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao buscar screenshot'
    });
  }
};

// Retorna histórico de logs do bot
exports.getHistorico = async (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const [historico] = await promisePool.query(`
      SELECT hist_id, hist_mensagem, hist_datacriacao
      FROM tb_robo_historico
      WHERE hist_robo_id = ?
      ORDER BY hist_datacriacao DESC
      LIMIT ?
    `, [id, limit]);

    res.json({
      success: true,
      data: historico
    });
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao buscar histórico'
    });
  }
};

// Retorna status do processo atual
exports.getProcesso = async (req, res) => {
  try {
    const { id } = req.params;

    const [processo] = await promisePool.query(`
      SELECT proc_id, proc_op_numero, proc_item_atual, proc_total_itens, proc_status, proc_ultima_atualizacao
      FROM tb_robo_processo
      WHERE proc_robo_id = ?
    `, [id]);

    res.json({
      success: true,
      data: processo.length > 0 ? processo[0] : null
    });
  } catch (error) {
    console.error('Erro ao buscar processo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao buscar processo'
    });
  }
};

// Retorna dados dos agentes para o dashboard
exports.getDashboardStats = async (req, res) => {
  try {
    // Buscar todos os robôs com seus processos atuais e última atividade do histórico
    const [agentes] = await promisePool.query(`
      SELECT
        r.robo_id,
        r.robo_nome,
        r.robo_tipo,
        r.robo_status,
        r.robo_ultimaatividade,
        r.robo_opresgate,
        p.proc_op_numero,
        p.proc_item_atual,
        p.proc_total_itens,
        p.proc_status,
        p.proc_ultima_atualizacao,
        (SELECT hist_mensagem FROM tb_robo_historico WHERE hist_robo_id = r.robo_id ORDER BY hist_datacriacao DESC LIMIT 1) as ultima_mensagem
      FROM tb_robo r
      LEFT JOIN tb_robo_processo p ON r.robo_id = p.proc_robo_id
      ORDER BY r.robo_nome ASC
    `);

    // Formatar dados para o frontend
    const agentesFormatados = agentes.map(agente => ({
      id: agente.robo_id,
      nome: agente.robo_nome,
      tipo: agente.robo_tipo === 0 ? 'OP' : 'RT',
      status: agente.proc_status === 'running' ? 'working' : 'idle',
      opAtual: agente.proc_op_numero || agente.robo_opresgate || null,
      itemAtual: agente.proc_item_atual || 0,
      totalItens: agente.proc_total_itens || 0,
      ultimaAcao: agente.ultima_mensagem || agente.robo_ultimaatividade || 'Aguardando',
      ultimaAtualizacao: agente.proc_ultima_atualizacao
    }));

    // Contar agentes ativos (em trabalho)
    const agentesAtivos = agentesFormatados.filter(a => a.status === 'working');

    res.json({
      success: true,
      data: {
        total: agentesFormatados.length,
        ativos: agentesAtivos.length,
        agentes: agentesFormatados
      }
    });
  } catch (error) {
    console.error('Erro ao buscar dados do dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao buscar dados do dashboard'
    });
  }
};

// Busca próxima OP da fila e seta em robo_opresgate
async function fetchNextOpFromQueue(roboId) {
  // 1. Buscar primeira OP da fila
  const [ops] = await promisePool.query(`
    SELECT opesp_id, opesp_numero
    FROM tb_oportunidades_especificas
    WHERE opesp_robo_id = ?
    ORDER BY opesp_ordem ASC LIMIT 1
  `, [roboId]);

  if (ops.length > 0) {
    // 2. Atualizar robo_opresgate com o número da OP
    await promisePool.query(`
      UPDATE tb_robo SET robo_opresgate = ? WHERE robo_id = ?
    `, [ops[0].opesp_numero, roboId]);
    return ops[0].opesp_numero;
  } else {
    // 3. Se não tem OP na fila, limpar robo_opresgate
    await promisePool.query(`
      UPDATE tb_robo SET robo_opresgate = NULL WHERE robo_id = ?
    `, [roboId]);
    return null;
  }
}

// Inicia o bot
exports.startBot = async (req, res) => {
  try {
    const { id } = req.params;

    // Buscar dados do robô
    const [robos] = await promisePool.query(
      'SELECT * FROM tb_robo WHERE robo_id = ?',
      [id]
    );

    if (robos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Robô não encontrado'
      });
    }

    const robo = robos[0];

    // Verificar se já está rodando
    if (botManager.isBotRunning(id)) {
      return res.status(400).json({
        success: false,
        message: 'Bot já está em execução'
      });
    }

    // Buscar próxima OP da fila (se houver)
    const opResgate = await fetchNextOpFromQueue(id);

    // Atualizar objeto robo com a OP
    robo.robo_opresgate = opResgate;

    // Iniciar o bot
    const result = botManager.startBot(robo);

    if (result.success) {
      // Atualizar status do robô no banco
      await promisePool.query(
        'UPDATE tb_robo SET robo_status = 1 WHERE robo_id = ?',
        [id]
      );

      // Criar/atualizar registro de processo
      await promisePool.query(`
        INSERT INTO tb_robo_processo (proc_robo_id, proc_status, proc_op_numero)
        VALUES (?, 'running', ?)
        ON DUPLICATE KEY UPDATE proc_status = 'running', proc_op_numero = ?, proc_item_atual = 0, proc_total_itens = 0
      `, [id, opResgate, opResgate]);

      // Adicionar log
      await promisePool.query(
        'INSERT INTO tb_robo_historico (hist_robo_id, hist_mensagem) VALUES (?, ?)',
        [id, `Agente iniciado${opResgate ? ` - Resgatando OP ${opResgate}` : ' - Modo por data'}`]
      );
    }

    res.json(result);
  } catch (error) {
    console.error('Erro ao iniciar bot:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao iniciar bot'
    });
  }
};

// Para o bot
exports.stopBot = async (req, res) => {
  try {
    const { id } = req.params;

    // Buscar nome do robô para excluir screenshot
    const [robos] = await promisePool.query(
      'SELECT robo_nome FROM tb_robo WHERE robo_id = ?',
      [id]
    );

    // Tentar parar o processo se estiver rodando
    const result = botManager.stopBot(parseInt(id));

    // Sempre atualizar o banco, mesmo que o processo não esteja na memória
    // (pode ter sido iniciado antes de reiniciar o servidor)
    await promisePool.query(
      'UPDATE tb_robo SET robo_status = 0 WHERE robo_id = ?',
      [id]
    );

    // Atualizar processo
    await promisePool.query(`
      UPDATE tb_robo_processo SET proc_status = 'idle' WHERE proc_robo_id = ?
    `, [id]);

    // Adicionar log
    await promisePool.query(
      'INSERT INTO tb_robo_historico (hist_robo_id, hist_mensagem) VALUES (?, ?)',
      [id, 'Agente parado pelo usuário']
    );

    // Excluir arquivo de screenshot do agente
    if (robos.length > 0) {
      const bottag = robos[0].robo_nome.replace(/ /g, '_');
      const screenshotDir = process.env.SCREENSHOTS_DIR || path.join(__dirname, '../../playwright/screenshots');
      const screenshotPath = path.join(screenshotDir, `${bottag}.png`);

      try {
        if (fs.existsSync(screenshotPath)) {
          fs.unlinkSync(screenshotPath);
          console.log(`[StopBot] Screenshot excluído: ${screenshotPath}`);
        }
      } catch (err) {
        console.error(`[StopBot] Erro ao excluir screenshot:`, err.message);
      }
    }

    // Se o processo estava rodando, retorna sucesso do botManager
    // Caso contrário, retorna sucesso indicando que o status foi atualizado
    if (result.success) {
      res.json(result);
    } else {
      res.json({
        success: true,
        message: 'Status do bot atualizado para desligado'
      });
    }
  } catch (error) {
    console.error('Erro ao parar bot:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao parar bot'
    });
  }
};

// Adiciona log do bot (chamado pelo bot-runner)
exports.addLog = async (req, res) => {
  try {
    const { id } = req.params;
    const { mensagem } = req.body;

    if (!mensagem) {
      return res.status(400).json({
        success: false,
        message: 'Mensagem é obrigatória'
      });
    }

    await promisePool.query(
      'INSERT INTO tb_robo_historico (hist_robo_id, hist_mensagem) VALUES (?, ?)',
      [id, mensagem]
    );

    // Limpar logs antigos (manter apenas últimos 200)
    await promisePool.query(`
      DELETE FROM tb_robo_historico
      WHERE hist_robo_id = ? AND hist_id NOT IN (
        SELECT hist_id FROM (
          SELECT hist_id FROM tb_robo_historico
          WHERE hist_robo_id = ?
          ORDER BY hist_datacriacao DESC
          LIMIT 200
        ) AS t
      )
    `, [id, id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao adicionar log:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao adicionar log'
    });
  }
};

// Atualiza progresso do processo (chamado pelo bot-runner)
exports.updateProcesso = async (req, res) => {
  try {
    const { id } = req.params;
    const { opNumero, itemAtual, totalItens, status, stopRobo } = req.body;

    await promisePool.query(`
      INSERT INTO tb_robo_processo (proc_robo_id, proc_op_numero, proc_item_atual, proc_total_itens, proc_status)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        proc_op_numero = COALESCE(?, proc_op_numero),
        proc_item_atual = COALESCE(?, proc_item_atual),
        proc_total_itens = COALESCE(?, proc_total_itens),
        proc_status = COALESCE(?, proc_status)
    `, [id, opNumero, itemAtual || 0, totalItens || 0, status || 'running', opNumero, itemAtual, totalItens, status]);

    // Se stopRobo for true, também atualiza o status do robô para 0 (parado)
    if (stopRobo) {
      await promisePool.query(
        'UPDATE tb_robo SET robo_status = 0 WHERE robo_id = ?',
        [id]
      );
      console.log(`[updateProcesso] Robô ${id} parado via stopRobo flag`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao atualizar processo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao atualizar processo'
    });
  }
};

// Callback quando OP é finalizada (chamado pelo bot-runner)
exports.completeOp = async (req, res) => {
  try {
    const { roboId, opNumero } = req.body;

    if (!roboId || !opNumero) {
      return res.status(400).json({
        success: false,
        message: 'roboId e opNumero são obrigatórios'
      });
    }

    // Remover OP da fila
    await promisePool.query(`
      DELETE FROM tb_oportunidades_especificas
      WHERE opesp_robo_id = ? AND opesp_numero = ?
    `, [roboId, opNumero]);

    // Limpar robo_opresgate
    await promisePool.query(`
      UPDATE tb_robo SET robo_opresgate = NULL WHERE robo_id = ?
    `, [roboId]);

    // Adicionar log
    await promisePool.query(
      'INSERT INTO tb_robo_historico (hist_robo_id, hist_mensagem) VALUES (?, ?)',
      [roboId, `OP ${opNumero} finalizada e removida da fila`]
    );

    // Buscar próxima OP da fila
    const nextOp = await fetchNextOpFromQueue(roboId);

    // Atualizar processo com próxima OP (ou NULL se não houver)
    await promisePool.query(`
      UPDATE tb_robo_processo
      SET proc_op_numero = ?, proc_item_atual = 0, proc_total_itens = 0, proc_status = 'running'
      WHERE proc_robo_id = ?
    `, [nextOp, roboId]);

    res.json({
      success: true,
      nextOp: nextOp,
      message: nextOp ? `Próxima OP: ${nextOp}` : 'Fila vazia, operando por data'
    });
  } catch (error) {
    console.error('Erro ao completar OP:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao completar OP'
    });
  }
};

// =============================================
// VERIFICAR FILA DE OPS
// =============================================

// Bot verifica se há OPs na fila para processar
exports.checkQueue = async (req, res) => {
  try {
    const { id } = req.params;
    const roboId = parseInt(id);

    // Validar ID
    if (isNaN(roboId)) {
      return res.status(400).json({
        success: false,
        message: 'ID do robô inválido'
      });
    }

    // Buscar próxima OP da fila (sem remover)
    const [ops] = await promisePool.query(`
      SELECT opesp_id, opesp_numero
      FROM tb_oportunidades_especificas
      WHERE opesp_robo_id = ?
      ORDER BY opesp_ordem ASC LIMIT 1
    `, [roboId]);

    if (ops.length > 0) {
      // Atualizar robo_opresgate com o número da OP
      await promisePool.query(`
        UPDATE tb_robo SET robo_opresgate = ? WHERE robo_id = ?
      `, [ops[0].opesp_numero, roboId]);

      console.log(`[CheckQueue] Robô ${roboId}: OP na fila: ${ops[0].opesp_numero}`);

      res.json({
        success: true,
        hasQueue: true,
        nextOp: ops[0].opesp_numero,
        message: `Próxima OP da fila: ${ops[0].opesp_numero}`
      });
    } else {
      // Limpar robo_opresgate se não há fila
      await promisePool.query(`
        UPDATE tb_robo SET robo_opresgate = NULL WHERE robo_id = ?
      `, [roboId]);

      console.log(`[CheckQueue] Robô ${roboId}: Fila vazia`);

      res.json({
        success: true,
        hasQueue: false,
        nextOp: null,
        message: 'Fila vazia, continuar por data'
      });
    }
  } catch (error) {
    console.error('Erro ao verificar fila:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao verificar fila'
    });
  }
};

// =============================================
// VERIFICAÇÃO DE CÓDIGO (2FA)
// =============================================

// Bot solicita código de verificação (aguarda usuário inserir)
exports.requestVerificationCode = async (req, res) => {
  try {
    const { id } = req.params;
    const roboId = parseInt(id);

    // Validar ID
    if (isNaN(roboId)) {
      return res.status(400).json({
        success: false,
        message: 'ID do robô inválido'
      });
    }

    console.log(`[Verification] Bot ${roboId} solicitou código de verificação`);

    // Criar entrada pendente para este robô
    pendingVerificationCodes.set(roboId, {
      status: 'waiting',
      code: null,
      requestedAt: new Date()
    });

    // Notificar clientes SSE conectados IMEDIATAMENTE
    notifySSEClients(roboId, 'verification-needed', {
      roboId,
      requestedAt: new Date()
    });

    // Adicionar log
    await promisePool.query(
      'INSERT INTO tb_robo_historico (hist_robo_id, hist_mensagem) VALUES (?, ?)',
      [roboId, 'Aguardando código de verificação do usuário...']
    );

    res.json({
      success: true,
      message: 'Aguardando código de verificação'
    });
  } catch (error) {
    console.error('Erro ao solicitar código:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao solicitar código'
    });
  }
};

// Bot verifica se código foi inserido pelo usuário
exports.checkVerificationCode = async (req, res) => {
  try {
    const { id } = req.params;
    const roboId = parseInt(id);

    const pending = pendingVerificationCodes.get(roboId);

    if (!pending) {
      return res.json({
        success: false,
        status: 'not_requested',
        message: 'Nenhuma solicitação de código pendente'
      });
    }

    if (pending.status === 'waiting') {
      return res.json({
        success: true,
        status: 'waiting',
        code: null,
        message: 'Aguardando usuário inserir código'
      });
    }

    if (pending.status === 'submitted') {
      // Código foi inserido, retornar e limpar
      const code = pending.code;
      pendingVerificationCodes.delete(roboId);

      return res.json({
        success: true,
        status: 'submitted',
        code: code,
        message: 'Código recebido'
      });
    }

    res.json({
      success: false,
      status: 'unknown',
      message: 'Status desconhecido'
    });
  } catch (error) {
    console.error('Erro ao verificar código:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao verificar código'
    });
  }
};

// Usuário envia código de verificação via frontend
exports.submitVerificationCode = async (req, res) => {
  try {
    const { id } = req.params;
    const { code } = req.body;
    const roboId = parseInt(id);

    if (!code || code.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Código não informado'
      });
    }

    const pending = pendingVerificationCodes.get(roboId);

    if (!pending || pending.status !== 'waiting') {
      return res.status(400).json({
        success: false,
        message: 'Nenhuma solicitação de código pendente para este agente'
      });
    }

    // Atualizar com o código inserido
    pendingVerificationCodes.set(roboId, {
      status: 'submitted',
      code: code.trim(),
      submittedAt: new Date()
    });

    // Adicionar log
    await promisePool.query(
      'INSERT INTO tb_robo_historico (hist_robo_id, hist_mensagem) VALUES (?, ?)',
      [roboId, 'Código de verificação recebido, processando...']
    );

    res.json({
      success: true,
      message: 'Código enviado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao enviar código:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao enviar código'
    });
  }
};

// Verificar se há solicitação pendente (para o frontend saber quando mostrar o modal)
exports.getVerificationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const roboId = parseInt(id);

    const pending = pendingVerificationCodes.get(roboId);

    res.json({
      success: true,
      needsCode: pending && pending.status === 'waiting',
      status: pending ? pending.status : 'none',
      requestedAt: pending ? pending.requestedAt : null
    });
  } catch (error) {
    console.error('Erro ao verificar status:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno'
    });
  }
};

// Cancelar solicitação de código de verificação (quando usuário fecha o modal)
exports.cancelVerification = async (req, res) => {
  try {
    const { id } = req.params;
    const roboId = parseInt(id);

    // Remover a solicitação pendente
    pendingVerificationCodes.delete(roboId);

    // Adicionar log
    await promisePool.query(
      'INSERT INTO tb_robo_historico (hist_robo_id, hist_mensagem) VALUES (?, ?)',
      [roboId, 'Solicitação de código de verificação cancelada pelo usuário']
    );

    res.json({
      success: true,
      message: 'Solicitação cancelada'
    });
  } catch (error) {
    console.error('Erro ao cancelar verificação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno'
    });
  }
};

// =============================================
// LIMPEZA DE HISTÓRICO
// =============================================

// Limpar histórico mantendo apenas os últimos N registros de cada robô
exports.cleanupHistorico = async (req, res) => {
  try {
    const limite = parseInt(req.query.limite) || 500;

    // Buscar todos os robôs
    const [robos] = await promisePool.query('SELECT robo_id FROM tb_robo');

    let totalExcluidos = 0;

    for (const robo of robos) {
      const roboId = robo.robo_id;

      // Contar registros atuais
      const [countResult] = await promisePool.query(
        'SELECT COUNT(*) as total FROM tb_robo_historico WHERE hist_robo_id = ?',
        [roboId]
      );
      const totalRegistros = countResult[0].total;

      if (totalRegistros > limite) {
        // Excluir registros antigos mantendo apenas os últimos N
        const [deleteResult] = await promisePool.query(`
          DELETE FROM tb_robo_historico
          WHERE hist_robo_id = ? AND hist_id NOT IN (
            SELECT hist_id FROM (
              SELECT hist_id FROM tb_robo_historico
              WHERE hist_robo_id = ?
              ORDER BY hist_datacriacao DESC
              LIMIT ?
            ) AS t
          )
        `, [roboId, roboId, limite]);

        totalExcluidos += deleteResult.affectedRows;
        console.log(`[Cleanup] Robô ${roboId}: ${deleteResult.affectedRows} registros excluídos`);
      }
    }

    res.json({
      success: true,
      message: `Limpeza concluída: ${totalExcluidos} registro(s) excluído(s)`,
      data: {
        totalExcluidos,
        limite,
        robosProcessados: robos.length
      }
    });
  } catch (error) {
    console.error('Erro ao limpar histórico:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao limpar histórico',
      error: error.message
    });
  }
};

// Função interna para limpeza automática (pode ser chamada por scheduler)
async function cleanupHistoricoInterno(limite = 500) {
  try {
    const [robos] = await promisePool.query('SELECT robo_id FROM tb_robo');

    let totalExcluidos = 0;

    for (const robo of robos) {
      const roboId = robo.robo_id;

      const [deleteResult] = await promisePool.query(`
        DELETE FROM tb_robo_historico
        WHERE hist_robo_id = ? AND hist_id NOT IN (
          SELECT hist_id FROM (
            SELECT hist_id FROM tb_robo_historico
            WHERE hist_robo_id = ?
            ORDER BY hist_datacriacao DESC
            LIMIT ?
          ) AS t
        )
      `, [roboId, roboId, limite]);

      totalExcluidos += deleteResult.affectedRows;
    }

    console.log(`[Cleanup Auto] Total de ${totalExcluidos} registros excluídos`);
    return totalExcluidos;
  } catch (error) {
    console.error('[Cleanup Auto] Erro:', error);
    return 0;
  }
}

// Exportar função interna para uso em schedulers
exports.cleanupHistoricoInterno = cleanupHistoricoInterno;

// =============================================
// SERVER-SENT EVENTS (SSE) PARA NOTIFICAÇÕES EM TEMPO REAL
// =============================================

// Função para enviar evento SSE para todos os clientes conectados a um robô
function notifySSEClients(roboId, eventType, data) {
  const clients = sseClients.get(roboId);
  if (clients && clients.size > 0) {
    const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    console.log(`[SSE] Enviando evento ${eventType} para ${clients.size} cliente(s) do robô ${roboId}`);
    clients.forEach((client) => {
      try {
        client.write(message);
      } catch (error) {
        console.error(`[SSE] Erro ao enviar para cliente:`, error.message);
      }
    });
  } else {
    console.log(`[SSE] Nenhum cliente SSE conectado para robô ${roboId}`);
  }
}

// Endpoint SSE para o frontend se conectar e receber notificações em tempo real
exports.subscribeToEvents = (req, res) => {
  const { id } = req.params;
  const roboId = parseInt(id);

  console.log(`[SSE] Cliente conectando para robô ${roboId}`);

  // Configurar headers para SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Enviar evento inicial de conexão
  res.write(`event: connected\ndata: ${JSON.stringify({ roboId, message: 'Conectado ao SSE' })}\n\n`);

  // Adicionar cliente ao Map
  if (!sseClients.has(roboId)) {
    sseClients.set(roboId, new Set());
  }
  sseClients.get(roboId).add(res);

  console.log(`[SSE] Total de clientes para robô ${roboId}: ${sseClients.get(roboId).size}`);

  // Verificar se já tem solicitação pendente e notificar imediatamente
  const pending = pendingVerificationCodes.get(roboId);
  if (pending && pending.status === 'waiting') {
    console.log(`[SSE] Robô ${roboId} já tem verificação pendente - notificando cliente imediatamente`);
    res.write(`event: verification-needed\ndata: ${JSON.stringify({ roboId, requestedAt: pending.requestedAt })}\n\n`);
  }

  // Heartbeat para manter conexão viva
  const heartbeat = setInterval(() => {
    try {
      res.write(`event: heartbeat\ndata: ${JSON.stringify({ time: new Date().toISOString() })}\n\n`);
    } catch (error) {
      clearInterval(heartbeat);
    }
  }, 30000);

  // Remover cliente ao desconectar
  req.on('close', () => {
    console.log(`[SSE] Cliente desconectou do robô ${roboId}`);
    clearInterval(heartbeat);
    const clients = sseClients.get(roboId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        sseClients.delete(roboId);
      }
    }
  });
};
