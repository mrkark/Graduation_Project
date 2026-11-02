import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
  Database,
  Swords,
  MessageSquare,
  BookOpen,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import './admin.css';

export default function AdminLayout() {
  const role = useAuthStore((s) => s.role);
  const isAdmin = role === 'admin';

  return (
    <div className="admin-wrapper">
      <header className="admin-page-header">
        <div className="admin-page-header__content">
          <div className="admin-page-header__badge">
            <span className="admin-badge-dot" />
            <span>{isAdmin ? 'РЕЖИМ АДМИНИСТРАТОРА' : 'РЕЖИМ МОДЕРАТОРА'}</span>
          </div>
          <h1>{isAdmin ? 'Панель администратора' : 'Панель модератора'}</h1>
          <p>
            {isAdmin
              ? 'Управление учетными записями пользователей, мониторинг системного аудита, резервное копирование и модерация'
              : 'Утверждение и отклонение публикаций боевых сценариев бункай, просмотр и модерация комментариев'}
          </p>
        </div>
      </header>

      <div className="admin-shell">
        <aside className="admin-sidebar">
          <nav className="admin-nav">
            <div className="admin-nav__group-label">Основное</div>
            <NavLink to="/admin" end className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="admin-nav__icon"><LayoutDashboard size={18} /></span>
              <span className="admin-nav__text">{isAdmin ? 'Обзор системы' : 'Обзор модерации'}</span>
            </NavLink>

            {isAdmin && (
              <>
                <div className="admin-nav__group-label">Администрирование</div>
                <NavLink to="/admin/users" className={({ isActive }) => (isActive ? 'active' : '')}>
                  <span className="admin-nav__icon"><Users size={18} /></span>
                  <span className="admin-nav__text">Пользователи</span>
                </NavLink>
                <NavLink to="/admin/logs" className={({ isActive }) => (isActive ? 'active' : '')}>
                  <span className="admin-nav__icon"><FileText size={18} /></span>
                  <span className="admin-nav__text">Журнал аудита</span>
                </NavLink>
                <NavLink to="/admin/backups" className={({ isActive }) => (isActive ? 'active' : '')}>
                  <span className="admin-nav__icon"><Database size={18} /></span>
                  <span className="admin-nav__text">Резервные копии</span>
                </NavLink>
              </>
            )}

            <div className="admin-nav__group-label">Модерация контента</div>
            <NavLink to="/admin/bunkai" className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="admin-nav__icon"><Swords size={18} /></span>
              <span className="admin-nav__text">Модерация бункай</span>
            </NavLink>
            <NavLink to="/admin/comments" className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="admin-nav__icon"><MessageSquare size={18} /></span>
              <span className="admin-nav__text">Модерация комментариев</span>
            </NavLink>
            {isAdmin && (
              <NavLink to="/admin/kata" className={({ isActive }) => (isActive ? 'active' : '')}>
                <span className="admin-nav__icon"><BookOpen size={18} /></span>
                <span className="admin-nav__text">Каталог ката</span>
              </NavLink>
            )}
          </nav>
        </aside>

        <main className="admin-content">
          <Suspense fallback={<div className="page-loader"><div className="dojo-spinner" /></div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
