const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class BackupService {
    getBackupDir() {
        const dir = path.resolve(__dirname, '../../../uploads/backups');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        return dir;
    }

    async listarBackups() {
        const backupDir = this.getBackupDir();
        return new Promise((resolve, reject) => {
            fs.readdir(backupDir, (err, files) => {
                if (err) return reject(err);
                const list = files.map(file => {
                    const stats = fs.statSync(path.join(backupDir, file));
                    return {
                        name: file,
                        size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
                        date: stats.mtime
                    };
                }).sort((a,b) => b.date - a.date);
                resolve(list);
            });
        });
    }

    async gerarBackup() {
        const backupDir = this.getBackupDir();
        const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const fileName = `manual_backup_${dateStr}.sql`;
        const filePath = path.join(backupDir, fileName);

        const host = process.env.DB_HOST || 'database';
        const user = process.env.DB_USER || 'lnso_admin';
        const pass = process.env.DB_PASSWORD || 'luis@nhaca';
        const db   = process.env.DB_NAME || 'lnsotech_db';

        const dumpCommand = `PGPASSWORD='${pass}' pg_dump -h ${host} -U ${user} -d ${db} -F c -f "${filePath}"`;

        return new Promise((resolve, reject) => {
            exec(dumpCommand, (error) => {
                if (error) return reject(error);
                resolve(fileName);
            });
        });
    }

    async restaurarBackup(filename) {
        const backupDir = this.getBackupDir();
        const filePath = path.join(backupDir, filename);

        if (!fs.existsSync(filePath)) throw new Error('Ficheiro não encontrado');

        const host = process.env.DB_HOST || 'database';
        const user = process.env.DB_USER || 'lnso_admin';
        const pass = process.env.DB_PASSWORD || 'luis@nhaca';
        const db   = process.env.DB_NAME || 'lnsotech_db';

        const restoreCmd = `PGPASSWORD='${pass}' pg_restore -h ${host} -U ${user} -d ${db} -c -1 "${filePath}"`;

        return new Promise((resolve, reject) => {
            exec(restoreCmd, (error, stdout, stderr) => {
                if (error && !stderr.includes('already exists')) return reject(stderr);
                resolve();
            });
        });
    }

    async apagarBackup(filename) {
        const backupDir = this.getBackupDir();
        const filePath = path.join(backupDir, filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
}

module.exports = new BackupService();
