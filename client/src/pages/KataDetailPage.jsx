import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getKata, deleteKata, approveKata, rejectKata } from '../api/kata';
import { useAuthStore } from '../store/authStore';
import StatusBadge from '../components/StatusBadge';
import VideoEmbed from '../components/VideoEmbed';
import Comments from '../components/Comments';
import KataSequencer, { resolveKataSlug } from '../three/KataSequencer';
import { resolveMediaUrl } from '../utils/media';
import './KataDetailPage.css';

const DIFFICULTY_LABELS = {
  beginner: 'Начальный уровень (Сёдан)',
  intermediate: 'Средний уровень (Тюдан)',
  advanced: 'Продвинутый уровень (Дзёдан)',
  master: 'Мастерский уровень (Мэнкё)',
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
  const [activeTab, setActiveTab] = useState('breakdown'); // 'breakdown' | 'video' | 'bunkai' | 'comments'

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

  // Объединяем шаги из БД и канонические шаги из /kata_data/*.json
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
            ? 'Лицом к залу (Север 0°)'
            : `Направление: ${ev.facingDeg}°`
          : ev.facing
          ? `Направление: ${ev.facing}`
          : 'Линия эмбусэн';

      let techniqueName = Array.isArray(ev.techniques)
        ? ev.techniques.join(', ')
        : ev.technique || (existing?.Technique || (ev.stance ? `Стойка ${ev.stance}` : 'Каноническая техника'));

      if (moveNum === 4 || ev.T?.includes('tettsui')) {
        techniqueName = 'Тэцуи-ути (Стойка Мото-дати — половина длины дзэнкуцу-дати)';
      } else if (moveNum === 18 || (kataSlug === 'heian_shodan' && ev.T?.includes('shuto_uke') && ev.facingDeg === 0)) {
        techniqueName = 'Сюто-укэ (поворот через спину лицом к камере)';
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
          Direction:
            moveNum === 18 && kataSlug === 'heian_shodan'
              ? 'Поворот через спину лицом к камере (Север 0°)'
              : existing.Direction || facingStr.trim(),
          Title: existing.Title || `Шаг ${moveNum}: ${techniqueName}${ev.kiai ? ' [КИАЙ]' : ''}`,
          Technique: existing.Technique || techniqueName,
        };
      }

      return {
        ...ev,
        Step_ID: `canonical_${moveNum}`,
        Step_Number: moveNum,
        Title: `Шаг ${moveNum}: ${techniqueName}${ev.kiai ? ' [КИАЙ]' : ''}`,
        Technique: techniqueName,
        Direction: facingStr.trim(),
        Description:
          moveNum === 4
            ? `Каноническое движение #4 ката ${kata.Title}. Стойка Мото-дати (ровно половина длины дзэнкуцу-дати, шаг 0.45 м). Удар молотом кулака Тэцуи-ути.`
            : moveNum === 18
            ? `Каноническое движение #18 ката ${kata.Title}. Поворот через спину лицом к камере (Север 0°), блок ребром ладони сюто-укэ в стойке кокуцу-дати.`
            : `Каноническое движение #${moveNum} ката ${kata.Title}. Позиция: ${ev.stance || ev.form || 'базовая'}.${facingStr}.${ev.kiai ? ' Боевой выкрик КИАЙ!' : ''}`,
        Duration: ev.endTime && ev.startTime ? ev.endTime - ev.startTime : 2,
        kiai: Boolean(ev.kiai),
        facingDeg: ev.facingDeg,
        R: ev.R,
        stance: ev.stance || ev.form,
      };
    });
  }, [kata, kataJsonData, kataSlug]);

  const stepsCount = effectiveSteps.length;

  const goToPrevStep = useCallback(() => {
    setActiveStepIdx((prev) => Math.max(0, prev - 1));
  }, []);

  const goToNextStep = useCallback(() => {
    setActiveStepIdx((prev) => Math.min(stepsCount - 1, prev + 1));
  }, [stepsCount]);

  // Навигация стрелками клавиатуры
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') {
        goToPrevStep();
      } else if (e.key === 'ArrowRight') {
        goToNextStep();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrevStep, goToNextStep]);

  if (loading) return <div className="kata-detail-loading"><span className="loading-kanji">型</span><p>Загрузка канона ката…</p></div>;
  if (error || !kata) return <div className="empty-state">⚠️ {error}</div>;

  const activeStep = effectiveSteps[activeStepIdx] || effectiveSteps[0];
  const isKiai = activeStep && (activeStep.Title?.includes('КИАЙ') || activeStep.kiai);

  const isStaff = role === 'admin' || role === 'moderator';
  const canEdit = role === 'admin';

  async function onDelete() {
    if (!confirm('Удалить это ката без возможности восстановления?')) return;
    await deleteKata(id);
    navigate('/kata');
  }

  async function onApprove() {
    setKata(await approveKata(id));
  }
  async function onReject() {
    setKata(await rejectKata(id));
  }

  return (
    <div className="kata-detail-page">
      {/* --- ШАПКА КАТА: ДОДЗЁ БАННЕР --- */}
      <section className="kata-banner">
        <div className="kata-banner__inner">
          <div className="kata-banner__seal">
            <span className="hanko hanko--lg">型</span>
          </div>

          <div className="kata-banner__content">
            <div className="kata-banner__breadcrumbs">
              <Link to="/kata" className="breadcrumb-link">Каталог ката</Link>
              <span className="breadcrumb-sep">/</span>
              <span className="breadcrumb-curr">{kata.Title}</span>
            </div>

            <div className="kata-banner__title-row">
              <h1 className="kata-banner__title">{kata.Title}</h1>
              <StatusBadge status={kata.Status} />
            </div>

            <div className="kata-banner__meta-row">
              <span className="meta-tag meta-tag--style">
                <span className="meta-tag__kanji">流</span>
                <span>{kata.Style || 'Шотокан (松濤館流)'}</span>
              </span>

              <span className="meta-tag meta-tag--diff">
                <span className="meta-tag__kanji">段</span>
                <span>{DIFFICULTY_LABELS[kata.Difficulty] || kata.Difficulty}</span>
              </span>

              <span className="meta-tag meta-tag--steps">
                <span className="meta-tag__kanji">歩</span>
                <span>{stepsCount} канонических движений</span>
              </span>

              <span className="meta-tag meta-tag--author">
                Автор: {kata.Author?.Display_Name || kata.Author?.Username}
              </span>
            </div>
          </div>

          {/* Действия администратора / модератора */}
          {isStaff && (
            <div className="kata-banner__actions">
              {canEdit && (
                <Link to={`/kata/${id}/edit`} className="btn btn-gold btn-sm">
                  Редактировать
                </Link>
              )}
              {canEdit && (
                <button type="button" className="btn btn-danger btn-sm" onClick={onDelete}>
                  Удалить
                </button>
              )}
              {kata.Status !== 'approved' && (
                <button type="button" className="btn btn-primary btn-sm" onClick={onApprove}>
                  Одобрить
                </button>
              )}
              {kata.Status !== 'rejected' && (
                <button type="button" className="btn btn-sm" onClick={onReject}>
                  Отклонить
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* --- ГЛАВНАЯ РАБОЧАЯ ОБЛАСТЬ: 3D СЕКВЕНСЕР КАТА НА ПОЛНУЮ ШИРИНУ --- */}
      <section className="kata-stage-section">
        <div className="kata-stage-header">
          <div className="stage-title-wrap">
            <span className="stage-kanji">道場検定</span>
            <h2 className="stage-title">Интерактивный 3D-Анализ Формы</h2>
          </div>

          <div className="stage-indicator-wrap">
            <span className="stage-step-pill">
              Шаг <strong>{activeStep ? activeStep.Step_Number : 1}</strong> из {stepsCount}
            </span>
            {isKiai && <span className="kiai-badge">💥 КИАЙ!</span>}
          </div>
        </div>

        {/* 3D Dojo Canvas */}
        <div className="kata-stage-viewport">
          <KataSequencer
            kataTitle={kata.Title}
            steps={effectiveSteps}
            height={600}
            activeStepIndex={activeStepIdx}
            onStepChange={setActiveStepIdx}
          />
        </div>
      </section>

      {/* --- ПАНЕЛЬ ПОШАГОВОГО СКРАББЕРА И НАВИГАЦИИ ПО ТАТАМИ --- */}
      <section className="kata-scrubber-section">
        <div className="scrubber-bar">
          <button
            type="button"
            className="btn btn-scrubber-nav"
            onClick={goToPrevStep}
            disabled={activeStepIdx === 0}
          >
            ← Пред. шаг
          </button>

          {/* Лента всех канонических шагов */}
          <div className="scrubber-track">
            {effectiveSteps.map((step, idx) => {
              const stepKiai = step.Title?.includes('КИАЙ') || step.Technique?.includes('КИАЙ') || step.kiai;
              const isActive = idx === activeStepIdx;
              return (
                <button
                  key={step.Step_ID || idx}
                  type="button"
                  className={`scrubber-step-btn ${isActive ? 'active' : ''} ${stepKiai ? 'kiai' : ''}`}
                  onClick={() => setActiveStepIdx(idx)}
                  title={`Шаг ${step.Step_Number}: ${step.Title}`}
                >
                  <span className="step-num">{step.Step_Number}</span>
                  {stepKiai && <span className="kiai-mini-dot" />}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="btn btn-scrubber-nav btn-gold"
            onClick={goToNextStep}
            disabled={activeStepIdx === stepsCount - 1}
          >
            {activeStepIdx === stepsCount - 1 ? 'Форма завершена ✔' : 'След. шаг →'}
          </button>
        </div>

        <div className="scrubber-hint">
          <span>💡 Клавиши <strong>←</strong> и <strong>→</strong> на клавиатуре для мгновенного перехода между шагами формы</span>
        </div>
      </section>

      {/* --- ДЕТАЛЬНЫЙ РАЗБОР ТЕКУЩЕГО ШАГА И ДОПОЛНИТЕЛЬНЫЕ РАЗДЕЛЫ --- */}
      <section className="kata-workspace-grid">
        {/* Левая колонка: Карта текущего шага и техники */}
        <div className="kata-workspace-main">
          {activeStep && (
            <div className="step-master-card">
              <div className="step-master-card__header">
                <div>
                  <span className="step-master-card__tag">
                    Каноническое движение #{activeStep.Step_Number}
                  </span>
                  <h3 className="step-master-card__title">
                    {activeStep.Technique || activeStep.Title}
                  </h3>
                </div>

                {isKiai && (
                  <div className="step-kiai-callout">
                    <span className="kiai-kanji">気合</span>
                    <span>Боевой выкрик КИАЙ</span>
                  </div>
                )}
              </div>

              <div className="step-master-card__grid">
                <div className="step-param-cell">
                  <span className="step-param-cell__label">Стойка (Дати)</span>
                  <strong className="step-param-cell__val">
                    🥋 {activeStep.stance || (activeStep.Step_Number === 4 ? 'Мото-дати (половина длины)' : 'Дзэнкуцу-дати')}
                  </strong>
                </div>

                <div className="step-param-cell">
                  <span className="step-param-cell__label">Направление взгляда и шага (Эмбусэн)</span>
                  <strong className="step-param-cell__val">
                    🧭 {activeStep.Direction || 'Линия канона'}
                  </strong>
                </div>

                <div className="step-param-cell">
                  <span className="step-param-cell__label">Длительность фазы</span>
                  <strong className="step-param-cell__val">
                    ⏱️ {activeStep.Duration ? `${activeStep.Duration} сек` : '1.5 сек'}
                  </strong>
                </div>

                <div className="step-param-cell">
                  <span className="step-param-cell__label">Фокус удара (Кимэ)</span>
                  <strong className="step-param-cell__val">
                    🎯 Чудан / Дзёдан
                  </strong>
                </div>
              </div>

              {activeStep.Description && (
                <div className="step-master-card__desc">
                  <h4>Биомеханика и наставление:</h4>
                  <p>{activeStep.Description}</p>
                </div>
              )}
            </div>
          )}

          {/* Вкладки: Описание, Видео, Бункаи, Комментарии */}
          <div className="kata-content-tabs">
            <div className="tabs-header">
              <button
                type="button"
                className={`tab-btn ${activeTab === 'breakdown' ? 'active' : ''}`}
                onClick={() => setActiveTab('breakdown')}
              >
                📜 Описание формы
              </button>
              {kata.Video_URL && (
                <button
                  type="button"
                  className={`tab-btn ${activeTab === 'video' ? 'active' : ''}`}
                  onClick={() => setActiveTab('video')}
                >
                  🎥 Эталонное видео сенсея
                </button>
              )}
              {kata.RelatedBunkai?.length > 0 && (
                <button
                  type="button"
                  className={`tab-btn ${activeTab === 'bunkai' ? 'active' : ''}`}
                  onClick={() => setActiveTab('bunkai')}
                >
                  ⚔️ Боевые применения ({kata.RelatedBunkai.length})
                </button>
              )}
              <button
                type="button"
                className={`tab-btn ${activeTab === 'comments' ? 'active' : ''}`}
                onClick={() => setActiveTab('comments')}
              >
                💬 Обсуждение в додзё
              </button>
            </div>

            <div className="tab-pane">
              {activeTab === 'breakdown' && (
                <div className="panel dojo-panel">
                  <h3 className="panel-title">Суть и философия ката</h3>
                  <p className="panel-text">{kata.Description || 'Описание канона пока не добавлено.'}</p>
                </div>
              )}

              {activeTab === 'video' && kata.Video_URL && (
                <div className="panel dojo-panel">
                  <h3 className="panel-title">Видеозапись канонического исполнения</h3>
                  <div className="video-wrap">
                    <VideoEmbed url={kata.Video_URL} />
                  </div>
                </div>
              )}

              {activeTab === 'bunkai' && kata.RelatedBunkai?.length > 0 && (
                <div className="bunkai-preview-grid">
                  {kata.RelatedBunkai.map((b) => (
                    <Link key={b.Bunkai_ID} to={`/bunkai/${b.Bunkai_ID}`} className="bunkai-mini-card">
                      <div className="bunkai-mini-card__seal">解</div>
                      <div className="bunkai-mini-card__body">
                        <h4>{b.Title}</h4>
                        <span className="bunkai-mini-card__link">Открыть 3D-поединок Тори и Укэ →</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {activeTab === 'comments' && (
                <Comments kataId={Number(id)} />
              )}
            </div>
          </div>
        </div>

        {/* Правая колонка: Канонический список всех движений */}
        <aside className="kata-workspace-aside">
          <div className="steps-ledger-card">
            <div className="steps-ledger-header">
              <span className="ledger-kanji">歩順</span>
              <h3>Список 21 шага формы</h3>
            </div>

            <div className="steps-ledger-list">
              {effectiveSteps.map((step, idx) => {
                const isActive = idx === activeStepIdx;
                const isStepKiai = step.Title?.includes('КИАЙ') || step.kiai;
                return (
                  <div
                    key={step.Step_ID || idx}
                    className={`steps-ledger-item ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveStepIdx(idx)}
                  >
                    <span className="ledger-item__num">{step.Step_Number}</span>
                    <div className="ledger-item__body">
                      <span className="ledger-item__tech">{step.Technique || step.Title}</span>
                      <span className="ledger-item__dir">{step.Direction || 'Эмбусэн'}</span>
                    </div>
                    {isStepKiai && <span className="ledger-kiai-tag">КИАЙ</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
