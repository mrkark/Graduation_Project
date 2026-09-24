const express = require('express');
const friendController = require('../controllers/friendController');
const adminController = require('../controllers/adminController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { requireAnyRole } = require('../middlewares/roleMiddleware');

const router = express.Router();

router.use(requireAuth);

// Поиск пользователей доступен любому авторизованному (нужно для системы друзей)
router.get('/search', friendController.searchUsers);

// Управление пользователями — только администратор (раздел 13 ТЗ)
router.get('/', requireAnyRole('admin'), adminController.listUsers);
router.get('/:id', requireAnyRole('admin'), adminController.getUser);
router.post('/:id/block', requireAnyRole('admin'), adminController.blockUser);
router.post('/:id/unblock', requireAnyRole('admin'), adminController.unblockUser);
router.patch('/:id/role', requireAnyRole('admin'), adminController.changeRole);
router.delete('/:id', requireAnyRole('admin'), adminController.deleteUser);

module.exports = router;
