const { spawn, exec } = require('child_process');
const path = require('path');
const { promisePool } = require('../config/database');

// Função de log com timestamp
function log(message) {
  const now = new Date();
  const timestamp = now.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  console.log(`[${timestamp}] ${message}`);
}

// Map de processos ativos: robo_id → { process, bottag, robo }
const runningBots = new Map();

// Diretório do Playwright Service (onde fica o bot-runner.js)
const PLAYWRIGHT_DIR = path.join(__dirname, '../../../playwright');

// Script do bot que se comunica com o Playwright Service
const BOT_SCRIPT = 'bot-runner.js';

// URL do Playwright Service
const PLAYWRIGHT_SERVICE_URL = process.env.PLAYWRIGHT_BASE || 'http://localhost:3003';

// Fechar browser no Playwright Service por bottag
async function closeBrowserByBottag(bottag) {
  try {
    const response = await fetch(`${PLAYWRIGHT_SERVICE_URL}/browser/close-by-bottag/${bottag}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    if (data.success) {
      log(`[BotManager] Browser do bot ${bottag} fechado no Playwright Service`);
    }
    return data;
  } catch (error) {
    log(`[BotManager] Aviso: não foi possível fechar browser no Playwright Service: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Buscar próxima OP da fila de oportunidades específicas
async function fetchNextOpFromQueue(roboId) {
  try {
    const [rows] = await promisePool.query(
      `SELECT opesp_numero FROM tb_oportunidades_especificas
       WHERE opesp_robo_id = ?
       ORDER BY opesp_ordem ASC, opesp_datacadastro ASC
       LIMIT 1`,
      [roboId]
    );
    return rows.length > 0 ? rows[0].opesp_numero : null;
  } catch (error) {
    log('[BotManager] ERROR: Erro ao buscar próxima OP:', error);
    return null;
  }
}

/**
 * Inicia um bot Playwright para um robô específico
 * @param {Object} robo - Dados do robô do banco de dados
 * @returns {Object} - { success, message, pid }
 */
function startBot(robo) {
  const roboId = robo.robo_id;

  // Verificar se já está rodando
  if (runningBots.has(roboId)) {
    return {
      success: false,
      message: 'Bot já está em execução'
    };
  }

  const bottag = robo.robo_nome.replace(/ /g, '_');

  // Argumentos para o bot-runner
  const args = [
    path.join(PLAYWRIGHT_DIR, BOT_SCRIPT),
    '--roboId', String(roboId),
    '--login', robo.robo_user,
    '--senha', robo.robo_senha,
    '--data', String(robo.robo_data || 1),
    '--bottag', bottag,
    '--ordem', String(robo.robo_ordemop || 0)
  ];

  // Se tem OP específica para resgatar
  if (robo.robo_opresgate) {
    args.push('--opresgate', robo.robo_opresgate);
  }

  log(`[BotManager] Iniciando bot ${bottag} (ID: ${roboId})`);
  log(`[BotManager] Comando: node ${args.join(' ')}`);

  try {
    // No Linux, usar detached: true para criar um grupo de processos
    // Isso permite matar todos os processos filhos com kill(-pid, signal)
    const isLinux = process.platform !== 'win32';

    const proc = spawn('node', args, {
      cwd: PLAYWRIGHT_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: isLinux // true no Linux para criar grupo de processos
    });

    // Capturar saída do processo
    proc.stdout.on('data', (data) => {
      console.log(`[Bot ${bottag}] ${data.toString().trim()}`);
    });

    proc.stderr.on('data', (data) => {
      console.error(`[Bot ${bottag} ERROR] ${data.toString().trim()}`);
    });

    proc.on('close', async (code) => {
      log(`[BotManager] Bot ${bottag} finalizado com código ${code}`);

      // Verificar se o bot foi parado manualmente (flag stopping ou código 99)
      const botInfo = runningBots.get(roboId);
      const wasStopping = botInfo?.stopping === true;

      if (wasStopping || code === 99) {
        log(`[BotManager] Bot ${bottag} parado manualmente, não reiniciar`);
        runningBots.delete(roboId);
        return;
      }

      // Se código 0, significa reiniciar o bot
      if (code === 0) {
        log(`[BotManager] Reiniciando bot ${bottag}...`);
        runningBots.delete(roboId);

        // Buscar dados atualizados do robô e próxima OP
        try {
          const [rows] = await promisePool.query(
            'SELECT * FROM tb_robo WHERE robo_id = ?',
            [roboId]
          );

          if (rows.length > 0 && rows[0].robo_status === 1) {
            const roboAtualizado = rows[0];
            // Buscar próxima OP da fila
            const opResgate = await fetchNextOpFromQueue(roboId);
            roboAtualizado.robo_opresgate = opResgate;

            // Reiniciar o bot
            startBot(roboAtualizado);
          } else {
            log(`[BotManager] Bot ${bottag} não será reiniciado (status desligado ou não encontrado)`);
          }
        } catch (error) {
          log(`[BotManager] ERROR: Erro ao reiniciar bot ${bottag}: ${error.message}`);
        }
      } else {
        // Código diferente de 0, não reiniciar
        runningBots.delete(roboId);
      }
    });

    proc.on('error', (err) => {
      log(`[BotManager] ERROR: Erro ao iniciar bot ${bottag}: ${err.message}`);
      runningBots.delete(roboId);
    });

    // Armazenar referência do processo
    runningBots.set(roboId, {
      process: proc,
      bottag: bottag,
      startedAt: new Date()
    });

    return {
      success: true,
      message: `Bot ${bottag} iniciado com sucesso`,
      pid: proc.pid
    };
  } catch (error) {
    log(`[BotManager] ERROR: Erro ao spawnar processo: ${error.message}`);
    return {
      success: false,
      message: `Erro ao iniciar bot: ${error.message}`
    };
  }
}

/**
 * Para um bot em execução
 * @param {number} roboId - ID do robô
 * @returns {Object} - { success, message }
 */
async function stopBot(roboId) {
  const botInfo = runningBots.get(roboId);

  if (!botInfo) {
    return {
      success: false,
      message: 'Bot não está em execução'
    };
  }

  try {
    const { process: proc, bottag } = botInfo;

    log(`[BotManager] Parando bot ${bottag} (PID: ${proc.pid})`);

    // Marcar como sendo parado para evitar reinício
    botInfo.stopping = true;

    // Primeiro, fechar o browser no Playwright Service (isso mata o processo Chromium)
    await closeBrowserByBottag(bottag);

    // Enviar comando de stop via stdin (funciona em Windows e Linux)
    try {
      proc.stdin.write('STOP\n');
    } catch (e) {
      log(`[BotManager] Erro ao enviar STOP via stdin: ${e.message}`);
    }

    // Aguardar um pouco para o bot processar
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Forçar kill imediatamente (não esperar mais)
    log(`[BotManager] Forçando encerramento do bot ${bottag}`);

    if (process.platform === 'win32') {
      // No Windows, usar taskkill para matar a árvore de processos
      exec(`taskkill /pid ${proc.pid} /T /F`, (err) => {
        if (err) log(`[BotManager] taskkill: ${err.message}`);
      });
    } else {
      // No Linux, usar kill com -PGID para matar todo o grupo de processos
      // Primeiro, tentar SIGTERM para encerramento gracioso
      try {
        // Tentar matar o grupo de processos (negativo do PID)
        process.kill(-proc.pid, 'SIGTERM');
        log(`[BotManager] SIGTERM enviado para grupo de processos ${proc.pid}`);
      } catch (e) {
        log(`[BotManager] Erro ao enviar SIGTERM para grupo: ${e.message}`);
        // Fallback: tentar matar processo individual
        try {
          proc.kill('SIGTERM');
        } catch (e2) {
          log(`[BotManager] Erro ao enviar SIGTERM: ${e2.message}`);
        }
      }

      // Aguardar 2 segundos e forçar SIGKILL se ainda estiver rodando
      setTimeout(() => {
        try {
          // Verificar se o processo ainda existe
          process.kill(proc.pid, 0);
          // Se chegou aqui, o processo ainda existe - forçar SIGKILL
          log(`[BotManager] Processo ${proc.pid} ainda ativo, enviando SIGKILL`);

          // Usar pkill para matar todos os processos filhos no Linux
          exec(`pkill -9 -P ${proc.pid}`, (err) => {
            if (err && err.code !== 1) {
              log(`[BotManager] pkill filhos: ${err.message}`);
            }
          });

          // Matar o processo principal
          try {
            process.kill(-proc.pid, 'SIGKILL');
          } catch (e) {
            try {
              proc.kill('SIGKILL');
            } catch (e2) {
              log(`[BotManager] Erro ao enviar SIGKILL: ${e2.message}`);
            }
          }
        } catch (checkErr) {
          // Processo já terminou
          log(`[BotManager] Processo ${proc.pid} já encerrado`);
        }
      }, 2000);
    }

    // Remover do mapa imediatamente
    runningBots.delete(roboId);

    // Atualizar status no banco para garantir que não reinicie
    try {
      await promisePool.query(
        'UPDATE tb_robo SET robo_status = 0 WHERE robo_id = ?',
        [roboId]
      );
    } catch (dbErr) {
      log(`[BotManager] ERROR: Erro ao atualizar status no banco: ${dbErr.message}`);
    }

    return {
      success: true,
      message: `Bot ${bottag} parado com sucesso`
    };
  } catch (error) {
    log(`[BotManager] ERROR: Erro ao parar bot: ${error.message}`);
    runningBots.delete(roboId);
    return {
      success: false,
      message: `Erro ao parar bot: ${error.message}`
    };
  }
}

/**
 * Verifica se um bot está rodando
 * @param {number} roboId - ID do robô
 * @returns {boolean}
 */
function isBotRunning(roboId) {
  return runningBots.has(roboId);
}

/**
 * Retorna informações sobre um bot em execução
 * @param {number} roboId - ID do robô
 * @returns {Object|null}
 */
function getBotInfo(roboId) {
  const botInfo = runningBots.get(roboId);
  if (!botInfo) return null;

  return {
    bottag: botInfo.bottag,
    pid: botInfo.process.pid,
    startedAt: botInfo.startedAt,
    running: !botInfo.process.killed
  };
}

/**
 * Retorna lista de todos os bots em execução
 * @returns {Array}
 */
function getAllRunningBots() {
  const bots = [];
  runningBots.forEach((info, roboId) => {
    bots.push({
      roboId,
      bottag: info.bottag,
      pid: info.process.pid,
      startedAt: info.startedAt,
      running: !info.process.killed
    });
  });
  return bots;
}

/**
 * Para todos os bots em execução (para shutdown gracioso)
 */
function stopAllBots() {
  log(`[BotManager] Parando todos os bots (${runningBots.size} ativos)`);
  runningBots.forEach((_, roboId) => {
    stopBot(roboId);
  });
}

// Cleanup ao encerrar o processo principal
process.on('SIGINT', () => {
  stopAllBots();
  process.exit();
});

process.on('SIGTERM', () => {
  stopAllBots();
  process.exit();
});

module.exports = {
  startBot,
  stopBot,
  isBotRunning,
  getBotInfo,
  getAllRunningBots,
  stopAllBots
};
