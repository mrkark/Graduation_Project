import api from './client';

export async function register({ username, email, password, displayName }) {
  const { data } = await api.post('/auth/register', { username, email, password, displayName });
  return data.data;
}

export async function login({ username, password }) {
  const { data } = await api.post('/auth/login', { username, password });
  return data.data;
}

export async function logout() {
  const { data } = await api.post('/auth/logout');
  return data.data;
}

export async function fetchMe() {
  const { data } = await api.get('/auth/me');
  return data.data;
}

export async function refresh() {
  const { data } = await api.post('/auth/refresh');
  return data.data;
}

export async function deleteAccount(password) {
  const { data } = await api.delete('/auth/delete-account', { data: { password } });
  return data.data;
}
