const { callProcedure } = require('./execProc');

function mapUserRow(row) {
  return {
    User_ID: row.User_ID,
    Username: row.Username,
    Email: row.Email,
    Display_Name: row.Display_Name,
    Avatar_URL: row.Avatar_URL,
    Bio: row.Bio,
    Is_Blocked: row.Is_Blocked,
    Created_At: row.Created_At,
    Role: { Role_Name: row.Role_Name },
  };
}

function mapLogRow(row) {
  return {
    Log_ID: row.Log_ID,
    User_ID: row.User_ID,
    Action: row.Action,
    Entity_Type: row.Entity_Type,
    Entity_ID: row.Entity_ID,
    Details: row.Details,
    Ip_Address: row.Ip_Address,
    Created_At: row.Created_At,
    User: row.User_ID ? { User_ID: row.User_ID, Username: row.User_Username } : null,
  };
}

async function listUsers({ search, roleName, offset, limit }) {
  const rows = await callProcedure('sp_Admin_ListUsers', {
    Search: search || null,
    RoleName: roleName || null,
    Offset: offset,
    Limit: limit,
  });
  const total = rows[0]?.Total_Count || 0;
  return { items: rows.map(mapUserRow), total };
}

async function getUser(userId) {
  const rows = await callProcedure('sp_Admin_GetUser', { UserId: userId });
  return mapUserRow(rows[0]);
}

async function blockUser(userId, actorUserId) {
  await callProcedure('sp_Admin_BlockUser', { UserId: userId, ActorUserId: actorUserId });
}

async function unblockUser(userId) {
  await callProcedure('sp_Admin_UnblockUser', { UserId: userId });
}

async function changeRole(userId, actorUserId, roleName) {
  await callProcedure('sp_Admin_ChangeUserRole', { UserId: userId, ActorUserId: actorUserId, RoleName: roleName });
}

async function deleteUser(userId, actorUserId) {
  await callProcedure('sp_Admin_DeleteUser', { UserId: userId, ActorUserId: actorUserId });
}

async function listLogs({ action, userId, offset, limit }) {
  const rows = await callProcedure('sp_Admin_ListLogs', {
    Action: action || null,
    UserId: userId || null,
    Offset: offset,
    Limit: limit,
  });
  const total = rows[0]?.Total_Count || 0;
  return { items: rows.map(mapLogRow), total };
}

async function listBackups() {
  return callProcedure('sp_Admin_ListBackups', {});
}

async function createBackupRecord({ createdBy, fileName, filePath, backupType }) {
  const rows = await callProcedure('sp_Admin_CreateBackupRecord', {
    CreatedBy: createdBy,
    FileName: fileName,
    FilePath: filePath,
    BackupType: backupType || 'full',
  });
  return rows[0];
}

async function updateBackupStatus(backupId, status) {
  const rows = await callProcedure('sp_Admin_UpdateBackupStatus', { BackupId: backupId, Status: status });
  return rows[0];
}

async function stats() {
  const rows = await callProcedure('sp_Admin_Stats', {});
  const row = rows[0] || {};
  return {
    users: row.Users || 0,
    blockedUsers: row.Blocked_Users || 0,
    kataTotal: row.Kata_Total || 0,
    kataPending: row.Kata_Pending || 0,
    bunkaiTotal: row.Bunkai_Total || 0,
    bunkaiPending: row.Bunkai_Pending || 0,
    comments: row.Comments || 0,
  };
}

module.exports = {
  listUsers,
  getUser,
  blockUser,
  unblockUser,
  changeRole,
  deleteUser,
  listLogs,
  listBackups,
  createBackupRecord,
  updateBackupStatus,
  stats,
};
