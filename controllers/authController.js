const bcrypt = require('bcrypt');
const pool = require('../config/db');
const jwt = require('jsonwebtoken');

const registrarUsuario = async (req, res) => {
    try {
        let { nombre, correo, contraseña } = req.body;

        // Valida campos obligatorios
        if (!nombre || !correo || !contraseña) {
            return res.status(400).json({
                error: 'Todos los campos son obligatorios'
            });
        }

        // Limpia espacios
        nombre = nombre.trim();
        correo = correo.trim().toLowerCase();

        // Valida que no estén vacíos
        if (!nombre || !correo || !contraseña.trim()) {
            return res.status(400).json({
                error: 'Los campos no pueden estar vacíos'
            });
        }

        // Valida formato del correo
        if (!correo.includes('@') || !correo.includes('.')) {
            return res.status(400).json({
                error: 'El correo no tiene un formato válido'
            });
        }

        // Valida el minimo de caracteres de la contraseña
        if (contraseña.length < 6) {
            return res.status(400).json({
                error: 'La contraseña debe tener al menos 6 caracteres'
            });
        }

        const usuarioExistente = await pool.query(
            'SELECT * FROM usuarios WHERE correo = $1',
            [correo]
        );

        if (usuarioExistente.rows.length > 0) {
            return res.status(400).json({
                error: 'El correo ya está registrado'
            });
        }

        const contraseñaHasheada = await bcrypt.hash(contraseña, 10);

        const resultado = await pool.query(
            `INSERT INTO usuarios (nombre, correo, contraseña, id_rol)
             VALUES ($1, $2, $3, $4)
             RETURNING id_usuario, nombre, correo, id_rol`,
            [nombre, correo, contraseñaHasheada, 1]
        );

        res.status(201).json({
            mensaje: 'Usuario registrado correctamente',
            usuario: resultado.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Error al registrar usuario'
        });
    }
};

const iniciarSesion = async (req, res) => {
    try {
        let { correo, contraseña } = req.body;

        // Validar campos obligatorios
        if (!correo || !contraseña) {
            return res.status(400).json({
                error: 'Correo y contraseña son obligatorios'
            });
        }

        // Limpiar espacios y normalizar correo
        correo = correo.trim().toLowerCase();

        if (!correo || !contraseña.trim()) {
            return res.status(400).json({
                error: 'Los campos no pueden estar vacíos'
            });
        }

        const resultado = await pool.query(
            'SELECT * FROM usuarios WHERE correo = $1',
            [correo]
        );

        if (resultado.rows.length === 0) {
            return res.status(401).json({
                error: 'Correo o contraseña incorrectos'
            });
        }

        const usuario = resultado.rows[0];

        const contraseñaCorrecta = await bcrypt.compare(
            contraseña,
            usuario.contraseña
        );

        if (!contraseñaCorrecta) {
            return res.status(401).json({
                error: 'Correo o contraseña incorrectos'
            });
        }

        const token = jwt.sign(
            {
                id_usuario: usuario.id_usuario,
                id_rol: usuario.id_rol
            },
            process.env.JWT_SECRET,
            {
                expiresIn: '2h'
            }
        );

        res.json({
            mensaje: 'Inicio de sesión correcto',
            token: token,
            usuario: {
                id_usuario: usuario.id_usuario,
                nombre: usuario.nombre,
                correo: usuario.correo,
                id_rol: usuario.id_rol
            }
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Error al iniciar sesión'
        });
    }
};

module.exports = {
    registrarUsuario,
    iniciarSesion
};