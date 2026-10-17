import { useState, useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import './MainLayout.css';

export default function MainLayout() {
  const { user, role, logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Автоматически закрывать мобильное меню при переходе по ссылке
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Блокировка скролла страницы при открытом мобильном меню
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

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

          {/* Десктопная навигация */}
          <nav className="site-nav site-nav--desktop">
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
            {(role === 'admin' || role === 'moderator') && (
              <NavLink to="/admin" className="site-nav__link site-nav__link--admin">
                <span className="site-nav__icon">役</span>
                <span>{role === 'admin' ? 'Админ' : 'Модерация'}</span>
              </NavLink>
            )}
          </nav>

          {/* Правая часть: пользователь и кнопка меню */}
          <div className="site-header__right-group">
            <div className="site-user site-user--desktop">
              <Link to="/profile" className="site-user__card" title="Личный профиль">
                <div className="site-user__avatar-badge">
                  {(user?.Display_Name || user?.Username || '門')[0].toUpperCase()}
                </div>
                <div className="site-user__info">
                  <span className="site-user__name">
                    {user?.Display_Name || user?.Username}
                  </span>
                  <span className="site-user__role">
                    {role === 'admin'
                      ? 'Инструктор (Sensei)'
                      : role === 'moderator'
                      ? 'Модератор (Senpai)'
                      : 'Ученик (Deshi)'}
                  </span>
                </div>
              </Link>
              <button className="btn btn-logout" onClick={() => logout()} title="Завершить тренировку">
                Выйти
              </button>
            </div>

            {/* Мобильная кнопка-гамбургер */}
            <button
              type="button"
              className={`site-mobile-toggle ${mobileMenuOpen ? 'is-active' : ''}`}
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Меню навигации"
            >
              <span className="hamburger-bar" />
              <span className="hamburger-bar" />
              <span className="hamburger-bar" />
            </button>
          </div>
        </div>

        {/* Выезжающий мобильный дровер Додзё */}
        {mobileMenuOpen && (
          <div className="site-mobile-backdrop" onClick={() => setMobileMenuOpen(false)}>
            <div className="site-mobile-drawer" onClick={(e) => e.stopPropagation()}>
              <div className="site-mobile-drawer__head">
                <div className="site-seal site-seal--sm">
                  <span className="site-seal__kanji">道</span>
                </div>
                <span className="site-mobile-drawer__title">Меню Додзё</span>
                <button
                  type="button"
                  className="site-mobile-close-btn"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  ✕
                </button>
              </div>

              {/* Профиль в мобильном меню */}
              <div className="site-mobile-user">
                <div className="site-user__avatar-badge">
                  {(user?.Display_Name || user?.Username || '門')[0].toUpperCase()}
                </div>
                <div className="site-user__info">
                  <span className="site-user__name">{user?.Display_Name || user?.Username}</span>
                  <span className="site-user__role">
                    {role === 'admin'
                      ? 'Инструктор (Sensei)'
                      : role === 'moderator'
                      ? 'Модератор (Senpai)'
                      : 'Ученик (Deshi)'}
                  </span>
                </div>
              </div>

              {/* Навигационные ссылки */}
              <nav className="site-mobile-nav">
                <NavLink to="/" end className="site-mobile-nav__link">
                  <span className="site-mobile-nav__kanji">本</span>
                  <span>Главная Додзё</span>
                </NavLink>
                <NavLink to="/kata" className="site-mobile-nav__link">
                  <span className="site-mobile-nav__kanji">型</span>
                  <span>Каталог Ката (26 форм)</span>
                </NavLink>
                <NavLink to="/bunkai" className="site-mobile-nav__link">
                  <span className="site-mobile-nav__kanji">解</span>
                  <span>Каталог Бункаев (Боевой анализ)</span>
                </NavLink>
                <NavLink to="/motion-lab" className="site-mobile-nav__link">
                  <span className="site-mobile-nav__kanji">動</span>
                  <span>AI Мокап & Aimokap</span>
                </NavLink>
                <NavLink to="/chat" className="site-mobile-nav__link">
                  <span className="site-mobile-nav__kanji">話</span>
                  <span>Чат тренировочного зала</span>
                </NavLink>
                <NavLink to="/friends" className="site-mobile-nav__link">
                  <span className="site-mobile-nav__kanji">友</span>
                  <span>Соратники и друзья</span>
                </NavLink>
                <NavLink to="/profile" className="site-mobile-nav__link">
                  <span className="site-mobile-nav__kanji">門</span>
                  <span>Личный профиль</span>
                </NavLink>
                {(role === 'admin' || role === 'moderator') && (
                  <NavLink to="/admin" className="site-mobile-nav__link site-mobile-nav__link--admin">
                    <span className="site-mobile-nav__kanji">役</span>
                    <span>{role === 'admin' ? 'Панель администратора' : 'Панель модератора'}</span>
                  </NavLink>
                )}
              </nav>

              <div className="site-mobile-footer">
                <button
                  type="button"
                  className="btn btn-logout site-mobile-logout"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                >
                  🚪 Завершить тренировку (Выйти)
                </button>
              </div>
            </div>
          </div>
        )}
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
