import { useEffect, useState, lazy, Suspense } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getBunkai, getBunkaiSteps, deleteBunkai, approveBunkai, rejectBunkai } from '../api/bunkai';
import { useAuthStore } from '../store/authStore';
import { useFavoritesStore } from '../store/favoritesStore';
import StatusBadge from '../components/StatusBadge';
import VideoEmbed from '../components/VideoEmbed';
import Comments from '../components/Comments';
import { HankoSeal, ShotokanTiger } from '../components/ui/JapaneseDecor';
import '../three/avatarWidget.css';
import { Heart, MessageSquare, Swords, Shield, Ruler, CheckCircle2 } from 'lucide-react';
import { HEIAN_SHODAN_BUNKAI_18_STEPS } from '../three/bunkaiScenarioEngine';
import './BunkaiDetailPage.css';

// Динамическая отложенная загрузка тяжелого 3D плеера (оптимизация загрузки страниц)
const BunkaiMultiAvatarPlayer = lazy(() => import('../three/BunkaiMultiAvatarPlayer'));

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

  const { isBunkaiFavorite, toggle: toggleFavorite, fetchFavorites, loaded: favsLoaded } = useFavoritesStore();

  useEffect(() => {
    if (!favsLoaded) fetchFavorites();
  }, [favsLoaded, fetchFavorites]);

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

  // Канонический 18-шаговый сценарий Хэйан Шодан с боевыми дистанциями, траекториями и предотвращением проникновения
  const effectiveSteps = (Array.isArray(bunkaiSteps) && bunkaiSteps.length >= 18 && bunkaiSteps[0]?.toriTrajectory)
    ? bunkaiSteps
    : HEIAN_SHODAN_BUNKAI_18_STEPS;

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
            <button
              type="button"
              className={`btn ${isBunkaiFavorite(id) ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => toggleFavorite('bunkai', id)}
              style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
            >
              {isBunkaiFavorite(id) ? <><Heart size={15} fill='#ef4444' color='#ef4444' style={{ marginRight: '6px' }} /> В избранном</> : <><Heart size={15} color='#f3f4f6' strokeWidth={2} style={{ marginRight: '6px' }} /> В избранное</>}
            </button>
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

      {/* 2. БОЛЬШАЯ 3D АРЕНА БОЕВОГО СПАРРИНГА ТОРИ И УКЭ */}
      <section className="bunkai-detail__arena-wrap">
        <div className="bunkai-detail__arena-header">
          <div className="bunkai-detail__arena-badge">
            <ShotokanTiger size={18} color="var(--gold)" />
            <span>БОЕВОЙ СПАРРИНГ · КУМИТЭ БУНКАЙ 3D</span>
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

        <Suspense
          fallback={
            <div
              style={{
                height: 540,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#060709',
                color: 'var(--gold, #d4a24c)',
              }}
            >
              <ShotokanTiger size={36} color="var(--gold, #d4a24c)" />
              <p style={{ marginTop: '0.8rem', fontSize: '0.9rem', color: 'var(--text-muted, #a8a29e)' }}>
                Инициализация 3D моделей Тори и Укэ…
              </p>
            </div>
          }
        >
          <BunkaiMultiAvatarPlayer
            steps={effectiveSteps}
            defaultParticipantMode="2-person"
            height={540}
          />
        </Suspense>
      </section>

      {/* 3. ТАКТИЧЕСКИЙ РАЗБОР И НАСТАВЛЕНИЯ ПРИМЕНЕНИЯ */}
      <section className="bunkai-detail__content">
        <div className="bunkai-notes">
          {bunkai.Description && (
            <div className="bunkai-notes__block">
              <h3>Общая тактическая концепция</h3>
              <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.75 }}>{bunkai.Description}</p>
            </div>
          )}

          {bunkai.Application && (
            <div className="bunkai-notes__block">
              <h3>Применение в реальном поединке (Оё-бункай)</h3>
              <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.75 }}>{bunkai.Application}</p>
            </div>
          )}

          {/* ПОШАГОВОЕ ОПИСАНИЕ БУНКАЙ (18 ШАГОВ) */}
          <div className="bunkai-notes__block" style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
              <Swords size={20} color="var(--gold)" />
              <h3 style={{ margin: 0 }}>Каноническое пошаговое описание Бункай Хэйан Шодан (18 шагов)</h3>
            </div>
            <p style={{ color: 'var(--text-muted, #a8a29e)', fontSize: '0.88rem', marginBottom: '1rem' }}>
              1 — Тори (атакующий); 2 — Укэ (защищающийся). Все действия синхронизированы в 3D с реальной боевой дистанцией, предотвращением геометрического проникновения и непрерывными переходами стоек.
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(197, 155, 39, 0.4)', color: 'var(--gold)' }}>
                    <th style={{ padding: '8px 10px', width: '60px' }}>Шаг</th>
                    <th style={{ padding: '8px 10px', width: '32%' }}>1 (Тори — атакующий)</th>
                    <th style={{ padding: '8px 10px', width: '38%' }}>2 (Укэ — защищающийся)</th>
                    <th style={{ padding: '8px 10px' }}>Примечания и боевой контакт</th>
                  </tr>
                </thead>
                <tbody>
                  {HEIAN_SHODAN_BUNKAI_18_STEPS.map((step) => (
                    <tr
                      key={step.stepNumber}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                        background: step.stepNumber % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '10px 10px', fontWeight: 700, color: 'var(--gold)' }}>
                        {step.stepNumber}
                      </td>
                      <td style={{ padding: '10px 10px', color: '#f8fafc' }}>
                        <div>{step.participants[0]?.clipName ? `${step.description.split('.')[0]}` : step.title}</div>
                      </td>
                      <td style={{ padding: '10px 10px', color: '#93c5fd' }}>
                        <div>{step.description.split('.')[1] || step.description}</div>
                      </td>
                      <td style={{ padding: '10px 10px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                            Дистанция: <strong style={{ color: '#fff' }}>{step.optimalDistance.toFixed(2)}м</strong>
                          </span>
                          {step.notes && (
                            <span
                              style={{
                                fontSize: '0.76rem',
                                color: '#fbbf24',
                                background: 'rgba(245, 158, 11, 0.15)',
                                padding: '2px 6px',
                                borderRadius: 4,
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                              }}
                            >
                              🥋 {step.notes}
                            </span>
                          )}
                          {step.scenarioAngles && (
                            <span
                              style={{
                                fontSize: '0.74rem',
                                color: '#90cdf4',
                                background: 'rgba(99, 179, 237, 0.15)',
                                padding: '2px 6px',
                                borderRadius: 4,
                                border: '1px solid rgba(99, 179, 237, 0.3)',
                              }}
                            >
                              📐 {step.scenarioAngles.label}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* 4. ОТДЕЛЬНЫЙ ПРЕМИАЛЬНЫЙ БЛОК ЭТАЛОННОГО ВИДЕО МАСТЕРОВ JKS ВНИЗУ СТРАНИЦЫ */}
      {bunkai.Video_URL && (
        <section className="bunkai-detail__video-section">
          <div className="bunkai-detail__video-section-header">
            <div className="bunkai-detail__video-section-badge">
              <ShotokanTiger size={22} color="var(--gold)" />
              <span className="bunkai-detail__video-section-eyebrow">
                ЭТАЛОННОЕ ИСПОЛНЕНИЕ · МАСТЕРА JKS (JAPAN KARATE SHOTO FEDERATION)
              </span>
            </div>
            <h2 className="bunkai-detail__video-section-title">
              Видеоразбор применения: {bunkai.Title}
            </h2>
            <p className="bunkai-detail__video-section-subtitle">
              Каноническая видеодемонстрация боевого применения бункай ведущими инструкторами штаб-квартиры JKS (Токио, Япония) под руководством шеф-инструктора Масао Кагава (9 Дан).
            </p>
          </div>

          <div className="bunkai-detail__video-player-container">
            <VideoEmbed
              url={bunkai.Video_URL}
              title={bunkai.Title}
              masterName="Мастера JKS · Шеф-инструктор Масао Кагава (9 Дан)"
              autoLoad={false}
            />
          </div>
        </section>
      )}

      {/* 5. ОБСУЖДЕНИЕ И ВОПРОСЫ ДОДЗЁ */}
      <section className="bunkai-detail__comments-section">
        <h3 className="bunkai-detail__comments-title">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><MessageSquare size={16} /> Обсуждение и тактический разбор</span>
        </h3>
        <Comments bunkaiId={Number(id)} />
      </section>
    </div>
  );
}
