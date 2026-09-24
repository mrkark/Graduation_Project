const { callProcedure } = require('../db/execProc');

/**
 * Пишет запись в ActivityLogs через sp_ActivityLog_Insert. Никогда не бросает
 * исключение наружу — сбой логирования не должен ломать основной запрос.
 */
async function logActivity({ userId = null, action, entityType = null, entityId = null, details = null, ip = null }) {
  try {
    await callProcedure('sp_ActivityLog_Insert', {
      UserId: userId,
      Action: action,
      EntityType: entityType,
      EntityId: entityId,
      Details: details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null,
      IpAddress: ip,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Не удалось записать ActivityLog:', err.message);
  }
}

module.exports = { logActivity };
