import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { listFriendRequests } from '../api/friends';
import { listNotifications, markNotificationRead } from '../api/notifications';
import { useChatSocket } from '../hooks/useChatSocket';
import { HankoSeal, ShotokanTiger } from '../components/ui/JapaneseDecor';
import './MainLayout.css';

export default function MainLayout() {
  const { user, role, logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [incomingRequestsCount, setIncomingRequestsCount] = useState(0);
  const [toast, setToast] = useState(null);
  const dropdownRef = useRef(null);
  const notificationsRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { socket } = useChatSocket();

  // Первичная подгрузка заявок в соратники и оффлайн/персистентных уведомлений (Задачи 6, 7, 39)
  useEffect(() => {
    if (!user) return;
    listFriendRequests('incoming')
      .then((reqs) => {
        if (Array.isArray(reqs)) {
          setIncomingRequestsCount(reqs.length);
        }
      })
      .catch(() => {});

    listNotifications(30)
      .then((data) => {
        if (data && Array.isArray(data.items)) {
          const loaded = data.items.map((item) => ({
            id: item.Notification_ID,
            type: item.Type,
            title: item.Title,
            message: item.Message,
            targetUrl: item.Target_URL,
            isRead: item.Is_Read,
            time: item.Created_At ? new Date(item.Created_At).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          }));
          setNotifications(loaded);
        }
      })
      .catch(() => {});
  }, [user]);

  // Закрывать мобильное меню и выпадающие списки при смене роута
  useEffect(() => {
    setMobileMenuOpen(false);
    setUserDropdownOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  // Закрывать выпадающие списки при клике вне их
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setUserDropdownOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target)) {
        setNotificationsOpen(false);
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

  // Автозакрытие всплывающего уведомления через 6 секунд (Задача 44)
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Клик по уведомлению: переброс на нужную страницу (чат, прием в друзья, бункай, додзё) + отметка о прочтении (Задачи 6, 7)
  const handleNotificationClick = (n) => {
    setNotificationsOpen(false);
    if (n.id && !n.isRead) {
      markNotificationRead(n.id).catch(() => {});
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item))
      );
    }
    const target = n.targetUrl || (n.type === 'message' ? '/chat' : n.type === 'dojo_invite' ? '/dojos' : '/friends?tab=incoming');
    navigate(target);
  };

  const handleClearNotifications = () => {
    markNotificationRead(null).catch(() => {});
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    setIncomingRequestsCount(0);
  };

  // Обработка real-time уведомлений через сокет (Задачи 6, 7, 39, 44)
  useEffect(() => {
    if (!socket?.current || !user) return;
    const s = socket.current;

    function handleNotification(notif) {
      if (notif.type === 'friend_request') {
        setIncomingRequestsCount((prev) => prev + 1);
      }
      const notifItem = {
        id: notif.id || Date.now() + Math.random(),
        type: notif.type || 'friend_request',
        title: notif.title || 'Уведомление Додзё',
        message: notif.message || 'Новое событие',
        targetUrl: notif.targetUrl || (notif.type === 'dojo_invite' ? '/dojos' : notif.type === 'bunkai_new' ? notif.targetUrl : '/friends?tab=incoming'),
        isRead: false,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setNotifications((prev) => [notifItem, ...prev.slice(0, 29)]);

      const icon = notif.type === 'dojo_invite' ? '⛩️' : notif.type === 'bunkai_new' ? '🥋' : '🤝';
      setToast({
        id: notifItem.id,
        icon,
        title: notifItem.title,
        message: notifItem.message,
        actionText: 'Перейти к событию →',
        onClick: () => {
          handleNotificationClick(notifItem);
          setToast(null);
        },
      });
    }

    function handleChatNotification(notif) {
      if (notif.authorId === user.User_ID) return;
      const notifItem = {
        id: notif.id || Date.now() + Math.random(),
        type: 'message',
        title: `Сообщение от ${notif.authorName || 'соратника'}`,
        message: notif.snippet || 'Новое сообщение',
        roomId: notif.roomId,
        targetUrl: notif.targetUrl || '/chat',
        isRead: false,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setNotifications((prev) => [notifItem, ...prev.slice(0, 29)]);

      // Если пользователь не в данном чате, показать всплывающий интерактивный тост
      if (location.pathname !== '/chat') {
        setToast({
          id: notifItem.id,
          icon: '💬',
          title: `Сообщение от ${notif.authorName || 'соратника'}`,
          message: notif.snippet || 'Новое сообщение в чате',
          actionText: 'Открыть беседу →',
          onClick: () => {
            handleNotificationClick(notifItem);
            setToast(null);
          },
        });
      }
    }

    s.on('notification', handleNotification);
    s.on('chat:notification', handleChatNotification);

    return () => {
      s.off('notification', handleNotification);
      s.off('chat:notification', handleChatNotification);
    };
  }, [socket, user, location.pathname, navigate]);

  const isStaff = role === 'admin' || role === 'moderator';
  const unreadNotificationsCount = notifications.filter((n) => !n.isRead).length;
  const totalUnreadCount = incomingRequestsCount + unreadNotificationsCount;

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

          {/* Основная навигация по залам Додзё (Задача 42: убраны лишние иероглифы) */}
          <nav className="navbar__menu" aria-label="Основное меню">
            <NavLink to="/kata" className={({ isActive }) => `navbar__link ${isActive ? 'active' : ''}`}>
              <span className="navbar__link-title">Ката</span>
            </NavLink>
            <NavLink to="/bunkai" className={({ isActive }) => `navbar__link ${isActive ? 'active' : ''}`}>
              <span className="navbar__link-title">Бункай</span>
            </NavLink>
            <NavLink to="/karate-studio" className={({ isActive }) => `navbar__link ${isActive ? 'active' : ''}`}>
              <span className="navbar__link-title">Мокап 3D</span>
            </NavLink>
            <NavLink to="/dojos" className={({ isActive }) => `navbar__link ${isActive ? 'active' : ''}`}>
              <span className="navbar__link-title">Додзё</span>
            </NavLink>
            <NavLink to="/bunkai/new" className={({ isActive }) => `navbar__link ${isActive ? 'active' : ''}`}>
              <span className="navbar__link-title">Студия</span>
            </NavLink>
            {/* Задача 41: Удобный прямой переход в чаты */}
            <NavLink to="/chat" className={({ isActive }) => `navbar__link ${isActive ? 'active' : ''}`}>
              <span className="navbar__link-title">Чат</span>
            </NavLink>
          </nav>

          {/* Действия пользователя справа */}
          <div className="navbar__actions">
            {user ? (
              <>
                {/* Задача 41: быстрый переход в чаты в блоке действий */}
                <Link
                  to="/chat"
                  className="navbar__chat-quick-btn"
                  title="Перейти в сообщения Додзё"
                  aria-label="Сообщения Додзё"
                >
                  <span className="navbar__chat-quick-icon">💬</span>
                </Link>

                {/* Задача 39: Иконка уведомлений у иконки профиля */}
                <div className="navbar__notifications-wrap" ref={notificationsRef}>
                  <button
                    type="button"
                    className={`navbar__bell-btn ${totalUnreadCount > 0 ? 'has-unread' : ''}`}
                    onClick={() => setNotificationsOpen(!notificationsOpen)}
                    aria-expanded={notificationsOpen}
                    aria-label="Уведомления"
                    title="Уведомления Додзё"
                  >
                    <svg className="navbar__bell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                    {totalUnreadCount > 0 && (
                      <span className="navbar__bell-badge">
                        {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                      </span>
                    )}
                  </button>

                  {notificationsOpen && (
                    <div className="navbar__notifications-dropdown">
                      <div className="navbar__notifications-header">
                        <span className="navbar__notifications-title">🔔 Уведомления</span>
                        {totalUnreadCount > 0 && (
                          <button
                            type="button"
                            className="navbar__notifications-clear"
                            onClick={handleClearNotifications}
                          >
                            Сбросить
                          </button>
                        )}
                      </div>

                      <div className="navbar__notifications-list">
                        {incomingRequestsCount > 0 && (
                          <div
                            className="navbar__notification-item navbar__notification-item--highlight"
                            onClick={() => {
                              setNotificationsOpen(false);
                              navigate('/friends?tab=incoming');
                            }}
                          >
                            <span className="navbar__notification-item-icon">🤝</span>
                            <div className="navbar__notification-body">
                              <div className="navbar__notification-item-title">Заявки в соратники</div>
                              <div className="navbar__notification-item-text">
                                Ожидают вашего ответа: {incomingRequestsCount}
                              </div>
                            </div>
                          </div>
                        )}

                        {notifications.map((n) => (
                          <div
                            key={n.id}
                            className={`navbar__notification-item ${!n.isRead ? 'navbar__notification-item--unread' : ''}`}
                            onClick={() => handleNotificationClick(n)}
                          >
                            <span className="navbar__notification-item-icon">
                              {n.type === 'message' ? '💬' : n.type === 'dojo_invite' ? '⛩️' : n.type === 'bunkai_new' ? '🥋' : '🤝'}
                            </span>
                            <div className="navbar__notification-body">
                              <div className="navbar__notification-item-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>{n.title}</span>
                                {!n.isRead && <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--vermilion, #e53935)' }} />}
                              </div>
                              <div className="navbar__notification-item-text">{n.message}</div>
                              {n.time && <div className="navbar__notification-item-time">{n.time}</div>}
                            </div>
                          </div>
                        ))}

                        {notifications.length === 0 && incomingRequestsCount === 0 && (
                          <div className="navbar__notifications-empty">
                            <span style={{ fontSize: '1.4rem' }}>📭</span>
                            <div>Новых уведомлений нет</div>
                          </div>
                        )}
                      </div>

                      <div className="navbar__notifications-footer">
                        <Link to="/friends?tab=incoming" onClick={() => setNotificationsOpen(false)}>
                          Заявки в друзья
                        </Link>
                        <Link to="/chat" onClick={() => setNotificationsOpen(false)}>
                          Все беседы
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                {/* Выпадающее меню профиля */}
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
                      </Link>
                      <Link to="/chat" className="navbar__dropdown-item">
                        <span>Сообщения Додзё</span>
                      </Link>
                      <Link to="/friends" className="navbar__dropdown-item">
                        <span>Соратники (Друзья)</span>
                      </Link>
                      <Link to="/dojos" className="navbar__dropdown-item">
                        <span>Мои Додзё (Школы)</span>
                      </Link>
                      {isStaff && (
                        <Link to="/admin" className="navbar__dropdown-item navbar__dropdown-item--admin">
                          <span>Панель управления</span>
                        </Link>
                      )}
                      <div className="navbar__dropdown-divider" />
                      <button type="button" className="navbar__dropdown-item navbar__dropdown-item--logout" onClick={logout}>
                        <span>Выйти из профиля</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
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

      {/* МОБИЛЬНОЕ ВЫДВИЖНОЕ МЕНЮ (Задача 42: убраны лишние иероглифы) */}
      {mobileMenuOpen && (
        <div className="mobile-drawer">
          <div className="container mobile-drawer__inner">
            <nav className="mobile-drawer__nav">
              <NavLink to="/" end className="mobile-drawer__link">
                <span>Главная</span>
              </NavLink>
              <NavLink to="/kata" className="mobile-drawer__link">
                <span>Каталог ката (26 форм)</span>
              </NavLink>
              <NavLink to="/bunkai" className="mobile-drawer__link">
                <span>Разборы бункай</span>
              </NavLink>
              <NavLink to="/karate-studio" className="mobile-drawer__link">
                <span>Мокап 3D (Каратэ Студия)</span>
              </NavLink>
              <NavLink to="/bunkai/new" className="mobile-drawer__link">
                <span>Студия бункай</span>
              </NavLink>
              {user && (
                <>
                  <div className="mobile-drawer__divider" />
                  <NavLink to="/profile" className="mobile-drawer__link">
                    <span>Мой профиль</span>
                  </NavLink>
                  <NavLink to="/chat" className="mobile-drawer__link">
                    <span>Сообщения</span>
                  </NavLink>
                  <NavLink to="/friends" className="mobile-drawer__link">
                    <span>Соратники</span>
                  </NavLink>
                  <NavLink to="/dojos" className="mobile-drawer__link">
                    <span>Додзё</span>
                  </NavLink>
                  {isStaff && (
                    <NavLink to="/admin" className="mobile-drawer__link mobile-drawer__link--admin">
                      <span>Панель управления</span>
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

      {/* Задача 44: Интерактивный всплывающий тост для сообщений и заявок в соратники */}
      {toast && (
        <div className="dojo-toast-container" role="alert" aria-live="polite">
          <div className="dojo-toast" onClick={toast.onClick}>
            <span className="dojo-toast__icon">{toast.icon}</span>
            <div className="dojo-toast__content">
              <div className="dojo-toast__title">{toast.title}</div>
              <div className="dojo-toast__message">{toast.message}</div>
              <div className="dojo-toast__action">{toast.actionText}</div>
            </div>
            <button
              type="button"
              className="dojo-toast__close"
              onClick={(e) => {
                e.stopPropagation();
                setToast(null);
              }}
              aria-label="Закрыть уведомление"
            >
              ✕
            </button>
          </div>
        </div>
      )}

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
                <li><Link to="/karate-studio">Мокап 3D (Каратэ Студия)</Link></li>
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
                <li><Link to="/karate-studio">Анализ биомеханики Кимэ</Link></li>
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
                    <li><Link to="/dojos">Залы Додзё</Link></li>
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
