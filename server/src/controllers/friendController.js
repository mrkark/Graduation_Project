const friendRepo = require('../db/friendRepo');
const { ok, created, fail } = require('../utils/apiResponse');
const { logActivity } = require('../utils/activityLogger');

function handleError(err, next, res) {
  if (err.status) return fail(res, err.status, err.message, err.code);
  return next(err);
}

// GET /api/users/search?q=
async function searchUsers(req, res, next) {
  try {
    const users = await friendRepo.searchUsers(req.query.q, req.user.User_ID);
    return ok(res, users);
  } catch (err) {
    return handleError(err, next, res);
  }
}

// POST /api/friends/requests { receiverId }
async function sendRequest(req, res, next) {
  try {
    const receiverId = Number(req.body.receiverId);
    if (!receiverId) return fail(res, 400, 'Укажите получателя', 'VALIDATION_ERROR');

    const request = await friendRepo.sendRequest(req.user.User_ID, receiverId);
    await logActivity({ userId: req.user.User_ID, action: 'send_friend_request', entityType: 'FriendRequest', entityId: request.Request_ID, ip: req.ip });
    return created(res, request);
  } catch (err) {
    return handleError(err, next, res);
  }
}

// POST /api/friends/requests/:id/accept
async function acceptRequest(req, res, next) {
  try {
    const request = await friendRepo.acceptRequest(req.params.id, req.user.User_ID);
    await logActivity({ userId: req.user.User_ID, action: 'accept_friend_request', entityType: 'FriendRequest', entityId: request.Request_ID, ip: req.ip });
    return ok(res, request);
  } catch (err) {
    return handleError(err, next, res);
  }
}

// POST /api/friends/requests/:id/reject — получатель отклоняет, отправитель отменяет
async function rejectRequest(req, res, next) {
  try {
    const request = await friendRepo.rejectRequest(req.params.id, req.user.User_ID);
    await logActivity({ userId: req.user.User_ID, action: 'reject_friend_request', entityType: 'FriendRequest', entityId: request.Request_ID, ip: req.ip });
    return ok(res, request);
  } catch (err) {
    return handleError(err, next, res);
  }
}

// GET /api/friends/requests?direction=incoming|outgoing
async function listRequests(req, res, next) {
  try {
    const direction = req.query.direction === 'outgoing' ? 'outgoing' : 'incoming';
    const requests = await friendRepo.listRequests(req.user.User_ID, direction);
    return ok(res, requests);
  } catch (err) {
    return handleError(err, next, res);
  }
}

// GET /api/friends
async function listFriends(req, res, next) {
  try {
    const friends = await friendRepo.listFriends(req.user.User_ID);
    return ok(res, friends);
  } catch (err) {
    return handleError(err, next, res);
  }
}

// DELETE /api/friends/:friendUserId
async function removeFriend(req, res, next) {
  try {
    const friendUserId = Number(req.params.friendUserId);
    await friendRepo.removeFriend(req.user.User_ID, friendUserId);
    await logActivity({ userId: req.user.User_ID, action: 'remove_friend', entityType: 'User', entityId: friendUserId, ip: req.ip });
    return ok(res, { message: 'Пользователь удалён из друзей' });
  } catch (err) {
    return handleError(err, next, res);
  }
}

module.exports = { searchUsers, sendRequest, acceptRequest, rejectRequest, listRequests, listFriends, removeFriend };
