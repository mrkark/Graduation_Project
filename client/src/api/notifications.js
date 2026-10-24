import api from './client';

export async function listNotifications(limit = 30) {
  const { data } = await api.get('/notifications', { params: { limit } });
  return data.data; // { items: [...], unreadCount: number }
}

export async function markNotificationRead(notificationId = null) {
  const { data } = await api.post('/notifications/read', { notificationId });
  return data.data;
}
