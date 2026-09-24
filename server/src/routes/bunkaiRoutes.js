const express = require('express');
const bunkaiController = require('../controllers/bunkaiController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { adminMiddleware } = require('../middlewares/roleMiddleware');
const validateRequest = require('../middlewares/validateRequest');
const {
  createBunkaiValidator,
  updateBunkaiValidator,
  listQueryValidator,
  idParamValidator,
} = require('../validators/bunkaiValidators');

const router = express.Router();

router.use(requireAuth);

router.get('/', listQueryValidator, validateRequest, bunkaiController.list);
router.get('/:id', idParamValidator, validateRequest, bunkaiController.getById);
router.post('/', createBunkaiValidator, validateRequest, bunkaiController.create);
router.put('/:id', updateBunkaiValidator, validateRequest, bunkaiController.update);
router.delete('/:id', idParamValidator, validateRequest, bunkaiController.remove);

router.post('/:id/approve', idParamValidator, validateRequest, adminMiddleware, bunkaiController.approve);
router.post('/:id/reject', idParamValidator, validateRequest, adminMiddleware, bunkaiController.reject);

module.exports = router;
