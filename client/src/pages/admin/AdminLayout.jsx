import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import './admin.css';

export default function AdminLayout() {
  const role = useAuthStore((s) => s.role);
  const isAdmin = role === 'admin';

  return (
    <div className="admin-wrapper">
      <div className="admin-page-header">
        <div className="admin-page-header__left">
          <span className="hanko hanko--lg">管理</span>
          <div>
            <h1>{isAdmin ? 'Палата администратора Додзё' : 'Палата модерации Додзё'}</h1>
            <p>Управление реестром каратек, модерация боевых разборов ката и аудит системы</p>
          </div>
        </div>
      </div>

      <div className="admin-shell">
        <nav className="admin-nav">
          <NavLink to="/admin" end>
            <span>Обзор системы</span>
            <span className="admin-nav__kanji">総括</span>
          </NavLink>
          <NavLink to="/admin/users">
            <span>Каратэки (Пользователи)</span>
            <span className="admin-nav__kanji">門人</span>
          </NavLink>
          {isAdmin && (
            <NavLink to="/admin/kata">
              <span>Модерация ката</span>
              <span className="admin-nav__kanji">型</span>
            </NavLink>
          )}
          <NavLink to="/admin/bunkai">
            <span>Модерация бункай</span>
            <span className="admin-nav__kanji">分解</span>
          </NavLink>
          {isAdmin && (
            <NavLink to="/admin/logs">
              <span>Журнал действий</span>
              <span className="admin-nav__kanji">記録</span>
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin/animations">
              <span>Запросы анимаций</span>
              <span className="admin-nav__kanji">動作</span>
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin/backups">
              <span>Резервные копии</span>
              <span className="admin-nav__kanji">控</span>
            </NavLink>
          )}
        </nav>
        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
