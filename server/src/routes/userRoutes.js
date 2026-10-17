const express = require('express');
const friendController = require('../controllers/friendController');
const adminController = require('../controllers/adminController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { requireAnyRole } = require('../middlewares/roleMiddleware');

const router = express.Router();

router.use(requireAuth);

// Поиск пользователей доступен любому авторизованному (нужно для системы друзей)
router.get('/search', friendController.searchUsers);

// Просмотр и удаление пользователей — администратор и модератор
router.get('/', requireAnyRole('admin', 'moderator'), adminController.listUsers);
router.get('/:id', requireAnyRole('admin', 'moderator'), adminController.getUser);
router.delete('/:id', requireAnyRole('admin', 'moderator'), adminController.deleteUser);

// Блокировка и смена ролей — только администратор системы
router.post('/:id/block', requireAnyRole('admin'), adminController.blockUser);
router.post('/:id/unblock', requireAnyRole('admin'), adminController.unblockUser);
router.patch('/:id/role', requireAnyRole('admin'), adminController.changeRole);

module.exports = router;
