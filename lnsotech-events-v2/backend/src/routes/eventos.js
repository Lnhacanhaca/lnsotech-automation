const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const EventoController = require('../controllers/EventoController');
const BotController = require('../controllers/BotController');
const SystemController = require('../controllers/SystemController');

// Multer configs for uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });
const uploadCSV = multer({ dest: path.join(__dirname, '../uploads/tmp/') });

// ========== EVENTOS ========== //
router.get('/stats', EventoController.getStats);
router.get('/analytics', SystemController.getAnalytics);
router.get('/', EventoController.list);
router.get('/feed.ics', EventoController.getFeed);
router.get('/imagem-evento/:id', EventoController.serveImage); // Rota infalível para fotos
router.get('/:id/historico', EventoController.getHistorico);
router.post('/', EventoController.create);
router.put('/:id', EventoController.update);
router.delete('/:id', EventoController.delete);
router.post('/:id/foto', upload.single('foto'), EventoController.uploadFoto);
router.post('/importar', uploadCSV.single('csv'), EventoController.importar);

// ========== TIPOS DE EVENTOS ========== //
router.get('/tipos', SystemController.listTipos);
router.post('/tipos', SystemController.createTipo);
router.put('/tipos/:id', SystemController.updateTipo);
router.delete('/tipos/:id', SystemController.deleteTipo);

// ========== TEMPLATES ========== //
router.get('/templates', SystemController.listTemplates);
router.put('/templates/:id', SystemController.updateTemplate);

// ========== LOGS ========== //
router.get('/logs', SystemController.listLogs);
router.delete('/logs/all', SystemController.clearAllLogs);
router.delete('/logs/:id', SystemController.deleteLog);

// ========== BOT / WHATSAPP (MULTI-INSTANCE) ========== //
router.get('/bots', BotController.listBots);
router.post('/bots', BotController.createBot);
router.put('/bots/:id', BotController.updateBot);
router.delete('/bots/:id', BotController.deleteBot);
router.post('/bots/:id/reconectar', BotController.reconnect);
router.post('/bots/:id/desconectar', BotController.disconnect);
router.get('/grupos', BotController.listGroups);
router.post('/teste-conexao', BotController.testConnection);
router.post('/testar-lembretes', BotController.triggerRemindersNow);

// ========== FEEDBACKS ========== //
router.get('/feedbacks', SystemController.listFeedbacks);
router.post('/feedbacks', SystemController.submitFeedback);

module.exports = router;
