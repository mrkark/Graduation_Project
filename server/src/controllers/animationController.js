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

// GET /api/animations/presets - Получить все общедоступные пресеты пользователей
async function listPresets(req, res, next) {
  try {
    const { category, motionMode, search } = req.query;
    const items = await animationRepo.listPresets({ category, motionMode, search });
    return ok(res, items);
  } catch (err) {
    return handleError(err, next, res);
  }
}

// POST /api/animations/presets - Автоматически создать новый пресет (доступный всем пользователям)
async function createPreset(req, res, next) {
  try {
    const {
      title,
      description,
      category,
      motionMode,
      stanceId,
      techniqueId,
      fullBodyClip,
      turnAngle,
      speed,
      displacementX,
      displacementZ,
      presetConfigJson,
      authorName,
    } = req.body;

    if (!title || !title.trim()) {
      return fail(res, 400, 'Название пресета обязательно', 'PRESET_TITLE_REQUIRED');
    }

    const record = await animationRepo.createPreset({
      title: title.trim(),
      description: description ? description.trim() : null,
      category: category || 'combo',
      motionMode: motionMode || 'modular',
      stanceId,
      techniqueId,
      fullBodyClip,
      turnAngle,
      speed,
      displacementX,
      displacementZ,
      presetConfigJson,
      userId: req.user?.User_ID || null,
      authorName: authorName || req.user?.Username || 'Мастер Додзё',
    });

    if (req.user) {
      await logActivity({
        userId: req.user.User_ID,
        action: 'create_motion_preset',
        entityType: 'MotionPreset',
        details: JSON.stringify({ presetId: record?.Preset_ID, title }),
        ip: req.ip,
      });
    }

    return created(res, record);
  } catch (err) {
    return handleError(err, next, res);
  }
}

// DELETE /api/animations/presets/:id
async function deletePreset(req, res, next) {
  try {
    const { id } = req.params;
    const result = await animationRepo.deletePreset(
      id,
      req.user?.User_ID || null,
      req.user?.Role || 'guest'
    );
    return ok(res, result);
  } catch (err) {
    return handleError(err, next, res);
  }
}

module.exports = {
  listClips,
  listTransitions,
  logMissing,
  listMissingRequests,
  listPresets,
  createPreset,
  deletePreset,
};
