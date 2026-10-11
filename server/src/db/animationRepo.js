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

module.exports = {
  listClips,
  listTransitions,
  logMissing,
  listMissingRequests,
};
