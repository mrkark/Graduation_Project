const express = require('express');
const friendController = require('../controllers/friendController');
const { requireAuth } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(requireAuth);

router.get('/', friendController.listFriends);
router.delete('/:friendUserId', friendController.removeFriend);

router.get('/requests', friendController.listRequests);
router.post('/requests', friendController.sendRequest);
router.post('/requests/:id/accept', friendController.acceptRequest);
router.post('/requests/:id/reject', friendController.rejectRequest);

module.exports = router;
