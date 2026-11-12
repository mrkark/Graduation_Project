import { useEffect, useState, useMemo, lazy, Suspense } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getKata, deleteKata, approveKata, rejectKata } from '../api/kata';
import { useAuthStore } from '../store/authStore';
import { useFavoritesStore } from '../store/favoritesStore';
import StatusBadge from '../components/StatusBadge';
import VideoEmbed from '../components/VideoEmbed';
import Comments from '../components/Comments';
import LazySection from '../components/ui/LazySection';
import { resolveKataSlug } from '../three/kataMotionUtils';
import { directionToFacingDeg, normalizeDirectionLabel } from '../data/shotokanTechniques';
import { HankoSeal, ShotokanTiger } from '../components/ui/JapaneseDecor';
import { Heart, Check, Edit3 } from 'lucide-react';
import './KataDetailPage.css';

// Динамическая отложенная загрузка тяжелого 3D секвенсора (оптимизация загрузки страниц)
const KataSequencer = lazy(() => import('../three/KataSequencer'));

const DIFFICULTY_LABELS = {
  beginner: 'Начальный уровень (Шодан · 9–7 Кю)',
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

  // Канонические шаги из JSON / БД с безусловным сохранением пользовательских правок углов и техник
  // и гарантированным включением стойки Йой (в начале и в конце ката)
  const effectiveSteps = useMemo(() => {
    if (!kata) return [];
    const rawDb = kata.Steps || [];
    const rawJson = kataJsonData?.steps || kataJsonData?.events || [];

    if (rawDb.length === 0 && rawJson.length === 0) return [];

    // Функция проверки, является ли шаг стойкой готовности Йой
    const isYoiObj = (s) =>
      Boolean(
        s?.isYoi ||
        s?.isYoiStart ||
        s?.isYoiEnd ||
        s?.part === 'ready' ||
        s?.part === 'finish' ||
        s?.Step_Number === 0 ||
        s?.n === 0 ||
        (s?.stance === 'ready' && s?.Technique && s.Technique.toLowerCase().includes('йой')) ||
        (s?.stance === 'ready' && s?.technique && s.technique.toLowerCase().includes('йой'))
      );

    // Извлекаем только техники ката (отфильтровывая возможные дубликаты Йой)
    const dbTechniques = rawDb.filter((s) => !isYoiObj(s));
    const jsonTechniques = rawJson.filter((s) => !isYoiObj(s));
    const techCount = Math.max(dbTechniques.length, jsonTechniques.length);

    // Находим метаданные Йой (если они были в JSON)
    const existingStartJson = rawJson.find((s) => s.isYoiStart || s.n === 0 || s.moveNumber === 0 || (s.isYoi && s.part === 'ready'));
    const existingEndJson = rawJson.find((s) => s.isYoiEnd || s.part === 'finish' || (s.isYoi && s.moveNumber > 1));

    const middleSteps = [];
    for (let idx = 0; idx < techCount; idx++) {
      const existing = dbTechniques[idx];
      const ev = jsonTechniques[idx];
      const moveNum = idx + 1;

      // Канонический угол из статического JSON ката
      const canonicalFacing = ev?.facingDeg !== undefined ? ev.facingDeg : 0;

      // Пользовательский угол из базы данных:
      // Приоритет у Direction (выбранного пользователем в редакторе формы)
      let userFacingDeg = undefined;
      if (existing?.Direction) {
        userFacingDeg = directionToFacingDeg(existing.Direction);
      } else if (typeof existing?.Root_Rotation_Y === 'number' && existing.Root_Rotation_Y !== 0) {
        userFacingDeg = existing.Root_Rotation_Y;
      }

      // Проверяем, отличается ли угол от канонического в JSON
      const isCustomAngle = userFacingDeg !== undefined && ev?.facingDeg !== undefined && userFacingDeg !== canonicalFacing;
      const finalFacingDeg = userFacingDeg !== undefined ? userFacingDeg : canonicalFacing;
      const finalDirection = existing?.Direction || normalizeDirectionLabel(finalFacingDeg);

      let techniqueName = existing?.Technique ||
        (Array.isArray(ev?.techniques) ? ev.techniques.join(', ') : ev?.technique) ||
        (ev?.stance ? `Стойка ${ev.stance}` : 'Каноническая техника');

      if (!existing?.Technique) {
        if (moveNum === 4 || ev?.T?.includes('tettsui')) {
          techniqueName = 'Тэцуи-ути (Стойка Мото-дати)';
        } else if (moveNum === 18) {
          techniqueName = 'Сюто-укэ (Разворот на 90° влево в стойку Кокуцу-дати)';
        }
      }

      const isCustomTech = Boolean(existing?.Technique && ev?.technique && !ev.technique.toLowerCase().includes(existing.Technique.toLowerCase().slice(0, 5)));
      const isCustomStance = Boolean(existing?.Stance_Out && ev?.stance && existing.Stance_Out.toLowerCase() !== ev.stance.toLowerCase());
      const isCustomStep = isCustomAngle || isCustomTech || isCustomStance;

      middleSteps.push({
        ...(ev || {}),
        ...(existing || {}),
        isYoi: false,
        techniqueNumber: moveNum,
        Step_Number: moveNum,
        stepNumber: moveNum,
        Title: existing?.Title || `Шаг ${moveNum}: ${techniqueName}${ev?.kiai ? ' [КИАЙ]' : ''}`,
        Technique: techniqueName,
        technique: techniqueName,
        Direction: finalDirection,
        direction: finalDirection,
        Duration: existing?.Duration || (ev?.endTime && ev?.startTime ? +(ev.endTime - ev.startTime).toFixed(2) : 2),
        duration: existing?.Duration || (ev?.endTime && ev?.startTime ? +(ev.endTime - ev.startTime).toFixed(2) : 2),
        stance: existing?.Stance_Out || existing?.stance || ev?.stance || ev?.form || 'zenkutsu',
        kiai: Boolean(existing?.kiai || ev?.kiai || existing?.Title?.includes('КИАЙ')),
        facingDeg: finalFacingDeg,
        targetFacingDeg: finalFacingDeg,
        Root_Rotation_Y: finalFacingDeg,
        rootRotationY: finalFacingDeg,
        // Если угол изменен пользователем, обнуляем R, чтобы относительный код поворота не перетирал точный угол
        R: isCustomAngle ? null : (ev?.R || null),
        isCustomDirection: isCustomAngle,
        isCustomStep,
        T: isCustomTech ? null : (ev?.T || existing?.T),
        S: isCustomStance ? null : (ev?.S || existing?.S),
        scale: ev?.scale || existing?.scale || 1.0,
      });
    }

    const isHs = kataSlug === 'heian_shodan';

    // Шаг стойки Йой в начале ката
    const yoiStartStep = {
      ...(existingStartJson || {}),
      isYoi: true,
      isYoiStart: true,
      techniqueNumber: 0,
      Step_Number: 0,
      stepNumber: 0,
      moveNumber: 0,
      Title: 'Начало формы — Сидзэнтай',
      Technique: 'Начало формы (Сидзэнтай)',
      technique: 'Начало формы (Сидзэнтай)',
      Direction: 'Прямо вперед (0°)',
      direction: 'Прямо вперед (0°)',
      Duration: existingStartJson?.duration || (isHs ? 1.30 : 2.0),
      duration: existingStartJson?.duration || (isHs ? 1.30 : 2.0),
      stance: 'ready',
      kiai: false,
      facingDeg: 0,
      targetFacingDeg: 0,
      Root_Rotation_Y: 0,
      rootRotationY: 0,
      R: null,
      T: 'T_ready',
      S: 'S_ready',
      clipName: 'idle_shizentai',
      fallbackClipName: 'stance_ready',
      startTime: 0.0,
      endTime: existingStartJson?.endTime || (isHs ? 1.30 : 2.0),
      mocapStartTime: 0.0,
      mocapEndTime: isHs ? 1.30 : 2.0,
      Description: 'Начало формы: исходная стойка Сидзэнтай (Хатидзи-дати). Взгляд вперед, дыхание спокойное, концентрация внимания (дзансин) перед выполнением формы.',
      note: 'Начало формы: исходная стойка Сидзэнтай. Концентрация внимания (дзансин).',
    };

    // Шаг стойки Йой в конце ката
    const lastMid = middleSteps[middleSteps.length - 1];
    const lastEndTime = lastMid?.endTime || (isHs ? 27.63 : 28.0);
    const endDuration = isHs ? 1.90 : 2.0;
    const finalEndTime = isHs ? 29.53 : +(lastEndTime + endDuration).toFixed(2);

    const yoiEndStep = {
      ...(existingEndJson || {}),
      isYoi: true,
      isYoiEnd: true,
      techniqueNumber: techCount + 1,
      Step_Number: techCount + 1,
      stepNumber: techCount + 1,
      moveNumber: techCount + 1,
      Title: 'Завершение формы — Сидзэнтай',
      Technique: 'Завершение формы (Сидзэнтай)',
      technique: 'Завершение формы (Сидзэнтай)',
      Direction: 'Прямо вперед (0°)',
      direction: 'Прямо вперед (0°)',
      Duration: existingEndJson?.duration || endDuration,
      duration: existingEndJson?.duration || endDuration,
      stance: 'ready',
      kiai: false,
      facingDeg: 0,
      targetFacingDeg: 0,
      Root_Rotation_Y: 0,
      rootRotationY: 0,
      R: null,
      T: 'T_ready',
      S: 'S_ready',
      clipName: 'idle_shizentai',
      fallbackClipName: 'stance_ready',
      startTime: lastEndTime,
      endTime: finalEndTime,
      mocapStartTime: 27.63,
      mocapEndTime: 29.53,
      Description: 'Завершение формы: возвращение передней ноги на центральную линию, выход в стойку Сидзэнтай, поклон (рэй) и фиксация состояния дзансин.',
      note: 'Завершение формы: возвращение на центральную линию, стойка Сидзэнтай, поклон (рэй) и дзансин.',
    };

    return [yoiStartStep, ...middleSteps, yoiEndStep];
  }, [kata, kataJsonData, kataSlug]);

  const stepsCount = effectiveSteps.length;
  const techniqueCount = useMemo(() => effectiveSteps.filter((s) => !s.isYoi).length, [effectiveSteps]);
  const activeStep = effectiveSteps[activeStepIdx] || effectiveSteps[0] || null;
  const isKiai = Boolean(activeStep?.kiai || activeStep?.Title?.includes('КИАЙ'));

  const stanceKey = (activeStep?.stance || 'zenkutsu').toLowerCase().split('_')[0];
  const stanceKanjiChar = STANCE_KANJI[stanceKey] || '構';

  const isOwner = kata?.Author_ID === user?.User_ID;
  const isStaff = role === 'admin' || role === 'moderator';
  const canEdit = isOwner || isStaff || Boolean(user);

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
              {techniqueCount} движений (+ начало и завершение)
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
              {isKataFavorite(id) ? <><Heart size={15} fill='#ef4444' color='#ef4444' style={{ marginRight: '6px' }} /> В избранном</> : <><Heart size={15} color='#f3f4f6' strokeWidth={2} style={{ marginRight: '6px' }} /> В избранное</>}
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
            <Link to={`/kata/${id}/edit`} className="btn btn-gold" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
              <Edit3 size={15} /> Редактировать ката
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

      {/* 2. ЦЕНТРАЛЬНАЯ 3D АРЕНА БИОМЕХАНИКИ КАТА */}
      <section className="kata-study__stage-wrap">
        <div className="kata-study__stage-frame-header">
          <div className="kata-study__stage-badge">
            <ShotokanTiger size={18} color="var(--gold)" />
            <span>3D АРЕНА ДОДЗЁ · ШОТОКАН КАРАТЭДО</span>
          </div>

          <span className="kata-study__stage-slug">
            {kataSlug ? kataSlug.toUpperCase() : 'KATA'}
          </span>
        </div>

        <div className="kata-study__canvas-container">
          <Suspense
            fallback={
              <div
                style={{
                  height: 560,
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
                  Инициализация 3D сцены Додзё и кинематики ката…
                </p>
              </div>
            }
          >
            <KataSequencer
              kataTitle={kata.Title}
              steps={effectiveSteps}
              height={560}
              activeStepIndex={activeStepIdx}
              onStepChange={setActiveStepIdx}
            />
          </Suspense>
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
              {activeStep?.isYoiStart ? (
                <span className="kata-yoi-badge">Начало формы</span>
              ) : activeStep?.isYoiEnd ? (
                <span className="kata-yoi-badge">Завершение формы</span>
              ) : (
                <span>Шаг {activeStep?.techniqueNumber || activeStep?.moveNumber || activeStepIdx} из {techniqueCount}</span>
              )}
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
              {canEdit && (
                <>
                  <span className="kata-stance-sep">·</span>
                  <Link to={`/kata/${id}/edit`} className="kata-direction-pill" style={{ color: 'var(--gold)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }} title="Нажмите для редактирования этого шага">
                    <Edit3 size={12} /> Редактировать
                  </Link>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary kata-stepper__nav-btn"
            onClick={() => setActiveStepIdx((prev) => Math.min(stepsCount - 1, prev + 1))}
            disabled={activeStepIdx === stepsCount - 1}
          >
            {activeStepIdx === stepsCount - 1 ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>Завершено <Check size={14} /></span> : 'След. шаг →'}
          </button>
        </div>

        {/* Минималистичная лента точек шагов */}
        <div className="kata-dots-track">
          {effectiveSteps.map((step, idx) => {
            const stepKiai = step.Title?.includes('КИАЙ') || step.Technique?.includes('КИАЙ') || step.kiai;
            const isActive = idx === activeStepIdx;
            const isYoi = Boolean(step.isYoi || step.isYoiStart || step.isYoiEnd);
            let dotLabel = `${idx + 1}`;
            if (step.isYoiStart) dotLabel = 'Нач';
            else if (step.isYoiEnd) dotLabel = 'Кон';
            else if (step.techniqueNumber !== undefined) dotLabel = `${step.techniqueNumber}`;

            return (
              <button
                key={idx}
                type="button"
                className={`kata-dot-btn ${isActive ? 'active' : ''} ${stepKiai ? 'kiai' : ''} ${isYoi ? 'yoi' : ''}`}
                onClick={() => setActiveStepIdx(idx)}
                title={step.Title || step.Technique}
              >
                {dotLabel}
              </button>
            );
          })}
        </div>
      </section>

      {/* 4. ПРОГРЕССИВНОЕ РАСКРЫТИЕ ДОПОЛНИТЕЛЬНОЙ ИНФОРМАЦИИ (ДЭНСЁ) */}
      <LazySection minHeight="320px" rootMargin="250px">
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
                    <h4>
                      {activeStep.isYoiStart
                        ? 'Нюанс начала формы:'
                        : activeStep.isYoiEnd
                        ? 'Нюанс завершения формы:'
                        : `Нюанс шага #${activeStep.techniqueNumber || activeStepIdx}:`}
                    </h4>
                    <p style={{ margin: 0 }}>{activeStep.Description}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'video' && kata.Video_URL && (
            <div className="kata-video-wrap">
              <VideoEmbed
                url={kata.Video_URL}
                title={kata.Title}
                masterName="Шеф-инструктор Масао Кагава (9 Дан) · Сборная JKS"
                autoLoad={true}
              />
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
      </LazySection>
    </div>
  );
}
