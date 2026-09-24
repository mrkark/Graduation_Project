const commentRepo = require('../db/commentRepo');
const { ok, created, fail } = require('../utils/apiResponse');
const { logActivity } = require('../utils/activityLogger');

function handleError(err, next, res) {
  if (err.status) return fail(res, err.status, err.message, err.code);
  return next(err);
}

// GET /api/comments?kataId=&bunkaiId=
async function list(req, res, next) {
  try {
    const { kataId, bunkaiId } = req.query;
    const comments = await commentRepo.list({ kataId, bunkaiId });
    return ok(res, comments);
  } catch (err) {
    return handleError(err, next, res);
  }
}

// POST /api/comments — только авторизованные (раздел 7 ТЗ); проверки внутри sp_Comment_Create
async function create(req, res, next) {
  try {
    const { text, kataId, bunkaiId } = req.body;
    const comment = await commentRepo.create({ userId: req.user.User_ID, kataId, bunkaiId, text });
    await logActivity({ userId: req.user.User_ID, action: 'create_comment', entityType: 'Comment', entityId: comment.Comment_ID, ip: req.ip });
    return created(res, comment);
  } catch (err) {
    return handleError(err, next, res);
  }
}

// DELETE /api/comments/:id — автор или админ (проверка внутри sp_Comment_Delete)
async function remove(req, res, next) {
  try {
    const actionName = await commentRepo.remove(req.params.id, { userId: req.user.User_ID, userRole: req.userRole });
    await logActivity({
      userId: req.user.User_ID,
      action: actionName || 'delete_comment',
      entityType: 'Comment',
      entityId: Number(req.params.id),
      ip: req.ip,
    });
    return ok(res, { message: 'Комментарий удалён' });
  } catch (err) {
    return handleError(err, next, res);
  }
}

module.exports = { list, create, remove };
