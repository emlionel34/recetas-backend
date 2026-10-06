require('dotenv').config();

const { Pool } = require('pg');

// Si existe DATABASE_URL (Supabase, en la nube) se usa esa.
// Si no existe, se usa la base local de siempre.
const pool = process.env.DATABASE_URL
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    })
    : new Pool({
        host: 'localhost',
        port: 5432,
        database: 'recetas_db',
        user: 'postgres',
        password: process.env.DB_PASSWORD
    });

module.exports = pool;
