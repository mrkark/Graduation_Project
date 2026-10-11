import api from './client';

export async function listClips(params) {
  const { data } = await api.get('/animations', { params });
  return data.data || [];
}

export async function listTransitions() {
  const { data } = await api.get('/animations/transitions');
  return data.data || [];
}

export async function reportMissingAnimation(payload) {
  const { data } = await api.post('/animations/report-missing', payload);
  return data.data;
}

export async function listMissingRequests(params) {
  const { data } = await api.get('/animations/missing', { params });
  return data.data || [];
}
