import api from './client';

const kataCache = new Map();
const CACHE_TTL = 3 * 60 * 1000; // 3 минуты кэша для оптимизации скорости загрузки

export async function listKata(params) {
  const key = JSON.stringify(params || {});
  const cached = kataCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  const { data } = await api.get('/kata', { params });
  kataCache.set(key, { data, timestamp: Date.now() });
  return data;
}

export async function getKata(id) {
  const key = `kata_${id}`;
  const cached = kataCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  const { data } = await api.get(`/kata/${id}`);
  kataCache.set(key, { data: data.data, timestamp: Date.now() });
  return data.data;
}

export function clearKataCache() {
  kataCache.clear();
}

export async function createKata(payload) {
  clearKataCache();
  const { data } = await api.post('/kata', payload);
  return data.data;
}

export async function updateKata(id, payload) {
  clearKataCache();
  const { data } = await api.put(`/kata/${id}`, payload);
  return data.data;
}

export async function deleteKata(id) {
  clearKataCache();
  await api.delete(`/kata/${id}`);
}

export async function approveKata(id) {
  clearKataCache();
  const { data } = await api.post(`/kata/${id}/approve`);
  return data.data;
}

export async function rejectKata(id) {
  clearKataCache();
  const { data } = await api.post(`/kata/${id}/reject`);
  return data.data;
}
