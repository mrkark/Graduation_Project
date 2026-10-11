const express = require('express');
const animationController = require('../controllers/animationController');
const { requireAuth } = require('../middlewares/authMiddleware');

const router = express.Router();

// Список клипов и переходов доступен для 3D плеера
router.get('/', animationController.listClips);
router.get('/transitions', animationController.listTransitions);

// Регистрация отсутствующей анимации (вызывается 3D-плеером при обнаружении несовместимости/отсутствия)
router.post('/report-missing', animationController.logMissing);

// Просмотр сводного реестра отсутствующих анимаций (для админки и анимационного агента)
router.get('/missing', requireAuth, animationController.listMissingRequests);

module.exports = router;
