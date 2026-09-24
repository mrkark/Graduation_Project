import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { deleteAccount } from '../api/auth';
import { useAuthStore } from '../store/authStore';

export default function ProfilePage() {
  const { user, role, setUser, logout } = useAuthStore();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    displayName: user?.Display_Name || '',
    bio: user?.Bio || '',
    avatarUrl: user?.Avatar_URL || '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function onSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const { data } = await api.put('/auth/me', {
        displayName: form.displayName,
        bio: form.bio,
        avatarUrl: form.avatarUrl,
      });
      setUser(data.data.user);
      setMessage('Профиль обновлён');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Не удалось сохранить профиль');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(e) {
    e.preventDefault();
    if (!confirm('Аккаунт будет удалён без возможности восстановления. Продолжить?')) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount(password);
      await logout();
      navigate('/register', { replace: true });
    } catch (err) {
      setDeleteError(err.response?.data?.error?.message || 'Не удалось удалить аккаунт');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h1>Профиль</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        {user?.Username} · роль: {role}
      </p>

      <form onSubmit={onSave} className="panel" style={{ marginBottom: '1.5rem' }}>
        <div className="field">
          <label>Отображаемое имя</label>
          <input value={form.displayName} onChange={update('displayName')} />
        </div>
        <div className="field">
          <label>О себе</label>
          <textarea rows={4} value={form.bio} onChange={update('bio')} />
        </div>
        <div className="field">
          <label>Ссылка на аватар</label>
          <input value={form.avatarUrl} onChange={update('avatarUrl')} placeholder="https://…" />
        </div>
        {message && <p style={{ color: 'var(--success)', fontSize: '0.85rem' }}>{message}</p>}
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
      </form>

      <div className="panel" style={{ borderColor: 'var(--danger)' }}>
        <h3 style={{ color: 'var(--danger)' }}>Опасная зона</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Удаление аккаунта необратимо. Все ваши материалы останутся отмечены как принадлежащие удалённому пользователю.
        </p>
        <form onSubmit={onDelete}>
          <div className="field">
            <label>Подтвердите паролем</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {deleteError && <p className="error-text">{deleteError}</p>}
          <button className="btn btn-danger" type="submit" disabled={deleting}>
            {deleting ? 'Удаление…' : 'Удалить аккаунт'}
          </button>
        </form>
      </div>
    </div>
  );
}
