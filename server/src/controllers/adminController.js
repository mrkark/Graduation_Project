const adminRepo = require('../db/adminRepo');
const backupService = require('../services/backupService');
const { ok, created, fail } = require('../utils/apiResponse');
const { logActivity } = require('../utils/activityLogger');

function handleError(err, next, res) {
  if (err.status) return fail(res, err.status, err.message, err.code);
  return next(err);
}

// GET /api/users?search=&role=&page=&pageSize=
async function listUsers(req, res, next) {
  try {
    const { search, role, page = 1, pageSize = 20 } = req.query;
    const limit = Math.min(Number(pageSize) || 20, 100);
    const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

    const { items, total } = await adminRepo.listUsers({ search, roleName: role, offset, limit });
    return ok(res, items, { total, page: Number(page), pageSize: limit });
  } catch (err) {
    return handleError(err, next, res);
  }
}

// GET /api/users/:id
async function getUser(req, res, next) {
  try {
    const user = await adminRepo.getUser(req.params.id);
    return ok(res, user);
  } catch (err) {
    return handleError(err, next, res);
  }
}

// POST /api/users/:id/block
async function blockUser(req, res, next) {
  try {
    await adminRepo.blockUser(req.params.id, req.user.User_ID);
    await logActivity({ userId: req.user.User_ID, action: 'block_user', entityType: 'User', entityId: Number(req.params.id), ip: req.ip });
    return ok(res, { message: 'Пользователь заблокирован' });
  } catch (err) {
    return handleError(err, next, res);
  }
}

// POST /api/users/:id/unblock
async function unblockUser(req, res, next) {
  try {
    await adminRepo.unblockUser(req.params.id);
    await logActivity({ userId: req.user.User_ID, action: 'unblock_user', entityType: 'User', entityId: Number(req.params.id), ip: req.ip });
    return ok(res, { message: 'Пользователь разблокирован' });
  } catch (err) {
    return handleError(err, next, res);
  }
}

// PATCH /api/users/:id/role { roleName } — раздел 3 ТЗ: пользователь не может назначить
// себе роль admin; это гарантируется внутри sp_Admin_ChangeUserRole через @ActorUserId.
async function changeRole(req, res, next) {
  try {
    const { roleName } = req.body;
    await adminRepo.changeRole(req.params.id, req.user.User_ID, roleName);
    await logActivity({
      userId: req.user.User_ID,
      action: 'change_role',
      entityType: 'User',
      entityId: Number(req.params.id),
      details: { newRole: roleName },
      ip: req.ip,
    });
    return ok(res, { message: 'Роль обновлена' });
  } catch (err) {
    return handleError(err, next, res);
  }
}

// DELETE /api/users/:id
async function deleteUser(req, res, next) {
  try {
    await adminRepo.deleteUser(req.params.id, req.user.User_ID);
    await logActivity({ userId: req.user.User_ID, action: 'admin_delete_user', entityType: 'User', entityId: Number(req.params.id), ip: req.ip });
    return ok(res, { message: 'Пользователь удалён' });
  } catch (err) {
    return handleError(err, next, res);
  }
}

// GET /api/admin/logs
async function listLogs(req, res, next) {
  try {
    const { page = 1, pageSize = 50, action, userId } = req.query;
    const limit = Math.min(Number(pageSize) || 50, 200);
    const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

    const { items, total } = await adminRepo.listLogs({ action, userId, offset, limit });
    return ok(res, items, { total, page: Number(page), pageSize: limit });
  } catch (err) {
    return handleError(err, next, res);
  }
}

// GET /api/admin/backups
async function listBackups(req, res, next) {
  try {
    const backups = await adminRepo.listBackups();
    return ok(res, backups);
  } catch (err) {
    return handleError(err, next, res);
  }
}

// POST /api/admin/backups — создать резервную копию (только admin)
async function createBackup(req, res, next) {
  try {
    const { backup, error } = await backupService.createBackup({ createdBy: req.user.User_ID });
    await logActivity({
      userId: req.user.User_ID,
      action: 'create_backup',
      entityType: 'Backup',
      entityId: backup.Backup_ID,
      details: { status: backup.Status, error: error || null },
      ip: req.ip,
    });
    if (error) return fail(res, 502, error, 'BACKUP_FAILED');
    return created(res, backup);
  } catch (err) {
    return handleError(err, next, res);
  }
}

// GET /api/admin/stats
async function stats(req, res, next) {
  try {
    const data = await adminRepo.stats();
    return ok(res, data);
  } catch (err) {
    return handleError(err, next, res);
  }
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
  createBackup,
  stats,
};
