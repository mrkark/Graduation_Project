import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi } from '../api/endpoints';
import { setAccessToken, setUnauthorizedHandler } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearAuth = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clearAuth);

    // При первой загрузке пробуем "тихо" обновить сессию по refresh-cookie
    (async () => {
      try {
        const { data } = await authApi.refresh();
        setAccessToken(data.data.accessToken);
        setUser(data.data.user);
      } catch {
        clearAuth();
      } finally {
        setLoading(false);
      }
    })();
  }, [clearAuth]);

  async function login(email, password) {
    const { data } = await authApi.login({ email, password });
    setAccessToken(data.data.accessToken);
    setUser(data.data.user);
  }

  async function register(payload) {
    const { data } = await authApi.register(payload);
    setAccessToken(data.data.accessToken);
    setUser(data.data.user);
  }

  async function logout() {
    try {
      await authApi.logout();
    } finally {
      clearAuth();
    }
  }

  const isModerator = user && ['moderator', 'admin'].includes(user.role);
  const isAdmin = user && user.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isModerator, isAdmin, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
