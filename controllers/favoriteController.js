const pool = require('../config/db');

const agregarFavorito = async (req, res) => {
    try {
        const id_usuario = req.usuario.id_usuario;
        const { id_receta } = req.body;

        if (!id_receta) {
            return res.status(400).json({
                error: 'El id de la receta es obligatorio'
            });
        }

        const receta = await pool.query(
            'SELECT id_receta FROM recetas WHERE id_receta = $1',
            [id_receta]
        );

        if (receta.rows.length === 0) {
            return res.status(404).json({
                error: 'Receta no encontrada'
            });
        }

        const resultado = await pool.query(
            `INSERT INTO favoritos (id_usuario, id_receta)
             VALUES ($1, $2)
             RETURNING *`,
            [id_usuario, id_receta]
        );

        res.status(201).json({
            mensaje: 'Receta agregada a favoritos',
            favorito: resultado.rows[0]
        });

    } catch (error) {

        if (error.code === '23505') {
            return res.status(400).json({
                error: 'La receta ya está en favoritos'
            });
        }

        console.error(error);

        res.status(500).json({
            error: 'Error al agregar favorito'
        });
    }
};

const listarFavoritos = async (req, res) => {
    try {
        const id_usuario = req.usuario.id_usuario;

        const resultado = await pool.query(
            `SELECT recetas.*
             FROM favoritos
             INNER JOIN recetas
             ON favoritos.id_receta = recetas.id_receta
             WHERE favoritos.id_usuario = $1`,
            [id_usuario]
        );

        res.json(resultado.rows);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Error al obtener los favoritos'
        });
    }
};
const eliminarFavorito = async (req, res) => {
    try {
        const id_usuario = req.usuario.id_usuario;
        const { id_receta } = req.params;

        const resultado = await pool.query(
            `DELETE FROM favoritos
             WHERE id_usuario = $1
             AND id_receta = $2
             RETURNING *`,
            [id_usuario, id_receta]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                error: 'La receta no está en tus favoritos'
            });
        }

        res.json({
            mensaje: 'Receta eliminada de favoritos'
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Error al eliminar favorito'
        });
    }
};

module.exports = {
    agregarFavorito,
    listarFavoritos,
    eliminarFavorito
};