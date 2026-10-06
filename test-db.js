const pool = require('./config/db');

async function probarConexion() {
    try {
        const resultado = await pool.query('SELECT NOW()');
        console.log('✅ Conexión exitosa a PostgreSQL');
        console.log(resultado.rows[0]);
    } catch (error) {
        console.error('❌ Error de conexión:', error.message);
    } finally {
        await pool.end();
    }
}

probarConexion();

