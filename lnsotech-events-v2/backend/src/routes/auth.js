const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const BackupController = require('../controllers/BackupController');
const SystemController = require('../controllers/SystemController');
const { verificarToken } = require('../middleware/auth');

// ========== AUTENTICAÇÃO ========== //
router.post('/login', AuthController.login);
router.get('/me', verificarToken, AuthController.me);

// ========== GESTÃO DE USUÁRIOS (Admin) ========== //
router.get('/usuarios', AuthController.listUsers);
router.post('/usuarios', AuthController.createUser);
router.put('/usuarios/:id', AuthController.updateUser);
router.delete('/usuarios/:id', AuthController.deleteUser);

// ========== BACKUPS ========== //
router.get('/backups', BackupController.list);
router.post('/backups/gerar', BackupController.generate);
router.get('/backups/download/:filename', BackupController.download);
router.post('/backups/restore/:filename', BackupController.restore);
router.delete('/backups/:filename', BackupController.delete);

// ========== CONFIGURAÇÕES ========== //
router.get('/configuracoes', SystemController.listConfigs);
router.post('/configuracoes', SystemController.updateConfig);

// ========== GESTÃO DE GRUPOS ========== //
router.get('/grupos/muted', SystemController.listMutedGrupos);
router.post('/grupos/toggle-mute', SystemController.toggleGrupoMute);

module.exports = router;
