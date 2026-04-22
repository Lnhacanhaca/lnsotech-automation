const { Pool } = require('pg');
const pool = new Pool({
    host: process.env.DB_HOST || 'database',   
    user: process.env.DB_USER || 'lnso_admin',         
    password: process.env.DB_PASSWORD || 'luis@nhaca',     
    database: process.env.DB_NAME || 'lnsotech_db',    
    port: 5432,
});

async function check() {
    try {
        const res = await pool.query(`
            SELECT tipo_log, status, COUNT(*) as total 
            FROM logs_envio 
            WHERE criado_em >= CURRENT_DATE 
            GROUP BY tipo_log, status
        `);
        console.log('Logs de hoje:', res.rows);

        const dupes = await pool.query(`
            SELECT evento_id, grupo_id, COUNT(*) as enviados
            FROM logs_envio
            WHERE criado_em >= CURRENT_DATE AND tipo_log = 'envio_sucesso'
            GROUP BY evento_id, grupo_id
            HAVING COUNT(*) > 1
        `);
        console.log('Duplicados hoje:', dupes.rows);
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
check();
