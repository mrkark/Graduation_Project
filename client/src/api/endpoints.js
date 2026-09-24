import api from './client';

// Тонкий слой над axios-клиентом — по одному методу на каждый эндпоинт API

export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  refresh: () => api.post('/auth/refresh'),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

export const kataApi = {
  list: (params) => api.get('/kata', { params }),
  getOne: (id) => api.get(`/kata/${id}`),
  create: (data) => api.post('/kata', data),
  update: (id, data) => api.patch(`/kata/${id}`, data),
  remove: (id) => api.delete(`/kata/${id}`),
  createSequence: (data) => api.post('/kata/sequences', data),
  updateSequence: (id, data) => api.patch(`/kata/sequences/${id}`, data),
  deleteSequence: (id) => api.delete(`/kata/sequences/${id}`),
  createMovement: (data) => api.post('/kata/movements', data),
  updateMovement: (id, data) => api.patch(`/kata/movements/${id}`, data),
  deleteMovement: (id) => api.delete(`/kata/movements/${id}`),
};

export const bunkaiApi = {
  list: (params) => api.get('/bunkai', { params }),
  getOne: (id) => api.get(`/bunkai/${id}`),
  create: (data) => api.post('/bunkai', data),
  update: (id, data) => api.patch(`/bunkai/${id}`, data),
  remove: (id) => api.delete(`/bunkai/${id}`),
  vote: (id, value) => api.post(`/bunkai/${id}/vote`, { value }),
  relations: (id) => api.get(`/bunkai/${id}/relations`),
  createRelation: (id, data) => api.post(`/bunkai/${id}/relations`, data),
  comments: (id) => api.get(`/bunkai/${id}/comments`),
  addComment: (id, text) => api.post(`/bunkai/${id}/comments`, { text }),
};

export const commentApi = {
  remove: (id) => api.delete(`/comments/${id}`),
};

export const userApi = {
  getProfile: (id) => api.get(`/users/${id}`),
  updateMe: (data) => api.patch('/users/me', data),
  myBunkai: () => api.get('/users/me/bunkai'),
};

export const mediaApi = {
  upload: (formData) =>
    api.post('/media/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  list: () => api.get('/media'),
  remove: (id) => api.delete(`/media/${id}`),
};

export const adminApi = {
  stats: () => api.get('/admin/stats'),
  listUsers: (params) => api.get('/admin/users', { params }),
  createUser: (data) => api.post('/admin/users', data),
  updateUserRole: (id, role) => api.patch(`/admin/users/${id}/role`, { role }),
  setUserBan: (id, isBanned) => api.patch(`/admin/users/${id}/ban`, { isBanned }),
  resetPassword: (id, newPassword) => api.post(`/admin/users/${id}/reset-password`, { newPassword }),
  moderationQueue: () => api.get('/admin/moderation/queue'),
  moderateBunkai: (id, status) => api.patch(`/admin/moderation/${id}`, { status }),
  hideComment: (id, isHidden) => api.patch(`/admin/comments/${id}/hide`, { isHidden }),
  listTags: () => api.get('/admin/tags'),
  createTag: (name) => api.post('/admin/tags', { name }),
  deleteTag: (id) => api.delete(`/admin/tags/${id}`),
  logs: (params) => api.get('/admin/logs', { params }),
};
