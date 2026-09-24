const { verifyAccessToken } = require('../utils/jwt');
const { User } = require('../models');

// Проверяет access-токен из заголовка Authorization: Bearer <token>
// Не блокирует запрос без токена — req.user останется undefined (для guest-доступа)
async function attachUser(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();

  try {
    const token = header.slice(7);
    const payload = verifyAccessToken(token);
    const user = await User.findByPk(payload.id);
    if (user && !user.isBanned) req.user = user;
    next();
  } catch (err) {
    next(); // невалидный/просроченный токен — просто идём дальше как guest
  }
}

// Требует, чтобы пользователь был аутентифицирован
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      data: null,
      error: { code: 'UNAUTHORIZED', message: 'Требуется авторизация' },
    });
  }
  next();
}

module.exports = { attachUser, requireAuth };
