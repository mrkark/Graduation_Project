import api from './client';

export async function getGeneralRoom() {
  const { data } = await api.get('/chat/rooms/general');
  return data.data;
}
export async function listRooms() {
  const { data } = await api.get('/chat/rooms');
  return data.data;
}
export async function createPrivateRoom(friendUserId) {
  const { data } = await api.post('/chat/rooms/private', { friendUserId });
  return data.data;
}
export async function listMessages(roomId, params) {
  const { data } = await api.get(`/chat/rooms/${roomId}/messages`, { params });
  return data.data;
}
