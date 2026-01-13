const express = require('express');
const router = express.Router();

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

module.exports = router;
