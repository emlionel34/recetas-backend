const express = require('express');

const router = express.Router();

const {
    listarRecetas,
    obtenerReceta,
    crearReceta,
    actualizarReceta,
    eliminarReceta,
    aprobarReceta
} = require('../controllers/recipeController');

const { verificarToken, verificarRol } = require('../middleware/auth');

router.get('/', verificarToken, listarRecetas);

router.get('/:id', obtenerReceta);

router.post('/', verificarToken, verificarRol(2, 3), crearReceta);

router.put('/:id', verificarToken, verificarRol(2, 3), actualizarReceta);

// Solo el administrador (rol 3) puede aprobar recetas pendientes
router.put('/:id/aprobar', verificarToken, verificarRol(3), aprobarReceta);

router.delete('/:id', verificarToken, verificarRol(2, 3), eliminarReceta);

module.exports = router;
