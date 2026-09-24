const express = require('express');
const controller = require('../controllers/mediaController');
const { requireAuth } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/role');
const { upload } = require('../middlewares/upload');
const { ROLES } = require('../config/constants');

const router = express.Router();

router.post('/upload', requireAuth, requireRole(ROLES.MODERATOR, ROLES.ADMIN), upload.single('file'), controller.upload);
router.get('/', requireAuth, requireRole(ROLES.MODERATOR, ROLES.ADMIN), controller.list);
router.delete('/:id', requireAuth, requireRole(ROLES.ADMIN), controller.remove);

module.exports = router;
