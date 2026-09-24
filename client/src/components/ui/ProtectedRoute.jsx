import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Оборачивает роут: пускает дальше только если пользователь авторизован
// и (опционально) обладает одной из разрешённых ролей.
export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="page-loader">Загрузка…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return children;
}
