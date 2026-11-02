import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Loader2, Trash2, Check } from 'lucide-react';
import api from '../api/client';
import { deleteAccount, uploadAvatar } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { HankoSeal, ShotokanTiger } from '../components/ui/JapaneseDecor';
import './ProfilePage.css';

export default function ProfilePage() {
  const { user, role, setUser, logout } = useAuthStore();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    displayName: user?.Display_Name || '',
    bio: user?.Bio || '',
    avatarUrl: user?.Avatar_URL || '',
  });
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function onAvatarFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Пожалуйста, выберите файл изображения (PNG, JPEG, WebP, GIF)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Размер изображения не должен превышать 5 МБ');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
    setUploadingAvatar(true);
    setError(null);
    setMessage(null);

    try {
      const res = await uploadAvatar(file);
      const newUrl = res.avatarUrl || res.user?.Avatar_URL;
      setForm((f) => ({ ...f, avatarUrl: newUrl }));
      if (res.user) {
        setUser(res.user);
      }
      setMessage('Аватар успешно загружен с устройства и сохранён');
    } catch (err) {
      setAvatarPreview(null);
      setError(err.response?.data?.error?.message || err.message || 'Ошибка загрузки изображения');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
    user: { label: 'Каратэка (Ученик Додзё)', kanji: '空手家', belt: 'Практикующий Шотокан', rankClass: 'rank-badge--student' },
  };
  const roleInfo = roleLabels[role] || roleLabels.user;

  const currentAvatar = avatarPreview || form.avatarUrl || user?.Avatar_URL;

  return (
    <div className="container profile-page">
      <div className="page-header">
        <div>
          <span className="profile-kicker">道場門下生 · СТАТУС В ДОДЗЁ</span>
          <h1>Профиль каратэка</h1>
          <p className="page-subtitle">Личные данные ученика, степень мастерства и управление аккаунтом</p>
        </div>
      </div>

      {/* Карточка статуса ученика (Dojo Pass / Menjo) */}
      <div className="profile-card">
        <div className="profile-avatar-container">
          <div
            className="profile-avatar-wrap profile-avatar-wrap--clickable"
            onClick={() => fileInputRef.current?.click()}
            title="Нажмите, чтобы загрузить аватар с устройства"
          >
            {currentAvatar ? (
              <img src={currentAvatar} alt={user?.Display_Name || 'Аватар'} className="profile-avatar-img" />
            ) : (
              <span>{(user?.Display_Name || user?.Username || 'K')[0].toUpperCase()}</span>
            )}
            <div className="profile-avatar-hover-overlay">
              <Camera size={22} className="profile-avatar-hover-icon" />
            </div>
          </div>
          <button
            type="button"
            className="profile-avatar-corner-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Загрузить фото с устройства"
            aria-label="Загрузить фото с устройства"
          >
            <Camera size={13} className="profile-avatar-corner-icon" />
          </button>
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

        {/* Декоративная печать ханко */}
        <div className="profile-seal-wrap">
          <HankoSeal text="道場" size={54} color="#bfa15f" style={{ opacity: 0.85 }} />
        </div>
      </div>

      {/* Скрытый input для выбора файла аватара */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={onAvatarFileChange}
        accept="image/png,image/jpeg,image/webp,image/gif"
        style={{ display: 'none' }}
      />

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
            <textarea
              rows={4}
              value={form.bio}
              onChange={update('bio')}
              placeholder="Расскажите о своем опыте занятий каратэ..."
              style={{ resize: 'none' }}
            />
          </div>
          <div className="field">
            <label>Аватар профиля</label>
            <div className="profile-avatar-actions">
              <button
                type="button"
                className="btn btn-secondary profile-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? (
                  <>
                    <Loader2 size={16} className="profile-upload-icon profile-upload-icon--spin" />
                    <span>Загрузка…</span>
                  </>
                ) : (
                  <>
                    <Camera size={16} className="profile-upload-icon" />
                    <span>Загрузить фото с устройства</span>
                  </>
                )}
              </button>
              {currentAvatar && (
                <button
                  type="button"
                  className="btn btn-subtle profile-remove-avatar-btn"
                  onClick={() => {
                    setAvatarPreview(null);
                    setForm((f) => ({ ...f, avatarUrl: '' }));
                  }}
                  title="Очистить аватар"
                >
                  <Trash2 size={14} className="profile-remove-icon" />
                  <span>Удалить фото</span>
                </button>
              )}
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <span className="profile-avatar-subtext">или укажите прямую ссылку на изображение (URL):</span>
              <input
                value={form.avatarUrl}
                onChange={(e) => {
                  setAvatarPreview(null);
                  update('avatarUrl')(e);
                }}
                placeholder="https://..."
                style={{ marginTop: '0.35rem' }}
              />
            </div>
          </div>
          {message && <p style={{ color: 'var(--success)', fontSize: '0.88rem', margin: '0.8rem 0', display: 'flex', alignItems: 'center', gap: '5px' }}><Check size={14} /> {message}</p>}
          {error && <p className="error-text" style={{ margin: '0.8rem 0' }}>{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={saving || uploadingAvatar}>
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
