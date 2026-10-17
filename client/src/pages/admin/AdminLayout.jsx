import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export default function AdminLayout() {
  const role = useAuthStore((s) => s.role);
  const isAdmin = role === 'admin';

  return (
    <div>
      <h1>{isAdmin ? 'Административная панель' : 'Панель модерации (Додзё)'}</h1>
      <div className="admin-shell">
        <nav className="admin-nav">
          <NavLink to="/admin" end>
            Обзор
          </NavLink>
          <NavLink to="/admin/users">Пользователи</NavLink>
          {isAdmin && <NavLink to="/admin/kata">Модерация ката</NavLink>}
          <NavLink to="/admin/bunkai">Модерация бункаев</NavLink>
          {isAdmin && <NavLink to="/admin/logs">Журнал действий</NavLink>}
          {isAdmin && <NavLink to="/admin/animations">Запросы анимаций</NavLink>}
          {isAdmin && <NavLink to="/admin/backups">Резервные копии</NavLink>}
        </nav>
        <div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
