import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getBunkai, deleteBunkai, approveBunkai, rejectBunkai } from '../api/bunkai';
import { useAuthStore } from '../store/authStore';
import StatusBadge from '../components/StatusBadge';
import VideoEmbed from '../components/VideoEmbed';
import Comments from '../components/Comments';
import BunkaiDuelScene from '../three/BunkaiDuelScene';
import '../three/avatarWidget.css';

const DIFFICULTY_LABELS = { beginner: 'Начальный', intermediate: 'Средний', advanced: 'Продвинутый', master: 'Мастер' };

export default function BunkaiDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuthStore();
  const [bunkai, setBunkai] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    getBunkai(id)
      .then(setBunkai)
      .catch((err) => setError(err.response?.data?.error?.message || 'Бункай не найден'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="loading">Загрузка…</p>;
  if (error || !bunkai) return <p className="empty-state">{error}</p>;

  const isOwner = bunkai.Author_ID === user?.User_ID;
  const isStaff = role === 'admin';
  const canEdit = isOwner || isStaff;

  async function onDelete() {
    if (!confirm('Удалить этот бункай без возможности восстановления?')) return;
    await deleteBunkai(id);
    navigate('/bunkai');
  }
  async function onApprove() {
    setBunkai(await approveBunkai(id));
  }
  async function onReject() {
    setBunkai(await rejectBunkai(id));
  }

  return (
    <div>
      <div className="detail-header">
        <div>
          <div className="card__meta" style={{ marginBottom: '0.4rem' }}>
            <StatusBadge status={bunkai.Status} />
            <span>{DIFFICULTY_LABELS[bunkai.Difficulty] || bunkai.Difficulty}</span>
          </div>
          <h1>{bunkai.Title}</h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Ката: <Link to={`/kata/${bunkai.Kata_ID}`}>{bunkai.Kata?.Title}</Link> · Автор:{' '}
            {bunkai.Author?.Display_Name || bunkai.Author?.Username}
          </p>
        </div>
        <div className="detail-actions">
          {canEdit && (
            <Link to={`/bunkai/${id}/edit`} className="btn btn-gold">
              Редактировать
            </Link>
          )}
          {canEdit && (
            <button className="btn btn-danger" onClick={onDelete}>
              Удалить
            </button>
          )}
          {isStaff && bunkai.Status !== 'approved' && (
            <button className="btn btn-primary" onClick={onApprove}>
              Одобрить
            </button>
          )}
          {isStaff && bunkai.Status !== 'rejected' && (
            <button className="btn" onClick={onReject}>
              Отклонить
            </button>
          )}
        </div>
      </div>

      {/* Интерактивная 3D арена боевого разбора (Бункай: Тори и Укэ) */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🥋</span>
          <span>3D-Симуляция боевого применения (Тори & Укэ)</span>
        </h3>
        <BunkaiDuelScene height={460} />
      </div>

      <div className="detail-grid">
        <div>
          {bunkai.Video_URL && <VideoEmbed url={bunkai.Video_URL} />}

          <div className="panel" style={{ marginTop: '1.2rem' }}>
            <h3>Описание техники</h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{bunkai.Description || 'Описание пока не добавлено.'}</p>
          </div>

          {bunkai.Application && (
            <div className="panel" style={{ marginTop: '1.2rem' }}>
              <h3>Применение в реальном поединке (Оё-бункай)</h3>
              <p style={{ whiteSpace: 'pre-wrap' }}>{bunkai.Application}</p>
            </div>
          )}

          <Comments bunkaiId={Number(id)} />
        </div>

        <aside>
          <div className="panel">
            <h4 style={{ marginBottom: '0.6rem' }}>Связанное ката</h4>
            <p style={{ fontSize: '0.9rem', marginBottom: '0.8rem' }}>
              Этот бункай является разбором движений канона:
            </p>
            <Link to={`/kata/${bunkai.Kata_ID}`} className="btn btn-primary" style={{ width: '100%', textAlign: 'center' }}>
              Смотреть ката
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
