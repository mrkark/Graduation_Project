import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

/**
 * Пока идёт первичная проверка сессии (bootstrap), ничего не показываем,
 * чтобы не мигать защищённым контентом или формой регистрации.
 */
export function AuthGate({ children }) {
  const status = useAuthStore((s) => s.status);
  if (status === 'checking') {
    return (
      <div className="loading" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Проверка сессии…
      </div>
    );
  }
  return children;
}

/**
 * RequireAuth — раздел 2 ТЗ: guest НЕ должен видеть внутренние страницы.
 * Важно: это только UX-удобство. Настоящая защита — на backend (401 на каждый
 * защищённый эндпоинт), фронтенд-редирект сам по себе ничего не гарантирует.
 */
export function RequireAuth() {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === 'guest') {
    return <Navigate to="/register" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

// Разрешённые для guest страницы: если уже авторизован, /login и /register не нужны
export function RedirectIfAuthenticated({ children }) {
  const status = useAuthStore((s) => s.status);
  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }
  return children;
}

export function RequireAdmin() {
  const role = useAuthStore((s) => s.role);
  if (role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
