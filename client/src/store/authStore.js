import { create } from 'zustand';
import * as authApi from '../api/auth';
import { setAccessToken, setUnauthorizedHandler } from '../api/client';

// status: 'checking' | 'guest' | 'authenticated'
export const useAuthStore = create((set, get) => ({
  status: 'checking',
  user: null,
  role: 'guest',

  // Вызывается один раз при загрузке приложения: пытаемся обменять
  // httpOnly refresh-cookie на новый access-token без участия пользователя.
  async bootstrap() {
    try {
      const { accessToken, user, role } = await authApi.refresh();
      setAccessToken(accessToken);
      set({ status: 'authenticated', user, role });
    } catch {
      setAccessToken(null);
      set({ status: 'guest', user: null, role: 'guest' });
    }
  },

  async register(payload) {
    const { accessToken, user, role } = await authApi.register(payload);
    setAccessToken(accessToken);
    set({ status: 'authenticated', user, role });
  },

  async login(payload) {
    const { accessToken, user, role } = await authApi.login(payload);
    setAccessToken(accessToken);
    set({ status: 'authenticated', user, role });
  },

  async logout() {
    try {
      await authApi.logout();
    } finally {
      setAccessToken(null);
      set({ status: 'guest', user: null, role: 'guest' });
    }
  },

  setUser(user) {
    set({ user });
  },

  // Гость: сессия истекла / refresh не удался
  forceGuest() {
    setAccessToken(null);
    set({ status: 'guest', user: null, role: 'guest' });
  },
}));

setUnauthorizedHandler(() => {
  useAuthStore.getState().forceGuest();
});
