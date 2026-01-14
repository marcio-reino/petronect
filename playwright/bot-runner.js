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
const opResgate = config.opresgate || null;

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
    console.log(`[Bot] Comando STOP recebido via stdin`);
    if (!isStopping) {
      isStopping = true;
      try {
        // Fechar browser via Playwright Service
        if (browserId) {
          await fetch(`${PLAYWRIGHT_BASE}/browser/${browserId}/close`, { method: 'POST' });
          console.log(`[Bot] Browser fechado com sucesso`);
        }
      } catch (e) {
        console.error(`[Bot] Erro ao fechar browser:`, e.message);
      }
      process.exit(0);
    }
  }
});

// Modo headless
const HEADLESS_MODE = process.env.BOT_HEADLESS !== 'false';

// IDs do browser e página
let browserId = null;
let pageId = null;
let pageId2 = null;

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
    console.error(`[Playwright] Erro em ${endpoint}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Funções de alto nível para Playwright
async function launchBrowser() {
  const result = await pw('/browser/launch', 'POST', { headless: HEADLESS_MODE });
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

async function createPage2() {
  const result = await pw(`/browser/${browserId}/page`, 'POST', { width: 1400, height: 900 });
  if (result.success) {
    pageId2 = result.pageId;
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
    console.error('[SaveLogBot] Erro:', error.message);
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
    console.error('[UpdateProcesso] Erro:', error.message);
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
    console.error('[StopRobo] Erro:', error.message);
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
    console.error('[notifyOpCompleted] Erro:', error.message);
    return null;
  }
}

async function requestVerificationCode() {
  try {
    await fetch(`${API_BASE}/robos/${roboId}/request-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    console.log(`[Bot ${bottag}] Solicitação de código enviada ao backend`);
  } catch (error) {
    console.error('[requestVerificationCode] Erro:', error.message);
  }
}

async function waitForVerificationCode(maxWaitMs = 300000) {
  const startTime = Date.now();
  const pollInterval = 2000;

  console.log(`[Bot ${bottag}] Aguardando código de verificação (max ${maxWaitMs / 1000}s)...`);

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const response = await fetch(`${API_BASE}/robos/${roboId}/check-verification`);
      const data = await response.json();

      if (data.status === 'submitted' && data.code) {
        console.log(`[Bot ${bottag}] Código recebido: ${data.code}`);
        return data.code;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    } catch (error) {
      console.error('[waitForVerificationCode] Erro:', error.message);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  console.log(`[Bot ${bottag}] Timeout aguardando código de verificação`);
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
      console.log(`[Bot ${bottag}] OP ${numero} sincronizada no banco`);
    }
    return data;
  } catch (error) {
    console.error('[syncOportunidade] Erro:', error.message);
    return { success: false, error: error.message };
  }
}

async function syncItem(opNumero, itemNumero, descricao, quantidade, unidade) {
  try {
    const response = await fetch(`${API_BASE}/oportunidades/sync-item`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        opNumero,
        itemNumero,
        descricao,
        quantidade,
        unidade,
        bottag
      })
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[syncItem] Erro:', error.message);
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
      console.log(`[Bot ${bottag}] OP ${numero} finalizada no banco`);
    }
    return data;
  } catch (error) {
    console.error('[finishOportunidade] Erro:', error.message);
    return { success: false, error: error.message };
  }
}

async function checkOpInDatabase(opNumero) {
  try {
    // Verificar se a OP já está completa no banco (status = 1)
    const response = await fetch(`${API_BASE}/oportunidades?numero=${opNumero}&status=1&limit=1`);
    const data = await response.json();
    return data.success && data.data && data.data.length > 0;
  } catch (error) {
    console.error('[checkOpInDatabase] Erro:', error.message);
    return false;
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

// Cache de OPs já verificadas no banco
const opStatusCache = new Map();

async function checkOpStatus(n_op, id) {
  // Verificar cache primeiro
  if (opStatusCache.has(n_op)) {
    const cached = opStatusCache.get(n_op);
    if (cached) {
      return ' - Baixado - Linha: ' + id;
    }
  }

  // Verificar no banco de dados
  const isComplete = await checkOpInDatabase(n_op);
  opStatusCache.set(n_op, isComplete);

  if (!isComplete) {
    id_line_process = id;
    n_op_processar = n_op;
    return ' - Pendente - Linha: ' + id;
  } else {
    return ' - Baixado - Linha: ' + id;
  }
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// =============================================
// START BOT
// =============================================

(async () => {
  // Calcular data de pesquisa
  date_op = dateGetOp(dataOp);

  console.log(`[Bot ${bottag}] Iniciando...`);
  console.log(`[Bot ${bottag}] Login: ${login}`);
  console.log(`[Bot ${bottag}] Data OP: ${date_op} (${dataOp} dias atras)`);
  console.log(`[Bot ${bottag}] Ordem: ${statusHoraInicioOrdem === '0' ? 'Crescente' : 'Decrescente'}`);
  console.log(`[Bot ${bottag}] OP Resgate: ${opResgate || 'Nenhuma (modo data)'}`);
  console.log(`[Bot ${bottag}] Playwright Service: ${PLAYWRIGHT_BASE}`);

  // Verificar se o Playwright Service está rodando
  try {
    console.log(`[Bot ${bottag}] Tentando conectar em: ${PLAYWRIGHT_BASE}/health`);
    const healthCheck = await fetch(`${PLAYWRIGHT_BASE}/health`);
    console.log(`[Bot ${bottag}] Status HTTP: ${healthCheck.status}`);
    const health = await healthCheck.json();
    console.log(`[Bot ${bottag}] Resposta health:`, JSON.stringify(health));
    if (health.status !== 'ok') {
      throw new Error('Playwright Service não está ok');
    }
    console.log(`[Bot ${bottag}] Playwright Service OK`);
  } catch (error) {
    console.error(`[Bot ${bottag}] Playwright Service não disponível:`, error.message);
    console.error(`[Bot ${bottag}] Erro completo:`, error);
    await SaveLogBot(`Erro: Playwright Service não disponível (${PLAYWRIGHT_BASE}) - ${error.message}`);
    await delay(10000);
    process.exit(0);
  }

  try {
    // Iniciar browser
    const launchResult = await launchBrowser();
    if (!launchResult.success) {
      throw new Error(`Erro ao iniciar browser: ${launchResult.error}`);
    }
    console.log(`[Bot ${bottag}] Browser iniciado (ID: ${browserId})`);

    // Criar página principal
    const pageResult = await createPage();
    if (!pageResult.success) {
      throw new Error(`Erro ao criar página: ${pageResult.error}`);
    }
    console.log(`[Bot ${bottag}] Página criada (ID: ${pageId})`);

    // Criar segunda página para PDFs
    await createPage2();

    // Acessar Petronect
    console.log(`[Bot ${bottag}] Acessando Petronect...`);
    await SaveLogBot('Acessando Petronect...');
    await goto('https://www.petronect.com.br/irj/go/km/docs/pccshrcontent/Site%20Content%20(Legacy)/Portal2018/pt/index.html');
    await wait(2000);
    await screenshot(bottag);
    console.log(`[Bot ${bottag}] Página inicial carregada - screenshot salva`);
    await SaveLogBot('Página inicial carregada');

    await click('//html/body/div/div[1]/div[2]/div/div[3]/a');
    await wait(1000);
    await screenshot(bottag);
    console.log(`[Bot ${bottag}] Tela de login - screenshot salva`);

    await fill('#inputUser', login);
    await fill('#inputSenha', senha);
    await press('Enter');

    console.log(`[Bot ${bottag}] Efetuando login...`);
    await SaveLogBot('Efetuando login...');
    await wait(10000);
    await screenshot(bottag);

    // Verificar solicitação de código por e-mail
    const isCodeVisible = await isVisible('text=Confirme sua identidade');
    if (isCodeVisible) {
      console.log(`[Bot ${bottag}] Código de verificação solicitado`);
      await SaveLogBot('Código de verificação solicitado. Aguardando usuário...');
      await screenshot(bottag);
      await wait(2000);

      // Clicar no botão para enviar código por email
      await click('//html/body/div[1]/div[2]/div/div/div[2]/div[3]/form/button[2]');
      await wait(3000);
      await screenshot(bottag);

      // Solicitar código ao usuário via API
      await requestVerificationCode();

      // Aguardar código do usuário (máximo 1 minuto)
      const verificationCode = await waitForVerificationCode(60000);

      if (verificationCode) {
        console.log(`[Bot ${bottag}] Inserindo código de verificação...`);
        await SaveLogBot('Inserindo código de verificação...');

        // Localizar input do código e inserir
        const codeCount = await count('input[type="text"], input[type="number"], input[name*="code"], input[id*="code"]');
        if (codeCount > 0) {
          await locatorFill('input[type="text"], input[type="number"], input[name*="code"], input[id*="code"]', verificationCode.trim());
          await wait(1000);

          // Clicar no botão de confirmar
          const confirmCount = await count('button[type="submit"], button:has-text("Confirmar"), button:has-text("Enviar"), button:has-text("Validar")');
          if (confirmCount > 0) {
            await locatorClick('button[type="submit"], button:has-text("Confirmar"), button:has-text("Enviar"), button:has-text("Validar")');
          } else {
            await press('Enter');
          }

          await wait(5000);
          await screenshot(bottag);
          await SaveLogBot('Código de verificação enviado!');
        } else {
          console.log(`[Bot ${bottag}] Campo de código não encontrado`);
          await SaveLogBot('Erro: Campo de código não encontrado');
        }
      } else {
        console.log(`[Bot ${bottag}] Timeout - código não recebido`);
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

    // Acessar Cotações
    await click('#tabIcon1');
    console.log(`[Bot ${bottag}] Acessando cotações...`);
    await SaveLogBot('Acessando cotações...');
    await wait(5000);
    await screenshot(bottag);

    // Desbloqueio de sessão
    console.log(`[Bot ${bottag}] Desbloqueio de sessão...`);
    await SaveLogBot('Desbloqueio de sessão...');
    await click('#subTabIndex2');
    await wait(5000);

    const xpath_btn_unlocksession = '//html[1]/body[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/div[1]/span[1]/span[2]/div[1]/div[1]/table[1]/tbody[1]/tr[3]/td[1]/div[1]';
    await frame('isolatedWorkArea', 'click', xpath_btn_unlocksession);
    await wait(5000);
    await mouseClick(863, 520);
    await SaveLogBot('Desbloqueio realizado...');
    await wait(5000);

    // Formulário de pesquisa
    console.log(`[Bot ${bottag}] Acessando formulário de pesquisa...`);
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
      console.log(`[Bot ${bottag}] Pesquisando OP específica: ${opResgate}`);
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
      console.log(`[Bot ${bottag}] Pesquisando por data: ${date_op}`);
      await SaveLogBot(`Pesquisando por data: ${date_op}`);
      await frame('isolatedWorkArea', 'fill', xpath_input_date, date_op);
      await wait(2000);
      await frame('isolatedWorkArea', 'click', xpath_btn_buscar);
    }

    console.log(`[Bot ${bottag}] Pesquisando...`);
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
        console.log(`[Bot ${bottag}] Ordenando hora início para crescente...`);
        await SaveLogBot('Ordenando hora início para crescente...');
      }
    }

    // Verificar total de OPs
    const xpath_qtd_ops = '//html[1]/body[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[2]/td[1]/table[1]/tbody[1]/tr[1]/td[1]/table[1]/tbody[1]/tr[1]/td[2]/div[1]/div[1]/div[1]';

    await frame('isolatedWorkArea', 'waitForSelector', xpath_qtd_ops);
    let qtdResult = await frame('isolatedWorkArea', 'innerText', xpath_qtd_ops);
    qtd_ops = qtdResult.result || '';

    if (qtd_ops.indexOf('[Opera') > -1) {
      console.log(`[Bot ${bottag}] Aguardando +60 segundos...`);
      await wait(60000);
      await screenshot(bottag);
      qtdResult = await frame('isolatedWorkArea', 'innerText', xpath_qtd_ops);
      qtd_ops = qtdResult.result || '';
    }

    qtd_ops = qtd_ops.replace('Minhas Participações (', '').replace(')', '');
    await wait(5000);
    console.log(`[Bot ${bottag}] Total de [${qtd_ops}] oportunidades...`);
    await SaveLogBot(`Total de [${qtd_ops}] oportunidades...`);
    await UpdateProcesso(opResgate || 'DATA', 0, parseInt(qtd_ops), 'running');

    // Se pesquisa por data, verificar lista de OPs
    if (!opResgate) {
      const dez_ops = Math.min(10, parseInt(qtd_ops));
      let id_line = 1;

      for (let i = 0; i < dez_ops; i++) {
        id_line += 1;
        const xpath_n_op = `//html[1]/body[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[2]/td[1]/table[1]/tbody[1]/tr[3]/td[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[4]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[1]/div[1]/div[1]/div[1]/span[1]/span[1]/table[1]/tbody[1]/tr[2]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/table[1]/tbody[1]/tr[${id_line}]/td[2]/a[1]/span[1]`;

        try {
          await frame('isolatedWorkArea', 'waitForSelector', xpath_n_op, null, { timeout: 5000 });
          const nOpResult = await frame('isolatedWorkArea', 'innerText', xpath_n_op);
          const n_op = nOpResult.result || '';

          const status = await checkOpStatus(n_op, id_line);
          console.log(`[Bot ${bottag}] OP: ${n_op}${status}`);
          await SaveLogBot(`OP: ${n_op}${status}`);
        } catch (e) {
          break;
        }
        await wait(1000);
      }
    }

    // Se há OP para processar
    if (id_line_process && n_op_processar) {
      console.log(`[Bot ${bottag}] Processando OP: ${n_op_processar} Linha: ${id_line_process}`);
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
        console.error(`[Bot ${bottag}] Erro ao obter dados da OP:`, e.message);
      }

      await wait(30000);

      // Acessar itens
      console.log(`[Bot ${bottag}] Acessando itens...`);
      await SaveLogBot('Acessando itens...');
      await screenshot(bottag);
      await wait(4000);

      const xpath_btn_itens = '//html[1]/body[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[2]/td[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/span[2]/span[2]';
      await frame('isolatedWorkArea', 'waitForSelector', xpath_btn_itens);

      // Baixar PDF
      const xpath_btn_oppdf = '//html/body/table/tbody/tr/td/div/table/tbody/tr/td/div/table/tbody/tr[1]/td/table/tbody/tr/td/div/table/tbody/tr[1]/td/div/div[2]/div/div/div[1]/span[5]/div';
      await frame('isolatedWorkArea', 'click', xpath_btn_oppdf);
      await wait(20000);

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

      console.log(`[Bot ${bottag}] Total de [${qtd_itens}] itens...`);
      await SaveLogBot(`Total de [${qtd_itens}] itens...`);
      await UpdateProcesso(n_op_processar, 0, qtd_itens, 'running');

      // Sincronizar oportunidade no banco de dados
      await syncOportunidade(n_op_, desc_, data_inicio_, data_fim_, qtd_itens);

      // Processar itens
      let id_item = 2;
      const dez_itens = Math.min(10, qtd_itens);

      for (let i = 0; i < dez_itens; i++) {
        const xpath_id_item = `//html/body/table/tbody/tr/td/div/table/tbody/tr/td/div/table/tbody/tr[1]/td/table/tbody/tr/td/div/table/tbody/tr[2]/td/div/div/table/tbody/tr[3]/td/table/tbody/tr/td/div/div/div/div/div/table/tbody/tr[1]/td/div/div/table/tbody/tr[2]/td/div/div/div/div/table/tbody/tr[4]/td/table/tbody/tr/td[1]/table/tbody/tr[${id_item}]/td[2]/table/tbody/tr/td[3]/a/span`;
        const xpath_desc_item = `//html/body/table/tbody/tr/td/div/table/tbody/tr/td/div/table/tbody/tr[1]/td/table/tbody/tr/td/div/table/tbody/tr[2]/td/div/div/table/tbody/tr[3]/td/table/tbody/tr/td/div/div/div/div/div/table/tbody/tr[1]/td/div/div/table/tbody/tr[2]/td/div/div/div/div/table/tbody/tr[4]/td/table/tbody/tr/td[1]/table/tbody/tr[${id_item}]/td[6]/a/span`;
        const xpath_qtd_item = `//html/body/table/tbody/tr/td/div/table/tbody/tr/td/div/table/tbody/tr[1]/td/table/tbody/tr/td/div/table/tbody/tr[2]/td/div/div/table/tbody/tr[3]/td/table/tbody/tr/td/div/div/div/div/div/table/tbody/tr[1]/td/div/div/table/tbody/tr[2]/td/div/div/div/div/table/tbody/tr[4]/td/table/tbody/tr/td[1]/table/tbody/tr[${id_item}]/td[4]/span/span`;
        const xpath_unidade_item = `//html/body/table/tbody/tr/td/div/table/tbody/tr/td/div/table/tbody/tr[1]/td/table/tbody/tr/td/div/table/tbody/tr[2]/td/div/div/table/tbody/tr[3]/td/table/tbody/tr/td/div/div/div/div/div/table/tbody/tr[1]/td/div/div/table/tbody/tr[2]/td/div/div/div/div/table/tbody/tr[4]/td/table/tbody/tr/td[1]/table/tbody/tr[${id_item}]/td[5]/span/span`;

        try {
          await frame('isolatedWorkArea', 'waitForSelector', xpath_id_item, null, { timeout: 10000 });

          const itemIdResult = await frame('isolatedWorkArea', 'innerText', xpath_id_item);
          const itemDescResult = await frame('isolatedWorkArea', 'innerText', xpath_desc_item);
          const itemQtdResult = await frame('isolatedWorkArea', 'innerText', xpath_qtd_item);
          const itemUnidadeResult = await frame('isolatedWorkArea', 'innerText', xpath_unidade_item);

          const item_id = itemIdResult.result || '';
          const item_desc = itemDescResult.result || '';
          const item_qtd = itemQtdResult.result || '';
          const item_unidade = itemUnidadeResult.result || '';

          console.log(`[Bot ${bottag}] Resgatando item: [${item_id} de ${qtd_itens}] - ${item_desc.substr(0, 50)}...`);
          await SaveLogBot(`Resgatando item: [${item_id}] - ${item_desc.substr(0, 100)}`);
          await UpdateProcesso(n_op_processar, parseInt(item_id), qtd_itens, 'running');

          // Sincronizar item no banco de dados
          await syncItem(n_op_, item_id, item_desc, item_qtd, item_unidade);

          await screenshot(bottag);
        } catch (e) {
          console.log(`[Bot ${bottag}] Erro ao processar item ${i + 1}:`, e.message);
        }

        id_item += 1;
        await wait(3000);
      }

      // Finalizar OP no banco de dados
      console.log(`[Bot ${bottag}] Finalizando OP ${n_op_processar}...`);
      await SaveLogBot(`Finalizando OP ${n_op_processar}...`);
      await UpdateProcesso(n_op_processar, qtd_itens, qtd_itens, 'completed');
      await finishOportunidade(n_op_);

      // Notificar conclusão
      if (opResgate) {
        const nextOp = await notifyOpCompleted(opResgate);
        if (nextOp) {
          console.log(`[Bot ${bottag}] Próxima OP da fila: ${nextOp}`);
          await SaveLogBot(`Próxima OP da fila: ${nextOp}`);
        } else {
          console.log(`[Bot ${bottag}] Fila vazia, operando por data`);
          await SaveLogBot('Fila vazia, operando por data');
        }
      }

      console.log(`[Bot ${bottag}] Fim do processamento!`);
      await SaveLogBot('Fim do processamento!');
    } else {
      console.log(`[Bot ${bottag}] Nenhuma OP pendente para processar`);
      await SaveLogBot('Nenhuma OP pendente para processar');
    }

    // Reiniciar bot
    console.log(`[Bot ${bottag}] Reiniciando...`);
    await SaveLogBot('Reiniciando bot...');
    isStopping = true;
    await closeBrowser();
    process.exit(0);

  } catch (err) {
    console.error(`[Bot ${bottag}] Erro no sistema:`, err.message);
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
  console.log(`\n[Bot ${bottag}] Recebido ${signal}, encerrando...`);

  if (isStopping) {
    console.log(`[Bot ${bottag}] Já está encerrando, ignorando...`);
    return;
  }

  isStopping = true;

  try {
    await SaveLogBot(`Bot encerrado (${signal})`);
    await closeBrowser();
    console.log(`[Bot ${bottag}] Browser fechado com sucesso`);
  } catch (error) {
    console.error(`[Bot ${bottag}] Erro ao fechar browser:`, error.message);
  }

  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
