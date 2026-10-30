const express = require('express');
const friendController = require('../controllers/friendController');
const adminController = require('../controllers/adminController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

const router = express.Router();

router.use(requireAuth);

// Поиск пользователей доступен любому авторизованному (нужно для системы друзей)
router.get('/search', friendController.searchUsers);

// Управление пользователями — только Администратор (Диаграмма прецедентов роли «Администратор»)
router.get('/', requireRole('admin'), adminController.listUsers);
router.get('/:id', requireRole('admin'), adminController.getUser);
router.delete('/:id', requireRole('admin'), adminController.deleteUser);

// Блокировка и смена ролей — только администратор системы
router.post('/:id/block', requireRole('admin'), adminController.blockUser);
router.post('/:id/unblock', requireRole('admin'), adminController.unblockUser);
router.patch('/:id/role', requireRole('admin'), adminController.changeRole);

module.exports = router;
