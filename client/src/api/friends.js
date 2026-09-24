import api from './client';

export async function searchUsers(q) {
  const { data } = await api.get('/users/search', { params: { q } });
  return data.data;
}
export async function listFriends() {
  const { data } = await api.get('/friends');
  return data.data;
}
export async function removeFriend(friendUserId) {
  await api.delete(`/friends/${friendUserId}`);
}
export async function listFriendRequests(direction) {
  const { data } = await api.get('/friends/requests', { params: { direction } });
  return data.data;
}
export async function sendFriendRequest(receiverId) {
  const { data } = await api.post('/friends/requests', { receiverId });
  return data.data;
}
export async function acceptFriendRequest(id) {
  const { data } = await api.post(`/friends/requests/${id}/accept`);
  return data.data;
}
export async function rejectFriendRequest(id) {
  const { data } = await api.post(`/friends/requests/${id}/reject`);
  return data.data;
}
