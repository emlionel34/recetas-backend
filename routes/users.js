const express = require('express');

const router = express.Router();

const { verificarToken, verificarRol } = require('../middleware/auth');

const {
    listarUsuarios,
    cambiarRol,
    eliminarUsuario
} = require('../controllers/userController');

// Todas las rutas exigen token y rol 3 (Administrador)
router.get('/', verificarToken, verificarRol(3), listarUsuarios);
router.put('/:id/rol', verificarToken, verificarRol(3), cambiarRol);
router.delete('/:id', verificarToken, verificarRol(3), eliminarUsuario);

module.exports = router;