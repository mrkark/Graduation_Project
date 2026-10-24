import api from './client';

export async function listFavorites() {
  const { data } = await api.get('/favorites');
  return data.data; // { kata: [ids], bunkai: [ids], all: [...] }
}

export async function toggleFavorite(itemType, itemId) {
  const { data } = await api.post('/favorites/toggle', { itemType, itemId });
  return data.data; // { isFavorite: boolean, itemType, itemId }
}
