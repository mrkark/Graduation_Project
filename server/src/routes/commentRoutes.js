const express = require('express');
const commentController = require('../controllers/commentController');
const { requireAuth } = require('../middlewares/authMiddleware');
const validateRequest = require('../middlewares/validateRequest');
const { createCommentValidator, idParamValidator } = require('../validators/commentValidators');

const router = express.Router();

router.use(requireAuth);

router.get('/', commentController.list);
router.post('/', createCommentValidator, validateRequest, commentController.create);
router.delete('/:id', idParamValidator, validateRequest, commentController.remove);

module.exports = router;
