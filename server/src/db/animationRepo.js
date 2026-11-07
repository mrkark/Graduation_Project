const { callProcedure } = require('./execProc');

async function listClips({ category, interactionType, search } = {}) {
  const rows = await callProcedure('sp_Animation_ListClips', {
    Category: category || null,
    InteractionType: interactionType || null,
    Search: search || null,
  });
  return rows;
}

async function listTransitions() {
  const rows = await callProcedure('sp_Animation_ListTransitions');
  return rows;
}

async function logMissing({ clipName, contextType, contextEntityId, fromStance, toStance, userId, notes } = {}) {
  const rows = await callProcedure('sp_Animation_LogMissing', {
    ClipName: clipName,
    ContextType: contextType || 'general',
    ContextEntityId: contextEntityId || null,
    FromStance: fromStance || null,
    ToStance: toStance || null,
    UserId: userId || null,
    Notes: notes || null,
  });
  return rows[0];
}

async function listMissingRequests({ status } = {}) {
  const rows = await callProcedure('sp_Animation_ListMissingRequests', {
    Status: status || null,
  });
  return rows;
}

async function listPresets({ category, motionMode, search } = {}) {
  const rows = await callProcedure('sp_MotionPresets_List', {
    Category: category || null,
    MotionMode: motionMode || null,
    Search: search || null,
  });
  return rows;
}

async function createPreset({
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
  userId,
  authorName,
} = {}) {
  const rows = await callProcedure('sp_MotionPresets_Create', {
    Title: title,
    Description: description || null,
    Category: category || 'combo',
    MotionMode: motionMode || 'modular',
    StanceId: stanceId || null,
    TechniqueId: techniqueId || null,
    FullBodyClip: fullBodyClip || null,
    TurnAngle: turnAngle !== undefined ? Number(turnAngle) : 0.0,
    Speed: speed !== undefined ? Number(speed) : 1.0,
    DisplacementX: displacementX !== undefined ? Number(displacementX) : 0.0,
    DisplacementZ: displacementZ !== undefined ? Number(displacementZ) : 0.0,
    PresetConfigJson: presetConfigJson
      ? typeof presetConfigJson === 'string'
        ? presetConfigJson
        : JSON.stringify(presetConfigJson)
      : null,
    UserId: userId || null,
    AuthorName: authorName || null,
  });
  return rows[0] || null;
}

async function deletePreset(presetId, userId, userRole) {
  const rows = await callProcedure('sp_MotionPresets_Delete', {
    PresetId: Number(presetId),
    UserId: userId || null,
    UserRole: userRole || null,
  });
  return rows[0] || null;
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
