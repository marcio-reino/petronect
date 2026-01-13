const express = require('express');
const router = express.Router();
const oportunidadeController = require('../controllers/oportunidadeController');
const { verifyToken, isAdmin } = require('../middlewares/auth');

// Todas as rotas de oportunidades requerem autenticação
router.use(verifyToken);

// Rotas de listagem e busca
router.get('/', oportunidadeController.getAllOportunidades);
router.get('/:id', oportunidadeController.getOportunidadeById);
router.get('/:id/itens', oportunidadeController.getOportunidadeItens);

// Rotas de criação, atualização e exclusão (apenas admin)
router.post('/', isAdmin, oportunidadeController.createOportunidade);
router.put('/:id', isAdmin, oportunidadeController.updateOportunidade);
router.delete('/:id', isAdmin, oportunidadeController.deleteOportunidade);

// Rota para atualizar item (comentário)
router.put('/itens/:itemId', oportunidadeController.updateOportunidadeItem);

module.exports = router;
