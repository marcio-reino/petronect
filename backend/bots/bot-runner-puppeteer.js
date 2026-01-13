/**
 * Bot Runner - Puppeteer Bot para Petronect
 *
 * Recebe parametros via linha de comando e se comunica com o backend via API
 *
 * Uso: node bot-runner-puppeteer.js --roboId 1 --login USER --senha PASS --data 1 --bottag OP_01 --ordem 0 [--opresgate 7004192456]
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

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
const HEADLESS_MODE = process.env.BOT_HEADLESS !== 'false';

// Diretorio de screenshots
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

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

async function notifyBrowserClosed() {
  if (isStopping) return;
  isStopping = true;

  console.log(`[Bot ${bottag}] Browser fechado - notificando backend para parar agente...`);
  await SaveLogBot('Browser fechado - parando agente...');
  await StopRobo();

  process.exit(0);
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

// Função auxiliar para delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Função para aguardar seletor com xpath
async function waitForXPath(page, xpath, timeout = 60000) {
  return await page.waitForSelector(`xpath/${xpath}`, { timeout });
}

// Função para clicar em xpath
async function clickXPath(page, xpath) {
  const element = await page.$(`xpath/${xpath}`);
  if (element) {
    await element.click();
    return true;
  }
  return false;
}

// Função para preencher input com xpath
async function typeXPath(page, xpath, text) {
  const element = await page.$(`xpath/${xpath}`);
  if (element) {
    await element.click({ clickCount: 3 }); // Selecionar todo texto
    await element.type(text);
    return true;
  }
  return false;
}

// Função para obter texto de elemento xpath
async function getTextXPath(page, xpath) {
  const element = await page.$(`xpath/${xpath}`);
  if (element) {
    return await page.evaluate(el => el.innerText, element);
  }
  return '';
}

// Função para trabalhar com frames
async function getFrame(page, frameName) {
  const frames = page.frames();
  return frames.find(f => f.name() === frameName);
}

// =============================================
// START BOT
// =============================================

(async () => {
  // Calcular data de pesquisa
  date_op = dateGetOp(dataOp);

  console.log(`[Bot ${bottag}] Iniciando (Puppeteer)...`);
  console.log(`[Bot ${bottag}] Login: ${login}`);
  console.log(`[Bot ${bottag}] Data OP: ${date_op} (${dataOp} dias atras)`);
  console.log(`[Bot ${bottag}] Ordem: ${statusHoraInicioOrdem === '0' ? 'Crescente' : 'Decrescente'}`);
  console.log(`[Bot ${bottag}] OP Resgate: ${opResgate || 'Nenhuma (modo data)'}`);

  let browser;
  let page;

  try {
    browser = await puppeteer.launch({
      headless: HEADLESS_MODE ? 'new' : false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--single-process',
        '--no-zygote',
        '--window-size=1400,900'
      ]
    });
  } catch (err) {
    console.error(`[Bot ${bottag}] Erro ao iniciar browser:`, err.message);
    await SaveLogBot('Erro ao iniciar browser - reiniciando em 10s...');
    await delay(10000);
    process.exit(0);
  }

  // Detectar quando o browser fecha
  browser.on('disconnected', () => {
    notifyBrowserClosed();
  });

  try {
    page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.setDefaultTimeout(60000);
  } catch (err) {
    console.error(`[Bot ${bottag}] Erro ao criar página:`, err.message);
    await SaveLogBot('Erro ao criar página - reiniciando em 10s...');
    isStopping = true;
    await browser.close();
    await delay(10000);
    process.exit(0);
  }

  // Criar segunda página para PDFs
  const pageWebBot = await browser.newPage();
  await pageWebBot.setViewport({ width: 1400, height: 900 });

  try {
    // Acessar Petronect
    await page.goto('https://www.petronect.com.br/irj/go/km/docs/pccshrcontent/Site%20Content%20(Legacy)/Portal2018/pt/index.html', { waitUntil: 'networkidle2' });

    // Clicar no botão de login
    await clickXPath(page, '//html/body/div/div[1]/div[2]/div/div[3]/a');
    await delay(2000);

    // Preencher login e senha
    await page.type('#inputUser', login);
    await page.type('#inputSenha', senha);
    await page.keyboard.press('Enter');

    console.log(`[Bot ${bottag}] Efetuando login...`);
    await SaveLogBot('Efetuando login...');
    await delay(10000);
    await ScreenShot(page, bottag);

    // Verificar solicitação de código por e-mail
    const isTextVisible = await page.evaluate(() => {
      return document.body.innerText.includes('Confirme sua identidade');
    });

    if (isTextVisible) {
      console.log(`[Bot ${bottag}] Código de verificação solicitado`);
      await SaveLogBot('Código de verificação solicitado. Aguardando usuário...');
      await ScreenShot(page, bottag);
      await delay(2000);

      // Clicar no botão para enviar código por email
      await clickXPath(page, '//html/body/div[1]/div[2]/div/div/div[2]/div[3]/form/button[2]');
      await delay(3000);
      await ScreenShot(page, bottag);

      // Solicitar código ao usuário via API
      await requestVerificationCode();

      // Aguardar código do usuário (máximo 1 minuto)
      const verificationCode = await waitForVerificationCode(60000);

      if (verificationCode) {
        console.log(`[Bot ${bottag}] Inserindo código de verificação...`);
        await SaveLogBot('Inserindo código de verificação...');

        // Localizar input do código e inserir
        const codeInput = await page.$('input[type="text"], input[type="number"], input[name*="code"], input[id*="code"]');
        if (codeInput) {
          await codeInput.type(verificationCode);
          await delay(1000);

          // Clicar no botão de confirmar
          const confirmBtn = await page.$('button[type="submit"]');
          if (confirmBtn) {
            await confirmBtn.click();
          } else {
            await page.keyboard.press('Enter');
          }

          await delay(5000);
          await ScreenShot(page, bottag);
          await SaveLogBot('Código de verificação enviado!');
        } else {
          console.log(`[Bot ${bottag}] Campo de código não encontrado`);
          await SaveLogBot('Erro: Campo de código não encontrado');
        }
      } else {
        console.log(`[Bot ${bottag}] Timeout - código não recebido`);
        await SaveLogBot('Erro: Timeout aguardando código de verificação - reiniciando em 10s...');
        isStopping = true;
        await browser.close();
        await delay(10000);
        process.exit(0);
      }
    }

    await delay(8000);

    // Verificar manutenção de usuário
    const url = page.url();
    if (url.indexOf('ypuser_maintenance?origem=2') > -1) {
      await page.mouse.click(775, 555);
      await delay(5000);
    }

    await delay(5000);
    await ScreenShot(page, bottag);

    // Acessar Cotações
    await page.click('#tabIcon1');
    console.log(`[Bot ${bottag}] Acessando cotações...`);
    await SaveLogBot('Acessando cotações...');
    await delay(5000);
    await ScreenShot(page, bottag);

    // Desbloqueio de sessão
    console.log(`[Bot ${bottag}] Desbloqueio de sessão...`);
    await SaveLogBot('Desbloqueio de sessão...');
    await page.click('#subTabIndex2');
    await delay(5000);

    // Trabalhar com iframe
    const isolatedWorkArea = await getFrame(page, 'isolatedWorkArea');
    if (isolatedWorkArea) {
      const xpath_btn_unlocksession = '//html[1]/body[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/div[1]/span[1]/span[2]/div[1]/div[1]/table[1]/tbody[1]/tr[3]/td[1]/div[1]';
      await clickXPath(isolatedWorkArea, xpath_btn_unlocksession);
      await delay(5000);
      await page.mouse.click(863, 520);
      await SaveLogBot('Desbloqueio realizado...');
      await delay(5000);
    }

    // Formulário de pesquisa
    console.log(`[Bot ${bottag}] Acessando formulário de pesquisa...`);
    await SaveLogBot('Acessando formulário de pesquisa...');
    await page.click('#subTabIndex1');
    await delay(20000);
    await ScreenShot(page, bottag);

    // XPaths do formulário
    const xpath_input_op = '//html[1]/body[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[2]/td[1]/table[1]/tbody[1]/tr[3]/td[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[2]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/div[1]/div[2]/span[1]/span[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[3]/span[1]/input[1]';
    const xpath_btn_opstatus = '//html[1]/body[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[2]/td[1]/table[1]/tbody[1]/tr[3]/td[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[2]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/div[1]/div[2]/span[1]/span[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[11]/td[3]/span[1]/span[1]';
    const xpath_input_date = '//html[1]/body[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[2]/td[1]/table[1]/tbody[1]/tr[3]/td[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[2]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/div[1]/div[2]/span[1]/span[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[5]/td[3]/span[1]/input[1]';
    const xpath_btn_buscar = '//html/body/table/tbody/tr/td/div/table/tbody/tr/td/div/table/tbody/tr[2]/td/table/tbody/tr[3]/td/div[1]/div/table/tbody/tr/td/span/span/table/tbody/tr/td/span/span[2]/table/tbody/tr/td/div/table/tbody/tr/td/div/table/tbody/tr[2]/td/div/span[1]/div';

    const page2 = await getFrame(page, 'isolatedWorkArea');

    // Determinar tipo de pesquisa
    if (opResgate) {
      console.log(`[Bot ${bottag}] Pesquisando OP específica: ${opResgate}`);
      await SaveLogBot(`Pesquisando OP específica: ${opResgate}`);
      await delay(2000);
      await clickXPath(page2, xpath_btn_opstatus);
      await page.keyboard.press('PageUp');
      await delay(1000);
      await page.keyboard.press('PageUp');
      await delay(2000);
      await typeXPath(page2, xpath_input_op, opResgate);
      await clickXPath(page2, xpath_btn_buscar);
      n_op_processar = opResgate;
      id_line_process = 2;
    } else {
      console.log(`[Bot ${bottag}] Pesquisando por data: ${date_op}`);
      await SaveLogBot(`Pesquisando por data: ${date_op}`);
      await typeXPath(page2, xpath_input_date, date_op);
      await delay(2000);
      await clickXPath(page2, xpath_btn_buscar);
    }

    console.log(`[Bot ${bottag}] Pesquisando...`);
    await SaveLogBot('Pesquisando...');
    await delay(30000);
    await ScreenShot(page, bottag);

    // Ordenação por hora início
    if (statusHoraInicioOrdem === '0' && !opResgate) {
      const html = await page2.content();
      const posicaoInicial = html.indexOf('Hora In');
      if (posicaoInicial > -1) {
        const idBotao = html.substr(posicaoInicial - 64, 4);
        await page2.click('#' + idBotao);
        await delay(4000);

        // Clicar em ordenar crescente
        const elements = await page2.$$('text/Ordenar em ordem crescente');
        if (elements.length > 0) {
          await elements[0].click();
        }

        await delay(10000);
        await ScreenShot(page, bottag);
        console.log(`[Bot ${bottag}] Ordenando hora início para crescente...`);
        await SaveLogBot('Ordenando hora início para crescente...');
      }
    }

    // Verificar total de OPs
    const xpath_qtd_ops = '//html[1]/body[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[2]/td[1]/table[1]/tbody[1]/tr[1]/td[1]/table[1]/tbody[1]/tr[1]/td[2]/div[1]/div[1]/div[1]';

    await waitForXPath(page2, xpath_qtd_ops);
    qtd_ops = await getTextXPath(page2, xpath_qtd_ops);

    if (qtd_ops.indexOf('[Opera') > -1) {
      console.log(`[Bot ${bottag}] Aguardando +60 segundos...`);
      await delay(60000);
      await ScreenShot(page, bottag);
      qtd_ops = await getTextXPath(page2, xpath_qtd_ops);
    }

    qtd_ops = qtd_ops.replace('Minhas Participações (', '').replace(')', '');
    await delay(5000);
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
          await waitForXPath(page2, xpath_n_op, 5000);
          const n_op = await getTextXPath(page2, xpath_n_op);
          const data_inicio = await getTextXPath(page2, xpath_datainicio);

          const status = checkFileOP(n_op, id_line, data_inicio);
          console.log(`[Bot ${bottag}] OP: ${n_op}${status}`);
          await SaveLogBot(`OP: ${n_op}${status}`);
        } catch (e) {
          break;
        }
        await delay(1000);
      }
    }

    // Se há OP para processar
    if (id_line_process && n_op_processar) {
      console.log(`[Bot ${bottag}] Processando OP: ${n_op_processar} Linha: ${id_line_process}`);
      await SaveLogBot(`Processando OP: ${n_op_processar}`);
      await UpdateProcesso(n_op_processar, 0, 0, 'running');

      // XPaths da OP
      const xpath_n_op = `//html[1]/body[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[2]/td[1]/table[1]/tbody[1]/tr[3]/td[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[4]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[1]/div[1]/div[1]/div[1]/span[1]/span[1]/table[1]/tbody[1]/tr[2]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/table[1]/tbody[1]/tr[${id_line_process}]/td[2]/a[1]/span[1]`;
      const xpath_desc_op = `//html[1]/body[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[2]/td[1]/table[1]/tbody[1]/tr[3]/td[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[4]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[1]/div[1]/div[1]/div[1]/span[1]/span[1]/table[1]/tbody[1]/tr[2]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/table[1]/tbody[1]/tr[${id_line_process}]/td[3]/span[1]/span[1]`;
      const xpath_datainicio = `//html[1]/body[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[2]/td[1]/table[1]/tbody[1]/tr[3]/td[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[4]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[1]/div[1]/div[1]/div[1]/span[1]/span[1]/table[1]/tbody[1]/tr[2]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/table[1]/tbody[1]/tr[${id_line_process}]/td[4]/span[1]/span[1]`;
      const xpath_horainicio = `//html/body/table/tbody/tr/td/div/table/tbody/tr/td/div/table/tbody/tr[2]/td/table/tbody/tr[3]/td/div[1]/div/table/tbody/tr/td/span/span/table/tbody/tr/td/span/span[4]/table/tbody/tr/td/span/span[1]/div/div/div/span/span/table/tbody/tr[2]/td/div/table/tbody/tr/td/div/table/tbody/tr/td[1]/table/tbody/tr[${id_line_process}]/td[5]/span/span`;
      const xpath_datafim = `//html[1]/body[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[2]/td[1]/table[1]/tbody[1]/tr[3]/td[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[1]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[4]/table[1]/tbody[1]/tr[1]/td[1]/span[1]/span[1]/div[1]/div[1]/div[1]/span[1]/span[1]/table[1]/tbody[1]/tr[2]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/table[1]/tbody[1]/tr[${id_line_process}]/td[6]/span[1]/span[1]`;
      const xpath_horafim = `//html/body/table/tbody/tr/td/div/table/tbody/tr/td/div/table/tbody/tr[2]/td/table/tbody/tr[3]/td/div[1]/div/table/tbody/tr/td/span/span/table/tbody/tr/td/span/span[4]/table/tbody/tr/td/span/span[1]/div/div/div/span/span/table/tbody/tr[2]/td/div/table/tbody/tr/td/div/table/tbody/tr/td[1]/table/tbody/tr[${id_line_process}]/td[7]/span/span`;

      try {
        await waitForXPath(page2, xpath_n_op, 10000);

        n_op_ = await getTextXPath(page2, xpath_n_op);
        desc_ = await getTextXPath(page2, xpath_desc_op);
        data_inicio_ = await getTextXPath(page2, xpath_datainicio);
        hora_inicio_ = await getTextXPath(page2, xpath_horainicio);
        data_fim_ = await getTextXPath(page2, xpath_datafim);
        hora_fim_ = await getTextXPath(page2, xpath_horafim);

        await clickXPath(page2, xpath_n_op);
        await ScreenShot(page, bottag);
      } catch (e) {
        console.error(`[Bot ${bottag}] Erro ao obter dados da OP:`, e.message);
      }

      await delay(30000);

      // Acessar itens
      const page3 = await getFrame(page, 'isolatedWorkArea');
      console.log(`[Bot ${bottag}] Acessando itens...`);
      await SaveLogBot('Acessando itens...');
      await ScreenShot(page, bottag);
      await delay(4000);

      const xpath_btn_itens = '//html[1]/body[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/table[1]/tbody[1]/tr[2]/td[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[1]/table[1]/tbody[1]/tr[1]/td[1]/div[1]/span[2]/span[2]';
      await waitForXPath(page3, xpath_btn_itens);

      // Baixar PDF
      const xpath_btn_oppdf = '//html/body/table/tbody/tr/td/div/table/tbody/tr/td/div/table/tbody/tr[1]/td/table/tbody/tr/td/div/table/tbody/tr[1]/td/div/div[2]/div/div/div[1]/span[5]/div';
      await clickXPath(page3, xpath_btn_oppdf);
      await delay(20000);

      // Obter URL do PDF
      const pages = await browser.pages();
      if (pages.length > 2) {
        const pdfUrl = pages[2].url();
        await delay(2000);
        await pageWebBot.goto(pdfUrl, { waitUntil: 'networkidle2' });
        await delay(4000);
      }

      await ScreenShot(page, bottag);
      await clickXPath(page3, xpath_btn_itens);
      await delay(20000);

      const page4 = await getFrame(page, 'isolatedWorkArea');

      // Contar itens
      const html_itens = await page4.content();
      const html_start = html_itens.indexOf("'ROW',");
      if (html_start > -1) {
        qtd_itens = parseInt(html_itens.substr(html_start + 9, 2).replace('}', ''));
      }

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
          const itemElement = await page4.$(`xpath/${xpath_id_item}`);
          if (itemElement) {
            await waitForXPath(page4, xpath_id_item, 10000);

            const item_id = await getTextXPath(page4, xpath_id_item);
            const item_desc = await getTextXPath(page4, xpath_desc_item);

            console.log(`[Bot ${bottag}] Resgatando item: [${item_id} de ${qtd_itens}] - ${item_desc.substr(0, 50)}...`);
            await SaveLogBot(`Resgatando item: [${item_id}] - ${item_desc.substr(0, 100)}`);
            await UpdateProcesso(n_op_processar, parseInt(item_id), qtd_itens, 'running');
            await ScreenShot(page, bottag);
          }
        } catch (e) {
          console.log(`[Bot ${bottag}] Erro ao processar item ${itemNum}:`, e.message);
        }

        id_item += 1;
        await delay(3000);
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
    await browser.close();
    process.exit(0);

  } catch (err) {
    console.error(`[Bot ${bottag}] Erro no sistema:`, err.message);
    await SaveLogBot('Erro no sistema, um requisito não foi atendido - reiniciando em 10s...');
    isStopping = true;
    try {
      await browser.close();
    } catch (e) {
      // Browser pode já estar fechado
    }
    await delay(10000);
    process.exit(0);
  }
})();
