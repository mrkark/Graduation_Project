import api from './client';

export async function createDojo(payload) {
  const { data } = await api.post('/dojos', payload);
  return data.data;
}

export async function listMyDojos() {
  const { data } = await api.get('/dojos');
  return data.data;
}

export async function getDojoDetails(id) {
  const { data } = await api.get(`/dojos/${id}`);
  return data.data;
}

export async function inviteUserToDojo(dojoId, targetUserId) {
  const { data } = await api.post(`/dojos/${dojoId}/invite`, { targetUserId });
  return data.data;
}

export async function respondDojoInvite(dojoId, accept) {
  const { data } = await api.post(`/dojos/${dojoId}/respond`, { accept });
  return data.data;
}
