import { NavLink, Outlet } from 'react-router-dom';

export default function AdminLayout() {
  return (
    <div>
      <h1>Административная панель</h1>
      <div className="admin-shell">
        <nav className="admin-nav">
          <NavLink to="/admin" end>
            Обзор
          </NavLink>
          <NavLink to="/admin/users">Пользователи</NavLink>
          <NavLink to="/admin/kata">Модерация ката</NavLink>
          <NavLink to="/admin/bunkai">Модерация бункаев</NavLink>
          <NavLink to="/admin/logs">Журнал действий</NavLink>
          <NavLink to="/admin/backups">Резервные копии</NavLink>
        </nav>
        <div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
