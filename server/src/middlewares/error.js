const logger = require('../utils/logger');

// Централизованная обработка ошибок в едином формате ответа API
function errorHandler(err, req, res, next) {
  logger.error(err.stack || err.message);

  const status = err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = status === 500 ? 'Внутренняя ошибка сервера' : err.message;

  res.status(status).json({
    success: false,
    data: null,
    error: { code, message },
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    data: null,
    error: { code: 'NOT_FOUND', message: 'Маршрут не найден' },
  });
}

// Утилита для создания ошибок с http-статусом внутри контроллеров/сервисов
class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

module.exports = { errorHandler, notFoundHandler, ApiError };
