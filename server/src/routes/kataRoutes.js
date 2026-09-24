const express = require('express');
const kataController = require('../controllers/kataController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { adminMiddleware } = require('../middlewares/roleMiddleware');
const validateRequest = require('../middlewares/validateRequest');
const {
  createKataValidator,
  updateKataValidator,
  listQueryValidator,
  idParamValidator,
} = require('../validators/kataValidators');

const router = express.Router();

// Все маршруты ката требуют авторизации — guest не видит каталог (раздел 2 ТЗ)
router.use(requireAuth);

router.get('/', listQueryValidator, validateRequest, kataController.list);
router.get('/:id', idParamValidator, validateRequest, kataController.getById);
router.post('/', adminMiddleware, createKataValidator, validateRequest, kataController.create);
router.put('/:id', adminMiddleware, updateKataValidator, validateRequest, kataController.update);
router.delete('/:id', adminMiddleware, idParamValidator, validateRequest, kataController.remove);

router.post('/:id/approve', idParamValidator, validateRequest, adminMiddleware, kataController.approve);
router.post('/:id/reject', idParamValidator, validateRequest, adminMiddleware, kataController.reject);

module.exports = router;
