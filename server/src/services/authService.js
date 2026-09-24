const bcrypt = require('bcryptjs');
const authRepo = require('../db/authRepo');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');

// authService — бизнес-логика (хеширование паролей, выпуск JWT). Никаких SQL-запросов
// здесь нет: за данными всегда обращаемся к authRepo, который вызывает sp_Auth_*.
class AuthError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function register({ username, email, password, displayName }) {
  const passwordHash = await bcrypt.hash(password, 12);

  // Уникальность и назначение роли 'user' проверяются внутри sp_Auth_Register —
  // при конфликте процедура сама бросит ERR|409|USERNAME_TAKEN/EMAIL_TAKEN,
  // execProc превратит это в ApiError с тем же контрактом, что и раньше AuthError.
  const row = await authRepo.register({ username, email, passwordHash, displayName });
  return issueTokens(row);
}

async function login({ username, password }) {
  const row = await authRepo.getByUsername(username);
  if (!row) throw new AuthError(401, 'Неверное имя пользователя или пароль', 'INVALID_CREDENTIALS');

  if (row.Is_Blocked) throw new AuthError(403, 'Аккаунт заблокирован', 'USER_BLOCKED');

  const match = await bcrypt.compare(password, row.Password_Hash);
  if (!match) throw new AuthError(401, 'Неверное имя пользователя или пароль', 'INVALID_CREDENTIALS');

  return issueTokens(row);
}

function issueTokens(row) {
  const payload = { userId: row.User_ID, role: row.Role_Name };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken({ userId: row.User_ID });
  return { user: authRepo.toSafeUser(row), role: row.Role_Name, accessToken, refreshToken };
}

async function refresh(refreshToken) {
  if (!refreshToken) throw new AuthError(401, 'Refresh-токен отсутствует', 'NO_REFRESH_TOKEN');

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (_err) {
    throw new AuthError(401, 'Недействительный refresh-токен', 'INVALID_REFRESH_TOKEN');
  }

  const row = await authRepo.getById(payload.userId);
  if (!row) throw new AuthError(401, 'Пользователь не найден', 'USER_NOT_FOUND');
  if (row.Is_Blocked) throw new AuthError(403, 'Аккаунт заблокирован', 'USER_BLOCKED');

  return issueTokens(row);
}

module.exports = { register, login, refresh, AuthError };
