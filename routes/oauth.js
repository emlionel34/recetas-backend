const express = require('express');

const router = express.Router();

const { verificarToken } = require('../middleware/auth');

const {
    iniciarDiscord,
    callbackDiscord,
    obtenerPerfil
} = require('../controllers/oauthController');

// Acceso con Discord: primero se va a Discord y después vuelve al callback
router.get('/discord', iniciarDiscord);
router.get('/discord/callback', callbackDiscord);

// Datos del usuario logueado (los usa la app después de un acceso con Discord)
router.get('/me', verificarToken, obtenerPerfil);

module.exports = router;
