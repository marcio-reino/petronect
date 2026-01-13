const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, isAdmin } = require('../middlewares/auth');
const { uploadUserAvatar } = require('../middlewares/upload');

// Todas as rotas de usuários requerem autenticação
router.use(verifyToken);

// Rota para obter perfil do usuário logado
router.get('/profile', userController.getProfile);

// Rota para atualizar perfil do usuário logado
router.put('/profile', userController.updateProfile);

// Rota para alterar senha do usuário logado
router.put('/change-password', userController.changePassword);

// Rota para upload de avatar do usuário logado
router.post('/profile/avatar', uploadUserAvatar, userController.uploadAvatar);

// Rota para listar todos os roles (disponível para todos os usuários autenticados)
router.get('/roles', userController.getAllRoles);

// Rota para criar um novo role (apenas admin)
router.post('/roles', isAdmin, userController.createRole);

// Rota para atualizar permissões de um role (apenas admin)
router.put('/roles/:id', isAdmin, userController.updateRolePermissions);

// Rota para deletar um role (apenas admin)
router.delete('/roles/:id', isAdmin, userController.deleteRole);

// Rotas de gerenciamento de empresas do usuário (apenas admin)
router.get('/:id/companies', isAdmin, userController.getUserCompanies);
router.post('/:id/companies', isAdmin, userController.assignCompanyToUser);
router.delete('/:id/companies/:companyId', isAdmin, userController.removeCompanyFromUser);

// Rota para buscar usuários de uma empresa
router.get('/company/:companyId', userController.getUsersByCompany);

// Rotas que requerem permissão de admin
router.get('/', isAdmin, userController.getAllUsers);
router.post('/', isAdmin, userController.createUser);
router.get('/:id', isAdmin, userController.getUserById);
router.put('/:id', isAdmin, userController.updateUser);
router.delete('/:id', isAdmin, userController.deleteUser);

module.exports = router;
