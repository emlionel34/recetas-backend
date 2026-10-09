const express = require('express');

const router = express.Router();

const { verificarToken } = require('../middleware/auth');

const {
    iniciarConServicio,
    callbackDeServicio,
    obtenerPerfil
} = require('../controllers/oauthController');

// Datos del usuario logueado (los usa la app después de entrar con un servicio).
// Tiene que ir antes que las rutas con :proveedor, para que "me" no se confunda con un servicio.
router.get('/me', verificarToken, obtenerPerfil);

// Acceso con un servicio externo (discord, github, google o facebook):
// primero se va al servicio y después vuelve al callback
router.get('/:proveedor', iniciarConServicio);
router.get('/:proveedor/callback', callbackDeServicio);

module.exports = router;
