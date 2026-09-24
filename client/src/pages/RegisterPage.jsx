import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
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
        <h1>登録 · Регистрация</h1>
        <p className="auth-sub">
          Создайте аккаунт, чтобы получить доступ к каталогу ката, бункаев, чатам додзё и профилю.
        </p>

        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="username">Имя пользователя</label>
            <input id="username" required value={form.username} onChange={update('username')} placeholder="karateka_2026" />
          </div>
          <div className="field">
            <label htmlFor="displayName">Отображаемое имя (необязательно)</label>
            <input id="displayName" value={form.displayName} onChange={update('displayName')} placeholder="Иван Иванов" />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required value={form.email} onChange={update('email')} placeholder="you@example.com" />
          </div>
          <div className="field">
            <label htmlFor="password">Пароль</label>
            <input id="password" type="password" required minLength={8} value={form.password} onChange={update('password')} placeholder="Минимум 8 символов" />
          </div>

          {error && <p className="error-text">{error}</p>}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Регистрация…' : 'Зарегистрироваться'}
          </button>
        </form>

        <hr className="divider" />
        <p className="auth-alt">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </div>
    </div>
  );
}
