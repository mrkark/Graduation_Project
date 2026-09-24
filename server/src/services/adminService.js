const { User, Bunkai, Comment, Kata, AuditLog } = require('../models');
const { ApiError } = require('../middlewares/error');
const { hashPassword } = require('../utils/hash');
const { BUNKAI_STATUS, ROLES } = require('../config/constants');

async function getStats() {
  const [usersCount, kataCount, bunkaiCount, commentsCount, pendingCount] = await Promise.all([
    User.count(),
    Kata.count(),
    Bunkai.count(),
    Comment.count(),
    Bunkai.count({ where: { status: BUNKAI_STATUS.PENDING } }),
  ]);

  // Активность за последние 14 дней (для графика в дашборде)
  const since = new Date();
  since.setDate(since.getDate() - 14);
  const recentBunkai = await Bunkai.findAll({
    attributes: ['createdAt'],
    where: { createdAt: { [require('sequelize').Op.gte]: since } },
  });

  return { usersCount, kataCount, bunkaiCount, commentsCount, pendingCount, recentBunkai };
}

async function listUsers({ role, status, search, page = 1, limit = 20 }) {
  const where = {};
  if (role) where.role = role;
  if (status === 'banned') where.isBanned = true;
  if (status === 'active') where.isBanned = false;
  if (search) {
    where[require('sequelize').Op.or] = [
      { email: { [require('sequelize').Op.like]: `%${search}%` } },
      { username: { [require('sequelize').Op.like]: `%${search}%` } },
    ];
  }

  const offset = (page - 1) * limit;
  const { rows, count } = await User.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });
  return { items: rows.map((u) => u.toSafeJSON()), total: count, page: Number(page), limit: Number(limit) };
}

async function createUserByAdmin({ email, username, password, role }) {
  const passwordHash = await hashPassword(password);
  const user = await User.create({ email, username, passwordHash, role: role || ROLES.USER });
  return user.toSafeJSON();
}

async function updateUserRole(id, role) {
  const user = await User.findByPk(id);
  if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'Пользователь не найден');
  await user.update({ role });
  return user.toSafeJSON();
}

async function setUserBan(id, isBanned) {
  const user = await User.findByPk(id);
  if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'Пользователь не найден');
  await user.update({ isBanned });
  return user.toSafeJSON();
}

async function resetUserPassword(id, newPassword) {
  const user = await User.findByPk(id);
  if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'Пользователь не найден');
  const passwordHash = await hashPassword(newPassword);
  await user.update({ passwordHash });
}

async function getModerationQueue() {
  return Bunkai.findAll({
    where: { status: BUNKAI_STATUS.PENDING },
    order: [['createdAt', 'ASC']],
  });
}

async function moderateBunkai(id, status) {
  const bunkai = await Bunkai.findByPk(id);
  if (!bunkai) throw new ApiError(404, 'BUNKAI_NOT_FOUND', 'Бункай не найден');
  await bunkai.update({ status });
  return bunkai;
}

async function logAction(actorId, action, targetType, targetId, details) {
  return AuditLog.create({
    actorId,
    action,
    targetType,
    targetId,
    details: details ? JSON.stringify(details) : null,
  });
}

async function getLogs({ page = 1, limit = 50 }) {
  const offset = (page - 1) * limit;
  const { rows, count } = await AuditLog.findAndCountAll({
    include: [{ model: User, as: 'actor', attributes: ['id', 'username'] }],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });
  return { items: rows, total: count, page: Number(page), limit: Number(limit) };
}

module.exports = {
  getStats,
  listUsers,
  createUserByAdmin,
  updateUserRole,
  setUserBan,
  resetUserPassword,
  getModerationQueue,
  moderateBunkai,
  logAction,
  getLogs,
};
