const express = require('express');
const authController = require('../controllers/authController');
const { requireAuth } = require('../middlewares/authMiddleware');
const validateRequest = require('../middlewares/validateRequest');
const { registerValidator, loginValidator, updateProfileValidator } = require('../validators/authValidators');

const router = express.Router();

router.post('/register', registerValidator, validateRequest, authController.register);
router.post('/login', loginValidator, validateRequest, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', requireAuth, authController.logout);
router.get('/me', requireAuth, authController.me);
router.put('/me', requireAuth, updateProfileValidator, validateRequest, authController.updateProfile);
router.delete('/delete-account', requireAuth, authController.deleteAccount);

module.exports = router;
