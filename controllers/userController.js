const pool = require('../config/db');

// Lista todos los usuarios (sin mostrar contraseñas)
const listarUsuarios = async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT id_usuario, nombre, correo, id_rol
             FROM usuarios
             ORDER BY id_usuario`
        );

        res.json(resultado.rows);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Error al obtener los usuarios'
        });
    }
};

// Cambia el rol de un usuario (1 = Usuario, 2 = Cocinero, 3 = Administrador)
const cambiarRol = async (req, res) => {
    try {
        const id_usuario = Number(req.params.id);
        const id_rol = Number(req.body.id_rol);

        if (!Number.isInteger(id_usuario)) {
            return res.status(400).json({
                error: 'El id del usuario no es válido'
            });
        }

        if (![1, 2, 3].includes(id_rol)) {
            return res.status(400).json({
                error: 'El rol debe ser 1, 2 o 3'
            });
        }

        // Evita que el administrador se quite su propio permiso
        if (id_usuario === req.usuario.id_usuario) {
            return res.status(400).json({
                error: 'No podés cambiar tu propio rol'
            });
        }

        const resultado = await pool.query(
            `UPDATE usuarios
             SET id_rol = $1
             WHERE id_usuario = $2
             RETURNING id_usuario, nombre, correo, id_rol`,
            [id_rol, id_usuario]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                error: 'Usuario no encontrado'
            });
        }

        res.json({
            mensaje: 'Rol actualizado correctamente',
            usuario: resultado.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Error al cambiar el rol'
        });
    }
};

// Elimina un usuario (no deja si tiene recetas creadas)
const eliminarUsuario = async (req, res) => {
    try {
        const id_usuario = Number(req.params.id);

        if (!Number.isInteger(id_usuario)) {
            return res.status(400).json({
                error: 'El id del usuario no es válido'
            });
        }

        if (id_usuario === req.usuario.id_usuario) {
            return res.status(400).json({
                error: 'No podés eliminar tu propia cuenta'
            });
        }

        const resultado = await pool.query(
            `DELETE FROM usuarios
             WHERE id_usuario = $1
             RETURNING id_usuario`,
            [id_usuario]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                error: 'Usuario no encontrado'
            });
        }

        res.json({
            mensaje: 'Usuario eliminado correctamente'
        });

    } catch (error) {
        // 23503 = clave foránea: el usuario todavía tiene recetas
        if (error.code === '23503') {
            return res.status(400).json({
                error: 'No se puede eliminar: el usuario tiene recetas creadas'
            });
        }

        console.error(error);

        res.status(500).json({
            error: 'Error al eliminar el usuario'
        });
    }
};

module.exports = {
    listarUsuarios,
    cambiarRol,
    eliminarUsuario
};