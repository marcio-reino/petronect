/**
 * Serviço para verificar status do Petronect
 * Utiliza o serviço Playwright (porta 3003) que já está rodando no servidor
 */

const PLAYWRIGHT_SERVICE_URL = process.env.PLAYWRIGHT_SERVICE_URL || 'http://127.0.0.1:3003';

class PetronectStatusService {
  async checkStatus() {
    const startTime = Date.now();
    const url = `${PLAYWRIGHT_SERVICE_URL}/petronect-status`;

    try {
      console.log('[PetronectStatus] Chamando serviço Playwright em:', url);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90000); // 90 segundos timeout

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });

      clearTimeout(timeout);

      console.log('[PetronectStatus] HTTP Status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('[PetronectStatus] Resposta recebida:', JSON.stringify(result));

      return result;

    } catch (error) {
      const responseTime = Date.now() - startTime;

      console.error('[PetronectStatus] Erro ao chamar serviço Playwright:', error.message);
      console.error('[PetronectStatus] URL:', url);
      console.error('[PetronectStatus] Tipo do erro:', error.name);

      return {
        success: true,
        data: {
          status: 'offline',
          statusCode: 0,
          responseTime: responseTime,
          error: error.name === 'AbortError' ? 'Timeout' : error.message,
          checkedAt: new Date().toISOString()
        }
      };
    }
  }
}

module.exports = new PetronectStatusService();
