const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'database',
    user: process.env.DB_USER || 'lnso_admin',
    password: process.env.DB_PASSWORD || 'luis@nhaca',
    database: process.env.DB_NAME || 'lnsotech_db',
    port: process.env.DB_PORT || 5432,
});

// Singleton Pattern: Exporting the same pool instance
module.exports = {
    query: (text, params) => pool.query(text, params),
    pool, // Direct access if needed for transactions
};
