import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { deleteAccount } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import './ProfilePage.css';

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

  const roleLabels = {
    admin: { label: 'Сенсей (Администратор Додзё)', kanji: '先生', belt: 'Черный пояс (5 Дан)', rankClass: 'rank-badge--black' },
    moderator: { label: 'Сэмпай (Модератор Додзё)', kanji: '先輩', belt: 'Коричневый пояс (1 Дан)', rankClass: 'rank-badge--brown' },
    user: { label: 'Каратэка (Ученик Додзё)', kanji: '空手家', belt: 'Практикующий Сётокан', rankClass: 'rank-badge--student' },
  };
  const roleInfo = roleLabels[role] || roleLabels.user;

  const currentAvatar = form.avatarUrl || user?.Avatar_URL;

  return (
    <div className="container profile-page">
      <div className="page-header">
        <div>
          <span className="profile-kicker">道場門下生 · СТАТУС В ДОДЗЁ</span>
          <h1>Профиль каратэка</h1>
          <p className="page-subtitle">Личные данные ученика, степень мастерства и управление аккаунтом</p>
        </div>
      </div>

      {/* Карточка статуса ученика (Dojo Pass) */}
      <div className="profile-card">
        <div className="profile-avatar-wrap">
          {currentAvatar ? (
            <img src={currentAvatar} alt={user?.Display_Name || 'Аватар'} className="profile-avatar-img" />
          ) : (
            <span>{(user?.Display_Name || user?.Username || 'K')[0].toUpperCase()}</span>
          )}
        </div>
        <div className="profile-info">
          <div className="profile-name-row">
            <h2 className="profile-name">{user?.Display_Name || user?.Username}</h2>
            <span className={`rank-badge ${roleInfo.rankClass}`}>
              <span>{roleInfo.kanji}</span>
              <span>{roleInfo.belt}</span>
            </span>
          </div>
          <p className="profile-meta">
            <span>Логин: <strong>{user?.Username}</strong></span>
            <span className="profile-meta-sep">·</span>
            <span>Статус: {roleInfo.label}</span>
          </p>
        </div>
      </div>

      {/* Форма редактирования профиля */}
      <div className="profile-form-panel">
        <h3>Личные сведения ученика</h3>
        <form onSubmit={onSave}>
          <div className="field">
            <label>Отображаемое имя (Имя в Додзё)</label>
            <input value={form.displayName} onChange={update('displayName')} placeholder="Например: Мастер Гитин" />
          </div>
          <div className="field">
            <label>О себе (Опыт, клуб, направление)</label>
            <textarea rows={4} value={form.bio} onChange={update('bio')} placeholder="Расскажите о своем опыте занятий каратэ..." />
          </div>
          <div className="field">
            <label>Ссылка на аватар (URL изображения)</label>
            <input value={form.avatarUrl} onChange={update('avatarUrl')} placeholder="https://..." />
          </div>
          {message && <p style={{ color: 'var(--success)', fontSize: '0.88rem', margin: '0.8rem 0' }}>✓ {message}</p>}
          {error && <p className="error-text" style={{ margin: '0.8rem 0' }}>{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Сохранение…' : 'Сохранить изменения'}
          </button>
        </form>
      </div>

      {/* Опасная зона */}
      <div className="profile-danger-panel">
        <h3 className="profile-danger-title">Опасная зона</h3>
        <p className="profile-danger-desc">
          Удаление аккаунта необратимо. Все созданные вами материалы останутся в архиве Додзё с пометкой удалённого автора.
        </p>
        <form onSubmit={onDelete}>
          <div className="field">
            <label style={{ color: '#ef4444' }}>Подтвердите удаление паролем</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Текущий пароль" />
          </div>
          {deleteError && <p className="error-text" style={{ margin: '0.8rem 0' }}>{deleteError}</p>}
          <button className="btn btn-danger" type="submit" disabled={deleting}>
            {deleting ? 'Удаление аккаунта…' : 'Удалить аккаунт навсегда'}
          </button>
        </form>
      </div>
    </div>
  );
}
