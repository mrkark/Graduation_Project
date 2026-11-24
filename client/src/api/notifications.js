import api from './client';

export async function listNotifications(limit = 30) {
  const { data } = await api.get('/notifications', { params: { limit } });
  return data.data; // { items: [...], unreadCount: number }
}

export async function markNotificationRead(notificationId = null) {
  const { data } = await api.post('/notifications/read', { notificationId });
  return data.data;
}

export async function deleteNotification(notificationId) {
  const { data } = await api.delete(`/notifications/${notificationId}`);
  return data.data;
}

export async function clearAllNotifications() {
  const { data } = await api.delete('/notifications');
  return data.data;
}
