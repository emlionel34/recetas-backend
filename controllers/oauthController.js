const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Hace un pedido a un servicio externo y devuelve la respuesta ya leída.
// Si el servicio contesta con error, lanza una excepción.
const pedirJson = async (direccion, opciones) => {
    const respuesta = await fetch(direccion, opciones);
    const datos = await respuesta.json();

    if (!respuesta.ok) {
        throw new Error(`Error ${respuesta.status} al consultar ${direccion}`);
    }

    return datos;
};

// Configuración de cada servicio. Para sumar uno nuevo, se agrega un bloque.
//  - autorizar / token: direcciones del servicio para el acceso (OAuth2)
//  - variableId / variableSecreto: nombres de las variables de entorno en Render
//  - leerPerfil: devuelve { nombre, correo, verificado } a partir del token del servicio
const PROVEEDORES = {
    discord: {
        nombre: 'Discord',
        autorizar: 'https://discord.com/oauth2/authorize',
        token: 'https://discord.com/api/oauth2/token',
        scope: 'identify email',
        variableId: 'DISCORD_CLIENT_ID',
        variableSecreto: 'DISCORD_CLIENT_SECRET',
        leerPerfil: async (accessToken) => {
            const datos = await pedirJson('https://discord.com/api/users/@me', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            return {
                nombre: datos.global_name || datos.username,
                correo: datos.email,
                // Discord no obliga a verificar el correo, así que se comprueba acá
                verificado: datos.verified === true
            };
        }
    },

    github: {
        nombre: 'GitHub',
        autorizar: 'https://github.com/login/oauth/authorize',
        token: 'https://github.com/login/oauth/access_token',
        scope: 'read:user user:email',
        variableId: 'GITHUB_CLIENT_ID',
        variableSecreto: 'GITHUB_CLIENT_SECRET',
        leerPerfil: async (accessToken) => {
            const cabeceras = {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/vnd.github+json',
                'User-Agent': 'recetas-app'
            };

            const usuario = await pedirJson('https://api.github.com/user', {
                headers: cabeceras
            });

            // El correo puede ser privado, así que se pide la lista completa
            const correos = await pedirJson('https://api.github.com/user/emails', {
                headers: cabeceras
            });

            const elegido =
                correos.find((c) => c.primary && c.verified) ||
                correos.find((c) => c.verified);

            return {
                nombre: usuario.name || usuario.login,
                correo: elegido ? elegido.email : null,
                verificado: Boolean(elegido)
            };
        }
    },

    google: {
        nombre: 'Google',
        autorizar: 'https://accounts.google.com/o/oauth2/v2/auth',
        token: 'https://oauth2.googleapis.com/token',
        scope: 'openid email profile',
        variableId: 'GOOGLE_CLIENT_ID',
        variableSecreto: 'GOOGLE_CLIENT_SECRET',
        leerPerfil: async (accessToken) => {
            const datos = await pedirJson(
                'https://openidconnect.googleapis.com/v1/userinfo',
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            return {
                nombre: datos.name,
                correo: datos.email,
                verificado: datos.email_verified === true
            };
        }
    },

    facebook: {
        nombre: 'Facebook',
        autorizar: 'https://www.facebook.com/v25.0/dialog/oauth',
        token: 'https://graph.facebook.com/v25.0/oauth/access_token',
        metodoToken: 'GET',
        scope: 'email,public_profile',
        variableId: 'FACEBOOK_CLIENT_ID',
        variableSecreto: 'FACEBOOK_CLIENT_SECRET',
        leerPerfil: async (accessToken) => {
            const datos = await pedirJson(
                'https://graph.facebook.com/v25.0/me?fields=id,name,email' +
                `&access_token=${encodeURIComponent(accessToken)}`
            );

            // Facebook solo entrega un correo si la cuenta tiene uno válido.
            // Si la cuenta no tiene correo, no se puede entrar.
            return {
                nombre: datos.name,
                correo: datos.email,
                verificado: Boolean(datos.email)
            };
        }
    }
};

// Busca el servicio pedido en la dirección (ignora nombres que no existan)
const buscarProveedor = (nombre) => {
    return Object.prototype.hasOwnProperty.call(PROVEEDORES, nombre)
        ? PROVEEDORES[nombre]
        : null;
};

// Solo se aceptan direcciones de regreso que pertenezcan a nuestra app.
// Así nadie puede usar el servidor para mandar a un usuario a un sitio ajeno.
const esDireccionDeLaApp = (direccion) => {
    return /^(recetas|exp|exps):\/\//i.test(direccion || '');
};

// Dirección fija del servidor donde el servicio devuelve al usuario
const direccionDeRetorno = (proveedor) => {
    return `${process.env.BACKEND_URL}/api/auth/${proveedor}/callback`;
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

    // Una cuenta que entra por un servicio externo no tiene contraseña propia:
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

// Cambia el código que devuelve el servicio por un token de acceso
const intercambiarCodigo = async (config, proveedor, code) => {
    const parametros = new URLSearchParams({
        client_id: process.env[config.variableId],
        client_secret: process.env[config.variableSecreto],
        grant_type: 'authorization_code',
        code,
        redirect_uri: direccionDeRetorno(proveedor)
    });

    let respuesta;

    if (config.metodoToken === 'GET') {
        respuesta = await fetch(`${config.token}?${parametros.toString()}`, {
            headers: { Accept: 'application/json' }
        });
    } else {
        respuesta = await fetch(config.token, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json'
            },
            body: parametros
        });
    }

    const datos = await respuesta.json();

    if (!respuesta.ok || !datos.access_token) {
        throw new Error(`${config.nombre} no aceptó el código`);
    }

    return datos.access_token;
};

// Paso 1: la app abre esta dirección y mandamos al usuario al servicio
const iniciarConServicio = (req, res) => {
    const proveedor = req.params.proveedor;
    const config = buscarProveedor(proveedor);

    if (!config) {
        return res.status(404).send('Servicio no disponible');
    }

    const volver = req.query.app_redirect;

    if (!esDireccionDeLaApp(volver)) {
        return res.status(400).send('Dirección de regreso no válida');
    }

    if (
        !process.env[config.variableId] ||
        !process.env[config.variableSecreto] ||
        !process.env.BACKEND_URL
    ) {
        return volverALaApp(res, volver, {
            error: `El servidor no tiene configurado el acceso con ${config.nombre}`
        });
    }

    // El "state" viaja al servicio y vuelve igual. Lleva firmadas la dirección
    // de regreso y el servicio, así no se pueden cambiar por el camino.
    const state = jwt.sign({ volver, proveedor }, process.env.JWT_SECRET, {
        expiresIn: '10m'
    });

    const parametros = new URLSearchParams({
        client_id: process.env[config.variableId],
        response_type: 'code',
        scope: config.scope,
        redirect_uri: direccionDeRetorno(proveedor),
        state
    });

    res.redirect(`${config.autorizar}?${parametros.toString()}`);
};

// Paso 2: el servicio devuelve al usuario acá con un código
const callbackDeServicio = async (req, res) => {
    const proveedor = req.params.proveedor;
    const config = buscarProveedor(proveedor);

    if (!config) {
        return res.status(404).send('Servicio no disponible');
    }

    const { code, state, error } = req.query;
    let volver;

    try {
        const datosState = jwt.verify(state, process.env.JWT_SECRET);

        if (datosState.proveedor !== proveedor) {
            throw new Error('El state es de otro servicio');
        }

        volver = datosState.volver;
    } catch (errorState) {
        return res
            .status(400)
            .send('El intento de acceso venció. Volvé a probar desde la app.');
    }

    if (error || !code) {
        return volverALaApp(res, volver, {
            error: `Se canceló el acceso con ${config.nombre}`
        });
    }

    try {
        const accessToken = await intercambiarCodigo(config, proveedor, code);
        const perfil = await config.leerPerfil(accessToken);

        if (!perfil.correo || !perfil.verificado) {
            return volverALaApp(res, volver, {
                error: `Tu cuenta de ${config.nombre} no tiene un correo verificado`
            });
        }

        const usuario = await buscarOCrearUsuario(perfil.nombre, perfil.correo);

        volverALaApp(res, volver, { token: crearToken(usuario) });

    } catch (errorProceso) {
        console.error(errorProceso);

        volverALaApp(res, volver, {
            error: `No se pudo iniciar sesión con ${config.nombre}`
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
    iniciarConServicio,
    callbackDeServicio,
    obtenerPerfil
};
