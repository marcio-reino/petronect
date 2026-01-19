/**
 * Serviço para verificar status do Petronect
 * Utiliza o serviço Playwright (porta 3003) que já está rodando no servidor
 */

const PLAYWRIGHT_SERVICE_URL = process.env.PLAYWRIGHT_SERVICE_URL || 'http://localhost:3003';

class PetronectStatusService {
  async checkStatus() {
    const startTime = Date.now();

    try {
      console.log('[PetronectStatus] Chamando serviço Playwright...');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000); // 60 segundos timeout

      const response = await fetch(`${PLAYWRIGHT_SERVICE_URL}/petronect-status`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('[PetronectStatus] Resposta recebida:', result.data?.status);

      return result;

    } catch (error) {
      const responseTime = Date.now() - startTime;

      console.error('[PetronectStatus] Erro ao chamar serviço Playwright:', error.message);

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
