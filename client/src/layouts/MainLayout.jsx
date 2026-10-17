import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import './MainLayout.css';

export default function MainLayout() {
  const { user, role, logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const location = useLocation();

  // Закрывать мобильное меню и выпадающие списки при смене роута
  useEffect(() => {
    setMobileMenuOpen(false);
    setUserDropdownOpen(false);
  }, [location.pathname]);

  // Закрывать выпадающий список при клике вне его
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Блокировка скролла при открытом мобильном меню
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

  const isStaff = role === 'admin' || role === 'moderator';

  return (
    <div className="site-shell">
      {/* ЕДИНАЯ ВЕРХНЯЯ НАВИГАЦИОННАЯ ПАНЕЛЬ */}
      <header className="navbar">
        <div className="container navbar__container">
          {/* Логотип Bunkai Explorer */}
          <Link to="/" className="navbar__brand">
            <span className="navbar__logo-text">BUNKAI EXPLORER</span>
            <span className="navbar__logo-kanji">分解</span>
          </Link>

          {/* Основная навигация */}
          <nav className="navbar__menu">
            <NavLink to="/kata" className={({ isActive }) => `navbar__link ${isActive ? 'active' : ''}`}>
              Ката
            </NavLink>
            <NavLink to="/bunkai" className={({ isActive }) => `navbar__link ${isActive ? 'active' : ''}`}>
              Бункай
            </NavLink>
            <NavLink to="/motion-lab" className={({ isActive }) => `navbar__link ${isActive ? 'active' : ''}`}>
              Aimokap
            </NavLink>
            <NavLink to="/bunkai/new" className={({ isActive }) => `navbar__link ${isActive ? 'active' : ''}`}>
              Студия
            </NavLink>
          </nav>

          {/* Действия пользователя справа */}
          <div className="navbar__actions">
            {user ? (
              <div className="navbar__user-menu" ref={dropdownRef}>
                <button
                  type="button"
                  className="navbar__user-btn"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  aria-expanded={userDropdownOpen}
                >
                  <span className="navbar__user-name">{user.Display_Name || user.Username}</span>
                  {isStaff && <span className="navbar__staff-pill">{role === 'admin' ? 'Сэнсэй' : 'Сэмпай'}</span>}
                  <span className="navbar__chevron">{userDropdownOpen ? '▴' : '▾'}</span>
                </button>

                {userDropdownOpen && (
                  <div className="navbar__dropdown">
                    <div className="navbar__dropdown-header">
                      <div className="navbar__dropdown-user">{user.Display_Name || user.Username}</div>
                      <div className="navbar__dropdown-email">{user.Email}</div>
                    </div>
                    <div className="navbar__dropdown-divider" />
                    <Link to="/profile" className="navbar__dropdown-item">
                      Личный профиль
                    </Link>
                    <Link to="/chat" className="navbar__dropdown-item">
                      Сообщения Додзё
                    </Link>
                    <Link to="/friends" className="navbar__dropdown-item">
                      Соратники (Друзья)
                    </Link>
                    {isStaff && (
                      <Link to="/admin" className="navbar__dropdown-item navbar__dropdown-item--admin">
                        Панель управления
                      </Link>
                    )}
                    <div className="navbar__dropdown-divider" />
                    <button type="button" className="navbar__dropdown-item navbar__dropdown-item--logout" onClick={logout}>
                      Выйти из профиля
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="navbar__auth-links">
                <Link to="/login" className="btn btn-subtle navbar__login-btn">
                  Войти
                </Link>
                <Link to="/register" className="btn btn-primary navbar__register-btn">
                  Присоединиться
                </Link>
              </div>
            )}

            {/* Мобильная кнопка меню */}
            <button
              type="button"
              className="navbar__burger"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Переключить меню"
            >
              <span className={`burger-line ${mobileMenuOpen ? 'open' : ''}`} />
              <span className={`burger-line ${mobileMenuOpen ? 'open' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* МОБИЛЬНОЕ ВЫДВИЖНОЕ МЕНЮ */}
      {mobileMenuOpen && (
        <div className="mobile-drawer">
          <div className="container mobile-drawer__inner">
            <nav className="mobile-drawer__nav">
              <NavLink to="/" end className="mobile-drawer__link">
                Главная
              </NavLink>
              <NavLink to="/kata" className="mobile-drawer__link">
                Каталог ката
              </NavLink>
              <NavLink to="/bunkai" className="mobile-drawer__link">
                Разборы бункай
              </NavLink>
              <NavLink to="/motion-lab" className="mobile-drawer__link">
                Aimokap (Камера)
              </NavLink>
              <NavLink to="/bunkai/new" className="mobile-drawer__link">
                Студия бункай
              </NavLink>
              {user && (
                <>
                  <div className="mobile-drawer__divider" />
                  <NavLink to="/profile" className="mobile-drawer__link">
                    Мой профиль
                  </NavLink>
                  <NavLink to="/chat" className="mobile-drawer__link">
                    Сообщения
                  </NavLink>
                  <NavLink to="/friends" className="mobile-drawer__link">
                    Друзья
                  </NavLink>
                  {isStaff && (
                    <NavLink to="/admin" className="mobile-drawer__link mobile-drawer__link--admin">
                      Панель управления
                    </NavLink>
                  )}
                </>
              )}
            </nav>

            <div className="mobile-drawer__footer">
              {user ? (
                <button type="button" className="btn btn-danger" style={{ width: '100%' }} onClick={logout}>
                  Выйти из профиля
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
                  <Link to="/login" className="btn btn-secondary" style={{ width: '100%' }}>
                    Войти
                  </Link>
                  <Link to="/register" className="btn btn-primary" style={{ width: '100%' }}>
                    Регистрация
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ОСНОВНОЙ КОНТЕНТ СТРАНИЦЫ */}
      <main className="site-content">
        <Outlet />
      </main>

      {/* АРХИТЕКТУРНЫЙ ФУТЕР В СТИЛИСТИКЕ ТРАДИЦИОННОГО ДОДЗЁ */}
      <footer className="dojo-footer">
        <div className="container dojo-footer__container">
          <div className="dojo-footer__grid">
            {/* 1. Идентичность и философия школы */}
            <div className="dojo-footer__col dojo-footer__col--brand">
              <div className="dojo-footer__logo">
                <span className="dojo-footer__logo-title">BUNKAI EXPLORER</span>
                <span className="dojo-footer__logo-kanji">空手道 · 分解</span>
              </div>
              <p className="dojo-footer__desc">
                Интерактивная среда для глубокого освоения 26 канонических ката Сётокан,
                пространственного анализа траекторий эмбусэн и боевой биомеханики бункай.
              </p>
              <div className="dojo-footer__motto">
                <span className="dojo-footer__motto-mark">「空手に先手なし」</span>
                <span className="dojo-footer__motto-trans">В каратэ нет первого нападения</span>
              </div>
            </div>

            {/* 2. Навигация по залам Додзё */}
            <div className="dojo-footer__col">
              <h4 className="dojo-footer__heading">Хранилище форм</h4>
              <ul className="dojo-footer__list">
                <li><Link to="/kata">Атлас 26 Ката (型)</Link></li>
                <li><Link to="/bunkai">Боевые сценарии Бункай (分解)</Link></li>
                <li><Link to="/motion-lab">AI Мокап Лаборатория (Aimokap)</Link></li>
                <li><Link to="/bunkai/new">Мастерская симуляции боя</Link></li>
              </ul>
            </div>

            {/* 3. Канон и традиция */}
            <div className="dojo-footer__col">
              <h4 className="dojo-footer__heading">Канон Сётокан</h4>
              <ul className="dojo-footer__list">
                <li><Link to="/kata/1">Школа Хэйан (Базовые формы)</Link></li>
                <li><Link to="/kata">Мастерские ката (Дан)</Link></li>
                <li><Link to="/bunkai">Контроль дистанции Ма-ай</Link></li>
                <li><Link to="/motion-lab">Анализ биомеханики Кимэ</Link></li>
              </ul>
            </div>

            {/* 4. Личный кабинет практикующего */}
            <div className="dojo-footer__col">
              <h4 className="dojo-footer__heading">Путь каратэка</h4>
              <ul className="dojo-footer__list">
                {user ? (
                  <>
                    <li><Link to="/profile">Личный профиль ученика</Link></li>
                    <li><Link to="/chat">Сообщения Додзё</Link></li>
                    <li><Link to="/friends">Соратники (Друзья)</Link></li>
                    {isStaff && <li><Link to="/admin">Панель управления</Link></li>}
                  </>
                ) : (
                  <>
                    <li><Link to="/login">Вход в систему</Link></li>
                    <li><Link to="/register">Регистрация в Додзё</Link></li>
                  </>
                )}
              </ul>
            </div>
          </div>

          {/* Нижняя полоса с копирайтом и традиционной печатью */}
          <div className="dojo-footer__bottom">
            <div className="dojo-footer__copy">
              © {new Date().getFullYear()} Bunkai Explorer. Традиционная школа Сётокан каратэдо. Все права сохранены.
            </div>
            <div className="dojo-footer__seal-wrap">
              <span className="dojo-footer__seal-label">伝統の継承</span>
              <div className="dojo-footer__hanko">武道</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
