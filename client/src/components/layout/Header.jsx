import { Link, NavLink } from 'react-router-dom';
import { useState } from 'react';
import { Menu, X, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './layout.css';

export default function Header() {
  const { user, logout, isModerator } = useAuth();
  const [open, setOpen] = useState(false);

  const links = [
    { to: '/kata', label: 'Каталог ката' },
    { to: '/bunkai', label: 'Бункай' },
  ];

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link to="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-jp">分解</span>
          <span className="brand-name">Bunkai Explorer</span>
        </Link>

        <nav className={`main-nav ${open ? 'is-open' : ''}`}>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className="nav-link" onClick={() => setOpen(false)}>
              {l.label}
            </NavLink>
          ))}

          {user ? (
            <>
              <NavLink to="/profile" className="nav-link" onClick={() => setOpen(false)}>
                {user.username}
              </NavLink>
              {isModerator && (
                <NavLink to="/admin" className="nav-link nav-link-admin" onClick={() => setOpen(false)}>
                  <ShieldCheck size={16} /> Админ-панель
                </NavLink>
              )}
              <button className="btn" onClick={logout}>Выйти</button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="nav-link" onClick={() => setOpen(false)}>Вход</NavLink>
              <NavLink to="/register" className="btn btn-primary" onClick={() => setOpen(false)}>Регистрация</NavLink>
            </>
          )}
        </nav>

        <button className="nav-toggle" onClick={() => setOpen((v) => !v)} aria-label="Меню">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
    </header>
  );
}
