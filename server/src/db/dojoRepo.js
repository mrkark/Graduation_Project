const { callProcedure } = require('./execProc');

async function createDojo(creatorId, { name, kanji, description, avatarUrl }) {
  const rows = await callProcedure('sp_Dojo_Create', {
    CreatorId: creatorId,
    Name: name,
    Kanji: kanji || '道場',
    Description: description || null,
    AvatarUrl: avatarUrl || null,
  });
  return rows[0] || null;
}

async function inviteUser(dojoId, inviterId, targetUserId) {
  const rows = await callProcedure('sp_Dojo_InviteUser', {
    DojoId: Number(dojoId),
    InviterId: inviterId,
    TargetUserId: Number(targetUserId),
  });
  return rows[0] || null;
}

async function listMyDojos(userId) {
  return await callProcedure('sp_Dojo_ListMy', {
    UserId: userId,
  });
}

async function getDojoDetails(dojoId, userId) {
  const pool = await require('../config/database').poolPromise;
  const request = pool.request();
  request.input('DojoId', Number(dojoId));
  request.input('UserId', Number(userId));

  const result = await request.execute('dbo.sp_Dojo_GetDetails');
  const dojo = result.recordsets[0]?.[0] || null;
  const members = result.recordsets[1] || [];

  return {
    ...dojo,
    dojo,
    members,
  };
}

async function respondInvite(dojoId, userId, accept) {
  const rows = await callProcedure('sp_Dojo_RespondInvite', {
    DojoId: Number(dojoId),
    UserId: userId,
    Accept: accept ? 1 : 0,
  });
  return rows[0] || null;
}

async function updateDojo(dojoId, userId, { name, kanji, description, avatarUrl }) {
  const rows = await callProcedure('sp_Dojo_Update', {
    DojoId: Number(dojoId),
    UserId: Number(userId),
    Name: name,
    Kanji: kanji || '道場',
    Description: description || null,
    AvatarUrl: avatarUrl || null,
  });
  return rows[0] || null;
}

async function deleteDojo(dojoId, userId) {
  const rows = await callProcedure('sp_Dojo_Delete', {
    DojoId: Number(dojoId),
    UserId: Number(userId),
  });
  return rows[0] || null;
}

module.exports = {
  createDojo,
  inviteUser,
  listMyDojos,
  getDojoDetails,
  respondInvite,
  updateDojo,
  deleteDojo,
};
