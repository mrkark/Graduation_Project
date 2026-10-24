import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getKata, deleteKata, approveKata, rejectKata } from '../api/kata';
import { useAuthStore } from '../store/authStore';
import { useFavoritesStore } from '../store/favoritesStore';
import StatusBadge from '../components/StatusBadge';
import VideoEmbed from '../components/VideoEmbed';
import Comments from '../components/Comments';
import KataSequencer, { resolveKataSlug } from '../three/KataSequencer';
import { HankoSeal, ShotokanTiger } from '../components/ui/JapaneseDecor';
import './KataDetailPage.css';

const DIFFICULTY_LABELS = {
  beginner: 'Начальный уровень (Сёдан · 9–7 Кю)',
  intermediate: 'Средний уровень (Тюдан · 6–4 Кю)',
  advanced: 'Продвинутый уровень (Дзёдан · 3–1 Кю)',
  master: 'Мастерский уровень (Мэнкё · Дан)',
};

const STANCE_KANJI = {
  zenkutsu: '前',
  kokutsu: '後',
  kiba: '騎',
  fudo: '不',
  gankaku: '鶴',
  heiko: '平',
  ready: '然',
};

export default function KataDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuthStore();
  const [kata, setKata] = useState(null);
  const [kataJsonData, setKataJsonData] = useState(null);
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('notes'); // 'notes' | 'video' | 'bunkai' | 'comments'

  const { isKataFavorite, toggle: toggleFavorite, fetchFavorites, loaded: favsLoaded } = useFavoritesStore();

  useEffect(() => {
    if (!favsLoaded) fetchFavorites();
  }, [favsLoaded, fetchFavorites]);

  useEffect(() => {
    setLoading(true);
    getKata(id)
      .then((data) => {
        setKata(data);
        setActiveStepIdx(0);
      })
      .catch((err) => setError(err.response?.data?.error?.message || 'Ката не найдено'))
      .finally(() => setLoading(false));
  }, [id]);

  const kataSlug = useMemo(() => (kata?.Title ? resolveKataSlug(kata.Title) : null), [kata?.Title]);

  useEffect(() => {
    if (!kataSlug) return;
    fetch(`/kata_data/${kataSlug}.json`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setKataJsonData(data))
      .catch(() => {});
  }, [kataSlug]);

  // Канонические шаги из JSON / БД
  const effectiveSteps = useMemo(() => {
    if (!kata) return [];
    const dbSteps = kata.Steps || [];
    const jsonSteps = kataJsonData?.steps || kataJsonData?.events || [];
    if (jsonSteps.length === 0) return dbSteps;

    return jsonSteps.map((ev, idx) => {
      const existing = dbSteps[idx];
      const moveNum = ev.n || ev.moveNumber || idx + 1;
      const facingStr =
        ev.facingDeg !== undefined
          ? ev.facingDeg === 0
            ? '0° (Север · 正面)'
            : `${ev.facingDeg}°`
          : ev.facing
          ? `${ev.facing}`
          : 'Линия эмбусэн';

      let techniqueName = Array.isArray(ev.techniques)
        ? ev.techniques.join(', ')
        : ev.technique || (existing?.Technique || (ev.stance ? `Стойка ${ev.stance}` : 'Каноническая техника'));

      if (moveNum === 4 || ev.T?.includes('tettsui')) {
        techniqueName = 'Тэцуи-ути (Стойка Мото-дати)';
      } else if (moveNum === 18 || (kataSlug === 'heian_shodan' && ev.T?.includes('shuto_uke') && ev.facingDeg === 0)) {
        techniqueName = 'Сюто-укэ (Поворот через спину)';
      }

      if (existing) {
        return {
          ...ev,
          ...existing,
          T: ev.T || existing.T,
          S: ev.S || existing.S,
          scale: ev.scale || existing.scale || 1.0,
          Duration: existing.Duration || (ev.endTime && ev.startTime ? ev.endTime - ev.startTime : 2),
          kiai: Boolean(ev.kiai || existing.Title?.includes('КИАЙ')),
          facingDeg: moveNum === 18 && kataSlug === 'heian_shodan' ? 0 : ev.facingDeg !== undefined ? ev.facingDeg : existing.facingDeg,
          R: ev.R || existing.R,
          stance: ev.stance || ev.form || existing.stance,
          Direction: facingStr.trim(),
          Title: existing.Title || `Шаг ${moveNum}: ${techniqueName}${ev.kiai ? ' [КИАЙ]' : ''}`,
          Technique: existing.Technique || techniqueName,
        };
      }

      return {
        Step_Number: moveNum,
        Title: `Шаг ${moveNum}: ${techniqueName}${ev.kiai ? ' [КИАЙ]' : ''}`,
        Technique: techniqueName,
        Direction: facingStr.trim(),
        Duration: ev.endTime && ev.startTime ? ev.endTime - ev.startTime : 2,
        stance: ev.stance || ev.form || 'zenkutsu',
        kiai: Boolean(ev.kiai),
        facingDeg: ev.facingDeg || 0,
        T: ev.T,
        S: ev.S,
        R: ev.R,
        scale: ev.scale || 1.0,
      };
    });
  }, [kata, kataJsonData, kataSlug]);

  const stepsCount = effectiveSteps.length;
  const activeStep = effectiveSteps[activeStepIdx] || effectiveSteps[0] || null;
  const isKiai = Boolean(activeStep?.kiai || activeStep?.Title?.includes('КИАЙ'));

  const stanceKey = (activeStep?.stance || 'zenkutsu').toLowerCase().split('_')[0];
  const stanceKanjiChar = STANCE_KANJI[stanceKey] || '構';

  const isOwner = kata?.Author_ID === user?.User_ID;
  const isStaff = role === 'admin' || role === 'moderator';
  const canEdit = isOwner || isStaff;

  async function onDelete() {
    if (!confirm('Удалить эту форму ката?')) return;
    await deleteKata(id);
    navigate('/kata');
  }

  async function onApprove() {
    setKata(await approveKata(id));
  }

  async function onReject() {
    setKata(await rejectKata(id));
  }

  if (loading) return <p className="loading">Загрузка ката…</p>;
  if (error || !kata) return <p className="empty-state">{error || 'Ката не найдено'}</p>;

  return (
    <div className="kata-study container">
      {/* 1. АРХИТЕКТУРНАЯ ШАПКА КАТА ДОДЗЁ */}
      <header className="kata-study__header">
        <div>
          <div className="kata-study__meta-row">
            <Link to="/kata" className="kata-study__back-link">
              ← Атлас ката (型)
            </Link>
            <span className="kata-study__sep">/</span>
            <span className="kata-study__belt-tag">
              {DIFFICULTY_LABELS[kata.Difficulty] || kata.Difficulty}
            </span>
            <span className="kata-study__sep">/</span>
            <span className="kata-study__step-count">
              {stepsCount} движений
            </span>
            <StatusBadge status={kata.Status} />
          </div>

          <div className="kata-study__title-wrap">
            <h1 className="kata-study__title">
              {kata.Title}
            </h1>
            <button
              type="button"
              className={`btn ${isKataFavorite(id) ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => toggleFavorite('kata', id)}
              style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
            >
              {isKataFavorite(id) ? '❤️ В избранном' : '🤍 В избранное'}
            </button>
            <HankoSeal
              text={kata.Title?.match(/[\u4e00-\u9faf]{1,2}/)?.[0] || '型'}
              size="md"
              variant="vermilion"
              shape="square"
            />
          </div>
        </div>

        {canEdit && (
          <div className="kata-study__actions">
            <Link to={`/kata/${id}/edit`} className="btn btn-subtle">
              Редактировать
            </Link>
            {isStaff && kata.Status !== 'approved' && (
              <button type="button" className="btn btn-primary" onClick={onApprove}>
                Одобрить
              </button>
            )}
            {isStaff && kata.Status !== 'rejected' && (
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

      {/* 2. ЦЕНТРАЛЬНЫЙ 3D-АВАТАР И СЦЕНА (ОСНОВНОЙ ФОКУС БЕЗ ПЕРЕКРЫТИЙ) */}
      <section className="kata-study__stage-wrap">
        <div className="kata-study__stage-frame-header">
          <div className="kata-study__stage-badge">
            <ShotokanTiger size={18} color="var(--gold)" />
            <span>3D АРЕНА ДОДЗЁ · СЁТОКАН КАРАТЭДО</span>
          </div>
          <span className="kata-study__stage-slug">
            {kataSlug ? kataSlug.toUpperCase() : 'KATA'}
          </span>
        </div>

        <div className="kata-study__canvas-container">
          <KataSequencer
            kataTitle={kata.Title}
            steps={effectiveSteps}
            height={560}
            activeStepIndex={activeStepIdx}
            onStepChange={setActiveStepIdx}
          />
        </div>

        {/* 3. КОМПАКТНАЯ ПАНЕЛЬ ШАГА И УПРАВЛЕНИЯ ПЕРЕМЕЩЕНИЕМ */}
        <div className="kata-stepper">
          <button
            type="button"
            className="btn btn-subtle kata-stepper__nav-btn"
            onClick={() => setActiveStepIdx((prev) => Math.max(0, prev - 1))}
            disabled={activeStepIdx === 0}
          >
            ← Пред. шаг
          </button>

          <div className="kata-stepper__info">
            <div className="kata-stepper__step-badge">
              <span>Шаг {activeStepIdx + 1} из {stepsCount}</span>
              {isKiai && (
                <div className="kata-kiai-badge">
                  <HankoSeal text="気合" size="sm" variant="vermilion" shape="square" />
                  <span className="kata-kiai-text">КИАЙ!</span>
                </div>
              )}
            </div>
            <div className="kata-stepper__technique">
              {activeStep?.Technique || activeStep?.Title || 'Стойка готовности'}
            </div>
            <div className="kata-stepper__stance-line">
              <span className="kata-stance-pill">
                <span className="kata-stance-kanji">{stanceKanjiChar}</span>
                <span>Стойка: <strong>{activeStep?.stance || 'Дзэнкуцу-дати'}</strong></span>
              </span>
              <span className="kata-stance-sep">·</span>
              <span className="kata-direction-pill">
                <span>Ось: <strong>{activeStep?.Direction || '0° (Север)'}</strong></span>
              </span>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary kata-stepper__nav-btn"
            onClick={() => setActiveStepIdx((prev) => Math.min(stepsCount - 1, prev + 1))}
            disabled={activeStepIdx === stepsCount - 1}
          >
            {activeStepIdx === stepsCount - 1 ? 'Завершено ✔' : 'След. шаг →'}
          </button>
        </div>

        {/* Минималистичная лента точек шагов */}
        <div className="kata-dots-track">
          {effectiveSteps.map((step, idx) => {
            const stepKiai = step.Title?.includes('КИАЙ') || step.Technique?.includes('КИАЙ') || step.kiai;
            const isActive = idx === activeStepIdx;
            return (
              <button
                key={idx}
                type="button"
                className={`kata-dot-btn ${isActive ? 'active' : ''} ${stepKiai ? 'kiai' : ''}`}
                onClick={() => setActiveStepIdx(idx)}
                title={`Шаг ${idx + 1}: ${step.Technique || step.Title}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </section>

      {/* 4. ПРОГРЕССИВНОЕ РАСКРЫТИЕ ДОПОЛНИТЕЛЬНОЙ ИНФОРМАЦИИ (ДЭНСЁ) */}
      <section className="kata-study__details">
        <div className="tabs kata-study__tabs">
          <button
            type="button"
            className={activeTab === 'notes' ? 'active' : ''}
            onClick={() => setActiveTab('notes')}
          >
            Наставление и биомеханика
          </button>
          {kata.Video_URL && (
            <button
              type="button"
              className={activeTab === 'video' ? 'active' : ''}
              onClick={() => setActiveTab('video')}
            >
              Эталонное видео
            </button>
          )}
          {kata.RelatedBunkai?.length > 0 && (
            <button
              type="button"
              className={activeTab === 'bunkai' ? 'active' : ''}
              onClick={() => setActiveTab('bunkai')}
            >
              Боевой бункай ({kata.RelatedBunkai.length})
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

        <div className="kata-study__tab-content">
          {activeTab === 'notes' && (
            <div className="kata-notes">
              <div className="kata-notes__main">
                <div className="kata-notes__header-row">
                  <HankoSeal text="伝" size="sm" variant="gold" shape="square" />
                  <h3 style={{ margin: 0 }}>Каноническое наставление формы</h3>
                </div>
                <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.75 }}>
                  {kata.Description || 'Описание формы пока не добавлено.'}
                </p>

                {activeStep?.Description && (
                  <div className="kata-step-callout">
                    <h4>Нюанс текущего шага #{activeStepIdx + 1}:</h4>
                    <p style={{ margin: 0 }}>{activeStep.Description}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'video' && kata.Video_URL && (
            <div className="kata-video-wrap">
              <VideoEmbed url={kata.Video_URL} />
            </div>
          )}

          {activeTab === 'bunkai' && kata.RelatedBunkai?.length > 0 && (
            <div className="kata-bunkai-list">
              {kata.RelatedBunkai.map((b) => (
                <div key={b.Bunkai_ID} className="kata-bunkai-item">
                  <div>
                    <h4>{b.Title}</h4>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      {b.Description || 'Разбор боевого применения движений ката.'}
                    </p>
                  </div>
                  <Link to={`/bunkai/${b.Bunkai_ID}`} className="btn btn-subtle">
                    <span>Открыть симуляцию 3D</span>
                    <HankoSeal text="解" size="sm" variant="vermilion" shape="square" />
                  </Link>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'comments' && (
            <div>
              <Comments kataId={Number(id)} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
