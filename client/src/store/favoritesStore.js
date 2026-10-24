import { create } from 'zustand';
import { listFavorites, toggleFavorite } from '../api/favorites';

export const useFavoritesStore = create((set, get) => ({
  kataFavorites: [],
  bunkaiFavorites: [],
  loaded: false,
  loading: false,

  fetchFavorites: async () => {
    try {
      set({ loading: true });
      const data = await listFavorites();
      set({
        kataFavorites: data.kata || [],
        bunkaiFavorites: data.bunkai || [],
        loaded: true,
      });
    } catch (err) {
      console.error('Failed to load favorites:', err);
    } finally {
      set({ loading: false });
    }
  },

  isKataFavorite: (kataId) => {
    return get().kataFavorites.includes(Number(kataId));
  },

  isBunkaiFavorite: (bunkaiId) => {
    return get().bunkaiFavorites.includes(Number(bunkaiId));
  },

  toggle: async (type, id) => {
    const numericId = Number(id);
    const key = type === 'kata' ? 'kataFavorites' : 'bunkaiFavorites';
    const current = get()[key];
    const isCurrentlyFav = current.includes(numericId);

    // Оптимистичное обновление
    const nextList = isCurrentlyFav
      ? current.filter((x) => x !== numericId)
      : [...current, numericId];

    set({ [key]: nextList });

    try {
      const res = await toggleFavorite(type, numericId);
      // Если ответ сервера отличается от оптимистичного, синхронизируем
      const serverFav = Boolean(res.isFavorite);
      const synced = serverFav
        ? [...get()[key].filter((x) => x !== numericId), numericId]
        : get()[key].filter((x) => x !== numericId);
      set({ [key]: synced });
      return serverFav;
    } catch (err) {
      // Откат при ошибке
      set({ [key]: current });
      throw err;
    }
  },
}));
