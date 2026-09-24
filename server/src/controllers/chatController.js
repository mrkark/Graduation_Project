const chatRepo = require('../db/chatRepo');
const { ok, created, fail } = require('../utils/apiResponse');
const { logActivity } = require('../utils/activityLogger');

function handleError(err, next, res) {
  if (err.status) return fail(res, err.status, err.message, err.code);
  return next(err);
}

// GET /api/chat/rooms — общий чат + чаты ката/бункая + свои приватные
async function listRooms(req, res, next) {
  try {
    const rooms = await chatRepo.listRoomsForUser(req.user.User_ID);
    return ok(res, rooms);
  } catch (err) {
    return handleError(err, next, res);
  }
}

// GET /api/chat/rooms/general
async function getOrCreateGeneralRoom(req, res, next) {
  try {
    const room = await chatRepo.getOrCreateGeneralRoom();
    return ok(res, room);
  } catch (err) {
    return handleError(err, next, res);
  }
}

// POST /api/chat/rooms/private { friendUserId }
async function createPrivateRoom(req, res, next) {
  try {
    const friendUserId = Number(req.body.friendUserId);
    if (!friendUserId) return fail(res, 400, 'Укажите друга', 'VALIDATION_ERROR');

    const room = await chatRepo.createPrivateRoom(req.user.User_ID, friendUserId);
    return created(res, room);
  } catch (err) {
    return handleError(err, next, res);
  }
}

// GET /api/chat/rooms/:id/messages
async function listMessages(req, res, next) {
  try {
    const { page = 1, pageSize = 50 } = req.query;
    const limit = Math.min(Number(pageSize) || 50, 100);
    const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

    const { items, total } = await chatRepo.listMessages(req.params.id, req.user.User_ID, offset, limit);
    return ok(res, items, { total, page: Number(page), pageSize: limit });
  } catch (err) {
    return handleError(err, next, res);
  }
}

// DELETE /api/chat/messages/:id — автор или админ (используется и REST, и сокетом)
async function deleteMessage(req, res, next) {
  try {
    const result = await chatRepo.deleteMessage(req.params.id, req.user.User_ID, req.userRole);
    await logActivity({
      userId: req.user.User_ID,
      action: 'delete_message',
      entityType: 'ChatMessage',
      entityId: result.Message_ID,
      ip: req.ip,
    });
    return ok(res, { message: 'Сообщение удалено' });
  } catch (err) {
    return handleError(err, next, res);
  }
}

module.exports = { listRooms, getOrCreateGeneralRoom, createPrivateRoom, listMessages, deleteMessage };
