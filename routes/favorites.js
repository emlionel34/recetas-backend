const express = require('express');

const router = express.Router();

const { verificarToken } = require('../middleware/auth');

const {
    agregarFavorito,
    listarFavoritos,
    eliminarFavorito
} = require('../controllers/favoriteController');

router.post('/', verificarToken, agregarFavorito);
router.get('/', verificarToken, listarFavoritos);
router.delete('/:id_receta', verificarToken, eliminarFavorito);

module.exports = router;