const express = require('express');

const router = express.Router();

const {
    listarRecetas,
    obtenerReceta,
    crearReceta,
    actualizarReceta,
    eliminarReceta
} = require('../controllers/recipeController');

const { verificarToken, verificarRol } = require('../middleware/auth');

router.get('/', verificarToken, listarRecetas);

router.get('/:id', obtenerReceta);

router.post('/', verificarToken, verificarRol(2, 3), crearReceta);

router.put('/:id', verificarToken, verificarRol(2, 3), actualizarReceta);

router.delete('/:id', verificarToken, verificarRol(2, 3), eliminarReceta);

module.exports = router;