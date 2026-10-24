const express = require('express');
const router = express.Router();
const dojoController = require('../controllers/dojoController');
const { requireAuth } = require('../middlewares/auth');

router.use(requireAuth);

router.post('/', dojoController.createDojo);
router.get('/', dojoController.listMyDojos);
router.get('/:id', dojoController.getDojoDetails);
router.post('/:id/invite', dojoController.inviteUser);
router.post('/:id/respond', dojoController.respondInvite);

module.exports = router;
