import api from './client';

export async function listUsers(params) {
  const { data } = await api.get('/users', { params });
  return data;
}
export async function blockUser(id) {
  await api.post(`/users/${id}/block`);
}
export async function unblockUser(id) {
  await api.post(`/users/${id}/unblock`);
}
export async function changeUserRole(id, roleName) {
  await api.patch(`/users/${id}/role`, { roleName });
}
export async function deleteUser(id) {
  await api.delete(`/users/${id}`);
}
export async function fetchLogs(params) {
  const { data } = await api.get('/admin/logs', { params });
  return data;
}
export async function fetchBackups() {
  const { data } = await api.get('/admin/backups');
  return data.data;
}
export async function createBackup() {
  const { data } = await api.post('/admin/backups');
  return data.data;
}
export async function fetchStats() {
  const { data } = await api.get('/admin/stats');
  return data.data;
}
