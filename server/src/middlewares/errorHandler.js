const { fail } = require('../utils/apiResponse');
const { logActivity } = require('../utils/activityLogger');

function notFoundHandler(req, res) {
  return fail(res, 404, 'Маршрут не найден', 'ROUTE_NOT_FOUND');
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err);

  logActivity({
    userId: req.user ? req.user.User_ID : null,
    action: 'server_error',
    details: { message: err.message, path: req.originalUrl, method: req.method },
    ip: req.ip,
  });

  // ApiError — ожидаемая бизнес-ошибка, разобранная из THROW хранимой процедуры
  // (см. server/src/db/execProc.js). status/code уже выставлены.
  const status = err.status || 500;
  const message = status === 500 ? 'Внутренняя ошибка сервера' : err.message;
  return fail(res, status, message, err.code || 'INTERNAL_ERROR');
}

module.exports = { notFoundHandler, errorHandler };
