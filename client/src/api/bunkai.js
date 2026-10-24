import api from './client';

const bunkaiCache = new Map();
const CACHE_TTL = 2 * 60 * 1000; // 2 минуты кэша

export async function listBunkai(params) {
  const key = JSON.stringify(params || {});
  const cached = bunkaiCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  const { data } = await api.get('/bunkai', { params });
  bunkaiCache.set(key, { data, timestamp: Date.now() });
  return data;
}

export async function getBunkai(id) {
  const key = `bunkai_${id}`;
  const cached = bunkaiCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  const { data } = await api.get(`/bunkai/${id}`);
  bunkaiCache.set(key, { data: data.data, timestamp: Date.now() });
  return data.data;
}

export function clearBunkaiCache() {
  bunkaiCache.clear();
}

export async function createBunkai(payload) {
  clearBunkaiCache();
  const { data } = await api.post('/bunkai', payload);
  return data.data;
}

export async function updateBunkai(id, payload) {
  clearBunkaiCache();
  const { data } = await api.put(`/bunkai/${id}`, payload);
  return data.data;
}

export async function deleteBunkai(id) {
  clearBunkaiCache();
  await api.delete(`/bunkai/${id}`);
}

export async function approveBunkai(id) {
  clearBunkaiCache();
  const { data } = await api.post(`/bunkai/${id}/approve`);
  return data.data;
}

export async function rejectBunkai(id) {
  clearBunkaiCache();
  const { data } = await api.post(`/bunkai/${id}/reject`);
  return data.data;
}

export async function getBunkaiSteps(id) {
  const { data } = await api.get(`/bunkai/${id}/steps`);
  return data.data;
}

export async function saveBunkaiSteps(id, steps) {
  clearBunkaiCache();
  const { data } = await api.put(`/bunkai/${id}/steps`, { steps });
  return data.data;
}
