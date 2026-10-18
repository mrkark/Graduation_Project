import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { HankoSeal, ShotokanTiger } from '../components/ui/JapaneseDecor';
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
      {/* ЕДИНАЯ ВЕРХНЯЯ НАВИГАЦИОННАЯ ПАНЕЛЬ С АРХИТЕКТУРОЙ ДОДЗЁ */}
      <header className="navbar">
        <div className="navbar__top-trim" />
        <div className="container navbar__container">
          {/* Логотип Bunkai Explorer: Тигр Сётокан + Название + Печать Ханко */}
          <Link to="/" className="navbar__brand" title="Bunkai Explorer — Главная Додзё">
            <div className="navbar__logo-icon-wrap">
              <ShotokanTiger size={30} color="var(--gold)" className="navbar__logo-tiger" />
            </div>
            <div className="navbar__logo-text-block">
              <span className="navbar__logo-text">BUNKAI EXPLORER</span>
              <span className="navbar__logo-subtext">松濤館流 · 空手道</span>
            </div>
            <HankoSeal text="分解" size="sm" variant="vermilion" shape="square" className="navbar__logo-seal" />
          </Link>

          {/* Основная навигация по залам Додзё */}
          <nav className="navbar__menu" aria-label="Основное меню">
            <NavLink to="/kata" className={({ isActive }) => `navbar__link ${isActive ? 'active' : ''}`}>
              <span className="navbar__link-title">Ката</span>
              <span className="navbar__link-kanji">型</span>
            </NavLink>
            <NavLink to="/bunkai" className={({ isActive }) => `navbar__link ${isActive ? 'active' : ''}`}>
              <span className="navbar__link-title">Бункай</span>
              <span className="navbar__link-kanji">分解</span>
            </NavLink>
            <NavLink to="/motion-lab" className={({ isActive }) => `navbar__link ${isActive ? 'active' : ''}`}>
              <span className="navbar__link-title">Aimokap</span>
              <span className="navbar__link-kanji">動</span>
            </NavLink>
            <NavLink to="/bunkai/new" className={({ isActive }) => `navbar__link ${isActive ? 'active' : ''}`}>
              <span className="navbar__link-title">Студия</span>
              <span className="navbar__link-kanji">創</span>
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
                  <span className="navbar__user-avatar-mini">
                    {user.Avatar_URL ? (
                      <img src={user.Avatar_URL} alt="" className="navbar__user-img" />
                    ) : (
                      <span>{(user.Display_Name || user.Username)[0].toUpperCase()}</span>
                    )}
                  </span>
                  <span className="navbar__user-name">{user.Display_Name || user.Username}</span>
                  {isStaff && (
                    <span className="navbar__staff-pill">
                      <span className="navbar__staff-kanji">{role === 'admin' ? '師範' : '先輩'}</span>
                      <span>{role === 'admin' ? 'Сэнсэй' : 'Сэмпай'}</span>
                    </span>
                  )}
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
                      <span>Личный профиль</span>
                      <span className="navbar__dropdown-kanji">門下生</span>
                    </Link>
                    <Link to="/chat" className="navbar__dropdown-item">
                      <span>Сообщения Додзё</span>
                      <span className="navbar__dropdown-kanji">通信</span>
                    </Link>
                    <Link to="/friends" className="navbar__dropdown-item">
                      <span>Соратники (Друзья)</span>
                      <span className="navbar__dropdown-kanji">仲間</span>
                    </Link>
                    {isStaff && (
                      <Link to="/admin" className="navbar__dropdown-item navbar__dropdown-item--admin">
                        <span>Панель управления</span>
                        <span className="navbar__dropdown-kanji">管理</span>
                      </Link>
                    )}
                    <div className="navbar__dropdown-divider" />
                    <button type="button" className="navbar__dropdown-item navbar__dropdown-item--logout" onClick={logout}>
                      <span>Выйти из профиля</span>
                      <span className="navbar__dropdown-kanji">退堂</span>
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
        <div className="navbar__bottom-border" />
      </header>

      {/* МОБИЛЬНОЕ ВЫДВИЖНОЕ МЕНЮ */}
      {mobileMenuOpen && (
        <div className="mobile-drawer">
          <div className="container mobile-drawer__inner">
            <nav className="mobile-drawer__nav">
              <NavLink to="/" end className="mobile-drawer__link">
                <span>Главная</span>
                <span className="mobile-drawer__kanji">本道場</span>
              </NavLink>
              <NavLink to="/kata" className="mobile-drawer__link">
                <span>Каталог ката (26 форм)</span>
                <span className="mobile-drawer__kanji">型目録</span>
              </NavLink>
              <NavLink to="/bunkai" className="mobile-drawer__link">
                <span>Разборы бункай</span>
                <span className="mobile-drawer__kanji">分解</span>
              </NavLink>
              <NavLink to="/motion-lab" className="mobile-drawer__link">
                <span>Aimokap (AI Камера)</span>
                <span className="mobile-drawer__kanji">動態</span>
              </NavLink>
              <NavLink to="/bunkai/new" className="mobile-drawer__link">
                <span>Студия бункай</span>
                <span className="mobile-drawer__kanji">鍛錬</span>
              </NavLink>
              {user && (
                <>
                  <div className="mobile-drawer__divider" />
                  <NavLink to="/profile" className="mobile-drawer__link">
                    <span>Мой профиль</span>
                    <span className="mobile-drawer__kanji">門下生</span>
                  </NavLink>
                  <NavLink to="/chat" className="mobile-drawer__link">
                    <span>Сообщения</span>
                    <span className="mobile-drawer__kanji">通信</span>
                  </NavLink>
                  <NavLink to="/friends" className="mobile-drawer__link">
                    <span>Соратники</span>
                    <span className="mobile-drawer__kanji">仲間</span>
                  </NavLink>
                  {isStaff && (
                    <NavLink to="/admin" className="mobile-drawer__link mobile-drawer__link--admin">
                      <span>Панель управления</span>
                      <span className="mobile-drawer__kanji">管理</span>
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
                    Регистрация в Додзё
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

      {/* АРХИТЕКТУРНЫЙ ФУТЕР В СТИЛИСТИКЕ ТРАДИЦИОННОГО ДОДЗЁ ХОНБУ */}
      <footer className="dojo-footer">
        <div className="dojo-footer__beam-top" />
        <div className="container dojo-footer__container">
          <div className="dojo-footer__grid">
            {/* 1. Идентичность и философия школы */}
            <div className="dojo-footer__col dojo-footer__col--brand">
              <div className="dojo-footer__logo">
                <ShotokanTiger size={36} color="var(--gold)" className="dojo-footer__crest" />
                <div className="dojo-footer__logo-titles">
                  <span className="dojo-footer__logo-title">BUNKAI EXPLORER</span>
                  <span className="dojo-footer__logo-kanji">空手道 · 松濤館流 · 分解</span>
                </div>
              </div>
              <p className="dojo-footer__desc">
                Интерактивная среда для глубокого освоения 26 канонических ката Сётокан,
                пространственного анализа траекторий эмбусэн и боевой биомеханики бункай.
              </p>
              <div className="dojo-footer__motto">
                <div className="dojo-footer__motto-header">
                  <span className="dojo-footer__motto-mark">「空手に先手なし」</span>
                  <HankoSeal text="武徳" size="sm" variant="vermilion" shape="square" />
                </div>
                <span className="dojo-footer__motto-trans">В каратэ нет первого нападения (Нидзю Кун)</span>
              </div>
            </div>

            {/* 2. Навигация по залам Додзё */}
            <div className="dojo-footer__col">
              <h4 className="dojo-footer__heading">
                <span>Хранилище форм</span>
                <span className="dojo-footer__heading-kanji">型</span>
              </h4>
              <ul className="dojo-footer__list">
                <li><Link to="/kata">Атлас 26 Ката (型)</Link></li>
                <li><Link to="/bunkai">Боевые сценарии Бункай (分解)</Link></li>
                <li><Link to="/motion-lab">AI Мокап Лаборатория (Aimokap)</Link></li>
                <li><Link to="/bunkai/new">Мастерская симуляции боя</Link></li>
              </ul>
            </div>

            {/* 3. Канон и традиция */}
            <div className="dojo-footer__col">
              <h4 className="dojo-footer__heading">
                <span>Канон Сётокан</span>
                <span className="dojo-footer__heading-kanji">道</span>
              </h4>
              <ul className="dojo-footer__list">
                <li><Link to="/kata/1">Школа Хэйан (Базовые формы)</Link></li>
                <li><Link to="/kata">Мастерские ката (Дан)</Link></li>
                <li><Link to="/bunkai">Контроль дистанции Ма-ай</Link></li>
                <li><Link to="/motion-lab">Анализ биомеханики Кимэ</Link></li>
              </ul>
            </div>

            {/* 4. Личный кабинет практикующего */}
            <div className="dojo-footer__col">
              <h4 className="dojo-footer__heading">
                <span>Путь каратэка</span>
                <span className="dojo-footer__heading-kanji">門</span>
              </h4>
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
              <span className="dojo-footer__seal-label">伝統の継承 · 百錬自得</span>
              <HankoSeal text="武道" size="md" variant="vermilion" shape="square" title="Традиционная печать Будо" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
