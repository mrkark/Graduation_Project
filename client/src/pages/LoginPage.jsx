import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { HankoSeal, ShotokanTiger } from '../components/ui/JapaneseDecor';
import './AuthPages.css';

export default function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Задача 36: поля должны быть пустыми при входе пока пользователь не начнет вводить текст
  useEffect(() => {
    setForm({ username: '', password: '' });
  }, []);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(form);
      const redirectTo = location.state?.from?.pathname || '/';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Не удалось войти');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card panel">
        <div className="auth-card__header">
          <div className="auth-card__crest">
            <ShotokanTiger size={40} color="var(--gold)" />
          </div>
          <div className="auth-card__title-row">
            <h1>Вход в Додзё</h1>
            <HankoSeal text="入門" size="md" variant="vermilion" shape="square" />
          </div>
          <p className="auth-sub">
            Войдите, чтобы продолжить изучение ката, анализировать бункай и тренироваться вместе с додзё.
          </p>
        </div>

        <form onSubmit={onSubmit} className="auth-form" autoComplete="off">
          <div className="field">
            <label htmlFor="username">Имя пользователя / Каратека</label>
            <input
              id="username"
              required
              value={form.username}
              onChange={update('username')}
              autoComplete="off"
              placeholder="Введите имя пользователя"
            />
          </div>
          <div className="field">
            <label htmlFor="password">Секретный пароль</label>
            <input
              id="password"
              type="password"
              required
              value={form.password}
              onChange={update('password')}
              autoComplete="new-password"
              placeholder="Введите пароль"
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button className="btn btn-primary auth-submit-btn" type="submit" disabled={loading}>
            {loading ? 'Вход…' : 'Войти в зал →'}
          </button>
        </form>

        <p className="auth-alt">
          Ещё нет аккаунта ученика? <Link to="/register">Зарегистрироваться</Link>
        </p>
      </div>
    </div>
  );
}
