import api from './client';

export async function listComments({ kataId, bunkaiId }) {
  const { data } = await api.get('/comments', { params: { kataId, bunkaiId } });
  return data.data;
}
export async function createComment(payload) {
  const { data } = await api.post('/comments', payload);
  return data.data;
}
export async function deleteComment(id) {
  await api.delete(`/comments/${id}`);
}
