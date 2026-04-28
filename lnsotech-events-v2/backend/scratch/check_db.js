const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'lnso_admin',
    password: process.env.DB_PASSWORD || 'luis@nhaca',
    database: process.env.DB_NAME || 'lnsotech_db',
    port: process.env.DB_PORT || 5432,
});

async function check() {
    try {
        console.log('--- EVENTOS ---');
        const resEvents = await pool.query("SELECT id, nomes_principais, tipo_evento, frequencia_lembrete, grupo_id FROM eventos;");
        console.table(resEvents.rows);

        console.log('\n--- BOTS ---');
        const resBots = await pool.query("SELECT id, nome, status, tipos_permitidos FROM whatsapp_bots;");
        console.table(resBots.rows);

        console.log('\n--- GRUPOS CONFIG ---');
        const resGroups = await pool.query("SELECT grupo_id, nome, is_muted FROM grupos_config;");
        console.table(resGroups.rows);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
