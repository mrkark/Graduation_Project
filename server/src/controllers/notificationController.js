const notificationRepo = require('../db/notificationRepo');
const { ok, fail } = require('../utils/apiResponse');

async function list(req, res, next) {
  try {
    const limit = Number(req.query.limit) || 30;
    const notifications = await notificationRepo.listNotifications(req.user.User_ID, limit);
    const unreadCount = await notificationRepo.getUnreadCount(req.user.User_ID);
    return ok(res, {
      items: notifications,
      unreadCount,
    });
  } catch (err) {
    if (err.status) return fail(res, err.status, err.message, err.code);
    return next(err);
  }
}

async function markRead(req, res, next) {
  try {
    const notificationId = req.body.notificationId ? Number(req.body.notificationId) : null;
    const result = await notificationRepo.markRead(req.user.User_ID, notificationId);
    return ok(res, result);
  } catch (err) {
    if (err.status) return fail(res, err.status, err.message, err.code);
    return next(err);
  }
}

module.exports = {
  list,
  markRead,
};
