import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', username: '', password: '' });
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await register(form);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Не удалось зарегистрироваться');
    }
  }

  return (
    <div className="auth-page">
      <p className="hanko">登録</p>
      <h1 style={{ marginTop: 10 }}>Регистрация</h1>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Имя пользователя
          <input required minLength={3} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </label>
        <label>
          Email
          <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label>
          Пароль
          <input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        {error && <p className="auth-error">{error}</p>}
        <button type="submit" className="btn btn-primary">Создать аккаунт</button>
      </form>
      <p className="auth-switch">Уже есть аккаунт? <Link to="/login">Войти</Link></p>
    </div>
  );
}
