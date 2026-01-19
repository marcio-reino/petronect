const { chromium } = require('playwright');

class PetronectStatusService {
  constructor() {
    this.targetUrl = 'https://www.petronect.com.br/irj/go/km/docs/pccshrcontent/Site%20Content%20(Legacy)/Portal2018/pt/index.html';
    this.searchText = 'Portal de Compras da Petrobras';
    this.timeout = 30000; // 30 segundos
  }

  async checkStatus() {
    const startTime = Date.now();
    let browser = null;

    try {
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      const page = await context.newPage();
      page.setDefaultTimeout(this.timeout);

      console.log('[PetronectStatus] Navegando para:', this.targetUrl);

      await page.goto(this.targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: this.timeout
      });

      // Aguarda um pouco para o JavaScript carregar
      await page.waitForTimeout(3000);

      // Verifica se o texto está presente na página
      const pageContent = await page.content();
      const isOnline = pageContent.includes(this.searchText);

      const responseTime = Date.now() - startTime;

      console.log('[PetronectStatus] Verificação concluída:');
      console.log('- Texto encontrado:', isOnline);
      console.log('- Tempo de resposta:', responseTime, 'ms');

      await browser.close();

      return {
        success: true,
        data: {
          status: isOnline ? 'online' : 'offline',
          statusCode: 200,
          responseTime: responseTime,
          checkedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;

      console.error('[PetronectStatus] Erro na verificação:', error.message);

      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.error('[PetronectStatus] Erro ao fechar browser:', closeError.message);
        }
      }

      return {
        success: true,
        data: {
          status: 'offline',
          statusCode: 0,
          responseTime: responseTime,
          error: error.message,
          checkedAt: new Date().toISOString()
        }
      };
    }
  }
}

module.exports = new PetronectStatusService();
