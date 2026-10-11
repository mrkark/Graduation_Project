const animationRepo = require('../db/animationRepo');
const { ok, created, fail } = require('../utils/apiResponse');
const { logActivity } = require('../utils/activityLogger');

function handleError(err, next, res) {
  if (err.status) return fail(res, err.status, err.message, err.code);
  return next(err);
}

// GET /api/animations
async function listClips(req, res, next) {
  try {
    const { category, interactionType, search } = req.query;
    const items = await animationRepo.listClips({ category, interactionType, search });
    return ok(res, items);
  } catch (err) {
    return handleError(err, next, res);
  }
}

// GET /api/animations/transitions
async function listTransitions(req, res, next) {
  try {
    const items = await animationRepo.listTransitions();
    return ok(res, items);
  } catch (err) {
    return handleError(err, next, res);
  }
}

// POST /api/animations/report-missing
async function logMissing(req, res, next) {
  try {
    const { clipName, contextType, contextEntityId, fromStance, toStance, notes } = req.body;
    if (!clipName) {
      return fail(res, 400, 'Имя клипа обязательно', 'CLIP_NAME_REQUIRED');
    }

    const record = await animationRepo.logMissing({
      clipName,
      contextType: contextType || 'player',
      contextEntityId: contextEntityId ? Number(contextEntityId) : null,
      fromStance,
      toStance,
      userId: req.user?.User_ID || null,
      notes,
    });

    if (req.user) {
      await logActivity({
        userId: req.user.User_ID,
        action: 'report_missing_animation',
        entityType: 'Animation',
        details: JSON.stringify({ clipName, fromStance, toStance }),
        ip: req.ip,
      });
    }

    return created(res, record);
  } catch (err) {
    return handleError(err, next, res);
  }
}

// GET /api/animations/missing
async function listMissingRequests(req, res, next) {
  try {
    const { status } = req.query;
    const items = await animationRepo.listMissingRequests({ status });
    return ok(res, items);
  } catch (err) {
    return handleError(err, next, res);
  }
}

module.exports = {
  listClips,
  listTransitions,
  logMissing,
  listMissingRequests,
};
