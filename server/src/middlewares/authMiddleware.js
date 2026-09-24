const { verifyAccessToken } = require('../utils/jwt');
const { fail } = require('../utils/apiResponse');
const authRepo = require('../db/authRepo');

/**
 * requireAuth — обязательная проверка JWT access-токена.
 * Guest (нет валидного токена) ВСЕГДА получает 401, независимо от того,
 * что показывает фронтенд. Это серверный барьер из раздела 2 ТЗ:
 * "нельзя ограничиваться только React-редиректом".
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return fail(res, 401, 'Требуется авторизация', 'NO_TOKEN');
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return fail(res, 401, 'Сессия истекла, требуется повторный вход', 'TOKEN_EXPIRED');
      }
      return fail(res, 401, 'Недействительный токен', 'INVALID_TOKEN');
    }

    // Роль и блокировка проверяются заново в БД на каждый запрос (через sp_Auth_GetById) —
    // фронтенду/токену не доверяем (раздел 17 ТЗ: "не доверяй роли, присланной с frontend").
    const user = await authRepo.getById(payload.userId);
    if (!user) {
      return fail(res, 401, 'Пользователь не найден', 'USER_NOT_FOUND');
    }
    if (user.Is_Blocked) {
      return fail(res, 403, 'Аккаунт заблокирован', 'USER_BLOCKED');
    }

    req.user = authRepo.toSafeUser(user);
    req.userRole = authRepo.roleOf(user);
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * optionalAuth — не блокирует запрос, но если токен есть и валиден,
 * прикрепляет req.user.
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    const user = await authRepo.getById(payload.userId);
    if (user && !user.Is_Blocked) {
      req.user = authRepo.toSafeUser(user);
      req.userRole = authRepo.roleOf(user);
    }
  } catch (_err) {
    // тихо игнорируем — это необязательная авторизация
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
