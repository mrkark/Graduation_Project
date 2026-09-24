const bunkaiRepo = require('../db/bunkaiRepo');
const { ok, created, fail } = require('../utils/apiResponse');
const { logActivity } = require('../utils/activityLogger');

function handleError(err, next, res) {
  if (err.status) return fail(res, err.status, err.message, err.code);
  return next(err);
}

// GET /api/bunkai
async function list(req, res, next) {
  try {
    const { search, kataId, difficulty, status, sort = 'newest', page = 1, pageSize = 12 } = req.query;
    const limit = Math.min(Number(pageSize) || 12, 50);
    const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

    const { items, total } = await bunkaiRepo.list({
      userId: req.user.User_ID,
      userRole: req.userRole,
      search,
      kataId,
      difficulty,
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

// GET /api/bunkai/:id
async function getById(req, res, next) {
  try {
    const bunkai = await bunkaiRepo.getById(req.params.id, { userId: req.user.User_ID, userRole: req.userRole });
    if (!bunkai) return fail(res, 404, 'Бункай не найден', 'BUNKAI_NOT_FOUND');
    return ok(res, bunkai);
  } catch (err) {
    return handleError(err, next, res);
  }
}

// POST /api/bunkai — создаёт user, всегда статус pending (внутри sp_Bunkai_Create)
async function create(req, res, next) {
  try {
    const { kataId, title, description, application, difficulty, videoUrl, thumbnailUrl } = req.body;
    const bunkai = await bunkaiRepo.create({
      authorId: req.user.User_ID,
      kataId,
      title,
      description,
      application,
      difficulty,
      videoUrl,
      thumbnailUrl,
    });
    await logActivity({ userId: req.user.User_ID, action: 'create_bunkai', entityType: 'Bunkai', entityId: bunkai.Bunkai_ID, ip: req.ip });
    return created(res, bunkai);
  } catch (err) {
    return handleError(err, next, res);
  }
}

// PUT /api/bunkai/:id — автор или админ (проверка внутри sp_Bunkai_Update)
async function update(req, res, next) {
  try {
    const bunkai = await bunkaiRepo.update(req.params.id, { userId: req.user.User_ID, userRole: req.userRole }, req.body);
    await logActivity({ userId: req.user.User_ID, action: 'update_bunkai', entityType: 'Bunkai', entityId: bunkai.Bunkai_ID, ip: req.ip });
    return ok(res, bunkai);
  } catch (err) {
    return handleError(err, next, res);
  }
}

// DELETE /api/bunkai/:id
async function remove(req, res, next) {
  try {
    await bunkaiRepo.remove(req.params.id, { userId: req.user.User_ID, userRole: req.userRole });
    await logActivity({ userId: req.user.User_ID, action: 'delete_bunkai', entityType: 'Bunkai', entityId: Number(req.params.id), ip: req.ip });
    return ok(res, { message: 'Бункай удалён' });
  } catch (err) {
    return handleError(err, next, res);
  }
}

// POST /api/bunkai/:id/approve — admin
async function approve(req, res, next) {
  try {
    const bunkai = await bunkaiRepo.setStatus(req.params.id, 'approved', { userId: req.user.User_ID, userRole: req.userRole });
    await logActivity({ userId: req.user.User_ID, action: 'approve_bunkai', entityType: 'Bunkai', entityId: bunkai.Bunkai_ID, ip: req.ip });
    return ok(res, bunkai);
  } catch (err) {
    return handleError(err, next, res);
  }
}

// POST /api/bunkai/:id/reject — admin
async function reject(req, res, next) {
  try {
    const bunkai = await bunkaiRepo.setStatus(req.params.id, 'rejected', { userId: req.user.User_ID, userRole: req.userRole });
    await logActivity({ userId: req.user.User_ID, action: 'reject_bunkai', entityType: 'Bunkai', entityId: bunkai.Bunkai_ID, ip: req.ip });
    return ok(res, bunkai);
  } catch (err) {
    return handleError(err, next, res);
  }
}

module.exports = { list, getById, create, update, remove, approve, reject };
