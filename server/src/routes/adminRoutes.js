const express = require('express');
const adminController = require('../controllers/adminController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { adminMiddleware } = require('../middlewares/roleMiddleware');

const router = express.Router();

router.use(requireAuth, adminMiddleware);

router.get('/logs', adminController.listLogs);
router.get('/backups', adminController.listBackups);
router.post('/backups', adminController.createBackup);
router.get('/stats', adminController.stats);

module.exports = router;
