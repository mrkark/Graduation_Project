const bcrypt = require('bcryptjs');
const authService = require('../services/authService');
const authRepo = require('../db/authRepo');
const { ok, fail } = require('../utils/apiResponse');
const { REFRESH_COOKIE_NAME, refreshCookieOptions } = require('../utils/jwt');
const { logActivity } = require('../utils/activityLogger');

function setRefreshCookie(res, refreshToken) {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);
}

async function register(req, res, next) {
  try {
    const { username, email, password, displayName } = req.body;
    const { user, role, accessToken, refreshToken } = await authService.register({ username, email, password, displayName });

    setRefreshCookie(res, refreshToken);
    await logActivity({ userId: user.User_ID, action: 'register', entityType: 'User', entityId: user.User_ID, ip: req.ip });

    return ok(res, { user, accessToken, role }, undefined, 201);
  } catch (err) {
    if (err.status) return fail(res, err.status, err.message, err.code);
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    const { user, role, accessToken, refreshToken } = await authService.login({ username, password });

    setRefreshCookie(res, refreshToken);
    await logActivity({ userId: user.User_ID, action: 'login', entityType: 'User', entityId: user.User_ID, ip: req.ip });

    return ok(res, { user, accessToken, role });
  } catch (err) {
    if (err.status) return fail(res, err.status, err.message, err.code);
    return next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    const { user, role, accessToken, refreshToken } = await authService.refresh(token);
    setRefreshCookie(res, refreshToken);
    return ok(res, { accessToken, role, user });
  } catch (err) {
    if (err.status) return fail(res, err.status, err.message, err.code);
    return next(err);
  }
}

async function logout(req, res, next) {
  try {
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
    if (req.user) {
      await logActivity({ userId: req.user.User_ID, action: 'logout', entityType: 'User', entityId: req.user.User_ID, ip: req.ip });
    }
    return ok(res, { message: 'Выход выполнен' });
  } catch (err) {
    return next(err);
  }
}

async function me(req, res) {
  return ok(res, { user: req.user, role: req.userRole });
}

async function updateProfile(req, res, next) {
  try {
    const { displayName, bio, avatarUrl } = req.body;
    const row = await authRepo.updateProfile(req.user.User_ID, {
      displayName: displayName !== undefined ? String(displayName).slice(0, 100) : undefined,
      bio: bio !== undefined ? String(bio).slice(0, 4000) : undefined,
      avatarUrl: avatarUrl !== undefined ? String(avatarUrl).slice(0, 500) : undefined,
    });
    return ok(res, { user: authRepo.toSafeUser(row) });
  } catch (err) {
    if (err.status) return fail(res, err.status, err.message, err.code);
    return next(err);
  }
}

async function deleteAccount(req, res, next) {
  try {
    const { password } = req.body;
    // Пароль всё ещё нужно сверить — для этого достаём хеш через ту же процедуру,
    // что и логин; хеш никогда не покидает этот контроллер.
    const row = await authRepo.getById(req.user.User_ID);
    const match = await bcrypt.compare(password || '', row.Password_Hash);
    if (!match) return fail(res, 401, 'Неверный пароль', 'INVALID_PASSWORD');

    await logActivity({ userId: row.User_ID, action: 'delete_account', entityType: 'User', entityId: row.User_ID, ip: req.ip });
    await authRepo.deleteAccount(row.User_ID);

    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
    return ok(res, { message: 'Аккаунт удалён' });
  } catch (err) {
    if (err.status) return fail(res, err.status, err.message, err.code);
    return next(err);
  }
}

module.exports = { register, login, refresh, logout, me, updateProfile, deleteAccount };
