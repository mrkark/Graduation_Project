const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController');
const { requireAuth } = require('../middlewares/authMiddleware');

router.use(requireAuth);

router.get('/', favoriteController.list);
router.post('/toggle', favoriteController.toggle);

module.exports = router;
