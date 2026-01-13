/**
 * Bot Runner - Playwright Bot para Petronect
 *
 * Recebe parametros via linha de comando e se comunica com o backend via API
 *
 * Uso: node bot-runner.js --roboId 1 --login USER --senha PASS --data 1 --bottag OP_01 --ordem 0 [--opresgate 7004192456]
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

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

// URL base do backend
const API_BASE = process.env.API_BASE || 'http://localhost:5000/api';

// Flag para evitar múltiplas chamadas de stop
let isStopping = false;

// Modo headless (true = sem interface gráfica, false = com interface gráfica)
// BOT_HEADLESS=true para produção, BOT_HEADLESS=false para desenvolvimento/debug
const HEADLESS_MODE = process.env.BOT_HEADLESS === 'true';

// Diretorio de screenshots
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

// Variaveis globais
let n_ = '\r\n';
let n_op_ = '';
let desc_ = '';
let data_inicio_ = '';
let hora_inicio_ = '';
let data_fim_ = '';
let hora_fim_ = '';
let opportunity_type_ = '';
let qtd_ops = 0;
let qtd_itens = 0;
let n_op_processar = '';
let id_line_process = '';
let date_op = '';
let mes_pasta = '';
let dia_pasta = '';

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

// Atualizar status do robô no banco de dados (0 = parado)
async function StopRobo() {
  try {
    // Buscar token de admin ou usar endpoint interno
    // Por simplicidade, vamos usar o endpoint de processo com status idle
    // que já deve ser interpretado como parado
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

// Solicitar código de verificação ao usuário via backend
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

// Notificar o backend para parar o agente (quando browser fecha)
async function notifyBrowserClosed() {
  if (isStopping) return;
  isStopping = true;

  console.log(`[Bot ${bottag}] Browser fechado - notificando backend para parar agente...`);
  await SaveLogBot('Browser fechado - parando agente...');
  await StopRobo();

  // Encerrar processo
  process.exit(0);
}

// Aguardar código de verificação do usuário (polling)
async function waitForVerificationCode(maxWaitMs = 300000) {
  const startTime = Date.now();
  const pollInterval = 2000; // Verificar a cada 2 segundos

  console.log(`[Bot ${bottag}] Aguardando código de verificação (max ${maxWaitMs / 1000}s)...`);

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const response = await fetch(`${API_BASE}/robos/${roboId}/check-verification`);
      const data = await response.json();

      if (data.status === 'submitted' && data.code) {
        console.log(`[Bot ${bottag}] Código recebido: ${data.code}`);
        return data.code;
      }

      // Aguardar antes de próxima verificação
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

function getDayMonthPath(data) {
  mes_pasta = data.substr(3, 10).replace('.', '-');
  dia_pasta = data.replace('.', '-').replace('.', '-');
}

function getHora() {
  const data = new Date();
  const hora = data.getHours();
  const min = data.getMinutes();
  const seg = data.getSeconds();
  return hora + ':' + min + ':' + seg;
}

function zeroFill(zero, val) {
  return ('000000' + val).slice(-zero);
}

function checkFileOP(n_op, id, data) {
  getDayMonthPath(data);
  const url_file = path.join(__dirname, '../../oportunidades', mes_pasta, dia_pasta, n_op + '.txt');
  if (!fs.existsSync(url_file)) {
    id_line_process = id;
    n_op_processar = n_op;
    return ' - Pendente - Linha: ' + id;
  } else {
    return ' - Baixado - Linha: ' + id;
  }
}

async function ScreenShot(page, tag) {
  try {
    const screenshotPath = path.join(SCREENSHOTS_DIR, `${tag}.png`);
    await page.screenshot({ path: screenshotPath });
  } catch (error) {
    console.error('[ScreenShot] Erro:', error.message);
  }
}

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

  let browser;
  let context;
  let page;

  try {
    browser = await chromium.launch({ headless: HEADLESS_MODE });
  } catch (err) {
    console.error(`[Bot ${bottag}] Erro ao iniciar browser:`, err.message);
    await SaveLogBot('Erro ao iniciar browser - reiniciando em 10s...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    process.exit(0); // exit 0 para reiniciar
  }

  // Detectar quando o browser fecha (usuário fechou manualmente ou erro)
  browser.on('disconnected', () => {
    notifyBrowserClosed();
  });

  try {
    context = await browser.newContext();
    page = await context.newPage();
  } catch (err) {
    console.error(`[Bot ${bottag}] Erro ao criar contexto do browser:`, err.message);
    await SaveLogBot('Erro ao criar contexto do browser - reiniciando em 10s...');
    isStopping = true;
    await browser.close();
    await new Promise(resolve => setTimeout(resolve, 10000));
    process.exit(0); // exit 0 para reiniciar
  }
  await page.setDefaultTimeout(60000);
  await page.setViewportSize({ width: 1400, height: 900 });

  const pageWebBot = await context.newPage();
  await pageWebBot.setViewportSize({ width: 1400, height: 900 });

  try {
    // Acessar Petronect
    await page.goto('https://www.petronect.com.br/irj/go/km/docs/pccshrcontent/Site%20Content%20(Legacy)/Portal2018/pt/index.html');
    await page.click('//html/body/div/div[1]/div[2]/div/div[3]/a');
    await page.fill('#inputUser', login);
    await page.fill('#inputSenha', senha);
    await page.press('body', 'Enter');

    console.log(`[Bot ${bottag}] Efetuando login...`);
    await SaveLogBot('Efetuando login...');
    await page.waitForTimeout(10000);
    await ScreenShot(page, bottag);

    // Verificar solicitacao de codigo por e-mail
    const isTextVisible = await page.isVisible('text=Confirme sua identidade');
    if (isTextVisible) {
      console.log(`[Bot ${bottag}] Codigo de verificacao solicitado`);
      await SaveLogBot('Código de verificação solicitado. Aguardando usuário...');
      await ScreenShot(page, bottag);
      await page.waitForTimeout(2000);

      // Clicar no botão para enviar código por email
      await page.click('//html/body/div[1]/div[2]/div/div/div[2]/div[3]/form/button[2]');
      await page.waitForTimeout(3000);
      await ScreenShot(page, bottag);

      // Solicitar código ao usuário via API
      await requestVerificationCode();

      // Aguardar código do usuário (máximo 1 minuto)
      const verificationCode = await waitForVerificationCode(60000);

      if (verificationCode) {
        // Inserir código no campo
        console.log(`[Bot ${bottag}] Inserindo código de verificação...`);
        await SaveLogBot('Inserindo código de verificação...');

        // Localizar input do código e inserir
        const codeInput = await page.locator('input[type="text"], input[type="number"], input[name*="code"], input[id*="code"]').first();
        if (await codeInput.count() > 0) {
          await codeInput.fill(verificationCode);
          await page.waitForTimeout(1000);

          // Clicar no botão de confirmar
          const confirmBtn = await page.locator('button[type="submit"], button:has-text("Confirmar"), button:has-text("Enviar"), button:has-text("Validar")').first();
          if (await confirmBtn.count() > 0) {
            await confirmBtn.click();
          } else {
            await page.press('body', 'Enter');
          }

          await page.waitForTimeout(5000);
          await ScreenShot(page, bottag);
          await SaveLogBot('Código de verificação enviado!');
        } else {
          console.log(`[Bot ${bottag}] Campo de código não encontrado`);
          await SaveLogBot('Erro: Campo de código não encontrado');
        }
      } else {
        console.log(`[Bot ${bottag}] Timeout - código não recebido`);
        await SaveLogBot('Erro: Timeout aguardando código de verificação - reiniciando em 10s...');
        isStopping = true; // Evitar que o evento disconnected dispare
        await browser.close();
        await new Promise(resolve => setTimeout(resolve, 10000));
        process.exit(0); // exit 0 para reiniciar
      }
    }

    await page.waitForTimeout(8000);

    // Verificar manutencao de usuario
    const url = page.url();
    if (url.indexOf('ypuser_maintenance?origem=2') > -1) {
      await page.mouse.click(775, 555);
      await page.waitForTimeout(5000);
    }

    await page.waitForTimeout(5000);
    await ScreenShot(page, bottag);

    // Acessar Cotacoes
    const tabIcon1 = await page.locator('#tabIcon1');
    await tabIcon1.click();
    console.log(`[Bot ${bottag}] Acessando cotacoes...`);
    await SaveLogBot('Acessando cotacoes...');
    await page.waitForTimeout(5000);
    await ScreenShot(page, bottag);

    // Desbloqueio de sessao
    console.log(`[Bot ${bottag}] Desbloqueio de sessao...`);
    await SaveLogBot('Desbloqueio de sessao...');
    await page.click('#subTabIndex2');
    await page.waitForTimeout(5000);

    const xpath_btn_unlocksession = '//html[1]/body[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/div[1]/span[1]/span[2]/div[1]/div[1]/table[1]/tbody[1]/tr[3]/td[1]/div[1]';
    const isolatedWorkArea = await page.frame({ name: 'isolatedWorkArea' });
    await isolatedWorkArea.click(xpath_btn_unlocksession);
    await page.waitForTimeout(5000);
    await page.mouse.click(863, 520);
    await SaveLogBot('Desbloqueio realizado...');
    await page.waitForTimeout(5000);

    // Formulario de pesquisa
    console.log(`[Bot ${bottag}] Acessando formulario de pesquisa...`);
    await SaveLogBot('Acessando formulario de pesquisa...');
    await page.click('#subTabIndex1');
    await page.waitForTimeout(20000);
    await ScreenShot(page, bottag);

    // XPaths do formulario
    const xpath_input_op = '//html[1]/body[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[2]/td[1]/table[1]/tbody[1]/tr[3]/td[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[2]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/div[1]/div[2]/span[1]/span[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[3]/span[1]/input[1]';
    const xpath_btn_opstatus = '//html[1]/body[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[2]/td[1]/table[1]/tbody[1]/tr[3]/td[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[2]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/div[1]/div[2]/span[1]/span[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[11]/td[3]/span[1]/span[1]';
    const xpath_input_date = '//html[1]/body[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[2]/td[1]/table[1]/tbody[1]/tr[3]/td[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[2]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/div[1]/div[2]/span[1]/span[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[5]/td[3]/span[1]/input[1]';
    const xpath_btn_buscar = '//html/body/table/tbody/tr/td/div/table/tbody/tr/td/div/table/tbody/tr[2]/td/table/tbody/tr[3]/td/div[1]/div/table/tbody/tr/td/span/span/table/tbody/tr/td/span/span[2]/table/tbody/tr/td/div/table/tbody/tr/td/div/table/tbody/tr[2]/td/div/span[1]/div';

    const page2 = await page.frame({ name: 'isolatedWorkArea' });

    // Determinar tipo de pesquisa
    if (opResgate) {
      // Pesquisa por numero da OP
      console.log(`[Bot ${bottag}] Pesquisando OP especifica: ${opResgate}`);
      await SaveLogBot(`Pesquisando OP especifica: ${opResgate}`);
      await page.waitForTimeout(2000);
      await page2.click(xpath_btn_opstatus);
      await page.press('body', 'PageUp');
      await page.waitForTimeout(1000);
      await page.press('body', 'PageUp');
      await page.waitForTimeout(2000);
      await page2.fill(xpath_input_op, opResgate);
      await page2.click(xpath_btn_buscar);
      n_op_processar = opResgate;
      id_line_process = 2;
    } else {
      // Pesquisa por data
      console.log(`[Bot ${bottag}] Pesquisando por data: ${date_op}`);
      await SaveLogBot(`Pesquisando por data: ${date_op}`);
      await page2.fill(xpath_input_date, date_op);
      await page.waitForTimeout(2000);
      await page2.click(xpath_btn_buscar);
    }

    console.log(`[Bot ${bottag}] Pesquisando...`);
    await SaveLogBot('Pesquisando...');
    await page.waitForTimeout(30000);
    await ScreenShot(page, bottag);

    // Ordenacao por hora inicio (se modo data e ordem crescente)
    if (statusHoraInicioOrdem === '0' && !opResgate) {
      const html = await page2.content();
      const posicaoInicial = html.indexOf('Hora In');
      const idBotao = html.substr(posicaoInicial - 64, 4);
      await page2.click('#' + idBotao);
      await page.waitForTimeout(4000);
      await page2.click(':nth-match(:text("Ordenar em ordem crescente"), 1)');
      await page.waitForTimeout(10000);
      await ScreenShot(page, bottag);
      console.log(`[Bot ${bottag}] Ordenando hora inicio para crescente...`);
      await SaveLogBot('Ordenando hora inicio para crescente...');
    }

    // Verificar total de OPs
    const xpath_qtd_ops = '//html[1]/body[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[2]/td[1]/table[1]/tbody[1]/tr[1]/td[1]/table[1]/tbody[1]/tr[1]/td[2]/div[1]/div[1]/div[1]';
    await page2.waitForSelector(xpath_qtd_ops);
    let qtdElement = await page2.$(xpath_qtd_ops);
    qtd_ops = await qtdElement.innerText();

    if (qtd_ops.indexOf('[Opera') > -1) {
      console.log(`[Bot ${bottag}] Aguardando +60 segundos...`);
      await page.waitForTimeout(60000);
      await ScreenShot(page, bottag);
      qtdElement = await page2.$(xpath_qtd_ops);
      qtd_ops = await qtdElement.innerText();
    }

    qtd_ops = qtd_ops.replace('Minhas Participações (', '').replace(')', '');
    await page.waitForTimeout(5000);
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
        const xpath_datainicio = `//html[1]/body[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[2]/td[1]/table[1]/tbody[1]/tr[3]/td[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[4]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[1]/div[1]/div[1]/div[1]/span[1]/span[1]/table[1]/tbody[1]/tr[2]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/table[1]/tbody[1]/tr[${id_line}]/td[4]/span[1]/span[1]`;

        try {
          await page2.waitForSelector(xpath_n_op, { timeout: 5000 });
          const nOpEl = await page2.$(xpath_n_op);
          const dataInicioEl = await page2.$(xpath_datainicio);
          const n_op = await nOpEl.innerText();
          const data_inicio = await dataInicioEl.innerText();

          const status = checkFileOP(n_op, id_line, data_inicio);
          console.log(`[Bot ${bottag}] OP: ${n_op}${status}`);
          await SaveLogBot(`OP: ${n_op}${status}`);
        } catch (e) {
          break;
        }
        await page.waitForTimeout(1000);
      }
    }

    // Se ha OP para processar
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
        await page2.waitForSelector(xpath_n_op, { timeout: 10000 });
        const nOpEl = await page2.$(xpath_n_op);
        const descEl = await page2.$(xpath_desc_op);
        const dataInicioEl = await page2.$(xpath_datainicio);
        const horaInicioEl = await page2.$(xpath_horainicio);
        const dataFimEl = await page2.$(xpath_datafim);
        const horaFimEl = await page2.$(xpath_horafim);

        n_op_ = await nOpEl.innerText();
        desc_ = await descEl.innerText();
        data_inicio_ = await dataInicioEl.innerText();
        hora_inicio_ = await horaInicioEl.innerText();
        data_fim_ = await dataFimEl.innerText();
        hora_fim_ = await horaFimEl.innerText();

        await page2.click(xpath_n_op);
        await ScreenShot(page, bottag);
      } catch (e) {
        console.error(`[Bot ${bottag}] Erro ao obter dados da OP:`, e.message);
      }

      await page.waitForTimeout(30000);

      // Acessar itens
      const page3 = await page.frame({ name: 'isolatedWorkArea' });
      console.log(`[Bot ${bottag}] Acessando itens...`);
      await SaveLogBot('Acessando itens...');
      await ScreenShot(page, bottag);
      await page.waitForTimeout(4000);

      const xpath_btn_itens = '//html[1]/body[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[2]/td[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/span[2]/span[2]';
      await page3.waitForSelector(xpath_btn_itens);

      // Baixar PDF da oportunidade
      const xpath_btn_oppdf = '//html/body/table/tbody/tr/td/div/table/tbody/tr/td/div/table/tbody/tr[1]/td/table/tbody/tr/td/div/table/tbody/tr[1]/td/div/div[2]/div/div/div[1]/span[5]/div';
      await page3.click(xpath_btn_oppdf);
      await page.waitForTimeout(20000);

      const pages = context.pages();
      const pageWebBotPdf = pages[2];
      const pdfUrl = pageWebBotPdf.url();
      await page.waitForTimeout(2000);
      await pageWebBot.goto(pdfUrl);
      await page.waitForTimeout(4000);

      const pdfPath = path.join(__dirname, `${bottag}.pdf`);
      pageWebBot.on('download', async (download) => {
        await download.saveAs(pdfPath);
        console.log(`[Bot ${bottag}] Download de oportunidade concluido!`);
      });
      await pageWebBot.click('//html/body/table/tbody/tr/td/div/div[1]/div/table/tbody/tr[3]/td/div/div/table/tbody/tr/td[2]/div');
      await page.waitForTimeout(5000);

      let textPdf;
      try {
        textPdf = fs.readFileSync(pdfPath);
      } catch (e) {
        console.log(`[Bot ${bottag}] PDF nao disponivel`);
      }

      await ScreenShot(page, bottag);
      await page3.click(xpath_btn_itens);
      await page.waitForTimeout(20000);

      const page4 = await page.frame({ name: 'isolatedWorkArea' });

      // Contar itens
      const html_itens = await page4.content();
      const html_start = html_itens.indexOf("'ROW',");
      qtd_itens = parseInt(html_itens.substr(html_start + 9, 2).replace('}', ''));
      console.log(`[Bot ${bottag}] Total de [${qtd_itens}] itens...`);
      await SaveLogBot(`Total de [${qtd_itens}] itens...`);
      await UpdateProcesso(n_op_processar, 0, qtd_itens, 'running');

      // Processar itens
      let id_item = 2;
      const dez_itens = Math.min(10, qtd_itens);

      for (let i = 0; i < dez_itens; i++) {
        const itemNum = i + 1;
        const xpath_id_item = `//html/body/table/tbody/tr/td/div/table/tbody/tr/td/div/table/tbody/tr[1]/td/table/tbody/tr/td/div/table/tbody/tr[2]/td/div/div/table/tbody/tr[3]/td/table/tbody/tr/td/div/div/div/div/div/table/tbody/tr[1]/td/div/div/table/tbody/tr[2]/td/div/div/div/div/table/tbody/tr[4]/td/table/tbody/tr/td[1]/table/tbody/tr[${id_item}]/td[2]/table/tbody/tr/td[3]/a/span`;
        const xpath_desc_item = `//html/body/table/tbody/tr/td/div/table/tbody/tr/td/div/table/tbody/tr[1]/td/table/tbody/tr/td/div/table/tbody/tr[2]/td/div/div/table/tbody/tr[3]/td/table/tbody/tr/td/div/div/div/div/div/table/tbody/tr[1]/td/div/div/table/tbody/tr[2]/td/div/div/div/div/table/tbody/tr[4]/td/table/tbody/tr/td[1]/table/tbody/tr[${id_item}]/td[6]/a/span`;

        try {
          if (await page4.locator(xpath_id_item).count() > 0) {
            await page4.waitForSelector(xpath_id_item, { timeout: 10000 });
            const itemIdEl = await page4.$(xpath_id_item);
            const itemDescEl = await page4.$(xpath_desc_item);

            const item_id = await itemIdEl.innerText();
            const item_desc = await itemDescEl.innerText();

            console.log(`[Bot ${bottag}] Resgatando item: [${item_id} de ${qtd_itens}] - ${item_desc.substr(0, 50)}...`);
            await SaveLogBot(`Resgatando item: [${item_id}] - ${item_desc.substr(0, 100)}`);
            await UpdateProcesso(n_op_processar, parseInt(item_id), qtd_itens, 'running');
            await ScreenShot(page, bottag);
          }
        } catch (e) {
          console.log(`[Bot ${bottag}] Erro ao processar item ${itemNum}:`, e.message);
        }

        id_item += 1;
        await page.waitForTimeout(3000);
      }

      // Finalizar OP
      console.log(`[Bot ${bottag}] Finalizando OP ${n_op_processar}...`);
      await SaveLogBot(`Finalizando OP ${n_op_processar}...`);
      await UpdateProcesso(n_op_processar, qtd_itens, qtd_itens, 'completed');

      // Salvar arquivo da OP
      getDayMonthPath(data_inicio_);
      const url_ = path.join(__dirname, '../../oportunidades', mes_pasta, dia_pasta);
      const url_op = path.join(url_, n_op_ + '.txt');

      if (!fs.existsSync(url_)) {
        fs.mkdirSync(url_, { recursive: true });
      }

      let opContent = '#####################################################################################\r\n';
      opContent += 'OPORTUNIDADE N:    ' + n_op_ + '\r\n';
      opContent += 'DESCRICAO:         ' + desc_ + '\r\n';
      opContent += 'DATA INICIO:       ' + data_inicio_ + ' ' + hora_inicio_ + '\r\n';
      opContent += 'DATA FIM:          ' + data_fim_ + ' ' + hora_fim_ + '\r\n';
      opContent += '#####################################################################################\r\n';
      opContent += 'PROCESSADO EM:     ' + dateGetOp(0) + ' - ' + getHora() + ' - ' + bottag + '\r\n';
      opContent += '######################################## FIM ########################################\r\n';

      fs.writeFileSync(url_op, opContent);

      // Notificar conclusao (se era OP especifica)
      if (opResgate) {
        const nextOp = await notifyOpCompleted(opResgate);
        if (nextOp) {
          console.log(`[Bot ${bottag}] Proxima OP da fila: ${nextOp}`);
          await SaveLogBot(`Proxima OP da fila: ${nextOp}`);
          // Aqui poderia reiniciar o bot com a proxima OP
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
    isStopping = true; // Evitar que o evento disconnected dispare
    await browser.close();
    process.exit(0);

  } catch (err) {
    console.error(`[Bot ${bottag}] Erro no sistema:`, err.message);
    await SaveLogBot('Erro no sistema, um requisito não foi atendido - reiniciando em 10s...');
    isStopping = true; // Evitar que o evento disconnected dispare
    try {
      await browser.close();
    } catch (e) {
      // Browser pode já estar fechado
    }
    await new Promise(resolve => setTimeout(resolve, 10000));
    process.exit(0); // exit 0 para reiniciar
  }
})();
