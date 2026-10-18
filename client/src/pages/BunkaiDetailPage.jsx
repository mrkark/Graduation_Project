import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getBunkai, getBunkaiSteps, deleteBunkai, approveBunkai, rejectBunkai } from '../api/bunkai';
import { useAuthStore } from '../store/authStore';
import StatusBadge from '../components/StatusBadge';
import VideoEmbed from '../components/VideoEmbed';
import Comments from '../components/Comments';
import BunkaiMultiAvatarPlayer from '../three/BunkaiMultiAvatarPlayer';
import { HankoSeal, ShotokanTiger } from '../components/ui/JapaneseDecor';
import '../three/avatarWidget.css';
import './BunkaiDetailPage.css';

const DIFFICULTY_LABELS = {
  beginner: 'Базовый уровень',
  intermediate: 'Средний уровень',
  advanced: 'Продвинутый уровень',
  master: 'Мастерский уровень',
};

export default function BunkaiDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuthStore();
  const [bunkai, setBunkai] = useState(null);
  const [bunkaiSteps, setBunkaiSteps] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('application'); // 'application' | 'video' | 'comments'

  useEffect(() => {
    if (!id || id === 'new' || id === 'create' || id === 'studio') {
      navigate('/bunkai/new', { replace: true });
      return;
    }
    setLoading(true);
    Promise.all([
      getBunkai(id),
      getBunkaiSteps(id).catch(() => []),
    ])
      .then(([bunkaiData, stepsData]) => {
        setBunkai(bunkaiData);
        setBunkaiSteps(stepsData);
      })
      .catch((err) => setError(err.response?.data?.error?.message || 'Бункай не найден'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) return <p className="loading">Загрузка боевого разбора…</p>;
  if (error || !bunkai) return <p className="empty-state">{error || 'Бункай не найден'}</p>;

  const isOwner = bunkai.Author_ID === user?.User_ID;
  const isStaff = role === 'admin' || role === 'moderator';
  const canEdit = isOwner || isStaff;

  async function onDelete() {
    if (!confirm('Удалить этот бункай?')) return;
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
    <div className="bunkai-detail container">
      {/* 1. ШАПКА БУНКАЯ */}
      <header className="bunkai-detail__header">
        <div>
          <div className="bunkai-detail__meta">
            <Link to="/bunkai" className="bunkai-detail__back-link">
              ← Каталог бункаев
            </Link>
            <span className="bunkai-detail__sep">/</span>
            {bunkai.Kata && (
              <>
                <Link to={`/kata/${bunkai.Kata_ID}`} className="bunkai-detail__kata-link">
                  Ката: {bunkai.Kata.Title}
                </Link>
                <span className="bunkai-detail__sep">/</span>
              </>
            )}
            <span className="bunkai-detail__difficulty">
              {DIFFICULTY_LABELS[bunkai.Difficulty] || bunkai.Difficulty}
            </span>
            <StatusBadge status={bunkai.Status} />
          </div>

          <div className="bunkai-detail__title-wrap">
            <h1 className="bunkai-detail__title">{bunkai.Title}</h1>
            <HankoSeal text="分解" size="md" variant="vermilion" shape="square" />
          </div>

          <p className="bunkai-detail__author-line">
            Разбор подготовил:{' '}
            <strong>{bunkai.Author?.Display_Name || bunkai.Author?.Username || 'Сенсей Додзё'}</strong>
          </p>
        </div>

        {canEdit && (
          <div className="bunkai-detail__actions">
            <Link to={`/bunkai/${id}/edit`} className="btn btn-subtle">
              Редактировать
            </Link>
            {isStaff && bunkai.Status !== 'approved' && (
              <button type="button" className="btn btn-primary" onClick={onApprove}>
                Одобрить
              </button>
            )}
            {isStaff && bunkai.Status !== 'rejected' && (
              <button type="button" className="btn btn-subtle" onClick={onReject}>
                Отклонить
              </button>
            )}
            <button type="button" className="btn btn-danger" onClick={onDelete}>
              Удалить
            </button>
          </div>
        )}
      </header>

      {/* 2. БОЛЬШАЯ 3D АРЕНА БОЕВОГО ВЗАИМОДЕЙСТВИЯ (ТОРИ И УКЭ) */}
      <section className="bunkai-detail__arena-wrap">
        <div className="bunkai-detail__arena-header">
          <div className="bunkai-detail__arena-badge">
            <ShotokanTiger size={18} color="var(--gold)" />
            <span>БОЕВОЙ СПАРРИНГ · КУМИТЭ БУНКАЙ</span>
          </div>
          <div className="bunkai-detail__arena-roles">
            <span className="bunkai-role-tag bunkai-role-tag--uke">
              <span className="bunkai-role-kanji">受</span> Укэ
            </span>
            <span className="bunkai-unit__role-arrow">⇄</span>
            <span className="bunkai-role-tag bunkai-role-tag--tori">
              <span className="bunkai-role-kanji">取</span> Тори
            </span>
          </div>
        </div>

        <BunkaiMultiAvatarPlayer
          steps={bunkaiSteps}
          defaultParticipantMode={
            bunkaiSteps?.some((s) => s.Participants?.some((p) => p.Role === 'uke2')) ? '3-person' : '2-person'
          }
          height={540}
        />
      </section>

      {/* 3. ПРОГРЕССИВНОЕ РАСКРЫТИЕ СМЫСЛА И ПРИМЕНЕНИЯ */}
      <section className="bunkai-detail__content">
        <div className="tabs">
          <button
            type="button"
            className={activeTab === 'application' ? 'active' : ''}
            onClick={() => setActiveTab('application')}
          >
            Тактический разбор (Оё-бункай)
          </button>
          {bunkai.Video_URL && (
            <button
              type="button"
              className={activeTab === 'video' ? 'active' : ''}
              onClick={() => setActiveTab('video')}
            >
              Видео демонстрации
            </button>
          )}
          <button
            type="button"
            className={activeTab === 'comments' ? 'active' : ''}
            onClick={() => setActiveTab('comments')}
          >
            Обсуждение
          </button>
        </div>

        <div className="bunkai-detail__tab-panel">
          {activeTab === 'application' && (
            <div className="bunkai-notes">
              {bunkai.Description && (
                <div className="bunkai-notes__block">
                  <h3>Общая концепция</h3>
                  <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{bunkai.Description}</p>
                </div>
              )}

              {bunkai.Application && (
                <div className="bunkai-notes__block">
                  <h3>Применение в реальном поединке</h3>
                  <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{bunkai.Application}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'video' && bunkai.Video_URL && (
            <div className="bunkai-video-box">
              <VideoEmbed url={bunkai.Video_URL} />
            </div>
          )}

          {activeTab === 'comments' && (
            <div>
              <Comments bunkaiId={Number(id)} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
