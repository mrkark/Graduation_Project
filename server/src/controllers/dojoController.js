const dojoRepo = require('../db/dojoRepo');
const notificationRepo = require('../db/notificationRepo');
const { ok, created, fail } = require('../utils/apiResponse');
const { logActivity } = require('../utils/activityLogger');

function handleError(err, next, res) {
  if (err.status) return fail(res, err.status, err.message, err.code);
  return next(err);
}

// POST /api/dojos
async function createDojo(req, res, next) {
  try {
    const { name, kanji, description, avatarUrl } = req.body;
    if (!name || name.trim().length < 3) {
      return fail(res, 400, 'Название Додзё должно содержать минимум 3 символа', 'VALIDATION_ERROR');
    }

    const dojo = await dojoRepo.createDojo(req.user.User_ID, {
      name: name.trim(),
      kanji: kanji?.trim(),
      description: description?.trim(),
      avatarUrl: avatarUrl?.trim(),
    });

    await logActivity({
      userId: req.user.User_ID,
      action: 'create_dojo',
      entityType: 'Dojo',
      entityId: dojo.Dojo_ID,
      ip: req.ip,
    });

    return created(res, dojo);
  } catch (err) {
    return handleError(err, next, res);
  }
}

// POST /api/dojos/:id/invite
async function inviteUser(req, res, next) {
  try {
    const dojoId = Number(req.params.id);
    const targetUserId = Number(req.body.targetUserId);

    if (!targetUserId) {
      return fail(res, 400, 'Укажите ID приглашаемого пользователя', 'VALIDATION_ERROR');
    }

    const result = await dojoRepo.inviteUser(dojoId, req.user.User_ID, targetUserId);

    await logActivity({
      userId: req.user.User_ID,
      action: 'invite_to_dojo',
      entityType: 'Dojo',
      entityId: dojoId,
      details: JSON.stringify({ targetUserId }),
      ip: req.ip,
    });

    // Персистентное уведомление в БД (Задачи 6 и 7)
    const dojoMsg = `${req.user.Display_Name || req.user.Username} пригласил вас в Додзё «${result.Dojo_Name}»`;
    const savedNotif = await notificationRepo.createNotification(
      targetUserId,
      'dojo_invite',
      'Приглашение в Додзё',
      dojoMsg,
      '/dojos'
    );

    // Оповещение в реальном времени через Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${targetUserId}`).emit('notification', {
        id: savedNotif.Notification_ID,
        type: 'dojo_invite',
        title: 'Приглашение в Додзё',
        message: dojoMsg,
        targetUrl: '/dojos',
        data: { dojoId, dojoName: result.Dojo_Name },
      });
    }

    return ok(res, result);
  } catch (err) {
    return handleError(err, next, res);
  }
}

// GET /api/dojos
async function listMyDojos(req, res, next) {
  try {
    const dojos = await dojoRepo.listMyDojos(req.user.User_ID);
    return ok(res, dojos);
  } catch (err) {
    return handleError(err, next, res);
  }
}

// GET /api/dojos/:id
async function getDojoDetails(req, res, next) {
  try {
    const dojoId = Number(req.params.id);
    const details = await dojoRepo.getDojoDetails(dojoId, req.user.User_ID);
    return ok(res, details);
  } catch (err) {
    return handleError(err, next, res);
  }
}

// POST /api/dojos/:id/respond
async function respondInvite(req, res, next) {
  try {
    const dojoId = Number(req.params.id);
    const accept = Boolean(req.body.accept);

    const result = await dojoRepo.respondInvite(dojoId, req.user.User_ID, accept);

    await logActivity({
      userId: req.user.User_ID,
      action: accept ? 'accept_dojo_invite' : 'reject_dojo_invite',
      entityType: 'Dojo',
      entityId: dojoId,
      ip: req.ip,
    });

    return ok(res, result);
  } catch (err) {
    return handleError(err, next, res);
  }
}

module.exports = {
  createDojo,
  inviteUser,
  listMyDojos,
  getDojoDetails,
  respondInvite,
};
