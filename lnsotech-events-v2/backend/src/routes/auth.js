const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const BackupController = require('../controllers/BackupController');
const SystemController = require('../controllers/SystemController');
const { verificarToken } = require('../middleware/auth');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Configuração do Multer para Backups
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.resolve(__dirname, '../../../uploads/backups');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, 'uploaded_backup_' + Date.now() + '.sql');
    }
});
const upload = multer({ storage });

// ========== AUTENTICAÇÃO ========== //
router.post('/login', AuthController.login);
router.post('/login/2fa/verify', AuthController.verify2FA);
router.get('/me', verificarToken, AuthController.me);
router.get('/2fa/setup', verificarToken, AuthController.setup2FA);
router.post('/2fa/enable', verificarToken, AuthController.enable2FA);
router.get('/usuarios/:id/2fa/setup', verificarToken, AuthController.adminSetup2FA);
router.post('/usuarios/:id/2fa/enable', verificarToken, AuthController.adminEnable2FA);
router.post('/usuarios/:id/2fa/disable', verificarToken, AuthController.adminDisable2FA);

// ========== GESTÃO DE USUÁRIOS & AUDITORIA (Admin) ========== //
router.get('/auditoria', AuthController.getLogsAuditoria);
router.get('/usuarios', AuthController.listUsers);
router.post('/usuarios', AuthController.createUser);
router.put('/usuarios/:id', AuthController.updateUser);
router.delete('/usuarios/:id', AuthController.deleteUser);

// ========== BACKUPS ========== //
router.get('/backups', BackupController.list);
router.post('/backups/gerar', BackupController.generate);
router.get('/backups/download/:filename', BackupController.download);
router.post('/backups/restore/:filename', BackupController.restore);
router.post('/backups/upload', upload.single('file'), BackupController.uploadRestore);
router.delete('/backups/:filename', BackupController.delete);

// ========== CONFIGURAÇÕES ========== //
router.get('/configuracoes', SystemController.listConfigs);
router.post('/configuracoes', SystemController.updateConfig);

// ========== GESTÃO DE GRUPOS ========== //
router.get('/grupos/muted', SystemController.listMutedGrupos);
router.post('/grupos/toggle-mute', SystemController.toggleGrupoMute);

module.exports = router;
