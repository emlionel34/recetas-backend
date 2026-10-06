const jwt = require('jsonwebtoken');

const verificarToken = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                error: 'Token no proporcionado'
            });
        }

        const token = authHeader.split(' ')[1];

        const usuario = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.usuario = usuario;

        next();

    } catch (error) {
        return res.status(401).json({
            error: 'Token inválido o expirado'
        });
    }
};

const verificarRol = (...rolesPermitidos) => {
    return (req, res, next) => {
        if (!rolesPermitidos.includes(req.usuario.id_rol)) {
            return res.status(403).json({
                error: 'No tenés permisos para realizar esta acción'
            });
        }

        next();
    };
};

module.exports = {
    verificarToken,
    verificarRol
};