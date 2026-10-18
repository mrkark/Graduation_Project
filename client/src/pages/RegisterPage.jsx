import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { HankoSeal, ShotokanTiger } from '../components/ui/JapaneseDecor';
import './AuthPages.css';

export default function RegisterPage() {
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '', displayName: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(form);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Не удалось зарегистрироваться');
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
            <h1>Регистрация в Додзё</h1>
            <HankoSeal text="登録" size="md" variant="gold" shape="square" />
          </div>
          <p className="auth-sub">
            Создайте свиток каратека, чтобы изучать формы ката, проектировать боевые сценарии и повышать свой ранг.
          </p>
        </div>

        <form onSubmit={onSubmit} className="auth-form">
          <div className="field">
            <label htmlFor="username">Имя пользователя (Логин)</label>
            <input id="username" required value={form.username} onChange={update('username')} placeholder="karateka_2026" />
          </div>
          <div className="field">
            <label htmlFor="displayName">Отображаемое имя ученика (необязательно)</label>
            <input id="displayName" value={form.displayName} onChange={update('displayName')} placeholder="Иван Иванов" />
          </div>
          <div className="field">
            <label htmlFor="email">Email адрес</label>
            <input id="email" type="email" required value={form.email} onChange={update('email')} placeholder="you@example.com" />
          </div>
          <div className="field">
            <label htmlFor="password">Пароль</label>
            <input id="password" type="password" required minLength={8} value={form.password} onChange={update('password')} placeholder="Минимум 8 символов" />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button className="btn btn-primary auth-submit-btn" type="submit" disabled={loading}>
            {loading ? 'Внесение в реестр…' : 'Вступить в Додзё →'}
          </button>
        </form>

        <p className="auth-alt">
          Уже есть учетная запись? <Link to="/login">Войти в зал</Link>
        </p>
      </div>
    </div>
  );
}
