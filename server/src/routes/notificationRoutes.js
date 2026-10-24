const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { requireAuth } = require('../middlewares/authMiddleware');

router.use(requireAuth);

router.get('/', notificationController.list);
router.post('/read', notificationController.markRead);

module.exports = router;
