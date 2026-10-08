const pool = require('../config/db');

// La imagen es opcional. Si viene, tiene que ser un enlace http o https.
const imagenValida = (imagen) => {
    return !imagen || /^https?:\/\//i.test(imagen);
};

const crearReceta = async (req, res) => {
    try {
        let { nombre, descripcion, ingredientes, imagen } = req.body;
        const id_usuario = req.usuario.id_usuario;
        const id_rol = req.usuario.id_rol;

        // Valida campos obligatorios
        if (!nombre || !descripcion) {
            return res.status(400).json({
                error: 'El nombre y la descripción son obligatorios'
            });
        }

        // Limpia espacios
        nombre = nombre.trim();
        descripcion = descripcion.trim();
        ingredientes = ingredientes ? ingredientes.trim() : '';
        imagen = imagen ? imagen.trim() : '';

        // Valida que no estén vacíos
        if (!nombre || !descripcion) {
            return res.status(400).json({
                error: 'El nombre y la descripción no pueden estar vacíos'
            });
        }

        // Valida longitud del nombre
        if (nombre.length < 3) {
            return res.status(400).json({
                error: 'El nombre de la receta debe tener al menos 3 caracteres'
            });
        }

        // Valida el enlace de la imagen (si lo hay)
        if (!imagenValida(imagen)) {
            return res.status(400).json({
                error: 'La imagen debe ser un enlace que empiece con http o https'
            });
        }

        const resultado = await pool.query(
            `INSERT INTO recetas (nombre, descripcion, ingredientes, imagen, id_usuario, aprobada)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            // Las recetas del administrador salen aprobadas; las del cocinero quedan pendientes
            [nombre, descripcion, ingredientes || null, imagen || null, id_usuario, id_rol === 3]
        );

        res.status(201).json({
            mensaje: 'Receta creada correctamente',
            receta: resultado.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Error al crear la receta'
        });
    }
};

const listarRecetas = async (req, res) => {
    try {
        let resultado;

        if (req.usuario.id_rol === 3) {
            // Administrador: ve todas, también las pendientes
            resultado = await pool.query(
                'SELECT * FROM recetas ORDER BY id_receta DESC'
            );
        } else {
            // Los demás ven las aprobadas y las que crearon ellos
            resultado = await pool.query(
                `SELECT * FROM recetas
                 WHERE aprobada = TRUE OR id_usuario = $1
                 ORDER BY id_receta DESC`,
                [req.usuario.id_usuario]
            );
        }

        res.json(resultado.rows);
    } catch (error) {
        console.log(error);
        res.status(500).json({
            mensaje: 'Error al obtener las recetas'
        });
    }
};

const obtenerReceta = async (req, res) => {
    try {
        const resultado = await pool.query(
            'SELECT * FROM recetas WHERE id_receta = $1 AND aprobada = TRUE',
            [req.params.id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                error: 'Receta no encontrada'
            });
        }

        res.json(resultado.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Error al obtener la receta'
        });
    }
};

const actualizarReceta = async (req, res) => {
    try {
        let { nombre, descripcion, ingredientes, imagen } = req.body;
        const id_receta = req.params.id;
        const id_usuario = req.usuario.id_usuario;
        const id_rol = req.usuario.id_rol;

        // Validar campos obligatorios
        if (!nombre || !descripcion) {
            return res.status(400).json({
                error: 'El nombre y la descripción son obligatorios'
            });
        }

        // Limpiar espacios
        nombre = nombre.trim();
        descripcion = descripcion.trim();
        ingredientes = ingredientes ? ingredientes.trim() : '';
        imagen = imagen ? imagen.trim() : '';

        // Validar que no estén vacíos
        if (!nombre || !descripcion) {
            return res.status(400).json({
                error: 'El nombre y la descripción no pueden estar vacíos'
            });
        }

        // Validar longitud del nombre
        if (nombre.length < 3) {
            return res.status(400).json({
                error: 'El nombre de la receta debe tener al menos 3 caracteres'
            });
        }

        // Validar el enlace de la imagen (si lo hay)
        if (!imagenValida(imagen)) {
            return res.status(400).json({
                error: 'La imagen debe ser un enlace que empiece con http o https'
            });
        }

        let resultado;

        if (id_rol === 3) {
            // Administrador: puede editar cualquier receta
            resultado = await pool.query(
                `UPDATE recetas
                 SET nombre = $1, descripcion = $2, ingredientes = $3, imagen = $4
                 WHERE id_receta = $5
                 RETURNING *`,
                [nombre, descripcion, ingredientes || null, imagen || null, id_receta]
            );
        } else {
            // Cocinero: solo puede editar sus propias recetas
            resultado = await pool.query(
                `UPDATE recetas
                 SET nombre = $1, descripcion = $2, ingredientes = $3, imagen = $4
                 WHERE id_receta = $5
                 AND id_usuario = $6
                 RETURNING *`,
                [nombre, descripcion, ingredientes || null, imagen || null, id_receta, id_usuario]
            );
        }

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                error: 'Receta no encontrada o no tenés permiso para editarla'
            });
        }

        res.json({
            mensaje: 'Receta actualizada correctamente',
            receta: resultado.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Error al actualizar la receta'
        });
    }
};
const eliminarReceta = async (req, res) => {
    try {
        const id_receta = req.params.id;
        const id_usuario = req.usuario.id_usuario;
        const id_rol = req.usuario.id_rol;

        let resultado;

        if (id_rol === 3) {
            // el Administrador: puede eliminar cualquier receta
            resultado = await pool.query(
                `DELETE FROM recetas
                 WHERE id_receta = $1
                 RETURNING *`,
                [id_receta]
            );
        } else {
            // el Cocinero solamente puede eliminar sus propias recetas
            resultado = await pool.query(
                `DELETE FROM recetas
                 WHERE id_receta = $1
                 AND id_usuario = $2
                 RETURNING *`,
                [id_receta, id_usuario]
            );
        }

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                error: 'Receta no encontrada o no tenés permiso para eliminarla'
            });
        }

        res.json({
            mensaje: 'Receta eliminada correctamente',
            receta: resultado.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Error al eliminar la receta'
        });
    }
};

// Aprueba una receta pendiente (solo administrador, lo controla la ruta)
const aprobarReceta = async (req, res) => {
    try {
        const id_receta = Number(req.params.id);

        if (!Number.isInteger(id_receta)) {
            return res.status(400).json({
                error: 'El id de la receta no es válido'
            });
        }

        const resultado = await pool.query(
            `UPDATE recetas
             SET aprobada = TRUE
             WHERE id_receta = $1
             RETURNING *`,
            [id_receta]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                error: 'Receta no encontrada'
            });
        }

        res.json({
            mensaje: 'Receta aprobada correctamente',
            receta: resultado.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Error al aprobar la receta'
        });
    }
};

module.exports = {
    aprobarReceta,
    listarRecetas,
    obtenerReceta,
    crearReceta,
    actualizarReceta,
    eliminarReceta
};
