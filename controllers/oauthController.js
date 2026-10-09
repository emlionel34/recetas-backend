const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Direcciones de Discord para el inicio de sesión (OAuth2)
const DISCORD = {
    autorizar: 'https://discord.com/oauth2/authorize',
    token: 'https://discord.com/api/oauth2/token',
    perfil: 'https://discord.com/api/users/@me'
};

// Solo se aceptan direcciones de regreso que pertenezcan a nuestra app.
// Así nadie puede usar el servidor para mandar a un usuario a un sitio ajeno.
const esDireccionDeLaApp = (direccion) => {
    return /^(recetas|exp|exps):\/\//i.test(direccion || '');
};

// Dirección fija del servidor donde Discord devuelve al usuario
const direccionDeRetorno = () => {
    return `${process.env.BACKEND_URL}/api/auth/discord/callback`;
};

// Vuelve a la app agregando datos a la dirección (por ejemplo ?token=...)
const volverALaApp = (res, direccion, datos) => {
    const separador = direccion.includes('?') ? '&' : '?';
    const consulta = new URLSearchParams(datos).toString();

    res.redirect(`${direccion}${separador}${consulta}`);
};

// Crea el mismo token que el login normal (2 horas)
const crearToken = (usuario) => {
    return jwt.sign(
        {
            id_usuario: usuario.id_usuario,
            id_rol: usuario.id_rol
        },
        process.env.JWT_SECRET,
        { expiresIn: '2h' }
    );
};

// Busca al usuario por su correo. Si no existe, lo crea con rol 1 (usuario común).
const buscarOCrearUsuario = async (nombre, correo) => {
    correo = correo.trim().toLowerCase();

    const existente = await pool.query(
        `SELECT id_usuario, nombre, correo, id_rol
         FROM usuarios
         WHERE correo = $1`,
        [correo]
    );

    if (existente.rows.length > 0) {
        return existente.rows[0];
    }

    // Una cuenta que entra por Discord no tiene contraseña propia:
    // se guarda una al azar, encriptada, que nadie conoce.
    const contraseñaAlAzar = await bcrypt.hash(
        crypto.randomBytes(32).toString('hex'),
        10
    );

    const nombreFinal = (nombre || correo.split('@')[0]).trim().slice(0, 50);

    const nuevo = await pool.query(
        `INSERT INTO usuarios (nombre, correo, contraseña, id_rol)
         VALUES ($1, $2, $3, 1)
         RETURNING id_usuario, nombre, correo, id_rol`,
        [nombreFinal, correo, contraseñaAlAzar]
    );

    return nuevo.rows[0];
};

// Paso 1: la app abre esta dirección y mandamos al usuario a Discord
const iniciarDiscord = (req, res) => {
    const volver = req.query.app_redirect;

    if (!esDireccionDeLaApp(volver)) {
        return res.status(400).send('Dirección de regreso no válida');
    }

    if (!process.env.DISCORD_CLIENT_ID || !process.env.BACKEND_URL) {
        return volverALaApp(res, volver, {
            error: 'El servidor no tiene configurado el acceso con Discord'
        });
    }

    // El "state" viaja a Discord y vuelve igual. Lleva firmada la dirección
    // de regreso, así no se puede cambiar por el camino.
    const state = jwt.sign({ volver }, process.env.JWT_SECRET, {
        expiresIn: '10m'
    });

    const parametros = new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        response_type: 'code',
        scope: 'identify email',
        redirect_uri: direccionDeRetorno(),
        state
    });

    res.redirect(`${DISCORD.autorizar}?${parametros.toString()}`);
};

// Paso 2: Discord devuelve al usuario acá con un código
const callbackDiscord = async (req, res) => {
    const { code, state, error } = req.query;
    let volver;

    try {
        volver = jwt.verify(state, process.env.JWT_SECRET).volver;
    } catch (errorState) {
        return res
            .status(400)
            .send('El intento de acceso venció. Volvé a probar desde la app.');
    }

    if (error || !code) {
        return volverALaApp(res, volver, {
            error: 'Se canceló el acceso con Discord'
        });
    }

    try {
        // Cambia el código por un token de Discord
        const respuestaToken = await fetch(DISCORD.token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code,
                redirect_uri: direccionDeRetorno()
            })
        });

        const datosToken = await respuestaToken.json();

        if (!respuestaToken.ok || !datosToken.access_token) {
            throw new Error('Discord no aceptó el código');
        }

        // Pide a Discord los datos del usuario
        const respuestaPerfil = await fetch(DISCORD.perfil, {
            headers: { Authorization: `Bearer ${datosToken.access_token}` }
        });

        const perfil = await respuestaPerfil.json();

        if (!respuestaPerfil.ok) {
            throw new Error('No se pudo leer el perfil de Discord');
        }

        // Discord no obliga a verificar el correo, así que se comprueba acá
        if (!perfil.email || perfil.verified !== true) {
            return volverALaApp(res, volver, {
                error: 'El correo de tu cuenta de Discord no está verificado'
            });
        }

        const usuario = await buscarOCrearUsuario(
            perfil.global_name || perfil.username,
            perfil.email
        );

        volverALaApp(res, volver, { token: crearToken(usuario) });

    } catch (errorProceso) {
        console.error(errorProceso);

        volverALaApp(res, volver, {
            error: 'No se pudo iniciar sesión con Discord'
        });
    }
};

// La app pide los datos del usuario que acaba de entrar (necesita token)
const obtenerPerfil = async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT id_usuario, nombre, correo, id_rol
             FROM usuarios
             WHERE id_usuario = $1`,
            [req.usuario.id_usuario]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ usuario: resultado.rows[0] });

    } catch (error) {
        console.error(error);

        res.status(500).json({ error: 'Error al obtener el perfil' });
    }
};

module.exports = {
    iniciarDiscord,
    callbackDiscord,
    obtenerPerfil
};
