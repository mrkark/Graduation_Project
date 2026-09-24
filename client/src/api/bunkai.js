import api from './client';

export async function listBunkai(params) {
  const { data } = await api.get('/bunkai', { params });
  return data;
}
export async function getBunkai(id) {
  const { data } = await api.get(`/bunkai/${id}`);
  return data.data;
}
export async function createBunkai(payload) {
  const { data } = await api.post('/bunkai', payload);
  return data.data;
}
export async function updateBunkai(id, payload) {
  const { data } = await api.put(`/bunkai/${id}`, payload);
  return data.data;
}
export async function deleteBunkai(id) {
  await api.delete(`/bunkai/${id}`);
}
export async function approveBunkai(id) {
  const { data } = await api.post(`/bunkai/${id}/approve`);
  return data.data;
}
export async function rejectBunkai(id) {
  const { data } = await api.post(`/bunkai/${id}/reject`);
  return data.data;
}
