const kataRepo = require('../db/kataRepo');
const { ok, created, fail } = require('../utils/apiResponse');
const { logActivity } = require('../utils/activityLogger');

function handleError(err, next, res) {
  if (err.status) return fail(res, err.status, err.message, err.code);
  return next(err);
}

// GET /api/kata
async function list(req, res, next) {
  try {
    const { search, difficulty, style, status, sort = 'newest', page = 1, pageSize = 12 } = req.query;
    const limit = Math.min(Number(pageSize) || 12, 50);
    const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

    const { items, total } = await kataRepo.list({
      userId: req.user.User_ID,
      userRole: req.userRole,
      search,
      difficulty,
      style,
      status,
      sort,
      offset,
      limit,
    });

    return ok(res, items, { total, page: Number(page), pageSize: limit });
  } catch (err) {
    return handleError(err, next, res);
  }
}

// GET /api/kata/:id
async function getById(req, res, next) {
  try {
    const kata = await kataRepo.getById(req.params.id, { userId: req.user.User_ID, userRole: req.userRole });
    if (!kata) return fail(res, 404, 'Ката не найдено', 'KATA_NOT_FOUND');
    return ok(res, kata);
  } catch (err) {
    return handleError(err, next, res);
  }
}

// POST /api/kata — создаёт user, всегда статус pending (внутри sp_Kata_Create)
async function create(req, res, next) {
  try {
    const kata = await kataRepo.create({ authorId: req.user.User_ID, ...req.body });
    await logActivity({ userId: req.user.User_ID, action: 'create_kata', entityType: 'Kata', entityId: kata.Kata_ID, ip: req.ip });
    return created(res, kata);
  } catch (err) {
    return handleError(err, next, res);
  }
}

// PUT /api/kata/:id — автор или админ (проверка внутри sp_Kata_Update)
async function update(req, res, next) {
  try {
    const kata = await kataRepo.update(req.params.id, { userId: req.user.User_ID, userRole: req.userRole }, req.body);
    await logActivity({ userId: req.user.User_ID, action: 'update_kata', entityType: 'Kata', entityId: kata.Kata_ID, ip: req.ip });
    return ok(res, kata);
  } catch (err) {
    return handleError(err, next, res);
  }
}

// DELETE /api/kata/:id
async function remove(req, res, next) {
  try {
    await kataRepo.remove(req.params.id, { userId: req.user.User_ID, userRole: req.userRole });
    await logActivity({ userId: req.user.User_ID, action: 'delete_kata', entityType: 'Kata', entityId: Number(req.params.id), ip: req.ip });
    return ok(res, { message: 'Ката удалено' });
  } catch (err) {
    return handleError(err, next, res);
  }
}

// POST /api/kata/:id/approve — admin (маршрут уже защищён adminMiddleware)
async function approve(req, res, next) {
  try {
    const kata = await kataRepo.setStatus(req.params.id, 'approved', { userId: req.user.User_ID, userRole: req.userRole });
    await logActivity({ userId: req.user.User_ID, action: 'approve_kata', entityType: 'Kata', entityId: kata.Kata_ID, ip: req.ip });
    return ok(res, kata);
  } catch (err) {
    return handleError(err, next, res);
  }
}

// POST /api/kata/:id/reject — admin
async function reject(req, res, next) {
  try {
    const kata = await kataRepo.setStatus(req.params.id, 'rejected', { userId: req.user.User_ID, userRole: req.userRole });
    await logActivity({ userId: req.user.User_ID, action: 'reject_kata', entityType: 'Kata', entityId: kata.Kata_ID, ip: req.ip });
    return ok(res, kata);
  } catch (err) {
    return handleError(err, next, res);
  }
}

module.exports = { list, getById, create, update, remove, approve, reject };
