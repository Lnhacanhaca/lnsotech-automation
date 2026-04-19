const BackupService = require('../services/BackupService');
const path = require('path');
const fs = require('fs');

class BackupController {
    async list(req, res) {
        try {
            const list = await BackupService.listarBackups();
            res.json(list);
        } catch (err) {
            res.status(500).json({ erro: 'Erro ao ler backups' });
        }
    }

    async generate(req, res) {
        try {
            const filename = await BackupService.gerarBackup();
            res.json({ mensagem: 'Backup gerado!', ficheiro: filename });
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    }

    async download(req, res) {
        const backupDir = BackupService.getBackupDir();
        const file = path.join(backupDir, req.params.filename);
        if (fs.existsSync(file)) {
            res.download(file);
        } else {
            res.status(404).json({ erro: 'Ficheiro não encontrado' });
        }
    }

    async restore(req, res) {
        try {
            await BackupService.restaurarBackup(req.params.filename);
            res.json({ mensagem: 'Backup restaurado com sucesso!' });
        } catch (err) {
            res.status(500).json({ erro: 'Erro ao restaurar', detalhes: err });
        }
    }
}

module.exports = new BackupController();
