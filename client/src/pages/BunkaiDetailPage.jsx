import { useEffect, useState, useMemo, lazy, Suspense } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getBunkai, getBunkaiSteps, deleteBunkai, approveBunkai, rejectBunkai } from '../api/bunkai';
import { sendFriendRequest, listFriends, listFriendRequests } from '../api/friends';
import { useAuthStore } from '../store/authStore';
import { useFavoritesStore } from '../store/favoritesStore';
import StatusBadge from '../components/StatusBadge';
import VideoEmbed from '../components/VideoEmbed';
import Comments from '../components/Comments';
import { HankoSeal, ShotokanTiger } from '../components/ui/JapaneseDecor';
import '../three/avatarWidget.css';
import { Heart, MessageSquare, Swords, UserPlus, UserCheck, Clock } from 'lucide-react';
import { buildStepsFromDb } from '../three/bunkaiScenarioEngine';
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
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const [isFriend, setIsFriend] = useState(false);
  const [isFriendReqPending, setIsFriendReqPending] = useState(false);
  const [sendingFriendReq, setSendingFriendReq] = useState(false);

  const { isBunkaiFavorite, toggle: toggleFavorite, fetchFavorites, loaded: favsLoaded } = useFavoritesStore();

  const currentUserId = user?.User_ID ?? user?.userId ?? user?.id;
  const authorId = bunkai?.Author_ID ?? bunkai?.Author?.User_ID;
  const isCreator = Boolean(currentUserId && authorId && Number(currentUserId) === Number(authorId));
  const isStaff = role === 'admin' || role === 'moderator';

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

  useEffect(() => {
    if (user && authorId && !isCreator) {
      Promise.all([
        listFriends().catch(() => []),
        listFriendRequests('outgoing').catch(() => []),
      ]).then(([friends, outgoing]) => {
        const friendFound = (friends || []).some((f) => Number(f.User_ID) === Number(authorId));
        const reqFound = (outgoing || []).some((r) => Number(r.Receiver_ID) === Number(authorId) && r.Status === 'pending');
        setIsFriend(friendFound);
        setIsFriendReqPending(reqFound);
      });
    }
  }, [user, authorId, isCreator]);

  async function handleSendFriendRequest() {
    if (!authorId || sendingFriendReq) return;
    setSendingFriendReq(true);
    try {
      await sendFriendRequest(authorId);
      setIsFriendReqPending(true);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Ошибка отправки заявки в друзья');
    } finally {
      setSendingFriendReq(false);
    }
  }

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

  // Единая сборка шагов из БД + канонических траекторий (совпадает с редактором 1-в-1)
  // Важно: useMemo вызывается строго до условных return для неизменного порядка хуков
  const effectiveSteps = useMemo(() => buildStepsFromDb(bunkaiSteps), [bunkaiSteps]);

  if (loading) return <p className="loading">Загрузка боевого разбора…</p>;
  if (error || !bunkai) return <p className="empty-state">{error || 'Бункай не найден'}</p>;

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

          <div className="bunkai-detail__author-line" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span>
              Разбор подготовил:{' '}
              <strong>{bunkai.Author?.Display_Name || bunkai.Author?.Username || 'Сенсей Додзё'}</strong>
            </span>
            {currentUserId && authorId && !isCreator && (
              <span style={{ marginLeft: '4px' }}>
                {isFriend ? (
                  <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', padding: '3px 8px' }}>
                    <UserCheck size={14} /> В соратниках
                  </span>
                ) : isFriendReqPending ? (
                  <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', padding: '3px 8px' }}>
                    <Clock size={14} /> Заявка отправлена
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '3px 10px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                    onClick={handleSendFriendRequest}
                    disabled={sendingFriendReq}
                  >
                    <UserPlus size={14} /> Добавить в соратники
                  </button>
                )}
              </span>
            )}
          </div>
        </div>

        {(isCreator || isStaff) && (
          <div className="bunkai-detail__actions">
            {isCreator && (
              <Link to={`/bunkai/${id}/edit`} className="btn btn-subtle">
                Редактировать
              </Link>
            )}
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
            {(isCreator || isStaff) && (
              <button type="button" className="btn btn-danger" onClick={onDelete}>
                Удалить
              </button>
            )}
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
            activeStepIndex={activeStepIndex}
            onStepChange={setActiveStepIndex}
            canEdit={false}
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

          {/* ПОШАГОВОЕ ОПИСАНИЕ БУНКАЙ */}
          <div className="bunkai-notes__block" style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
              <Swords size={20} color="var(--gold)" />
              <h3 style={{ margin: 0 }}>Пошаговое описание Бункай ({effectiveSteps.length} шагов)</h3>
            </div>
            <p style={{ color: 'var(--text-muted, #a8a29e)', fontSize: '0.86rem', marginBottom: '1rem' }}>
              1 — Тори (атакующий); 2 — Укэ (защищающийся). Нажмите на строку шага для перехода к нему в 3D-плеере.
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(197, 155, 39, 0.4)', color: 'var(--gold)' }}>
                    <th style={{ padding: '8px 10px', width: '54px' }}>Шаг</th>
                    <th style={{ padding: '8px 10px', width: '34%' }}>1 (Тори — атакующий)</th>
                    <th style={{ padding: '8px 10px', width: '40%' }}>2 (Укэ — защищающийся)</th>
                    <th style={{ padding: '8px 10px' }}>Примечания</th>
                  </tr>
                </thead>
                <tbody>
                  {effectiveSteps.map((step, idx) => {
                    const isActive = idx === activeStepIndex;
                    const desc = String(step.description || '');
                    const toriMatch = desc.match(/1\s*\(Тори\):\s*([\s\S]*?)(?=\s*2\s*\(Укэ\):|$)/i);
                    const ukeMatch = desc.match(/2\s*\(Укэ\):\s*([\s\S]*)/i);
                    const toriPart = (step.participants || []).find((p) => p.role === 'tori') || {};
                    const ukePart = (step.participants || []).find((p) => p.role === 'uke1' || p.role === 'uke') || {};
                    const toriText = (toriMatch?.[1] || step.title || toriPart.clipName || '—').trim();
                    const ukeText = (ukeMatch?.[1] || ukePart.clipName || '').trim();
                    return (
                      <tr
                        key={step.stepNumber || idx + 1}
                        onClick={() => setActiveStepIndex(idx)}
                        style={{
                          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                          background: isActive
                            ? 'rgba(212, 162, 76, 0.14)'
                            : (step.stepNumber || idx + 1) % 2 === 0
                            ? 'rgba(255, 255, 255, 0.02)'
                            : 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        <td style={{ padding: '9px 10px', fontWeight: 700, color: 'var(--gold)' }}>
                          {step.stepNumber || idx + 1}
                        </td>
                        <td style={{ padding: '9px 10px', color: '#f8fafc' }}>
                          {toriText}
                        </td>
                        <td style={{ padding: '9px 10px', color: '#e2e8f0' }}>
                          {ukeText || '—'}
                        </td>
                        <td style={{ padding: '9px 10px', color: '#cbd5e1', fontSize: '0.82rem' }}>
                          {step.notes || `${step.optimalDistance || 1.45}м`}
                        </td>
                      </tr>
                    );
                  })}
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
