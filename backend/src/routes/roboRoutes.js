const express = require('express');
const router = express.Router();
const roboController = require('../controllers/roboController');
const { verifyToken, isAdmin } = require('../middlewares/auth');

// Rotas públicas chamadas pelo bot (sem autenticação JWT)
router.post('/:id/log', roboController.addLog);
router.post('/:id/processo', roboController.updateProcesso);
router.post('/complete-op', roboController.completeOp);
router.post('/:id/request-verification', roboController.requestVerificationCode);
router.get('/:id/check-verification', roboController.checkVerificationCode);

// SSE (Server-Sent Events) - rota pública para receber notificações em tempo real
// EventSource não suporta headers customizados, então não requer JWT
router.get('/:id/events', roboController.subscribeToEvents);

// Todas as outras rotas de robôs requerem autenticação
router.use(verifyToken);

// Rotas de listagem e busca
router.get('/', roboController.getAllRobos);
router.get('/:id', roboController.getRoboById);

// Rotas de criação, atualização e exclusão (apenas admin)
router.post('/', isAdmin, roboController.createRobo);
router.put('/:id', isAdmin, roboController.updateRobo);
router.delete('/:id', isAdmin, roboController.deleteRobo);

// Rotas de oportunidades específicas
router.get('/:roboId/oportunidades-especificas', roboController.getOportunidadesEspecificas);
router.post('/:roboId/oportunidades-especificas', roboController.addOportunidadeEspecifica);
router.post('/:roboId/oportunidades-especificas/lote', roboController.addOportunidadesLote);
router.delete('/:roboId/oportunidades-especificas/:opespId', roboController.removeOportunidadeEspecifica);
router.put('/:roboId/oportunidades-especificas/reorder', roboController.reorderOportunidadesEspecificas);

// Rotas de controle do bot (Monitor) - requerem autenticação
router.get('/:id/screenshot', roboController.getScreenshot);
router.get('/:id/historico', roboController.getHistorico);
router.get('/:id/processo', roboController.getProcesso);
router.post('/:id/start', isAdmin, roboController.startBot);
router.post('/:id/stop', isAdmin, roboController.stopBot);

// Rotas de verificação de código (2FA) - requerem autenticação do usuário
router.get('/:id/verification-status', roboController.getVerificationStatus);
router.post('/:id/verification-code', roboController.submitVerificationCode);
router.post('/:id/cancel-verification', roboController.cancelVerification);

// Rota de debug - simular solicitação de código (remover em produção)
router.post('/:id/debug-request-verification', roboController.requestVerificationCode);

// Rota de limpeza de histórico (apenas admin)
router.post('/cleanup-historico', isAdmin, roboController.cleanupHistorico);

module.exports = router;
