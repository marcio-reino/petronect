const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middlewares/auth');

// Rotas públicas
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);

// Rotas protegidas
router.get('/verify', verifyToken, authController.verifyToken);
router.post('/logout', verifyToken, authController.logout);

module.exports = router;
