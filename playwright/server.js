/**
 * Playwright Service - Serviço HTTP para controle de browser Playwright
 *
 * Roda na porta 3003 e gerencia instâncias de browser para os bots
 *
 * Endpoints:
 *   POST /browser/launch - Inicia um browser
 *   POST /browser/:id/close - Fecha um browser
 *   POST /browser/:id/page - Cria uma nova página
 *   POST /browser/:id/goto - Navega para URL
 *   POST /browser/:id/click - Clica em elemento
 *   POST /browser/:id/fill - Preenche input
 *   POST /browser/:id/screenshot - Tira screenshot
 *   POST /browser/:id/content - Retorna HTML da página
 *   POST /browser/:id/evaluate - Executa JavaScript na página
 *   GET  /browser/:id/url - Retorna URL atual
 *   GET  /health - Health check
 */

const express = require('express');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { PDFExtract } = require('pdf.js-extract');

const app = express();

const PORT = process.env.PORT || 3003;

app.use(express.json({ limit: '50mb' }));

// Armazenar browsers e páginas ativos
const browsers = new Map(); // browserId -> { browser, pages: Map(pageId -> page), bottag }
const bottagToBrowser = new Map(); // bottag -> browserId (para fechar browser por bottag)
let browserIdCounter = 0;
let pageIdCounter = 0;

// Diretório de screenshots - na pasta do playwright
const SCREENSHOTS_DIR = process.env.SCREENSHOTS_DIR || path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}
console.log(`[PlaywrightService] Screenshots dir: ${SCREENSHOTS_DIR}`);

// Diretório de PDFs - pasta pdf_op no mesmo nível de screenshots
const PDF_DIR = path.join(__dirname, 'pdf_op');
if (!fs.existsSync(PDF_DIR)) {
  fs.mkdirSync(PDF_DIR, { recursive: true });
}
console.log(`[PlaywrightService] PDF dir: ${PDF_DIR}`);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    activeBrowsers: browsers.size,
    timestamp: new Date().toISOString()
  });
});

// Verificar status do site Petronect
app.get('/petronect-status', async (req, res) => {
  const startTime = Date.now();
  let browser = null;
  let browserId = null;

  try {
    const targetUrl = 'https://www.petronect.com.br/irj/go/km/docs/pccshrcontent/Site%20Content%20(Legacy)/Portal2018/pt/index.html';
    const searchText = 'Portal de Compras da Petrobras';

    console.log('[PetronectStatus] Verificando status do Petronect...');

    // Iniciar browser temporário
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    browserId = ++browserIdCounter;
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();
    page.setDefaultTimeout(30000);

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const pageContent = await page.content();
    const isOnline = pageContent.includes(searchText);

    const responseTime = Date.now() - startTime;

    console.log('[PetronectStatus] Verificação concluída:');
    console.log('- Texto encontrado:', isOnline);
    console.log('- Tempo de resposta:', responseTime, 'ms');

    await browser.close();

    res.json({
      success: true,
      data: {
        status: isOnline ? 'online' : 'offline',
        statusCode: 200,
        responseTime: responseTime,
        checkedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('[PetronectStatus] Erro:', error.message);

    if (browser) {
      try { await browser.close(); } catch (e) {}
    }

    res.json({
      success: true,
      data: {
        status: 'offline',
        statusCode: 0,
        responseTime: responseTime,
        error: error.message,
        checkedAt: new Date().toISOString()
      }
    });
  }
});

// Servir screenshots por nome do robô (bottag)
app.get('/screenshots/:bottag', (req, res) => {
  try {
    const { bottag } = req.params;
    const screenshotPath = path.join(SCREENSHOTS_DIR, `${bottag}.png`);

    if (!fs.existsSync(screenshotPath)) {
      return res.status(404).json({ success: false, error: 'Screenshot não encontrada' });
    }

    // Enviar o arquivo de imagem
    res.sendFile(screenshotPath);
  } catch (error) {
    console.error('[PlaywrightService] Erro ao servir screenshot:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Listar browsers ativos
app.get('/browsers', (req, res) => {
  const browserList = [];
  browsers.forEach((data, id) => {
    browserList.push({
      id,
      pageCount: data.pages.size,
      connected: data.browser.isConnected()
    });
  });
  res.json({ browsers: browserList });
});

// Iniciar browser
app.post('/browser/launch', async (req, res) => {
  try {
    const { headless = true, bottag } = req.body;

    console.log(`[PlaywrightService] Iniciando browser (headless: ${headless}, bottag: ${bottag || 'N/A'})...`);

    // Se já existe um browser para este bottag, fechar primeiro
    if (bottag && bottagToBrowser.has(bottag)) {
      const existingBrowserId = bottagToBrowser.get(bottag);
      const existingBrowserData = browsers.get(existingBrowserId);
      if (existingBrowserData) {
        console.log(`[PlaywrightService] Fechando browser anterior do bot ${bottag} (ID: ${existingBrowserId})`);
        try {
          await existingBrowserData.browser.close();
        } catch (e) {
          console.log(`[PlaywrightService] Erro ao fechar browser anterior: ${e.message}`);
        }
        browsers.delete(existingBrowserId);
      }
      bottagToBrowser.delete(bottag);
    }

    const browser = await chromium.launch({
      headless: headless === true || headless === 'true',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });

    // Criar um único contexto para todas as páginas (abas) com suporte a downloads
    const context = await browser.newContext({
      acceptDownloads: true
    });

    const browserId = ++browserIdCounter;

    browsers.set(browserId, {
      browser,
      context,  // Contexto compartilhado
      pages: new Map(),
      downloads: new Map(),  // Armazenar downloads pendentes
      bottag: bottag || null,  // Armazenar bottag para referência
      createdAt: new Date()
    });

    // Mapear bottag -> browserId para poder fechar por bottag
    if (bottag) {
      bottagToBrowser.set(bottag, browserId);
    }

    // Detectar desconexão
    browser.on('disconnected', () => {
      console.log(`[PlaywrightService] Browser ${browserId} desconectado`);
      const data = browsers.get(browserId);
      if (data && data.bottag) {
        bottagToBrowser.delete(data.bottag);
      }
      browsers.delete(browserId);
    });

    console.log(`[PlaywrightService] Browser ${browserId} iniciado com sucesso${bottag ? ` (bot: ${bottag})` : ''}`);

    res.json({
      success: true,
      browserId,
      message: 'Browser iniciado com sucesso'
    });
  } catch (error) {
    console.error('[PlaywrightService] Erro ao iniciar browser:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fechar browser por ID
app.post('/browser/:id/close', async (req, res) => {
  try {
    const browserId = parseInt(req.params.id);
    const browserData = browsers.get(browserId);

    if (!browserData) {
      return res.status(404).json({ success: false, error: 'Browser não encontrado' });
    }

    // Limpar mapeamento bottag se existir
    if (browserData.bottag) {
      bottagToBrowser.delete(browserData.bottag);
    }

    await browserData.browser.close();
    browsers.delete(browserId);

    console.log(`[PlaywrightService] Browser ${browserId} fechado`);

    res.json({ success: true, message: 'Browser fechado' });
  } catch (error) {
    console.error('[PlaywrightService] Erro ao fechar browser:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fechar browser por bottag (usado pelo botManager para forçar fechamento)
app.post('/browser/close-by-bottag/:bottag', async (req, res) => {
  try {
    const { bottag } = req.params;

    if (!bottagToBrowser.has(bottag)) {
      return res.status(404).json({ success: false, error: `Browser para bot ${bottag} não encontrado` });
    }

    const browserId = bottagToBrowser.get(bottag);
    const browserData = browsers.get(browserId);

    if (!browserData) {
      bottagToBrowser.delete(bottag);
      return res.status(404).json({ success: false, error: 'Browser não encontrado no mapa' });
    }

    await browserData.browser.close();
    browsers.delete(browserId);
    bottagToBrowser.delete(bottag);

    console.log(`[PlaywrightService] Browser ${browserId} (bot: ${bottag}) fechado via bottag`);

    res.json({ success: true, message: `Browser do bot ${bottag} fechado` });
  } catch (error) {
    console.error('[PlaywrightService] Erro ao fechar browser por bottag:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Criar nova página (aba no mesmo browser)
app.post('/browser/:id/page', async (req, res) => {
  try {
    const browserId = parseInt(req.params.id);
    const { width = 1400, height = 900, timeout = 60000 } = req.body;

    const browserData = browsers.get(browserId);
    if (!browserData) {
      return res.status(404).json({ success: false, error: 'Browser não encontrado' });
    }

    // Usar o contexto compartilhado para criar nova aba
    const page = await browserData.context.newPage();
    await page.setViewportSize({ width, height });
    await page.setDefaultTimeout(timeout);

    const pageId = ++pageIdCounter;
    browserData.pages.set(pageId, { page });

    console.log(`[PlaywrightService] Página ${pageId} criada no browser ${browserId} (aba)`);

    res.json({ success: true, pageId });
  } catch (error) {
    console.error('[PlaywrightService] Erro ao criar página:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fechar página (aba)
app.post('/browser/:browserId/page/:pageId/close', async (req, res) => {
  try {
    const browserId = parseInt(req.params.browserId);
    const pageId = parseInt(req.params.pageId);

    const browserData = browsers.get(browserId);
    if (!browserData) {
      return res.status(404).json({ success: false, error: 'Browser não encontrado' });
    }

    const pageData = browserData.pages.get(pageId);
    if (!pageData) {
      return res.status(404).json({ success: false, error: 'Página não encontrada' });
    }

    await pageData.page.close();
    browserData.pages.delete(pageId);

    res.json({ success: true, message: 'Página fechada' });
  } catch (error) {
    console.error('[PlaywrightService] Erro ao fechar página:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper para obter página
function getPage(browserId, pageId) {
  const browserData = browsers.get(browserId);
  if (!browserData) return null;
  const pageData = browserData.pages.get(pageId);
  return pageData ? pageData.page : null;
}

// Navegar para URL
app.post('/browser/:browserId/page/:pageId/goto', async (req, res) => {
  try {
    const { browserId, pageId } = req.params;
    const { url, waitUntil = 'load' } = req.body;

    const page = getPage(parseInt(browserId), parseInt(pageId));
    if (!page) {
      return res.status(404).json({ success: false, error: 'Página não encontrada' });
    }

    await page.goto(url, { waitUntil });

    res.json({ success: true, url: page.url() });
  } catch (error) {
    console.error('[PlaywrightService] Erro ao navegar:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clicar em elemento
app.post('/browser/:browserId/page/:pageId/click', async (req, res) => {
  try {
    const { browserId, pageId } = req.params;
    const { selector, options = {} } = req.body;

    const page = getPage(parseInt(browserId), parseInt(pageId));
    if (!page) {
      return res.status(404).json({ success: false, error: 'Página não encontrada' });
    }

    await page.click(selector, options);

    res.json({ success: true });
  } catch (error) {
    console.error('[PlaywrightService] Erro ao clicar:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Preencher input
app.post('/browser/:browserId/page/:pageId/fill', async (req, res) => {
  try {
    const { browserId, pageId } = req.params;
    const { selector, value } = req.body;

    const page = getPage(parseInt(browserId), parseInt(pageId));
    if (!page) {
      return res.status(404).json({ success: false, error: 'Página não encontrada' });
    }

    await page.fill(selector, value);

    res.json({ success: true });
  } catch (error) {
    console.error('[PlaywrightService] Erro ao preencher:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Pressionar tecla
app.post('/browser/:browserId/page/:pageId/press', async (req, res) => {
  try {
    const { browserId, pageId } = req.params;
    const { selector = 'body', key } = req.body;

    const page = getPage(parseInt(browserId), parseInt(pageId));
    if (!page) {
      return res.status(404).json({ success: false, error: 'Página não encontrada' });
    }

    await page.press(selector, key);

    res.json({ success: true });
  } catch (error) {
    console.error('[PlaywrightService] Erro ao pressionar tecla:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clicar com mouse em coordenadas
app.post('/browser/:browserId/page/:pageId/mouse-click', async (req, res) => {
  try {
    const { browserId, pageId } = req.params;
    const { x, y } = req.body;

    const page = getPage(parseInt(browserId), parseInt(pageId));
    if (!page) {
      return res.status(404).json({ success: false, error: 'Página não encontrada' });
    }

    await page.mouse.click(x, y);

    res.json({ success: true });
  } catch (error) {
    console.error('[PlaywrightService] Erro ao clicar:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Aguardar
app.post('/browser/:browserId/page/:pageId/wait', async (req, res) => {
  try {
    const { browserId, pageId } = req.params;
    const { ms } = req.body;

    const page = getPage(parseInt(browserId), parseInt(pageId));
    if (!page) {
      return res.status(404).json({ success: false, error: 'Página não encontrada' });
    }

    await page.waitForTimeout(ms);

    res.json({ success: true });
  } catch (error) {
    console.error('[PlaywrightService] Erro ao aguardar:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Aguardar seletor
app.post('/browser/:browserId/page/:pageId/wait-selector', async (req, res) => {
  try {
    const { browserId, pageId } = req.params;
    const { selector, timeout = 30000 } = req.body;

    const page = getPage(parseInt(browserId), parseInt(pageId));
    if (!page) {
      return res.status(404).json({ success: false, error: 'Página não encontrada' });
    }

    await page.waitForSelector(selector, { timeout });

    res.json({ success: true });
  } catch (error) {
    console.error('[PlaywrightService] Erro ao aguardar seletor:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Verificar visibilidade
app.post('/browser/:browserId/page/:pageId/is-visible', async (req, res) => {
  try {
    const { browserId, pageId } = req.params;
    const { selector } = req.body;

    const page = getPage(parseInt(browserId), parseInt(pageId));
    if (!page) {
      return res.status(404).json({ success: false, error: 'Página não encontrada' });
    }

    const visible = await page.isVisible(selector);

    res.json({ success: true, visible });
  } catch (error) {
    console.error('[PlaywrightService] Erro ao verificar visibilidade:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obter texto de elemento
app.post('/browser/:browserId/page/:pageId/inner-text', async (req, res) => {
  try {
    const { browserId, pageId } = req.params;
    const { selector } = req.body;

    const page = getPage(parseInt(browserId), parseInt(pageId));
    if (!page) {
      return res.status(404).json({ success: false, error: 'Página não encontrada' });
    }

    const element = await page.$(selector);
    if (!element) {
      return res.json({ success: true, text: null });
    }

    const text = await element.innerText();

    res.json({ success: true, text });
  } catch (error) {
    console.error('[PlaywrightService] Erro ao obter texto:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obter conteúdo HTML
app.post('/browser/:browserId/page/:pageId/content', async (req, res) => {
  try {
    const { browserId, pageId } = req.params;

    const page = getPage(parseInt(browserId), parseInt(pageId));
    if (!page) {
      return res.status(404).json({ success: false, error: 'Página não encontrada' });
    }

    const content = await page.content();

    res.json({ success: true, content });
  } catch (error) {
    console.error('[PlaywrightService] Erro ao obter conteúdo:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obter URL atual
app.get('/browser/:browserId/page/:pageId/url', async (req, res) => {
  try {
    const { browserId, pageId } = req.params;

    const page = getPage(parseInt(browserId), parseInt(pageId));
    if (!page) {
      return res.status(404).json({ success: false, error: 'Página não encontrada' });
    }

    const url = page.url();

    res.json({ success: true, url });
  } catch (error) {
    console.error('[PlaywrightService] Erro ao obter URL:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Tirar screenshot
app.post('/browser/:browserId/page/:pageId/screenshot', async (req, res) => {
  try {
    const { browserId, pageId } = req.params;
    const { filename } = req.body;

    const page = getPage(parseInt(browserId), parseInt(pageId));
    if (!page) {
      return res.status(404).json({ success: false, error: 'Página não encontrada' });
    }

    const screenshotPath = path.join(SCREENSHOTS_DIR, `${filename}.png`);
    await page.screenshot({ path: screenshotPath });

    res.json({ success: true, path: screenshotPath });
  } catch (error) {
    console.error('[PlaywrightService] Erro ao tirar screenshot:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Salvar PDF da página
app.post('/browser/:browserId/page/:pageId/save-pdf', async (req, res) => {
  try {
    const { browserId, pageId } = req.params;
    const { filename } = req.body;

    const page = getPage(parseInt(browserId), parseInt(pageId));
    if (!page) {
      return res.status(404).json({ success: false, error: 'Página não encontrada' });
    }

    const pdfPath = path.join(PDF_DIR, `${filename}.pdf`);
    await page.pdf({ path: pdfPath, format: 'A4' });

    console.log(`[PlaywrightService] PDF salvo: ${pdfPath}`);
    res.json({ success: true, path: pdfPath });
  } catch (error) {
    console.error('[PlaywrightService] Erro ao salvar PDF:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Salvar PDF de um frame específico
app.post('/browser/:browserId/page/:pageId/frame-pdf', async (req, res) => {
  try {
    const { browserId, pageId } = req.params;
    const { filename, frameName } = req.body;

    const page = getPage(parseInt(browserId), parseInt(pageId));
    if (!page) {
      return res.status(404).json({ success: false, error: 'Página não encontrada' });
    }

    // Capturar o conteúdo HTML do frame
    const frame = await page.frame({ name: frameName });
    if (!frame) {
      return res.status(404).json({ success: false, error: 'Frame não encontrado' });
    }

    // Criar uma nova página com o conteúdo do frame para gerar PDF
    const browserData = browsers.get(parseInt(browserId));
    if (!browserData) {
      return res.status(404).json({ success: false, error: 'Browser não encontrado' });
    }

    const frameContent = await frame.content();
    const tempPage = await browserData.context.newPage();
    await tempPage.setContent(frameContent, { waitUntil: 'networkidle' });

    const pdfPath = path.join(PDF_DIR, `${filename}.pdf`);
    await tempPage.pdf({ path: pdfPath, format: 'A4', printBackground: true });
    await tempPage.close();

    console.log(`[PlaywrightService] PDF do frame salvo: ${pdfPath}`);
    res.json({ success: true, path: pdfPath });
  } catch (error) {
    console.error('[PlaywrightService] Erro ao salvar PDF do frame:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Capturar download real (PDF ou qualquer arquivo)
app.post('/browser/:browserId/page/:pageId/capture-download', async (req, res) => {
  try {
    const { browserId, pageId } = req.params;
    const { filename, selector, frameName, timeout = 60000 } = req.body;

    const browserData = browsers.get(parseInt(browserId));
    if (!browserData) {
      return res.status(404).json({ success: false, error: 'Browser não encontrado' });
    }

    const page = getPage(parseInt(browserId), parseInt(pageId));
    if (!page) {
      return res.status(404).json({ success: false, error: 'Página não encontrada' });
    }

    console.log(`[PlaywrightService] Iniciando captura de download...`);
    console.log(`[PlaywrightService] Selector: ${selector}`);
    console.log(`[PlaywrightService] Frame: ${frameName || 'principal'}`);

    const finalFilename = filename || 'download.pdf';
    const savePath = path.join(PDF_DIR, finalFilename.endsWith('.pdf') ? finalFilename : `${finalFilename}.pdf`);

    // Usar page.on('download') como listener
    let downloadCompleted = false;
    let downloadError = null;

    const downloadHandler = async (download) => {
      try {
        console.log(`[PlaywrightService] Download detectado na PAGE: ${download.suggestedFilename()}`);
        await download.saveAs(savePath);
        console.log(`[PlaywrightService] Download salvo: ${savePath}`);
        downloadCompleted = true;
      } catch (err) {
        console.error(`[PlaywrightService] Erro ao salvar download: ${err.message}`);
        downloadError = err.message;
      }
    };

    // Listener no contexto também (alguns downloads são capturados aqui)
    const contextDownloadHandler = async (download) => {
      try {
        console.log(`[PlaywrightService] Download detectado no CONTEXT: ${download.suggestedFilename()}`);
        if (!downloadCompleted) {
          await download.saveAs(savePath);
          console.log(`[PlaywrightService] Download salvo via context: ${savePath}`);
          downloadCompleted = true;
        }
      } catch (err) {
        console.error(`[PlaywrightService] Erro ao salvar download (context): ${err.message}`);
        if (!downloadError) downloadError = err.message;
      }
    };

    // Registrar os listeners ANTES de clicar
    page.on('download', downloadHandler);
    browserData.context.on('download', contextDownloadHandler);

    // Clicar no elemento que dispara o download
    if (frameName) {
      const frame = page.frame({ name: frameName });
      if (!frame) {
        page.off('download', downloadHandler);
        browserData.context.off('download', contextDownloadHandler);
        return res.status(404).json({ success: false, error: 'Frame não encontrado' });
      }
      console.log(`[PlaywrightService] Clicando no elemento dentro do frame ${frameName}...`);
      await frame.click(selector);
    } else {
      console.log(`[PlaywrightService] Clicando no elemento...`);
      await page.click(selector);
    }

    // Aguardar o download completar (polling)
    console.log(`[PlaywrightService] Aguardando download completar...`);
    const startTime = Date.now();
    while (!downloadCompleted && !downloadError && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Remover os listeners
    page.off('download', downloadHandler);
    browserData.context.off('download', contextDownloadHandler);

    if (downloadError) {
      return res.json({ success: false, error: downloadError });
    }

    if (!downloadCompleted) {
      console.log(`[PlaywrightService] Timeout aguardando download`);
      return res.json({ success: false, error: 'Timeout aguardando download' });
    }

    // Verificar se o arquivo foi salvo
    const fileExists = fs.existsSync(savePath);
    const fileSize = fileExists ? fs.statSync(savePath).size : 0;
    console.log(`[PlaywrightService] Arquivo existe: ${fileExists}, Tamanho: ${fileSize} bytes`);

    res.json({
      success: true,
      path: savePath,
      size: fileSize,
      originalFilename: finalFilename
    });
  } catch (error) {
    console.error('[PlaywrightService] Erro ao capturar download:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Extrair dados de PDF da Petronect
app.post('/pdf/extract', async (req, res) => {
  try {
    const { filename } = req.body;

    if (!filename) {
      return res.status(400).json({ success: false, error: 'Filename é obrigatório' });
    }

    const pdfPath = path.join(PDF_DIR, filename);

    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ success: false, error: 'Arquivo PDF não encontrado' });
    }

    console.log(`[PlaywrightService] Extraindo dados do PDF: ${pdfPath}`);

    // Ler o PDF
    const pdfExtract = new PDFExtract();
    const data = await pdfExtract.extract(pdfPath, {});

    // Juntar todo o texto de todas as páginas
    let text = '';
    for (const page of data.pages) {
      for (const item of page.content) {
        if (item.str) {
          text += item.str + ' ';
        }
      }
      text += '\n';
    }

    // Extrair número da oportunidade
    const opMatch = text.match(/Número da Oportunidade\s*(\d+)/);
    const numeroOp = opMatch ? opMatch[1] : null;

    // Extrair nome da oportunidade
    const nomeMatch = text.match(/Nome da Oportunidade\s*([^\n]+)/);
    let nomeOp = nomeMatch ? nomeMatch[1].trim() : null;
    // Limpar o nome (pegar só até "Data da publicação")
    if (nomeOp && nomeOp.includes('Data da publicação')) {
      nomeOp = nomeOp.split('Data da publicação')[0].trim();
    }

    // Extrair todas as descrições longas dos itens
    const descricoesLongas = [];
    const regex = /Descrição longa do item\s*([^]*?)(?=Declarações envolvidas|Dados do Item \d+|$)/gi;
    let match;

    while ((match = regex.exec(text)) !== null) {
      let descricao = match[1].trim();
      descricao = descricao.replace(/\s+/g, ' ').trim();
      if (descricao && descricao.length > 10) {
        descricoesLongas.push(descricao);
      }
    }

    // Se não encontrou com o regex acima, tentar outra abordagem
    if (descricoesLongas.length === 0) {
      const lines = text.split('\n');
      let captureNext = false;
      let currentDesc = '';

      for (const line of lines) {
        if (line.includes('Descrição longa do item')) {
          captureNext = true;
          const parts = line.split('Descrição longa do item');
          if (parts[1] && parts[1].trim()) {
            currentDesc = parts[1].trim();
          }
          continue;
        }

        if (captureNext) {
          if (line.includes('Declarações') || line.includes('Dados do Item') || line.match(/^\d+\s+[A-Z]/)) {
            if (currentDesc) {
              descricoesLongas.push(currentDesc.trim());
              currentDesc = '';
            }
            captureNext = false;
          } else {
            currentDesc += ' ' + line.trim();
          }
        }
      }

      if (currentDesc) {
        descricoesLongas.push(currentDesc.trim());
      }
    }

    // Montar resultado
    const resultado = {
      arquivo: filename,
      numeroOportunidade: numeroOp,
      nomeOportunidade: nomeOp,
      dataExtracao: new Date().toISOString(),
      itens: descricoesLongas.map((desc, idx) => ({
        item: idx + 1,
        descricaoLonga: desc
      })),
      textoCompleto: text
    };

    // Salvar arquivo TXT com os dados extraídos
    const txtFileName = filename.replace('.pdf', '_descricao.txt');
    const txtPath = path.join(PDF_DIR, txtFileName);

    let txtContent = `========================================\n`;
    txtContent += `EXTRAÇÃO DE DADOS - PETRONECT\n`;
    txtContent += `========================================\n\n`;
    txtContent += `Arquivo: ${resultado.arquivo}\n`;
    txtContent += `Número da Oportunidade: ${resultado.numeroOportunidade}\n`;
    txtContent += `Nome: ${resultado.nomeOportunidade}\n`;
    txtContent += `Data da Extração: ${new Date().toLocaleString('pt-BR')}\n\n`;
    txtContent += `----------------------------------------\n`;
    txtContent += `DESCRIÇÕES LONGAS DOS ITENS\n`;
    txtContent += `----------------------------------------\n\n`;

    if (resultado.itens.length === 0) {
      txtContent += `Nenhuma descrição longa encontrada.\n`;
    } else {
      resultado.itens.forEach(item => {
        txtContent += `Item ${item.item}:\n`;
        txtContent += `${item.descricaoLonga}\n\n`;
      });
    }

    fs.writeFileSync(txtPath, txtContent, 'utf8');

    console.log(`[PlaywrightService] Dados extraídos e salvos em: ${txtPath}`);

    res.json({
      success: true,
      data: resultado,
      txtPath: txtPath
    });

  } catch (error) {
    console.error('[PlaywrightService] Erro ao extrair PDF:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Executar JavaScript na página
app.post('/browser/:browserId/page/:pageId/evaluate', async (req, res) => {
  try {
    const { browserId, pageId } = req.params;
    const { script } = req.body;

    const page = getPage(parseInt(browserId), parseInt(pageId));
    if (!page) {
      return res.status(404).json({ success: false, error: 'Página não encontrada' });
    }

    const result = await page.evaluate(script);

    res.json({ success: true, result });
  } catch (error) {
    console.error('[PlaywrightService] Erro ao executar script:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Trabalhar com frame
app.post('/browser/:browserId/page/:pageId/frame', async (req, res) => {
  try {
    const { browserId, pageId } = req.params;
    const { name, action, selector, value, options } = req.body;

    const page = getPage(parseInt(browserId), parseInt(pageId));
    if (!page) {
      return res.status(404).json({ success: false, error: 'Página não encontrada' });
    }

    const frame = await page.frame({ name });
    if (!frame) {
      return res.status(404).json({ success: false, error: 'Frame não encontrado' });
    }

    let result = null;

    switch (action) {
      case 'click':
        await frame.click(selector, options || {});
        break;
      case 'fill':
        await frame.fill(selector, value);
        break;
      case 'innerText':
        const element = await frame.$(selector);
        result = element ? await element.innerText() : null;
        break;
      case 'content':
        result = await frame.content();
        break;
      case 'waitForSelector':
        await frame.waitForSelector(selector, options || {});
        break;
      case 'inputValue':
        const inputElement = await frame.$(selector);
        result = inputElement ? await inputElement.inputValue() : null;
        break;
      case 'getAttribute':
        const attrElement = await frame.$(selector);
        result = attrElement ? await attrElement.getAttribute(value) : null;
        break;
      default:
        return res.status(400).json({ success: false, error: 'Ação não suportada' });
    }

    res.json({ success: true, result });
  } catch (error) {
    console.error('[PlaywrightService] Erro ao trabalhar com frame:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obter todas as páginas do contexto
app.get('/browser/:browserId/pages', async (req, res) => {
  try {
    const browserId = parseInt(req.params.browserId);

    const browserData = browsers.get(browserId);
    if (!browserData) {
      return res.status(404).json({ success: false, error: 'Browser não encontrado' });
    }

    const pageList = [];
    browserData.pages.forEach((data, id) => {
      pageList.push({
        id,
        url: data.page.url()
      });
    });

    res.json({ success: true, pages: pageList });
  } catch (error) {
    console.error('[PlaywrightService] Erro ao listar páginas:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Contar elementos
app.post('/browser/:browserId/page/:pageId/count', async (req, res) => {
  try {
    const { browserId, pageId } = req.params;
    const { selector } = req.body;

    const page = getPage(parseInt(browserId), parseInt(pageId));
    if (!page) {
      return res.status(404).json({ success: false, error: 'Página não encontrada' });
    }

    const count = await page.locator(selector).count();

    res.json({ success: true, count });
  } catch (error) {
    console.error('[PlaywrightService] Erro ao contar elementos:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Locator first
app.post('/browser/:browserId/page/:pageId/locator-fill', async (req, res) => {
  try {
    const { browserId, pageId } = req.params;
    const { selector, value } = req.body;

    const page = getPage(parseInt(browserId), parseInt(pageId));
    if (!page) {
      return res.status(404).json({ success: false, error: 'Página não encontrada' });
    }

    const locator = page.locator(selector).first();
    if (await locator.count() > 0) {
      await locator.fill(value);
      res.json({ success: true });
    } else {
      res.json({ success: false, error: 'Elemento não encontrado' });
    }
  } catch (error) {
    console.error('[PlaywrightService] Erro ao preencher locator:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Locator click
app.post('/browser/:browserId/page/:pageId/locator-click', async (req, res) => {
  try {
    const { browserId, pageId } = req.params;
    const { selector } = req.body;

    const page = getPage(parseInt(browserId), parseInt(pageId));
    if (!page) {
      return res.status(404).json({ success: false, error: 'Página não encontrada' });
    }

    const locator = page.locator(selector).first();
    if (await locator.count() > 0) {
      await locator.click();
      res.json({ success: true });
    } else {
      res.json({ success: false, error: 'Elemento não encontrado' });
    }
  } catch (error) {
    console.error('[PlaywrightService] Erro ao clicar locator:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Buscar textarea em todos os iframes (até 5 níveis)
app.post('/browser/:browserId/page/:pageId/find-textarea', async (req, res) => {
  try {
    const { browserId, pageId } = req.params;
    const { selector, startFrame } = req.body;

    const page = getPage(parseInt(browserId), parseInt(pageId));
    if (!page) {
      return res.status(404).json({ success: false, error: 'Página não encontrada' });
    }

    console.log(`[PlaywrightService] Buscando textarea: ${selector}`);

    // Função recursiva para buscar em todos os frames
    async function findInFrames(frameOrPage, depth = 0, path = 'main') {
      if (depth > 5) return null; // Limite de profundidade

      try {
        // Tentar encontrar o elemento neste frame
        const element = await frameOrPage.$(selector);
        if (element) {
          const value = await element.inputValue();
          console.log(`[PlaywrightService] Textarea encontrado em: ${path} (profundidade ${depth})`);
          return { value, path, depth };
        }
      } catch (e) {
        // Elemento não encontrado neste frame, continuar buscando
      }

      // Buscar em todos os frames filhos
      const frames = frameOrPage.frames ? frameOrPage.frames() : [];
      for (let i = 0; i < frames.length; i++) {
        const childFrame = frames[i];
        const frameName = childFrame.name() || `frame_${i}`;
        const result = await findInFrames(childFrame, depth + 1, `${path} > ${frameName}`);
        if (result) return result;
      }

      return null;
    }

    // Se especificou um frame inicial, começar por ele
    let startingPoint = page;
    if (startFrame) {
      const frame = page.frame({ name: startFrame });
      if (frame) {
        startingPoint = frame;
        console.log(`[PlaywrightService] Iniciando busca no frame: ${startFrame}`);
      }
    }

    const result = await findInFrames(startingPoint);

    if (result) {
      res.json({
        success: true,
        result: result.value,
        framePath: result.path,
        depth: result.depth
      });
    } else {
      console.log(`[PlaywrightService] Textarea não encontrado em nenhum frame`);
      res.json({ success: false, error: 'Textarea não encontrado em nenhum iframe' });
    }
  } catch (error) {
    console.error('[PlaywrightService] Erro ao buscar textarea:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Buscar textarea no iframe URLSPW por role
app.post('/browser/:browserId/page/:pageId/get-urlspw-textarea', async (req, res) => {
  try {
    const { browserId, pageId } = req.params;
    const { iframeName, textboxName } = req.body;

    const page = getPage(parseInt(browserId), parseInt(pageId));
    if (!page) {
      return res.status(404).json({ success: false, error: 'Página não encontrada' });
    }

    // Nome do iframe pode variar: URLSPW-0, URLSPW-1, etc
    const frameName = iframeName || 'URLSPW-0';
    const textName = textboxName || 'Textos de Item';

    console.log(`[PlaywrightService] Buscando textarea no iframe: ${frameName}, textbox: ${textName}`);

    try {
      // Usar locator para acessar o iframe e o textbox por role
      const textbox = page.locator(`iframe[name="${frameName}"]`).contentFrame().getByRole('textbox', { name: textName });

      // Verificar se existe - pesquisar apenas em URLSPW-0
      const count = await textbox.count();
      if (count === 0) {
        return res.json({ success: false, error: 'Textarea não encontrado no iframe URLSPW-0' });
      }

      const value = await textbox.inputValue();
      console.log(`[PlaywrightService] Textarea encontrado, valor com ${value.length} caracteres`);

      res.json({ success: true, result: value, iframe: frameName });
    } catch (e) {
      console.log(`[PlaywrightService] Erro ao acessar textarea: ${e.message}`);
      res.json({ success: false, error: e.message });
    }
  } catch (error) {
    console.error('[PlaywrightService] Erro ao buscar textarea URLSPW:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Listar todos os iframes da página (debug)
app.post('/browser/:browserId/page/:pageId/list-frames', async (req, res) => {
  try {
    const { browserId, pageId } = req.params;
    const { startFrame } = req.body;

    const page = getPage(parseInt(browserId), parseInt(pageId));
    if (!page) {
      return res.status(404).json({ success: false, error: 'Página não encontrada' });
    }

    const frameList = [];

    // Função recursiva para listar frames
    function listFrames(frameOrPage, depth = 0, path = 'main') {
      if (depth > 5) return;

      const frames = frameOrPage.frames ? frameOrPage.frames() : [];
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const frameName = frame.name() || `unnamed_${i}`;
        const frameUrl = frame.url();
        const framePath = `${path} > ${frameName}`;

        frameList.push({
          name: frameName,
          path: framePath,
          url: frameUrl,
          depth: depth + 1
        });

        listFrames(frame, depth + 1, framePath);
      }
    }

    let startingPoint = page;
    if (startFrame) {
      const frame = page.frame({ name: startFrame });
      if (frame) {
        startingPoint = frame;
      }
    }

    listFrames(startingPoint);

    console.log(`[PlaywrightService] Frames encontrados: ${frameList.length}`);
    frameList.forEach(f => console.log(`  - ${f.path} (${f.name})`));

    res.json({ success: true, frames: frameList });
  } catch (error) {
    console.error('[PlaywrightService] Erro ao listar frames:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`\n🎭 Playwright Service rodando na porta ${PORT}`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`❤️ Health: http://localhost:${PORT}/health\n`);
});

// Cleanup ao encerrar
process.on('SIGINT', async () => {
  console.log('\n[PlaywrightService] Encerrando...');
  for (const [id, data] of browsers) {
    try {
      await data.browser.close();
      console.log(`[PlaywrightService] Browser ${id} fechado`);
    } catch (e) {
      // Ignorar erros ao fechar
    }
  }
  process.exit();
});

process.on('SIGTERM', async () => {
  console.log('\n[PlaywrightService] Encerrando...');
  for (const [id, data] of browsers) {
    try {
      await data.browser.close();
    } catch (e) {
      // Ignorar erros ao fechar
    }
  }
  process.exit();
});

module.exports = app;
