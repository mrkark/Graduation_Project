import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import './MainLayout.css';

export default function MainLayout() {
  const { user, role, logout } = useAuthStore();

  return (
    <div className="site">
      <header className="site-header">
        <div className="site-header__topbar">
          <div className="container site-header__topbar-inner">
            <span className="site-header__motto">
              <span className="kanji-seal-mini">道</span> 空手に先手なし — В каратэ нет первого нападения
            </span>
            <span className="site-header__dojo-tag">
              Школа традиционного каратэдо
            </span>
          </div>
        </div>

        <div className="container site-header__inner">
          <Link to="/" className="site-logo">
            <div className="site-seal">
              <span className="site-seal__kanji">空手</span>
            </div>
            <div className="site-logo__text">
              <span className="site-logo__brand">BUNKAI EXPLORER</span>
              <span className="site-logo__kanji">分解探検家 · 空手道</span>
            </div>
          </Link>

          <nav className="site-nav">
            <NavLink to="/kata" className="site-nav__link">
              <span className="site-nav__icon">型</span>
              <span>Ката</span>
            </NavLink>
            <NavLink to="/bunkai" className="site-nav__link">
              <span className="site-nav__icon">解</span>
              <span>Бункаи</span>
            </NavLink>
            <NavLink to="/chat" className="site-nav__link">
              <span className="site-nav__icon">話</span>
              <span>Чат</span>
            </NavLink>
            <NavLink to="/motion-lab" className="site-nav__link">
              <span className="site-nav__icon">動</span>
              <span>AI Мокап</span>
            </NavLink>
            <NavLink to="/friends" className="site-nav__link">
              <span className="site-nav__icon">友</span>
              <span>Друзья</span>
            </NavLink>
            {role === 'admin' && (
              <NavLink to="/admin" className="site-nav__link site-nav__link--admin">
                <span className="site-nav__icon">役</span>
                <span>Админ</span>
              </NavLink>
            )}
          </nav>

          <div className="site-user">
            <Link to="/profile" className="site-user__card" title="Личный профиль">
              <div className="site-user__avatar-badge">
                {(user?.Display_Name || user?.Username || '門')[0].toUpperCase()}
              </div>
              <div className="site-user__info">
                <span className="site-user__name">
                  {user?.Display_Name || user?.Username}
                </span>
                <span className="site-user__role">
                  {role === 'admin' ? 'Инструктор (Sensei)' : 'Ученик (Deshi)'}
                </span>
              </div>
            </Link>
            <button className="btn btn-logout" onClick={() => logout()} title="Завершить тренировку">
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="site-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container site-footer__inner">
          <div className="site-footer__brand">
            <div className="site-seal site-seal--sm">
              <span className="site-seal__kanji">分</span>
            </div>
            <div>
              <div className="site-footer__title">Bunkai Explorer — 分解探検家</div>
              <div className="site-footer__desc">
                Интерактивная энциклопедия традиционных форм каратэдо и практического анализа техник
              </div>
            </div>
          </div>

          <div className="site-footer__quote">
            <p>«Каратэ начинается с поклона и заканчивается поклоном»</p>
            <small>— Гитин Фунакоси, основатель Сётокан каратэ</small>
          </div>

          <div className="site-footer__bottom">
            <span>© {new Date().getFullYear()} Bunkai Explorer. Путь боевого искусства.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
