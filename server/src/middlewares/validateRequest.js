const { validationResult } = require('express-validator');
const { fail } = require('../utils/apiResponse');

function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return fail(res, 400, 'Ошибка валидации данных', 'VALIDATION_ERROR', errors.array());
  }
  next();
}

module.exports = validateRequest;
