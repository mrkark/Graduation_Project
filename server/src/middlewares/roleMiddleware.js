const { fail } = require('../utils/apiResponse');

/**
 * requireRole('admin') — пропускает только пользователей с указанной ролью.
 * Должен использоваться ПОСЛЕ requireAuth (нужен req.userRole).
 */
function requireRole(role) {
  return (req, res, next) => {
    if (!req.userRole) {
      return fail(res, 401, 'Требуется авторизация', 'NO_TOKEN');
    }
    if (req.userRole !== role) {
      return fail(res, 403, 'Недостаточно прав', 'FORBIDDEN_ROLE');
    }
    next();
  };
}

/**
 * requireAnyRole('user', 'admin') — пропускает, если роль входит в список.
 */
function requireAnyRole(...roles) {
  return (req, res, next) => {
    if (!req.userRole) {
      return fail(res, 401, 'Требуется авторизация', 'NO_TOKEN');
    }
    if (!roles.includes(req.userRole)) {
      return fail(res, 403, 'Недостаточно прав', 'FORBIDDEN_ROLE');
    }
    next();
  };
}

// Готовый шорткат для админских маршрутов
const adminMiddleware = requireRole('admin');

module.exports = { requireRole, requireAnyRole, adminMiddleware };
