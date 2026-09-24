import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getKata, deleteKata, approveKata, rejectKata } from '../api/kata';
import { useAuthStore } from '../store/authStore';
import StatusBadge from '../components/StatusBadge';
import VideoEmbed from '../components/VideoEmbed';
import Comments from '../components/Comments';
import KaratekaAvatar from '../three/KaratekaAvatar';
import { resolveMediaUrl } from '../utils/media';
import '../three/avatarWidget.css';
import './KataDetailPage.css';

const DIFFICULTY_LABELS = { beginner: 'Начальный', intermediate: 'Средний', advanced: 'Продвинутый', master: 'Мастер' };

export default function KataDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuthStore();
  const [kata, setKata] = useState(null);
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const stepsCount = kata?.Steps?.length || 0;

  const goToPrevStep = useCallback(() => {
    setActiveStepIdx((prev) => Math.max(0, prev - 1));
  }, []);

  const goToNextStep = useCallback(() => {
    setActiveStepIdx((prev) => Math.min(stepsCount - 1, prev + 1));
  }, [stepsCount]);

  // Управление стрелками клавиатуры
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

  if (loading) return <p className="loading">Загрузка…</p>;
  if (error || !kata) return <p className="empty-state">{error}</p>;

  const activeStep = kata.Steps?.[activeStepIdx] || kata.Steps?.[0];

  function getStanceFromStep(step) {
    if (!step) return 'ready';
    const text = `${step.Technique || ''} ${step.Title || ''} ${step.Description || ''}`.toLowerCase();
    if (text.includes('гэдан') || text.includes('gedan')) return 'gedan_barai';
    if (text.includes('агэ') || text.includes('age-uke')) return 'age_uke';
    if (text.includes('сюто') || text.includes('shuto') || text.includes('кокуцу')) return 'kokutsu';
    if (text.includes('киба') || text.includes('kiba') || text.includes('тэкки')) return 'kiba';
    if (text.includes('фудо') || text.includes('fudo') || text.includes('сочин')) return 'fudo';
    if (text.includes('журавл') || text.includes('цуруаси') || text.includes('gankaku')) return 'tsuruashi';
    if (text.includes('цуки') || text.includes('дзэнкуцу') || text.includes('zenkutsu')) return 'zenkutsu';
    return 'zenkutsu';
  }

  const activeStance = getStanceFromStep(activeStep);
  const isKiai = activeStep && (activeStep.Title?.includes('КИАЙ') || activeStep.Technique?.includes('КИАЙ') || activeStep.Description?.includes('КИАЙ'));

  const stepImageUrl = activeStep?.Image_URL
    ? resolveMediaUrl(activeStep.Image_URL)
    : kata.Thumbnail_URL
      ? resolveMediaUrl(kata.Thumbnail_URL)
      : '/images/kata/sensei-preview.jpg';

  const isStaff = role === 'admin';
  const canEdit = isStaff;

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
    <div>
      {/* Главный заголовок Ката */}
      <div className="detail-header">
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          {kata.Thumbnail_URL && (
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: 12,
                backgroundImage: `url("${resolveMediaUrl(kata.Thumbnail_URL)}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                border: '1.5px solid var(--color-gold)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                flexShrink: 0,
              }}
            />
          )}
          <div>
            <div className="card__meta" style={{ marginBottom: '0.4rem' }}>
              <StatusBadge status={kata.Status} />
              <span>{DIFFICULTY_LABELS[kata.Difficulty] || kata.Difficulty}</span>
              {kata.Style && <span>· {kata.Style}</span>}
            </div>
            <h1 style={{ margin: '0 0 0.4rem' }}>{kata.Title}</h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              Автор: {kata.Author?.Display_Name || kata.Author?.Username}
            </p>
          </div>
        </div>
        <div className="detail-actions">
          {canEdit && (
            <Link to={`/kata/${id}/edit`} className="btn btn-gold">
              Редактировать
            </Link>
          )}
          {canEdit && (
            <button className="btn btn-danger" onClick={onDelete}>
              Удалить
            </button>
          )}
          {isStaff && kata.Status !== 'approved' && (
            <button className="btn btn-primary" onClick={onApprove}>
              Одобрить
            </button>
          )}
          {isStaff && kata.Status !== 'rejected' && (
            <button className="btn" onClick={onReject}>
              Отклонить
            </button>
          )}
        </div>
      </div>

      <div className="detail-grid">
        <div>
          {kata.Video_URL && <VideoEmbed url={kata.Video_URL} />}

          <div className="panel" style={{ marginTop: '1.2rem' }}>
            <h3>Описание</h3>
            <p style={{ whiteSpace: 'pre-wrap', color: 'var(--text-main)' }}>
              {kata.Description || 'Описание пока не добавлено.'}
            </p>
          </div>

          {/* ПОШАГОВАЯ ИНСТРУКЦИЯ С ФОКУСОМ НА 1 ШАГЕ И БОЛЬШИМ ОКНОМ */}
          {stepsCount > 0 && activeStep && (
            <div className="kata-step-viewer">
              <div className="kata-step-header">
                <div className="kata-step-title-group">
                  <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>🥋</span>
                    <span>Пошаговый канон</span>
                  </h3>
                  <span className="kata-step-num-badge">
                    Шаг {activeStep.Step_Number} из {stepsCount}
                  </span>
                </div>

                <span className="kata-step-view-btn active" style={{ cursor: 'default' }}>
                  🥋 3D Додзё Инспектор
                </span>
              </div>

              {/* БОЛЬШОЕ ВИЗУАЛЬНОЕ 3D ОКНО В ТРАДИЦИОННОМ ДОДЗЁ */}
              <div className="kata-step-media-window">
                <div className="kata-step-overlay-top">
                  <span className="kata-step-num-badge">
                    Шаг #{activeStep.Step_Number}
                  </span>
                  <div className="kata-step-badges-right">
                    {isKiai && (
                      <span style={{ fontSize: '0.8rem', padding: '4px 12px', borderRadius: 20, background: '#b91c1c', color: '#fff', fontWeight: 800, letterSpacing: '0.05em', boxShadow: '0 2px 10px rgba(185,28,28,0.6)' }}>
                        ⚡ КИАЙ
                      </span>
                    )}
                    {activeStep.Direction && (
                      <span style={{ fontSize: '0.8rem', padding: '4px 12px', borderRadius: 20, background: 'rgba(14, 14, 16, 0.85)', color: 'var(--color-gold)', border: '1px solid rgba(197, 155, 39, 0.4)', fontWeight: 600 }}>
                        🧭 {activeStep.Direction}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ width: '100%', height: '100%', flex: 1, minHeight: 640, position: 'relative' }}>
                  <KaratekaAvatar
                    height="100%"
                    initialStance={activeStance}
                    key={`main-${activeStepIdx}-${activeStance}`}
                  />
                </div>

                <div className="kata-step-overlay-bottom" style={{ pointerEvents: 'none', bottom: 82 }}>
                  <div>
                    <h4 className="kata-step-overlay-title">{activeStep.Title}</h4>
                    {activeStep.Technique && (
                      <div className="kata-step-overlay-tech">
                        🥋 {activeStep.Technique}
                      </div>
                    )}
                  </div>
                  {activeStep.Duration && (
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                      ⏱ ~{activeStep.Duration} сек
                    </span>
                  )}
                </div>
              </div>

              {/* ДЕТАЛЬНОЕ ОПИСАНИЕ И ИНСТРУКЦИЯ ТЕКУЩЕГО ШАГА */}
              <div className="kata-step-details-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ fontSize: '0.9rem', color: 'var(--color-gold)', fontWeight: 600 }}>
                    Каноническая техника: <span style={{ color: '#fff' }}>{activeStep.Technique || 'Базовая позиция'}</span>
                  </div>
                  {activeStep.Direction && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                      Линия перемещения: <strong style={{ color: 'var(--color-washi)' }}>{activeStep.Direction}</strong>
                    </div>
                  )}
                </div>
                {activeStep.Description && (
                  <p className="kata-step-desc-text">{activeStep.Description}</p>
                )}
              </div>

              {/* НАВИГАЦИЯ ПО ШАГАМ (ТОЛЬКО 1 ШАГ + ПЕРЕКЛЮЧАТЕЛЬ) */}
              <div className="kata-step-nav-bar">
                <button
                  className="kata-step-nav-btn"
                  onClick={goToPrevStep}
                  disabled={activeStepIdx === 0}
                >
                  ← Предыдущий шаг
                </button>

                {/* Лента номеров всех шагов для быстрого перехода */}
                <div className="kata-step-scrubber">
                  {kata.Steps.map((step, idx) => {
                    const stepKiai = step.Title?.includes('КИАЙ') || step.Technique?.includes('КИАЙ') || step.Description?.includes('КИАЙ');
                    return (
                      <button
                        key={step.Step_ID}
                        className={`kata-step-scrubber-dot ${idx === activeStepIdx ? 'active' : ''} ${stepKiai ? 'is-kiai' : ''}`}
                        onClick={() => setActiveStepIdx(idx)}
                        title={`Шаг ${step.Step_Number}: ${step.Title}`}
                      >
                        {step.Step_Number}
                      </button>
                    );
                  })}
                </div>

                <button
                  className={`kata-step-nav-btn ${activeStepIdx < stepsCount - 1 ? 'primary' : ''}`}
                  onClick={goToNextStep}
                  disabled={activeStepIdx === stepsCount - 1}
                >
                  {activeStepIdx === stepsCount - 1 ? 'Форма завершена ✔' : 'Следующий шаг →'}
                </button>
              </div>

              <div className="kata-step-keyboard-hint">
                💡 Подсказка: используйте клавиши <strong>←</strong> и <strong>→</strong> на клавиатуре для перехода между шагами
              </div>
            </div>
          )}

          {kata.RelatedBunkai?.length > 0 && (
            <div style={{ marginTop: '1.8rem' }}>
              <h3>Связанные бункаи (Боевые применения)</h3>
              <div className="grid grid-cards" style={{ marginTop: '0.8rem' }}>
                {kata.RelatedBunkai.map((b) => (
                  <Link key={b.Bunkai_ID} to={`/bunkai/${b.Bunkai_ID}`} className="card">
                    <div className="card__body">
                      <div className="card__title">{b.Title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-gold)', marginTop: 4 }}>
                        Смотреть 3D-разбор поединка →
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <Comments kataId={Number(id)} />
        </div>

        <aside>
          <div style={{ position: 'sticky', top: 20 }}>
            <div className="panel" style={{ padding: '1.1rem' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-gold)' }}>
                Каноническая стойка шага
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-washi)', marginTop: 4 }}>
                🥋 {activeStep?.Technique || 'Дзэнкуцу-дати'}
              </div>
              {activeStep?.Description && (
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: 8, lineHeight: 1.45 }}>
                  {activeStep.Description}
                </p>
              )}
            </div>

            {/* Компас направления эмбусэн */}
            {activeStep?.Direction && (
              <div className="panel" style={{ marginTop: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-gold)' }}>
                  Линия движения (Эмбусэн)
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-washi)', marginTop: 4 }}>
                  🧭 {activeStep.Direction}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                  Шаг {activeStep.Step_Number} из {stepsCount}: {activeStep.Title}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
