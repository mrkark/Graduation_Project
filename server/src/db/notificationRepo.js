const { callProcedure } = require('./execProc');

async function createNotification(userId, type, title, message, targetUrl = null) {
  const result = await callProcedure('sp_Notification_Create', {
    UserId: userId,
    Type: type,
    Title: title,
    Message: message,
    TargetURL: targetUrl,
  });
  return result[0];
}

async function listNotifications(userId, limit = 30) {
  const result = await callProcedure('sp_Notification_List', {
    UserId: userId,
    Limit: limit,
  });
  return result || [];
}

async function markRead(userId, notificationId = null) {
  const result = await callProcedure('sp_Notification_MarkRead', {
    UserId: userId,
    NotificationId: notificationId,
  });
  return result[0];
}

async function getUnreadCount(userId) {
  const result = await callProcedure('sp_Notification_GetUnreadCount', {
    UserId: userId,
  });
  return result[0]?.UnreadCount || 0;
}

module.exports = {
  createNotification,
  listNotifications,
  markRead,
  getUnreadCount,
};
