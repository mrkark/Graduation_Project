import api from './client';

export async function listKata(params) {
  const { data } = await api.get('/kata', { params });
  return data;
}
export async function getKata(id) {
  const { data } = await api.get(`/kata/${id}`);
  return data.data;
}
export async function createKata(payload) {
  const { data } = await api.post('/kata', payload);
  return data.data;
}
export async function updateKata(id, payload) {
  const { data } = await api.put(`/kata/${id}`, payload);
  return data.data;
}
export async function deleteKata(id) {
  await api.delete(`/kata/${id}`);
}
export async function approveKata(id) {
  const { data } = await api.post(`/kata/${id}/approve`);
  return data.data;
}
export async function rejectKata(id) {
  const { data } = await api.post(`/kata/${id}/reject`);
  return data.data;
}
