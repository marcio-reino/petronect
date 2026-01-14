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

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json({ limit: '50mb' }));

// Armazenar browsers e páginas ativos
const browsers = new Map(); // browserId -> { browser, pages: Map(pageId -> page) }
let browserIdCounter = 0;
let pageIdCounter = 0;

// Diretório de screenshots - na pasta do playwright
const SCREENSHOTS_DIR = process.env.SCREENSHOTS_DIR || path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}
console.log(`[PlaywrightService] Screenshots dir: ${SCREENSHOTS_DIR}`);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    activeBrowsers: browsers.size,
    timestamp: new Date().toISOString()
  });
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
    const { headless = true } = req.body;

    console.log(`[PlaywrightService] Iniciando browser (headless: ${headless})...`);

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

    // Criar um único contexto para todas as páginas (abas)
    const context = await browser.newContext();

    const browserId = ++browserIdCounter;

    browsers.set(browserId, {
      browser,
      context,  // Contexto compartilhado
      pages: new Map(),
      createdAt: new Date()
    });

    // Detectar desconexão
    browser.on('disconnected', () => {
      console.log(`[PlaywrightService] Browser ${browserId} desconectado`);
      browsers.delete(browserId);
    });

    console.log(`[PlaywrightService] Browser ${browserId} iniciado com sucesso`);

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

// Fechar browser
app.post('/browser/:id/close', async (req, res) => {
  try {
    const browserId = parseInt(req.params.id);
    const browserData = browsers.get(browserId);

    if (!browserData) {
      return res.status(404).json({ success: false, error: 'Browser não encontrado' });
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
