const express = require('express');
const chatController = require('../controllers/chatController');
const { requireAuth } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(requireAuth);

router.get('/rooms', chatController.listRooms);
router.get('/rooms/general', chatController.getOrCreateGeneralRoom);
router.post('/rooms/private', chatController.createPrivateRoom);
router.get('/rooms/:id/messages', chatController.listMessages);
router.delete('/messages/:id', chatController.deleteMessage);

module.exports = router;
