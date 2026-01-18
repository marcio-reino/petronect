/**
 * Bot Runner - Bot para Petronect usando Playwright Service
 *
 * Recebe parametros via linha de comando e se comunica com:
 * - Backend API (porta 5000) para logs, status e sincronização de oportunidades
 * - Playwright Service (porta 3003) para controle do browser
 *
 * Uso: node bot-runner.js --roboId 1 --login USER --senha PASS --data 1 --bottag OP_01 --ordem 0 [--opresgate 7004192456]
 */

// =============================================
// CONFIGURACAO VIA ARGUMENTOS
// =============================================
const args = process.argv.slice(2);
const config = {};

for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace('--', '');
  const value = args[i + 1];
  config[key] = value;
}

const roboId = config.roboId;
const login = config.login;
const senha = config.senha;
const dataOp = parseInt(config.data) || 1;
const bottag = config.bottag;
const statusHoraInicioOrdem = config.ordem || '0'; // 0=crescente, 1=decrescente
let opResgate = config.opresgate || null;

// URLs base
const API_BASE = process.env.API_BASE || 'http://localhost:5000/api';
const PLAYWRIGHT_BASE = process.env.PLAYWRIGHT_BASE || 'http://localhost:3003';

// Flag para evitar múltiplas chamadas de stop
let isStopping = false;

// Listener para comandos via stdin (usado pelo botManager para parar o bot)
process.stdin.setEncoding('utf8');
process.stdin.on('data', async (data) => {
  const command = data.trim();
  if (command === 'STOP') {
    log(`[Bot] Comando STOP recebido via stdin`);
    if (!isStopping) {
      isStopping = true;
      try {
        // Fechar browser via Playwright Service
        if (browserId) {
          await fetch(`${PLAYWRIGHT_BASE}/browser/${browserId}/close`, { method: 'POST' });
          log(`[Bot] Browser fechado com sucesso`);
        }
      } catch (e) {
        log(`[Bot] ERROR: Erro ao fechar browser:`, e.message);
      }
      // Código 99 = parado manualmente pelo usuário, não reiniciar
      process.exit(99);
    }
  }
});

// Modo headless
const HEADLESS_MODE = process.env.BOT_HEADLESS !== 'false';

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

// IDs do browser e página
let browserId = null;
let pageId = null;

// Variaveis globais
let n_op_ = '';
let desc_ = '';
let data_inicio_ = '';
let hora_inicio_ = '';
let data_fim_ = '';
let hora_fim_ = '';
let qtd_ops = 0;
let qtd_itens = 0;
let n_op_processar = '';
let id_line_process = '';
let date_op = '';

// =============================================
// FUNCOES DE COMUNICACAO COM PLAYWRIGHT SERVICE
// =============================================

async function pw(endpoint, method = 'POST', body = null) {
  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) {
      options.body = JSON.stringify(body);
    }
    const response = await fetch(`${PLAYWRIGHT_BASE}${endpoint}`, options);
    return await response.json();
  } catch (error) {
    log(`[Playwright] ERROR: Erro em ${endpoint}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Funções de alto nível para Playwright
async function launchBrowser() {
  // Enviar bottag para o Playwright Service poder associar o browser ao bot
  const result = await pw('/browser/launch', 'POST', { headless: HEADLESS_MODE, bottag: bottag });
  if (result.success) {
    browserId = result.browserId;
  }
  return result;
}

async function closeBrowser() {
  if (!browserId) return { success: true };
  return await pw(`/browser/${browserId}/close`, 'POST');
}

async function createPage() {
  const result = await pw(`/browser/${browserId}/page`, 'POST', { width: 1400, height: 900 });
  if (result.success) {
    pageId = result.pageId;
  }
  return result;
}

async function goto(url) {
  return await pw(`/browser/${browserId}/page/${pageId}/goto`, 'POST', { url });
}

async function click(selector) {
  return await pw(`/browser/${browserId}/page/${pageId}/click`, 'POST', { selector });
}

async function fill(selector, value) {
  return await pw(`/browser/${browserId}/page/${pageId}/fill`, 'POST', { selector, value });
}

async function press(key) {
  return await pw(`/browser/${browserId}/page/${pageId}/press`, 'POST', { key });
}

async function mouseClick(x, y) {
  return await pw(`/browser/${browserId}/page/${pageId}/mouse-click`, 'POST', { x, y });
}

async function wait(ms) {
  return await pw(`/browser/${browserId}/page/${pageId}/wait`, 'POST', { ms });
}

async function waitSelector(selector, timeout = 30000) {
  return await pw(`/browser/${browserId}/page/${pageId}/wait-selector`, 'POST', { selector, timeout });
}

async function isVisible(selector) {
  const result = await pw(`/browser/${browserId}/page/${pageId}/is-visible`, 'POST', { selector });
  return result.visible || false;
}

async function innerText(selector) {
  const result = await pw(`/browser/${browserId}/page/${pageId}/inner-text`, 'POST', { selector });
  return result.text || '';
}

async function getContent() {
  const result = await pw(`/browser/${browserId}/page/${pageId}/content`, 'POST');
  return result.content || '';
}

async function getUrl() {
  const result = await pw(`/browser/${browserId}/page/${pageId}/url`, 'GET');
  return result.url || '';
}

async function screenshot(filename) {
  return await pw(`/browser/${browserId}/page/${pageId}/screenshot`, 'POST', { filename });
}

async function frame(name, action, selector, value, options) {
  return await pw(`/browser/${browserId}/page/${pageId}/frame`, 'POST', {
    name, action, selector, value, options
  });
}

async function locatorFill(selector, value) {
  return await pw(`/browser/${browserId}/page/${pageId}/locator-fill`, 'POST', { selector, value });
}

async function locatorClick(selector) {
  return await pw(`/browser/${browserId}/page/${pageId}/locator-click`, 'POST', { selector });
}

async function count(selector) {
  const result = await pw(`/browser/${browserId}/page/${pageId}/count`, 'POST', { selector });
  return result.count || 0;
}

async function getPages() {
  const result = await pw(`/browser/${browserId}/pages`, 'GET');
  return result.pages || [];
}

// =============================================
// FUNCOES DE COMUNICACAO COM BACKEND
// =============================================

async function SaveLogBot(mensagem) {
  try {
    await fetch(`${API_BASE}/robos/${roboId}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensagem })
    });
  } catch (error) {
    log('[SaveLogBot] ERROR: Erro:', error.message);
  }
}

async function UpdateProcesso(opNumero, itemAtual, totalItens, status) {
  try {
    await fetch(`${API_BASE}/robos/${roboId}/processo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opNumero, itemAtual, totalItens, status })
    });
  } catch (error) {
    log('[UpdateProcesso] ERROR: Erro:', error.message);
  }
}

async function StopRobo() {
  try {
    await fetch(`${API_BASE}/robos/${roboId}/processo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opNumero: 'STOPPED', itemAtual: 0, totalItens: 0, status: 'idle', stopRobo: true })
    });
  } catch (error) {
    log('[StopRobo] ERROR: Erro:', error.message);
  }
}

async function notifyOpCompleted(opNumero) {
  try {
    const response = await fetch(`${API_BASE}/robos/complete-op`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roboId: parseInt(roboId), opNumero })
    });
    const data = await response.json();
    return data.nextOp || null;
  } catch (error) {
    log('[notifyOpCompleted] ERROR: Erro:', error.message);
    return null;
  }
}

async function checkQueueForNextOp() {
  try {
    const response = await fetch(`${API_BASE}/robos/${roboId}/check-queue`);
    const data = await response.json();
    if (data.success && data.hasQueue) {
      log(`[Bot ${bottag}] Fila verificada: próxima OP ${data.nextOp}`);
      return data.nextOp;
    }
    log(`[Bot ${bottag}] Fila verificada: vazia`);
    return null;
  } catch (error) {
    log('[checkQueueForNextOp] ERROR: Erro:', error.message);
    return null;
  }
}

async function requestVerificationCode() {
  try {
    await fetch(`${API_BASE}/robos/${roboId}/request-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    log(`[Bot ${bottag}] Solicitação de código enviada ao backend`);
  } catch (error) {
    log('[requestVerificationCode] ERROR: Erro:', error.message);
  }
}

async function waitForVerificationCode(maxWaitMs = 300000) {
  const startTime = Date.now();
  const pollInterval = 2000;

  log(`[Bot ${bottag}] Aguardando código de verificação (max ${maxWaitMs / 1000}s)...`);

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const response = await fetch(`${API_BASE}/robos/${roboId}/check-verification`);
      const data = await response.json();

      if (data.status === 'submitted' && data.code) {
        log(`[Bot ${bottag}] Código recebido: ${data.code}`);
        return data.code;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    } catch (error) {
      log('[waitForVerificationCode] ERROR: Erro:', error.message);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  log(`[Bot ${bottag}] Timeout aguardando código de verificação`);
  return null;
}

// =============================================
// FUNCOES DE SINCRONIZACAO COM BANCO DE DADOS
// =============================================

async function syncOportunidade(numero, descricao, datainicio, datafim, totalitens) {
  try {
    const response = await fetch(`${API_BASE}/oportunidades/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        numero,
        descricao,
        datainicio,
        datafim,
        totalitens,
        bottag
      })
    });
    const data = await response.json();
    if (data.success) {
      log(`[Bot ${bottag}] OP ${numero} sincronizada no banco`);
    }
    return data;
  } catch (error) {
    log('[syncOportunidade] ERROR: Erro:', error.message);
    return { success: false, error: error.message };
  }
}

async function syncItem(opNumero, itemNumero, descricao, descricaoCompleta, quantidade, unidade, produtoId, produtoFamilia, descricaoLonga) {
  try {
    const response = await fetch(`${API_BASE}/oportunidades/sync-item`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        opNumero,
        itemNumero,
        descricao,
        descricaoCompleta,
        descricaoLonga,
        quantidade,
        unidade,
        produtoId,
        produtoFamilia,
        bottag
      })
    });
    const data = await response.json();
    return data;
  } catch (error) {
    log('[syncItem] ERROR: Erro:', error.message);
    return { success: false, error: error.message };
  }
}

async function finishOportunidade(numero) {
  try {
    const response = await fetch(`${API_BASE}/oportunidades/finish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero })
    });
    const data = await response.json();
    if (data.success) {
      log(`[Bot ${bottag}] OP ${numero} finalizada no banco`);
    }
    return data;
  } catch (error) {
    log('[finishOportunidade] ERROR: Erro:', error.message);
    return { success: false, error: error.message };
  }
}

async function checkOpInDatabase(opNumero) {
  try {
    // Verificar se a OP já está completa usando o endpoint de progresso
    const response = await fetch(`${API_BASE}/oportunidades/progress/${opNumero}`);
    const data = await response.json();

    if (data.success && data.exists) {
      // OP está completa se:
      // 1. isComplete = true (status = 1)
      // 2. OU se todos os itens já foram baixados (itensBaixados >= totalItens E totalItens > 0)
      const allItemsDownloaded = data.totalItens > 0 && data.itensBaixados >= data.totalItens;
      const isComplete = data.isComplete || data.status === 1 || allItemsDownloaded;

      log(`[checkOpInDatabase] OP ${opNumero}: exists=${data.exists}, status=${data.status}, isComplete=${isComplete}, itensBaixados=${data.itensBaixados}/${data.totalItens}, allItemsDownloaded=${allItemsDownloaded}`);

      // Se todos os itens foram baixados mas status ainda é 0, marcar como completa
      if (allItemsDownloaded && data.status !== 1) {
        log(`[checkOpInDatabase] OP ${opNumero}: Todos itens baixados, marcando como completa...`);
        try {
          await fetch(`${API_BASE}/oportunidades/finish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ numero: opNumero })
          });
        } catch (e) {
          log(`[checkOpInDatabase] Erro ao marcar OP como completa: ${e.message}`);
        }
      }

      return isComplete;
    }

    return false;
  } catch (error) {
    log('[checkOpInDatabase] ERROR: Erro:', error.message);
    return false;
  }
}

async function getOpProgress(opNumero) {
  try {
    const response = await fetch(`${API_BASE}/oportunidades/progress/${opNumero}`);
    const data = await response.json();
    if (data.success) {
      return {
        exists: data.exists,
        lastItem: data.lastItem || 0,
        itensBaixados: data.itensBaixados || 0,
        totalItens: data.totalItens || 0,
        isComplete: data.isComplete || false
      };
    }
    return { exists: false, lastItem: 0, itensBaixados: 0, totalItens: 0, isComplete: false };
  } catch (error) {
    log('[getOpProgress] ERROR: Erro:', error.message);
    return { exists: false, lastItem: 0, itensBaixados: 0, totalItens: 0, isComplete: false };
  }
}

// =============================================
// FUNCOES DE SISTEMA
// =============================================

function dateGetOp(dt) {
  const data = new Date();
  data.setDate(data.getDate() - dt);
  let dia = data.getDate();
  let mes = data.getMonth() + 1;
  const ano = data.getFullYear();
  if (dia <= 9) dia = '0' + dia;
  if (mes <= 9) mes = '0' + mes;
  return dia + '.' + mes + '.' + ano;
}

function getHora() {
  const data = new Date();
  const hora = data.getHours();
  const min = data.getMinutes();
  const seg = data.getSeconds();
  return hora + ':' + min + ':' + seg;
}

// Função para obter o botão de rolagem para próximo item (para OPs com mais de 10 itens)
async function getScrollNextButtonId() {
  try {
    const frameContent = await frame('isolatedWorkArea', 'content');
    const html = frameContent.result || '';
    const posicaoInicial = html.indexOf('-scrollV-Nxt');
    if (posicaoInicial > -1) {
      const idBotao = html.substr(posicaoInicial - 6, 18);
      return '#' + idBotao;
    }
    return null;
  } catch (error) {
    log(`[Bot ${bottag}] Erro ao buscar botão de rolagem: ${error.message}`);
    return null;
  }
}

// Cache de OPs já verificadas no banco
const opStatusCache = new Map();

async function checkOpStatus(n_op, id, showLine = true) {
  // Verificar cache primeiro
  if (opStatusCache.has(n_op)) {
    const cached = opStatusCache.get(n_op);
    if (cached) {
      return ' - Baixado' + (showLine ? ' - L-' + id : '');
    }
  }

  // Verificar no banco de dados
  const isComplete = await checkOpInDatabase(n_op);
  opStatusCache.set(n_op, isComplete);

  if (!isComplete) {
    id_line_process = id;
    n_op_processar = n_op;
    return ' - Pendente' + (showLine ? ' - L-' + id : '');
  } else {
    return ' - Baixado' + (showLine ? ' - L-' + id : '');
  }
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// =============================================
// START BOT
// =============================================

(async () => {
  // Calcular data de pesquisa
  date_op = dateGetOp(dataOp);

  log(`[Bot ${bottag}] Iniciando...`);
  log(`[Bot ${bottag}] Login: ${login}`);
  log(`[Bot ${bottag}] Data OP: ${date_op} (${dataOp} dias atras)`);
  log(`[Bot ${bottag}] Ordem: ${statusHoraInicioOrdem === '0' ? 'Crescente' : 'Decrescente'}`);
  log(`[Bot ${bottag}] OP Resgate: ${opResgate || 'Nenhuma (modo data)'}`);
  log(`[Bot ${bottag}] Playwright Service: ${PLAYWRIGHT_BASE}`);

  // Verificar se o Playwright Service está rodando
  try {
    log(`[Bot ${bottag}] Tentando conectar em: ${PLAYWRIGHT_BASE}/health`);
    const healthCheck = await fetch(`${PLAYWRIGHT_BASE}/health`);
    log(`[Bot ${bottag}] Status HTTP: ${healthCheck.status}`);
    const health = await healthCheck.json();
    log(`[Bot ${bottag}] Resposta health:`, JSON.stringify(health));
    if (health.status !== 'ok') {
      throw new Error('Playwright Service não está ok');
    }
    log(`[Bot ${bottag}] Playwright Service OK`);
  } catch (error) {
    log(`[Bot ${bottag}] ERROR: Playwright Service não disponível:`, error.message);
    log(`[Bot ${bottag}] ERROR: Erro completo:`, error);
    await SaveLogBot('Erro: O servidor de automação falhou - reiniciando em 10s...');
    await delay(10000);
    process.exit(0);
  }

  try {
    // Iniciar browser
    const launchResult = await launchBrowser();
    if (!launchResult.success) {
      throw new Error(`Erro ao iniciar browser: ${launchResult.error}`);
    }
    log(`[Bot ${bottag}] Browser iniciado (ID: ${browserId})`);

    // Criar página principal
    const pageResult = await createPage();
    if (!pageResult.success) {
      throw new Error(`Erro ao criar página: ${pageResult.error}`);
    }
    log(`[Bot ${bottag}] Página criada (ID: ${pageId})`);

    // Acessar Petronect
    log(`[Bot ${bottag}] Acessando Petronect...`);
    await SaveLogBot('Acessando Petronect...');
    await goto('https://www.petronect.com.br/irj/go/km/docs/pccshrcontent/Site%20Content%20(Legacy)/Portal2018/pt/index.html');
    await wait(2000);
    await screenshot(bottag);
    log(`[Bot ${bottag}] Página inicial carregada - screenshot salva`);
    await SaveLogBot('Página inicial carregada');

    await click('//html/body/div/div[1]/div[2]/div/div[3]/a');
    await wait(1000);
    await screenshot(bottag);
    log(`[Bot ${bottag}] Tela de login - screenshot salva`);

    await fill('#inputUser', login);
    await fill('#inputSenha', senha);
    await press('Enter');

    log(`[Bot ${bottag}] Efetuando login...`);
    await SaveLogBot('Efetuando login...');
    await wait(10000);
    await screenshot(bottag);

    // Verificar solicitação de código por e-mail
    const isCodeVisible = await isVisible('text=Confirme sua identidade');
    if (isCodeVisible) {
      log(`[Bot ${bottag}] Código de verificação solicitado`);
      await SaveLogBot('Código de verificação solicitado. Aguardando usuário...');
      await screenshot(bottag);
      await wait(2000);

      // Clicar no botão para enviar código por email
      await click('//html/body/div[1]/div[2]/div/div/div[2]/div[3]/form/button[2]');
      await wait(3000);
      await screenshot(bottag);

      // Solicitar código ao usuário via API
      await requestVerificationCode();

      // Aguardar código do usuário (máximo 1:30)
      const verificationCode = await waitForVerificationCode(90000);

      if (verificationCode) {
        log(`[Bot ${bottag}] Inserindo código de verificação...`);
        await SaveLogBot('Inserindo código de verificação...');

        // Localizar input do código e inserir
        const codeCount = await count('input[type="text"], input[type="number"], input[name*="code"], input[id*="code"]');
        if (codeCount > 0) {
          await locatorFill('input[type="text"], input[type="number"], input[name*="code"], input[id*="code"]', verificationCode.trim());
          await wait(1000);
          await screenshot(bottag);
          await wait(2000);

          await click('//html/body/div[1]/div[2]/div/div/div[2]/div[3]/form/button[2]');

          await wait(5000);
          await screenshot(bottag);
          await SaveLogBot('Código de verificação enviado!');
        } else {
          log(`[Bot ${bottag}] Campo de código não encontrado`);
          await SaveLogBot('Erro: Campo de código não encontrado');
        }


      } else {
        log(`[Bot ${bottag}] Timeout - código não recebido`);
        await SaveLogBot('Erro: Timeout aguardando código de verificação - reiniciando em 10s...');
        isStopping = true;
        await closeBrowser();
        await delay(10000);
        process.exit(0);
      }
    }

    await wait(8000);

    // Verificar manutenção de usuário
    const url = await getUrl();
    if (url.indexOf('ypuser_maintenance?origem=2') > -1) {
      await mouseClick(775, 555);
      await wait(5000);
    }

    await wait(5000);
    await screenshot(bottag);

    // Verificar se o botão de Cotações existe
    const tabIcon1Exists = await isVisible('#tabIcon1');
    if (!tabIcon1Exists) {
      log(`[Bot ${bottag}] ERROR: Erro: Botão de Cotações (#tabIcon1) não encontrado`);
      await SaveLogBot('Não foi possivel realizar o login - reiniciando em 10s...');
      await screenshot(bottag);
      isStopping = true;
      await closeBrowser();
      await delay(10000);
      process.exit(0); // Exit 0 para permitir reinício automático
    }

    // Acessar Cotações
    await click('#tabIcon1');
    log(`[Bot ${bottag}] Acessando cotações...`);
    await SaveLogBot('Acessando cotações...');
    await wait(5000);
    await screenshot(bottag);

    // Desbloqueio de sessão
    log(`[Bot ${bottag}] Desbloqueio de sessão...`);
    await SaveLogBot('Desbloqueio de sessão...');
    await click('#subTabIndex2');
    await wait(5000);

    const xpath_btn_unlocksession = '//html[1]/body[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/div[1]/span[1]/span[2]/div[1]/div[1]/table[1]/tbody[1]/tr[3]/td[1]/div[1]';
    await frame('isolatedWorkArea', 'click', xpath_btn_unlocksession);
    await wait(5000);
    await mouseClick(863, 520);
    await SaveLogBot('Desbloqueio realizado...');
    await wait(5000);

    // =============================================
    // LOOP PRINCIPAL - PROCESSAR OPs
    // =============================================
    let continuarProcessando = true;

    while (continuarProcessando) {
      // Reset variáveis para cada ciclo
      n_op_processar = null;
      id_line_process = null;

      // Limpar cache de status das OPs para forçar nova verificação no banco
      opStatusCache.clear();
      log(`[Bot ${bottag}] Cache de OPs limpo para nova verificação`);

    // Formulário de pesquisa
    log(`[Bot ${bottag}] Acessando formulário de pesquisa...`);
    await SaveLogBot('Acessando formulário de pesquisa...');
    await click('#subTabIndex1');
    await wait(20000);
    await screenshot(bottag);

    // XPaths do formulário
    const xpath_input_op = '//html[1]/body[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[2]/td[1]/table[1]/tbody[1]/tr[3]/td[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[2]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/div[1]/div[2]/span[1]/span[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[3]/span[1]/input[1]';
    const xpath_btn_opstatus = '//html[1]/body[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[2]/td[1]/table[1]/tbody[1]/tr[3]/td[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[2]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/div[1]/div[2]/span[1]/span[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[11]/td[3]/span[1]/span[1]';
    const xpath_input_date = '//html[1]/body[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[2]/td[1]/table[1]/tbody[1]/tr[3]/td[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[2]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/div[1]/div[2]/span[1]/span[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[5]/td[3]/span[1]/input[1]';
    const xpath_btn_buscar = '//html/body/table/tbody/tr/td/div/table/tbody/tr/td/div/table/tbody/tr[2]/td/table/tbody/tr[3]/td/div[1]/div/table/tbody/tr/td/span/span/table/tbody/tr/td/span/span[2]/table/tbody/tr/td/div/table/tbody/tr/td/div/table/tbody/tr[2]/td/div/span[1]/div';

    // Determinar tipo de pesquisa
    if (opResgate) {
      log(`[Bot ${bottag}] Pesquisando OP específica: ${opResgate}`);
      await SaveLogBot(`Pesquisando OP específica: ${opResgate}`);
      await wait(2000);
      await frame('isolatedWorkArea', 'click', xpath_btn_opstatus);
      await press('PageUp');
      await wait(1000);
      await press('PageUp');
      await wait(2000);
      await frame('isolatedWorkArea', 'fill', xpath_input_op, opResgate);
      await frame('isolatedWorkArea', 'click', xpath_btn_buscar);
      n_op_processar = opResgate;
      id_line_process = 2;
    } else {
      log(`[Bot ${bottag}] Pesquisando por data: ${date_op}`);
      await SaveLogBot(`Pesquisando por data: ${date_op}`);
      await frame('isolatedWorkArea', 'fill', xpath_input_date, date_op);
      await wait(2000);
      await frame('isolatedWorkArea', 'click', xpath_btn_buscar);
    }

    log(`[Bot ${bottag}] Pesquisando...`);
    await SaveLogBot('Pesquisando...');
    await wait(30000);
    await screenshot(bottag);

    // Ordenação por hora início (se modo data e ordem crescente)
    if (statusHoraInicioOrdem === '0' && !opResgate) {
      const frameContent = await frame('isolatedWorkArea', 'content');
      const html = frameContent.result || '';
      const posicaoInicial = html.indexOf('Hora In');
      if (posicaoInicial > -1) {
        const idBotao = html.substr(posicaoInicial - 64, 4);
        await frame('isolatedWorkArea', 'click', '#' + idBotao);
        await wait(4000);
        await frame('isolatedWorkArea', 'click', ':nth-match(:text("Ordenar em ordem crescente"), 1)');
        await wait(10000);
        await screenshot(bottag);
        log(`[Bot ${bottag}] Ordenando hora início para crescente...`);
        await SaveLogBot('Ordenando hora início para crescente...');
      }
    }

    // Verificar total de OPs
    const xpath_qtd_ops = '//html[1]/body[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[2]/td[1]/table[1]/tbody[1]/tr[1]/td[1]/table[1]/tbody[1]/tr[1]/td[2]/div[1]/div[1]/div[1]';

    await frame('isolatedWorkArea', 'waitForSelector', xpath_qtd_ops);
    let qtdResult = await frame('isolatedWorkArea', 'innerText', xpath_qtd_ops);
    qtd_ops = qtdResult.result || '';

    if (qtd_ops.indexOf('[Opera') > -1) {
      log(`[Bot ${bottag}] Aguardando +60 segundos...`);
      await wait(60000);
      await screenshot(bottag);
      qtdResult = await frame('isolatedWorkArea', 'innerText', xpath_qtd_ops);
      qtd_ops = qtdResult.result || '';
    }

    qtd_ops = qtd_ops.replace('Minhas Participações (', '').replace(')', '');
    await wait(5000);
    log(`[Bot ${bottag}] Total de [${qtd_ops}] oportunidades...`);
    await SaveLogBot(`Total de [${qtd_ops}] oportunidades...`);
    await UpdateProcesso(opResgate || 'DATA', 0, parseInt(qtd_ops), 'running');

    // Se pesquisa por OP específica e não encontrou (0 resultados), remover da fila
    if (opResgate && parseInt(qtd_ops) === 0) {
      log(`[Bot ${bottag}] OP específica ${opResgate} não encontrada! Removendo da fila...`);
      await SaveLogBot(`OP específica ${opResgate} não encontrada! Removendo da fila...`);

      // Notificar conclusão para remover da fila e buscar próxima
      const nextOp = await notifyOpCompleted(opResgate);
      if (nextOp) {
        log(`[Bot ${bottag}] Próxima OP da fila: ${nextOp}`);
        await SaveLogBot(`Próxima OP da fila: ${nextOp}`);
        opResgate = nextOp;
      } else {
        log(`[Bot ${bottag}] Fila vazia, operando por data`);
        await SaveLogBot('Fila vazia, operando por data');
        opResgate = null;
      }

      // Continuar o loop para processar a próxima OP
      await wait(3000);
      continue;
    }

    // Se pesquisa por data, verificar lista de OPs
    if (!opResgate) {
      const totalOps = parseInt(qtd_ops);
      let encontrouPendente = false;
      let opsVerificadas = 0;

      // XPath do botão de rolagem para baixo na lista de OPs
      const xpath_scroll_down = '//html/body/table/tbody/tr/td/div/table/tbody/tr/td/div/table/tbody/tr[2]/td/table/tbody/tr[3]/td/div[1]/div/table/tbody/tr/td/span/span/table/tbody/tr/td/span/span[4]/table/tbody/tr/td/span/span[1]/div/div/div/span/span/table/tbody/tr[2]/td/div/table/tbody/tr/td/div/table/tbody/tr/td[2]/div/table/tbody/tr[3]/td/div';

      // Verificar primeiras 10 OPs
      const primeiraLeva = Math.min(10, totalOps);
      let id_line = 1;

      for (let i = 0; i < primeiraLeva; i++) {
        id_line += 1;
        const xpath_n_op = `//html[1]/body[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[2]/td[1]/table[1]/tbody[1]/tr[3]/td[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[4]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[1]/div[1]/div[1]/div[1]/span[1]/span[1]/table[1]/tbody[1]/tr[2]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/table[1]/tbody[1]/tr[${id_line}]/td[2]/a[1]/span[1]`;

        try {
          await frame('isolatedWorkArea', 'waitForSelector', xpath_n_op, null, { timeout: 5000 });
          const nOpResult = await frame('isolatedWorkArea', 'innerText', xpath_n_op);
          const n_op = nOpResult.result || '';

          const status = await checkOpStatus(n_op, id_line);
          opsVerificadas++;
          log(`[Bot ${bottag}] OP ${opsVerificadas}/${totalOps}: ${n_op}${status}`);
          await SaveLogBot(`OP ${opsVerificadas}/${totalOps}: ${n_op}${status}`);

          // Se encontrou OP pendente, parar de verificar e iniciar resgate
          if (status.indexOf('Pendente') > -1) {
            encontrouPendente = true;
            log(`[Bot ${bottag}] Encontrou OP pendente, iniciando resgate...`);
            await SaveLogBot('Encontrou OP pendente, iniciando resgate...');
            break;
          }
        } catch (e) {
          break;
        }
        await wait(1000);
      }

      // Se não encontrou pendente nas primeiras 10 e há mais OPs, rolar e continuar verificando
      if (!encontrouPendente && !n_op_processar && totalOps > 10) {
        const opsRestantes = totalOps - 10;
        log(`[Bot ${bottag}] Verificando ${opsRestantes} OPs restantes...`);
        await SaveLogBot(`Verificando ${opsRestantes} OPs restantes...`);

        // Rolar e verificar cada OP restante (sempre na linha 11 após rolar)
        let clicksRolagem = 0;
        for (let i = 0; i < opsRestantes; i++) {
          // Clicar no botão de rolagem para baixo
          try {
            await frame('isolatedWorkArea', 'click', xpath_scroll_down);
            clicksRolagem++;
            await wait(2000);

            // Após rolar, a nova OP aparece na linha 11 (última posição visível)
            const xpath_n_op = `//html[1]/body[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[2]/td[1]/table[1]/tbody[1]/tr[3]/td[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[4]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[1]/div[1]/div[1]/div[1]/span[1]/span[1]/table[1]/tbody[1]/tr[2]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/table[1]/tbody[1]/tr[11]/td[2]/a[1]/span[1]`;

            await frame('isolatedWorkArea', 'waitForSelector', xpath_n_op, null, { timeout: 5000 });
            const nOpResult = await frame('isolatedWorkArea', 'innerText', xpath_n_op);
            const n_op = nOpResult.result || '';

            const linhaAtual = 10 + clicksRolagem;
            const status = await checkOpStatus(n_op, 11, false);
            opsVerificadas++;
            log(`[Bot ${bottag}] OP ${opsVerificadas}/${totalOps}: ${n_op}${status} - L-${linhaAtual}`);
            await SaveLogBot(`OP ${opsVerificadas}/${totalOps}: ${n_op}${status} - L-${linhaAtual}`);

            // Se encontrou OP pendente, parar de verificar e iniciar resgate
            if (status.indexOf('Pendente') > -1) {
              encontrouPendente = true;
              id_line_process = 11; // A OP pendente está na linha 11 após a rolagem
              log(`[Bot ${bottag}] Encontrou OP pendente, iniciando resgate... L-${linhaAtual}`);
              await SaveLogBot(`Encontrou OP pendente, iniciando resgate... L-${linhaAtual}`);
              break;
            }
          } catch (e) {
            log(`[Bot ${bottag}] Erro ao verificar OP após rolagem: ${e.message}`);
            break;
          }
          await wait(1000);
        }
      }

      // Se verificou todas e não encontrou pendente
      if (!encontrouPendente && !n_op_processar) {
        log(`[Bot ${bottag}] Nenhuma OP pendente encontrada em ${opsVerificadas} oportunidades`);
        await SaveLogBot(`Nenhuma OP pendente encontrada em ${opsVerificadas} oportunidades`);
      }
    }

    // Se há OP para processar
    if (id_line_process && n_op_processar) {
      log(`[Bot ${bottag}] Processando OP: ${n_op_processar} Linha: ${id_line_process}`);
      await SaveLogBot(`Processando OP: ${n_op_processar}`);
      await UpdateProcesso(n_op_processar, 0, 0, 'running');

      // Clicar na OP
      const xpath_n_op = `//html[1]/body[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[2]/td[1]/table[1]/tbody[1]/tr[3]/td[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[4]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[1]/div[1]/div[1]/div[1]/span[1]/span[1]/table[1]/tbody[1]/tr[2]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/table[1]/tbody[1]/tr[${id_line_process}]/td[2]/a[1]/span[1]`;
      const xpath_desc_op = `//html[1]/body[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[2]/td[1]/table[1]/tbody[1]/tr[3]/td[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[4]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[1]/div[1]/div[1]/div[1]/span[1]/span[1]/table[1]/tbody[1]/tr[2]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/table[1]/tbody[1]/tr[${id_line_process}]/td[3]/span[1]/span[1]`;
      const xpath_datainicio = `//html[1]/body[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[2]/td[1]/table[1]/tbody[1]/tr[3]/td[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[4]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[1]/div[1]/div[1]/div[1]/span[1]/span[1]/table[1]/tbody[1]/tr[2]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/table[1]/tbody[1]/tr[${id_line_process}]/td[4]/span[1]/span[1]`;
      const xpath_horainicio = `//html/body/table/tbody/tr/td/div/table/tbody/tr/td/div/table/tbody/tr[2]/td/table/tbody/tr[3]/td/div[1]/div/table/tbody/tr/td/span/span/table/tbody/tr/td/span/span[4]/table/tbody/tr/td/span/span[1]/div/div/div/span/span/table/tbody/tr[2]/td/div/table/tbody/tr/td/div/table/tbody/tr/td[1]/table/tbody/tr[${id_line_process}]/td[5]/span/span`;
      const xpath_datafim = `//html[1]/body[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[2]/td[1]/table[1]/tbody[1]/tr[3]/td[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[4]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[1]/div[1]/div[1]/div[1]/span[1]/span[1]/table[1]/tbody[1]/tr[2]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/table[1]/tbody[1]/tr[${id_line_process}]/td[6]/span[1]/span[1]`;
      const xpath_horafim = `//html/body/table/tbody/tr/td/div/table/tbody/tr/td/div/table/tbody/tr[2]/td/table/tbody/tr[3]/td/div[1]/div/table/tbody/tr/td/span/span/table/tbody/tr/td/span/span[4]/table/tbody/tr/td/span/span[1]/div/div/div/span/span/table/tbody/tr[2]/td/div/table/tbody/tr/td/div/table/tbody/tr/td[1]/table/tbody/tr[${id_line_process}]/td[7]/span/span`;

      try {
        await frame('isolatedWorkArea', 'waitForSelector', xpath_n_op, null, { timeout: 10000 });

        const nOpResult = await frame('isolatedWorkArea', 'innerText', xpath_n_op);
        const descResult = await frame('isolatedWorkArea', 'innerText', xpath_desc_op);
        const dataInicioResult = await frame('isolatedWorkArea', 'innerText', xpath_datainicio);
        const horaInicioResult = await frame('isolatedWorkArea', 'innerText', xpath_horainicio);
        const dataFimResult = await frame('isolatedWorkArea', 'innerText', xpath_datafim);
        const horaFimResult = await frame('isolatedWorkArea', 'innerText', xpath_horafim);

        n_op_ = nOpResult.result || '';
        desc_ = descResult.result || '';
        data_inicio_ = dataInicioResult.result || '';
        hora_inicio_ = horaInicioResult.result || '';
        data_fim_ = dataFimResult.result || '';
        hora_fim_ = horaFimResult.result || '';

        await frame('isolatedWorkArea', 'click', xpath_n_op);
        await screenshot(bottag);
      } catch (e) {
        log(`[Bot ${bottag}] ERROR: Erro ao obter dados da OP:`, e.message);
      }

      await wait(30000);

      // Acessar itens
      log(`[Bot ${bottag}] Acessando itens...`);
      await SaveLogBot('Acessando itens...');
      await screenshot(bottag);
      await wait(4000);

      const xpath_btn_itens = '//html[1]/body[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[2]/td[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/span[2]/span[2]';
      await frame('isolatedWorkArea', 'waitForSelector', xpath_btn_itens);

      await screenshot(bottag);
      await frame('isolatedWorkArea', 'click', xpath_btn_itens);
      await wait(20000);

      // Contar itens
      const frameContent = await frame('isolatedWorkArea', 'content');
      const html_itens = frameContent.result || '';
      const html_start = html_itens.indexOf("'ROW',");
      if (html_start > -1) {
        qtd_itens = parseInt(html_itens.substr(html_start + 9, 2).replace('}', ''));
      }

      log(`[Bot ${bottag}] Total de [${qtd_itens}] itens...`);
      await SaveLogBot(`Total de [${qtd_itens}] itens...`);

      // Verificar progresso anterior desta OP
      const progress = await getOpProgress(n_op_);
      let startFromItem = 1;

      if (progress.exists && progress.lastItem > 0) {
        startFromItem = progress.lastItem + 1;
        log(`[Bot ${bottag}] Retomando OP - último item baixado: ${progress.lastItem}, continuando do item ${startFromItem}`);
        await SaveLogBot(`Retomando do item ${startFromItem} (${progress.itensBaixados} itens já baixados)`);
      }

      await UpdateProcesso(n_op_processar, progress.lastItem || 0, qtd_itens, 'running');

      // Sincronizar oportunidade no banco de dados
      await syncOportunidade(n_op_, desc_, data_inicio_, data_fim_, qtd_itens);

      // Processar itens - começando do próximo item pendente
      // A linha na tabela = item + 1 (linha 2 = item 1, linha 3 = item 2, etc)
      // A tabela mostra 10 itens por vez (linhas 2-11)
      // Para itens > 10, precisamos rolar a lista e o item aparece na linha 11
      let id_item = startFromItem + 1;
      const itensRestantes = qtd_itens - startFromItem + 1;

      // Se retomando de item > 10, precisamos rolar até a posição correta primeiro
      if (startFromItem > 10) {
        log(`[Bot ${bottag}] Retomando do item ${startFromItem}, rolando lista...`);
        await SaveLogBot(`Rolando lista para item ${startFromItem}...`);

        // Rolar (startFromItem - 10) vezes para chegar na posição correta
        const scrollCount = startFromItem - 10;
        for (let s = 0; s < scrollCount; s++) {
          const scrollBtnId = await getScrollNextButtonId();
          if (scrollBtnId) {
            await frame('isolatedWorkArea', 'click', scrollBtnId);
            await wait(1000);
          }
        }
        // Após rolar, o item estará na linha 11 (última linha visível da tabela)
        id_item = 11;
        await wait(2000);
      }

      // Contador de itens processados com sucesso
      let itensProcessadosComSucesso = progress.itensBaixados || 0;

      if (itensRestantes <= 0) {
        log(`[Bot ${bottag}] Todos os ${qtd_itens} itens já foram baixados`);
        await SaveLogBot('Todos os itens já foram baixados');
        itensProcessadosComSucesso = qtd_itens;
      } else {
        log(`[Bot ${bottag}] Processando ${itensRestantes} itens restantes (de ${startFromItem} até ${qtd_itens})`);
        await SaveLogBot(`Processando ${itensRestantes} itens restantes`);

        for (let itemNum = startFromItem; itemNum <= qtd_itens; itemNum++) {
          // Para itens > 10, precisamos rolar e usar linha 11
          if (itemNum > 10 && itemNum > startFromItem) {
            log(`[Bot ${bottag}] Item ${itemNum} > 10, rolando lista...`);
            const scrollBtnId = await getScrollNextButtonId();
            if (scrollBtnId) {
              await frame('isolatedWorkArea', 'click', scrollBtnId);
              await wait(2000);
              // Após rolar, o item sempre estará na linha 11 (última linha visível)
              id_item = 11;
            } else {
              log(`[Bot ${bottag}] Aviso: Botão de rolagem não encontrado`);
            }
          }

          const xpath_id_item = `//html/body/table/tbody/tr/td/div/table/tbody/tr/td/div/table/tbody/tr[1]/td/table/tbody/tr/td/div/table/tbody/tr[2]/td/div/div/table/tbody/tr[3]/td/table/tbody/tr/td/div/div/div/div/div/table/tbody/tr[1]/td/div/div/table/tbody/tr[2]/td/div/div/div/div/table/tbody/tr[4]/td/table/tbody/tr/td[1]/table/tbody/tr[${id_item}]/td[2]/table/tbody/tr/td[3]/a/span`;
          // Descrição - link/span na coluna 6 (atualizado)
          const xpath_desc_item = `//html/body/table/tbody/tr/td/div/table/tbody/tr/td/div/table/tbody/tr[1]/td/table/tbody/tr/td/div/table/tbody/tr[2]/td/div/div/table/tbody/tr[3]/td/table/tbody/tr/td/div/div/div/div/div/table/tbody/tr[1]/td/div/div/table/tbody/tr[2]/td/div/div/div/div/table/tbody/tr[4]/td/table/tbody/tr/td[1]/table/tbody/tr[${id_item}]/td[6]/a/span`;
          // ID do Produto - campo input na coluna 5 (atualizado)
          const xpath_produto_id_input = `//html/body/table/tbody/tr/td/div/table/tbody/tr/td/div/table/tbody/tr[1]/td/table/tbody/tr/td/div/table/tbody/tr[2]/td/div/div/table/tbody/tr[3]/td/table/tbody/tr/td/div/div/div/div/div/table/tbody/tr[1]/td/div/div/table/tbody/tr[2]/td/div/div/div/div/table/tbody/tr[4]/td/table/tbody/tr/td[1]/table/tbody/tr[${id_item}]/td[5]/table/tbody/tr/td/input`;
          // Quantidade - campo input na coluna 8 (atualizado)
          const xpath_qtd_item = `//html/body/table/tbody/tr/td/div/table/tbody/tr/td/div/table/tbody/tr[1]/td/table/tbody/tr/td/div/table/tbody/tr[2]/td/div/div/table/tbody/tr[3]/td/table/tbody/tr/td/div/div/div/div/div/table/tbody/tr[1]/td/div/div/table/tbody/tr[2]/td/div/div/div/div/table/tbody/tr[4]/td/table/tbody/tr/td[1]/table/tbody/tr[${id_item}]/td[8]/table/tbody/tr/td/input`;
          // Unidade - campo input na coluna 9 (atualizado)
          const xpath_unidade_item = `//html/body/table/tbody/tr/td/div/table/tbody/tr/td/div/table/tbody/tr[1]/td/table/tbody/tr/td/div/table/tbody/tr[2]/td/div/div/table/tbody/tr[3]/td/table/tbody/tr/td/div/div/div/div/div/table/tbody/tr[1]/td/div/div/table/tbody/tr[2]/td/div/div/div/div/table/tbody/tr[4]/td/table/tbody/tr/td[1]/table/tbody/tr[${id_item}]/td[9]/table/tbody/tr/td/input`;
          const xpath_link_desc_item = `//html/body/table/tbody/tr/td/div/table/tbody/tr/td/div/table/tbody/tr[1]/td/table/tbody/tr/td/div/table/tbody/tr[2]/td/div/div/table/tbody/tr[3]/td/table/tbody/tr/td/div/div/div/div/div/table/tbody/tr[1]/td/div/div/table/tbody/tr[2]/td/div/div/div/div/table/tbody/tr[4]/td/table/tbody/tr/td[1]/table/tbody/tr[${id_item}]/td[6]/a`;
          // Botão Notas e Anexos
          const xpath_btn_notas_anexos = `//html/body/table/tbody/tr/td/div/table/tbody/tr/td/div/table/tbody/tr[1]/td/table/tbody/tr/td/div/table/tbody/tr[2]/td/div/div/table/tbody/tr[3]/td/table/tbody/tr/td/div/div/div/div/div/table/tbody/tr[3]/td/div/div/table/tbody/tr[2]/td/div/div/div/span/span[2]/table/tbody/tr[1]/td/table/tbody/tr/td[2]/div/div[3]/div[1]`;
          // Botão Texto do Item
          const xpath_btn_texto_item = `//html/body/table/tbody/tr/td/div/table/tbody/tr/td/div/table/tbody/tr[1]/td/table/tbody/tr/td/div/table/tbody/tr[2]/td/div/div/table/tbody/tr[3]/td/table/tbody/tr/td/div/div/div/div/div/table/tbody/tr[3]/td/div/div/table/tbody/tr[2]/td/div/div/div/span/span[2]/table/tbody/tr[3]/td/div[3]/div/div/span/span[2]/table/tbody/tr/td/div/table/tbody/tr[1]/td/div/div/table/tbody/tr[2]/td/div/div/table/tbody/tr/td/div/table/tbody/tr/td/div/table/tbody/tr/td/table/tbody/tr[4]/td[2]/a/span`;

          try {
            await frame('isolatedWorkArea', 'waitForSelector', xpath_id_item, null, { timeout: 10000 });

            const itemIdResult = await frame('isolatedWorkArea', 'innerText', xpath_id_item);
            const itemDescResult = await frame('isolatedWorkArea', 'innerText', xpath_desc_item);

            // Capturar quantidade (campo input)
            let item_qtd = '';
            try {
              const itemQtdResult = await frame('isolatedWorkArea', 'inputValue', xpath_qtd_item);
              item_qtd = itemQtdResult.result || '';
            } catch (e) {
              try {
                const itemQtdResult = await frame('isolatedWorkArea', 'innerText', xpath_qtd_item);
                item_qtd = itemQtdResult.result || '';
              } catch (e2) {
                log(`[Bot ${bottag}] Aviso: Não foi possível capturar Quantidade`);
              }
            }

            // Capturar unidade (span)
            let item_unidade = '';
            try {
              const itemUnidadeResult = await frame('isolatedWorkArea', 'inputValue', xpath_unidade_item);
              item_unidade = itemUnidadeResult.result || '';
            } catch (e) {
              log(`[Bot ${bottag}] Aviso: Não foi possível capturar Unidade`);
            }

            // Capturar ID do Produto (campo input)
            let item_produto_id = '';
            try {
              const produtoIdResult = await frame('isolatedWorkArea', 'inputValue', xpath_produto_id_input);
              item_produto_id = produtoIdResult.result || '';
            } catch (e) {
              try {
                const produtoIdResult = await frame('isolatedWorkArea', 'innerText', xpath_produto_id_input);
                item_produto_id = produtoIdResult.result || '';
              } catch (e2) {
                log(`[Bot ${bottag}] Aviso: Não foi possível capturar ID Produto`);
              }
            }

            const item_id = itemIdResult.result || '';
            const item_desc = itemDescResult.result || '';

            log(`[Bot ${bottag}] ========================================`);
            log(`[Bot ${bottag}] RESGATANDO ITEM ${item_id} de ${qtd_itens}`);
            log(`[Bot ${bottag}] ----------------------------------------`);
            log(`[Bot ${bottag}] DESCRIÇÃO:      ${item_desc.substr(0, 80)}...`);
            log(`[Bot ${bottag}] QUANTIDADE:     ${item_qtd}`);
            log(`[Bot ${bottag}] UNIDADE:        ${item_unidade}`);
            log(`[Bot ${bottag}] ID PRODUTO:     ${item_produto_id || '(vazio)'}`);
            await SaveLogBot(`Resgatando item: [${item_id}] - ${item_desc.substr(0, 100)}`);
            await UpdateProcesso(n_op_processar, parseInt(item_id), qtd_itens, 'running');

            // Clicar no link da descrição para abrir o detalhe do item
            let item_desc_completa = '';
            let item_desc_longa = '';
            let item_produto_familia = '';
            try {
              await frame('isolatedWorkArea', 'click', xpath_link_desc_item);
              await wait(5000);

              // Capturar descrição completa do item (XPath do detalhe)
              const xpath_desc_completa = '//html/body/table/tbody/tr/td/div/table/tbody/tr/td/div/table/tbody/tr[1]/td/table/tbody/tr/td/div/table/tbody/tr[2]/td/div/div/table/tbody/tr[3]/td/table/tbody/tr/td/div/div/div/div/div/table/tbody/tr[1]/td/div/div/table/tbody/tr[2]/td/div/div/div/div/table/tbody/tr[2]/td/table/tbody/tr/td/table/tbody/tr[2]/td[2]/span/span';
              const descCompletaResult = await frame('isolatedWorkArea', 'innerText', xpath_desc_completa);
              item_desc_completa = descCompletaResult.result || '';

              if (item_desc_completa) {
                log(`[Bot ${bottag}] DESC COMPLETA:  ${item_desc_completa.substr(0, 80)}...`);
              }

            } catch (notasError) {
              log(`[Bot ${bottag}] Aviso: Não foi possível capturar descrição longa: ${notasError.message}`);
            }
            
              await screenshot(bottag);
              // Capturar ID da Família do Produto via aba "Família do Produto"
              try {
                log(`[Bot ${bottag}] Acessando aba Família do Produto...`);
                const xpath_aba_familia_produto = '//html/body/table/tbody/tr/td/div/table/tbody/tr/td/div/table/tbody/tr[1]/td/table/tbody/tr/td/div/table/tbody/tr[2]/td/div/div/table/tbody/tr[3]/td/table/tbody/tr/td/div/div/div/div/div/table/tbody/tr[3]/td/div/div/table/tbody/tr[2]/td/div/div/div/span/span[2]/table/tbody/tr[1]/td/table/tbody/tr/td[2]/div/div[4]/div[1]';
                await frame('isolatedWorkArea', 'click', xpath_aba_familia_produto);
                await wait(3000);
                await screenshot(bottag);

                // Capturar o ID da Família do Produto do input
                const xpath_input_familia_produto = '//html/body/table/tbody/tr/td/div/table/tbody/tr/td/div/table/tbody/tr[1]/td/table/tbody/tr/td/div/table/tbody/tr[2]/td/div/div/table/tbody/tr[3]/td/table/tbody/tr/td/div/div/div/div/div/table/tbody/tr[3]/td/div/div/table/tbody/tr[2]/td/div/div/div/span/span[2]/table/tbody/tr[3]/td/div[4]/div/table/tbody/tr/td/div/table/tbody/tr[1]/td/table/tbody/tr[2]/td/div/table/tbody/tr[2]/td/div/div/table/tbody/tr/td[2]/span/input';
                const familiaIdResult = await frame('isolatedWorkArea', 'inputValue', xpath_input_familia_produto);

                if (familiaIdResult.result) {
                  item_produto_familia = familiaIdResult.result;
                  log(`[Bot ${bottag}] ID FAMILIA:     ${item_produto_familia}`);
                } else {
                  log(`[Bot ${bottag}] Aviso: ID Família do Produto não encontrado`);
                }

                await screenshot(bottag);
              } catch (familiaError) {
                log(`[Bot ${bottag}] Aviso: Não foi possível capturar ID Família do Produto: ${familiaError.message}`);
              }

              // Capturar Descrição Longa do Item via Notas e Anexos > Texto do Item
              try {
                log(`[Bot ${bottag}] Acessando Notas e Anexos...`);
                await frame('isolatedWorkArea', 'click', xpath_btn_notas_anexos);
                await wait(3000);
                await screenshot(bottag);

                log(`[Bot ${bottag}] Acessando Texto do Item...`);
                await frame('isolatedWorkArea', 'click', xpath_btn_texto_item);
                await wait(3000);
                await screenshot(bottag);

                // Capturar o texto do textarea no iframe URLSPW-0 (modal)
                log(`[Bot ${bottag}] Capturando descrição longa do item...`);

                // Usar o novo endpoint que acessa o iframe URLSPW e busca o textbox por role
                const descLongaResult = await pw(`/browser/${browserId}/page/${pageId}/get-urlspw-textarea`, 'POST', {
                  iframeName: 'URLSPW-0',
                  textboxName: 'Textos de Item'
                });

                if (descLongaResult.success && descLongaResult.result) {
                  item_desc_longa = descLongaResult.result;
                  log(`[Bot ${bottag}] DESC LONGA:     ${item_desc_longa.substring(0, 80)}...`);
                  log(`[Bot ${bottag}] Iframe:         ${descLongaResult.iframe}`);
                } else {
                  log(`[Bot ${bottag}] Aviso: Textarea não encontrado - ${descLongaResult.error || 'erro desconhecido'}`);
                }

                await screenshot(bottag);
                await wait(2000);

                // Fechar o modal de Texto do Item (botão X ou clicar fora)
                log(`[Bot ${bottag}] Fechando modal de Texto do Item...`);
                await frame('URLSPW-0', 'click', '//html/body/table/tbody/tr/td/div/div[1]/div/div[4]/div/table/tbody/tr/td[3]/table/tbody/tr/td/div');
                await wait(2000);
                await screenshot(bottag);


              log(`[Bot ${bottag}] ========================================`);


            } catch (detailError) {
              log(`[Bot ${bottag}] Aviso: Não foi possível obter detalhes do item: ${detailError.message}`);
            }

            // Sincronizar item no banco de dados (com descrição completa, descrição longa, produto ID e família)
            const syncResult = await syncItem(n_op_, item_id, item_desc, item_desc_longa, item_qtd, item_unidade, item_produto_id, item_produto_familia, item_desc_longa);

            if (syncResult && syncResult.success) {
              itensProcessadosComSucesso++;
              log(`[Bot ${bottag}] Item ${item_id} sincronizado com sucesso (${itensProcessadosComSucesso}/${qtd_itens})`);
            } else {
              log(`[Bot ${bottag}] AVISO: Falha ao sincronizar item ${item_id}`);
              await SaveLogBot(`AVISO: Falha ao sincronizar item ${item_id}`);
            }

            await screenshot(bottag);
          } catch (e) {
            log(`[Bot ${bottag}] Erro ao processar item ${itemNum}:`, e.message);
            await SaveLogBot(`Erro ao processar item ${itemNum}: ${e.message}`);
          }

          // Só incrementa id_item para os primeiros 10 itens
          // Para itens > 10, a posição será sempre 11 após rolar (última linha visível)
          if (itemNum < 10) {
            id_item += 1;
          }
          await wait(3000);
        }
      }

      // Verificar se TODOS os itens foram processados antes de finalizar
      log(`[Bot ${bottag}] Verificação final: ${itensProcessadosComSucesso}/${qtd_itens} itens processados`);
      await SaveLogBot(`Verificação final: ${itensProcessadosComSucesso}/${qtd_itens} itens processados`);

      if (itensProcessadosComSucesso >= qtd_itens) {
        // Finalizar OP no banco de dados - TODOS os itens foram processados
        log(`[Bot ${bottag}] Finalizando OP ${n_op_processar}...`);
        await SaveLogBot(`Finalizando OP ${n_op_processar}...`);
        await UpdateProcesso(n_op_processar, qtd_itens, qtd_itens, 'completed');
        await finishOportunidade(n_op_);

        // Marcar OP como completa no cache para evitar reprocessamento
        opStatusCache.set(n_op_processar, true);
        opStatusCache.set(n_op_, true);

        log(`[Bot ${bottag}] OP ${n_op_processar} finalizada com sucesso! Todos os ${qtd_itens} itens baixados.`);
        await SaveLogBot(`OP ${n_op_processar} finalizada com sucesso! Todos os ${qtd_itens} itens baixados.`);
      } else {
        // NÃO finalizar - ainda há itens pendentes
        const itensFaltando = qtd_itens - itensProcessadosComSucesso;
        log(`[Bot ${bottag}] OP ${n_op_processar} INCOMPLETA! Faltam ${itensFaltando} itens.`);
        await SaveLogBot(`OP ${n_op_processar} INCOMPLETA! Faltam ${itensFaltando} itens. Será reprocessada.`);
        await UpdateProcesso(n_op_processar, itensProcessadosComSucesso, qtd_itens, 'running');

        // NÃO marcar como completa no cache - permitir reprocessamento
        opStatusCache.set(n_op_processar, false);
        opStatusCache.set(n_op_, false);
      }

      // Notificar conclusão apenas se OP foi completada
      if (itensProcessadosComSucesso >= qtd_itens) {
        if (opResgate) {
          // Era uma OP específica - notificar e buscar próxima da fila
          const nextOp = await notifyOpCompleted(opResgate);
          if (nextOp) {
            log(`[Bot ${bottag}] Próxima OP da fila: ${nextOp}`);
            await SaveLogBot(`Próxima OP da fila: ${nextOp}`);
            // Atualizar opResgate para processar a próxima OP da fila
            opResgate = nextOp;
          } else {
            log(`[Bot ${bottag}] Fila vazia, operando por data`);
            await SaveLogBot('Fila vazia, operando por data');
            // Limpar opResgate para continuar no modo data
            opResgate = null;
          }
        } else {
          // Era uma OP por data - verificar se há OPs na fila antes de continuar
          log(`[Bot ${bottag}] Verificando fila de OPs específicas...`);
          await SaveLogBot('Verificando fila de OPs específicas...');
          const queueOp = await checkQueueForNextOp();
          if (queueOp) {
            log(`[Bot ${bottag}] Encontrada OP na fila: ${queueOp}`);
            await SaveLogBot(`Encontrada OP na fila: ${queueOp}`);
            // Atualizar opResgate para processar a OP da fila
            opResgate = queueOp;
          }
          // Se não há fila, opResgate continua null (modo data)
        }

        log(`[Bot ${bottag}] OP ${n_op_processar} finalizada! Buscando próxima...`);
        await SaveLogBot(`OP ${n_op_processar} finalizada! Buscando próxima...`);
      }

      // Continuar o loop para próxima OP (seja da fila ou por data)
      await wait(3000);
    } else {
      log(`[Bot ${bottag}] Nenhuma OP pendente para processar`);
      await SaveLogBot('Nenhuma OP pendente para processar');
      continuarProcessando = false;
    }

    } // Fim do while (continuarProcessando)

    // Reiniciar bot após processar todas as OPs ou quando não houver mais pendentes
    log(`[Bot ${bottag}] Ciclo completo, reiniciando...`);
    await SaveLogBot('Ciclo completo, reiniciando agente...');
    isStopping = true;
    await closeBrowser();
    process.exit(0);

  } catch (err) {
    log(`[Bot ${bottag}] ERROR: Erro no sistema:`, err.message);
    await SaveLogBot('Erro no sistema, um requisito não foi atendido - reiniciando em 10s...');
    isStopping = true;
    try {
      await closeBrowser();
    } catch (e) {
      // Browser pode já estar fechado
    }
    await delay(10000);
    process.exit(0);
  }
})();

// =============================================
// HANDLERS PARA ENCERRAMENTO GRACIOSO
// =============================================

async function gracefulShutdown(signal) {
  log(`[Bot ${bottag}] Recebido ${signal}, encerrando...`);

  if (isStopping) {
    log(`[Bot ${bottag}] Já está encerrando, ignorando...`);
    return;
  }

  isStopping = true;

  try {
    await SaveLogBot(`Bot encerrado (${signal})`);
    await closeBrowser();
    log(`[Bot ${bottag}] Browser fechado com sucesso`);
  } catch (error) {
    log(`[Bot ${bottag}] ERROR: Erro ao fechar browser:`, error.message);
  }

  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
