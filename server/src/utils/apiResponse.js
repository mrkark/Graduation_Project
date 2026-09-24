/**
 * Единый формат ответа для всего API (раздел 15 ТЗ).
 */
function ok(res, data = null, meta = undefined, status = 200) {
  const body = { success: true, data };
  if (meta !== undefined) body.meta = meta;
  return res.status(status).json(body);
}

function created(res, data) {
  return ok(res, data, undefined, 201);
}

function fail(res, status, message, code = undefined, details = undefined) {
  const body = { success: false, error: { message, code, details } };
  return res.status(status).json(body);
}

module.exports = { ok, created, fail };
