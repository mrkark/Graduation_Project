const express = require('express');
const router = express.Router();
const dojoController = require('../controllers/dojoController');
const { requireAuth } = require('../middlewares/authMiddleware');

router.use(requireAuth);

router.post('/', dojoController.createDojo);
router.get('/', dojoController.listMyDojos);
router.get('/:id', dojoController.getDojoDetails);
router.put('/:id', dojoController.updateDojo);
router.delete('/:id', dojoController.deleteDojo);
router.post('/:id/invite', dojoController.inviteUser);
router.post('/:id/respond', dojoController.respondInvite);

module.exports = router;
