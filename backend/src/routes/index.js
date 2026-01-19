const express = require('express');
const router = express.Router();
const petronectStatusService = require('../services/petronectStatusService');

// Importar rotas
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const logRoutes = require('./logRoutes');
const oportunidadeRoutes = require('./oportunidadeRoutes');
const roboRoutes = require('./roboRoutes');

// Rotas públicas
router.use('/auth', authRoutes);

// Rotas protegidas
router.use('/users', userRoutes);
router.use('/logs', logRoutes);
router.use('/oportunidades', oportunidadeRoutes);
router.use('/robos', roboRoutes);

// Rota de teste
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API do Sistema Modelo está funcionando!',
    timestamp: new Date().toISOString()
  });
});

// Rota para verificar status do site Petronect (usando Playwright)
router.get('/petronect-status', async (req, res) => {
  try {
    const result = await petronectStatusService.checkStatus();
    res.json(result);
  } catch (error) {
    console.error('[petronect-status] Erro:', error.message);
    res.json({
      success: true,
      data: {
        status: 'offline',
        statusCode: 0,
        responseTime: 0,
        error: error.message,
        checkedAt: new Date().toISOString()
      }
    });
  }
});

module.exports = router;
