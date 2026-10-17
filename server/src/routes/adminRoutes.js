const express = require('express');
const adminController = require('../controllers/adminController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { adminMiddleware, moderatorMiddleware } = require('../middlewares/roleMiddleware');

const router = express.Router();

router.use(requireAuth);

router.get('/stats', moderatorMiddleware, adminController.stats);
router.get('/logs', adminMiddleware, adminController.listLogs);
router.get('/backups', adminMiddleware, adminController.listBackups);
router.post('/backups', adminMiddleware, adminController.createBackup);

module.exports = router;
