import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getKata, createKata, updateKata } from '../api/kata';
import TechniquePicker from '../components/TechniquePicker';
import { BookOpen, X, Sparkles, ArrowUp, ArrowDown, Plus } from 'lucide-react';
import {
  SHOTOKAN_KATA_LIST,
  SHOTOKAN_DIRECTIONS,
  SHOTOKAN_MOVEMENT_TYPES,
  SHOTOKAN_STANCES,
  normalizeDirectionLabel,
  directionToFacingDeg,
} from '../data/shotokanTechniques';
import { resolveKataSlug } from '../three/kataMotionUtils';
import { compileKataScenario } from '../three/kataCompositionEngine';

const emptyStep = (stepNumber = 1) => ({
  stepNumber,
  title: '',
  description: '',
  technique: '',
  stance: 'zenkutsu',
  direction: 'Прямо вперед (0°)',
  movementType: 'linear',
  duration: 2,
  kiai: false,
  rootRotationY: 0,
  facingDeg: 0,
  rootDisplacementX: 0,
  rootDisplacementZ: 0,
});

/**
 * Загружает и компилирует канонические шаги ката из /kata_data/*.json
 */
async function fetchCanonicalStepsForSlug(slug) {
  if (!slug) return null;
  try {
    const res = await fetch(`/kata_data/${slug}.json`);
    if (!res.ok) return null;
    const data = await res.json();
    const rawSteps = data.steps || data.events || [];
    if (rawSteps.length === 0) return null;

    const compiled = compileKataScenario(rawSteps, slug);
    if (!compiled.steps || compiled.steps.length === 0) return null;

    return compiled.steps.map((cs, idx) => ({
      stepNumber: cs.moveNumber || idx + 1,
      title: cs.title || `Шаг ${idx + 1}: ${cs.technique || 'Техника'}`,
      description: cs.note || cs.description || '',
      technique: cs.technique || cs.title || '',
      stance: cs.stance || 'zenkutsu',
      direction: normalizeDirectionLabel(cs.facingDeg !== undefined ? cs.facingDeg : 0),
      movementType: cs.pivotType === 'jump' ? 'tenshin' : 'linear',
      duration: cs.duration || 2,
      kiai: Boolean(cs.kiai || cs.title?.includes('КИАЙ')),
      rootRotationY: cs.facingDeg !== undefined ? cs.facingDeg : 0,
      facingDeg: cs.facingDeg !== undefined ? cs.facingDeg : 0,
      rootDisplacementX: cs.displacement ? cs.displacement[0] : 0,
      rootDisplacementZ: cs.displacement ? cs.displacement[2] : 0,
    }));
  } catch (err) {
    console.warn('[KataFormPage] Ошибка загрузки канонического JSON ката:', err);
    return null;
  }
}

export default function KataFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: '',
    description: '',
    difficulty: 'beginner',
    style: 'Шотокан (松濤館流)',
    videoUrl: '',
    thumbnailUrl: '',
  });
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Состояние модалки выбора техники для конкретного шага
  const [activePickerIndex, setActivePickerIndex] = useState(null);

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    getKata(id)
      .then(async (kata) => {
        setForm({
          title: kata.Title || '',
          description: kata.Description || '',
          difficulty: kata.Difficulty || 'beginner',
          style: kata.Style || 'Шотокан (松濤館流)',
          videoUrl: kata.Video_URL || '',
          thumbnailUrl: kata.Thumbnail_URL || '',
        });

        const slug = kata.Title ? resolveKataSlug(kata.Title) : null;
        let mapped = (kata.Steps || []).map((s, idx) => {
          const deg = s.Direction
            ? directionToFacingDeg(s.Direction)
            : (typeof s.Root_Rotation_Y === 'number' ? s.Root_Rotation_Y : 0);
          const dirLabel = s.Direction ? normalizeDirectionLabel(s.Direction) : normalizeDirectionLabel(deg);
          return {
            stepNumber: s.Step_Number || idx + 1,
            title: s.Title || `Шаг ${idx + 1}`,
            description: s.Description || '',
            technique: s.Technique || '',
            stance: s.Stance_Out || s.Stance_In || s.stance || 'zenkutsu',
            direction: dirLabel,
            movementType: s.movementType || 'linear',
            duration: Number(s.Duration) || 2,
            kiai: Boolean(s.kiai || s.Title?.includes('КИАЙ')),
            rootRotationY: deg,
            facingDeg: deg,
            rootDisplacementX: s.Root_Displacement_X || 0,
            rootDisplacementZ: s.Root_Displacement_Z || 0,
          };
        });

        // Если в БД шагов нет, автоматически подгружаем канонические шаги из 3D-библиотеки
        if (mapped.length === 0 && slug) {
          const canonical = await fetchCanonicalStepsForSlug(slug);
          if (canonical && canonical.length > 0) {
            mapped = canonical;
          }
        }

        setSteps(mapped);
      })
      .catch((err) => {
        setError(err.response?.data?.error?.message || 'Ошибка загрузки данных ката');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, isEdit]);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function updateStep(i, field, value) {
    setSteps((s) =>
      s.map((step, idx) => {
        if (idx !== i) return step;
        const updated = { ...step, [field]: value };
        if (field === 'direction') {
          const angle = directionToFacingDeg(value);
          updated.rootRotationY = angle;
          updated.facingDeg = angle;
        }
        return updated;
      })
    );
  }

  function addStep() {
    setSteps((s) => [...s, { ...emptyStep(), stepNumber: s.length + 1 }]);
  }

  function removeStep(i) {
    setSteps((s) => s.filter((_, idx) => idx !== i).map((step, idx) => ({ ...step, stepNumber: idx + 1 })));
  }

  function moveStepUp(i) {
    if (i <= 0) return;
    setSteps((prev) => {
      const copy = [...prev];
      const temp = copy[i];
      copy[i] = copy[i - 1];
      copy[i - 1] = temp;
      return copy.map((step, idx) => ({ ...step, stepNumber: idx + 1 }));
    });
  }

  function moveStepDown(i) {
    setSteps((prev) => {
      if (i >= prev.length - 1) return prev;
      const copy = [...prev];
      const temp = copy[i];
      copy[i] = copy[i + 1];
      copy[i + 1] = temp;
      return copy.map((step, idx) => ({ ...step, stepNumber: idx + 1 }));
    });
  }

  function insertStepAfter(i) {
    setSteps((prev) => {
      const copy = [...prev];
      copy.splice(i + 1, 0, { ...emptyStep(i + 2) });
      return copy.map((step, idx) => ({ ...step, stepNumber: idx + 1 }));
    });
  }

  // Быстрый выбор канонического ката Шотокан
  async function onSelectCanonicalKata(k) {
    const slug = k.id.replace(/-/g, '_');
    setForm((f) => ({
      ...f,
      title: `${k.name} (${k.kanji})`,
      difficulty: k.level,
      style: 'Шотокан (松濤館流)',
      description: `Традиционное ката стиля Шотокан каратэдо. Каноническое количество шагов: ${k.stepsCount}.`,
    }));

    const canonical = await fetchCanonicalStepsForSlug(slug);
    if (canonical && canonical.length > 0) {
      setSteps(canonical);
    }
  }

  // Ручная подгрузка / восстановление канонических шагов из 3D библиотеки
  async function handleLoadCanonicalSteps() {
    const slug = resolveKataSlug(form.title);
    if (!slug) {
      setError('Не удалось определить каноническое ката по названию');
      return;
    }
    setSaving(true);
    const canonical = await fetchCanonicalStepsForSlug(slug);
    setSaving(false);
    if (canonical && canonical.length > 0) {
      setSteps(canonical);
    } else {
      setError('Канонические шаги для данного ката не найдены в библиотеке');
    }
  }

  // При выборе техники из каталога подставляем в текущий шаг
  function handleTechniqueSelect(tech) {
    if (activePickerIndex === null) return;
    const currentStep = steps[activePickerIndex];
    const newTitle = currentStep.title
      ? `${currentStep.title} + ${tech.nameRu}`
      : `${tech.nameRu} (${tech.kanji})`;

    updateStep(activePickerIndex, 'title', newTitle);
    updateStep(activePickerIndex, 'technique', `${tech.nameRu} · ${tech.nameRomaji} [${tech.level}]`);
    if (!currentStep.description) {
      updateStep(activePickerIndex, 'description', tech.description);
    }
    const lower = (tech.nameRu || '').toLowerCase();
    if (lower.includes('сюто')) {
      updateStep(activePickerIndex, 'stance', 'kokutsu');
    } else if (lower.includes('киба')) {
      updateStep(activePickerIndex, 'stance', 'kiba');
    }
    setActivePickerIndex(null);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payloadSteps = steps.map((s, idx) => {
        const angle =
          s.rootRotationY !== undefined
            ? s.rootRotationY
            : (s.facingDeg !== undefined ? s.facingDeg : directionToFacingDeg(s.direction));

        const isKiai = Boolean(s.kiai || s.title?.includes('КИАЙ'));
        let stepTitle = s.title?.trim() || `Шаг ${idx + 1}`;
        if (isKiai && !stepTitle.includes('КИАЙ')) {
          stepTitle = `${stepTitle} [КИАЙ]`;
        } else if (!isKiai && stepTitle.includes(' [КИАЙ]')) {
          stepTitle = stepTitle.replace(' [КИАЙ]', '').trim();
        }

        return {
          stepNumber: idx + 1,
          title: stepTitle,
          description: s.description || '',
          technique: s.technique || '',
          stanceIn: idx === 0 ? 'heisoku' : (steps[idx - 1]?.stance || 'zenkutsu'),
          stanceOut: s.stance || 'zenkutsu',
          direction: s.direction || 'Прямо вперед (0°)',
          movementType: s.movementType || 'linear',
          duration: Number(s.duration) || 2,
          rootRotationY: angle,
          rootDisplacementX: s.rootDisplacementX || 0,
          rootDisplacementZ: s.rootDisplacementZ || 0,
        };
      });

      const payload = {
        title: form.title?.trim(),
        description: form.description?.trim() || null,
        difficulty: form.difficulty || 'beginner',
        style: form.style?.trim() || null,
        videoUrl: form.videoUrl?.trim() || null,
        thumbnailUrl: form.thumbnailUrl?.trim() || null,
        steps: payloadSteps,
      };
      const kata = isEdit ? await updateKata(id, payload) : await createKata(payload);
      navigate(`/kata/${kata.Kata_ID}`);
    } catch (err) {
      const apiErr = err.response?.data?.error;
      if (apiErr?.details && Array.isArray(apiErr.details) && apiErr.details.length > 0) {
        const detailList = apiErr.details.map((d) => d.msg || `${d.path}: некорректное значение`).filter(Boolean);
        setError(detailList.length > 0 ? detailList.join('. ') : apiErr.message);
      } else {
        setError(apiErr?.message || 'Не удалось сохранить ката');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="loading">Загрузка…</p>;

  return (
    <div style={{ maxWidth: 840, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.5rem' }}>
        <span className="hanko">松濤館</span>
        <h1>{isEdit ? 'Редактирование ката' : 'Новое ката Шотокан'}</h1>
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Материал будет отправлен на модерацию и появится в каталоге после одобрения инструктором.
      </p>

      {/* Быстрый выбор канонических ката Шотокан */}
      {!isEdit && (
        <div className="panel" style={{ marginBottom: '1.5rem', background: 'rgba(197, 160, 89, 0.04)' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--gold)', marginBottom: '0.6rem', fontWeight: 600 }}>
            Быстрый выбор из 26 канонических ката Шотокан:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {SHOTOKAN_KATA_LIST.map((k) => (
              <button
                key={k.id}
                type="button"
                className="btn"
                style={{ fontSize: '0.78rem', padding: '0.3em 0.7em' }}
                onClick={() => onSelectCanonicalKata(k)}
              >
                {k.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="panel">
        <div className="field">
          <label>Название ката *</label>
          <input required value={form.title} onChange={update('title')} placeholder="Например: Хэйан Шодан (平安初段)" />
        </div>

        <div className="field">
          <label>Описание и тактическое назначение</label>
          <textarea rows={4} value={form.description} onChange={update('description')} placeholder="Опишите характер ката, ключевой ритм и акценты силы (кимэ)..." />
        </div>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1, minWidth: 180 }}>
            <label>Сложность</label>
            <select value={form.difficulty} onChange={update('difficulty')}>
              <option value="beginner">Начальный (Хэйан 1-3)</option>
              <option value="intermediate">Средний (Хэйан 4-5, Тэкки 1)</option>
              <option value="advanced">Продвинутый (Бассай, Канку, Дзион)</option>
              <option value="master">Мастер (Сотин, Ганкаку, Унсу)</option>
            </select>
          </div>

          <div className="field" style={{ flex: 1, minWidth: 180 }}>
            <label>Стиль каратэдо</label>
            <input value={form.style} onChange={update('style')} placeholder="Шотокан (松濤館流)" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1, minWidth: 220 }}>
            <label>Ссылка на видео (YouTube / mp4)</label>
            <input value={form.videoUrl} onChange={update('videoUrl')} placeholder="https://youtube.com/watch?v=…" />
          </div>

          <div className="field" style={{ flex: 1, minWidth: 220 }}>
            <label>Ссылка на превью</label>
            <input value={form.thumbnailUrl} onChange={update('thumbnailUrl')} placeholder="https://…" />
          </div>
        </div>

        <hr className="divider" />

        {/* Секция шагов ката */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.8rem' }}>
          <div>
            <h3 style={{ margin: 0 }}>Пошаговая структура ката ({steps.length})</h3>
            <small style={{ color: 'var(--text-muted)' }}>
              Добавляйте стойки, блоки и удары с указанием направления и нелинейных траекторий
            </small>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {form.title && (
              <button
                type="button"
                className="btn btn-subtle"
                onClick={handleLoadCanonicalSteps}
                title="Загрузить официальные шаги Шотокан из 3D библиотеки"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem' }}
              >
                <Sparkles size={14} /> Канонические шаги (3D)
              </button>
            )}
            <button type="button" className="btn btn-gold" onClick={addStep}>
              + Добавить шаг
            </button>
          </div>
        </div>

        {steps.map((step, i) => (
          <div
            key={i}
            className="step-card"
            style={{
              marginBottom: '1.2rem',
              padding: '1.1rem',
              borderLeft: step.kiai ? '4px solid #ef4444' : '4px solid var(--gold, #c5a059)',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '6px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <strong style={{ color: 'var(--gold-bright, #e6ca85)', fontSize: '1.05rem' }}>Шаг {i + 1}</strong>
                {step.kiai && (
                  <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.72rem', fontWeight: 700, padding: '2px 7px', borderRadius: '4px' }}>
                    気合 КИАЙ
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-subtle"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => moveStepUp(i)}
                  disabled={i === 0}
                  title="Поднять шаг выше"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  className="btn btn-subtle"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => moveStepDown(i)}
                  disabled={i === steps.length - 1}
                  title="Опустить шаг ниже"
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  className="btn btn-subtle"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => insertStepAfter(i)}
                  title="Вставить новый шаг после этого"
                >
                  <Plus size={14} /> Вставить шаг
                </button>
                <button
                  type="button"
                  className="btn btn-gold"
                  style={{ fontSize: '0.78rem', padding: '0.3em 0.8em' }}
                  onClick={() => setActivePickerIndex(i)}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <BookOpen size={13} /> Каталог техник
                  </span>
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => removeStep(i)}
                  title="Удалить шаг"
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px 8px' }}
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Ряд 1: Название, Техника, Стойка */}
            <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', marginBottom: '0.7rem' }}>
              <div style={{ flex: 2, minWidth: 200 }}>
                <label style={{ fontSize: '0.75rem', marginBottom: '0.2rem', display: 'block', color: 'var(--text-muted)' }}>
                  Название шага
                </label>
                <input
                  required
                  placeholder="Например: Дзэнкуцу-дати, Гэдан-барай"
                  value={step.title}
                  onChange={(e) => updateStep(i, 'title', e.target.value)}
                />
              </div>
              <div style={{ flex: 2, minWidth: 180 }}>
                <label style={{ fontSize: '0.75rem', marginBottom: '0.2rem', display: 'block', color: 'var(--text-muted)' }}>
                  Техника Шотокан
                </label>
                <input
                  placeholder="Гэдан-барай, Ой-цуки, Сюто-укэ..."
                  value={step.technique}
                  onChange={(e) => updateStep(i, 'technique', e.target.value)}
                />
              </div>
              <div style={{ flex: 1.5, minWidth: 180 }}>
                <label style={{ fontSize: '0.75rem', marginBottom: '0.2rem', display: 'block', color: 'var(--text-muted)' }}>
                  Стойка (Дати)
                </label>
                <select
                  value={step.stance || 'zenkutsu'}
                  onChange={(e) => updateStep(i, 'stance', e.target.value)}
                >
                  {SHOTOKAN_STANCES.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.label} [{st.kanji}]
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Ряд 2: Направление, Длительность, КИАЙ, Тип траектории */}
            <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '0.7rem' }}>
              <div style={{ flex: 2, minWidth: 180 }}>
                <label style={{ fontSize: '0.75rem', marginBottom: '0.2rem', display: 'block', color: 'var(--text-muted)' }}>
                  Направление (угол поворота)
                </label>
                <select
                  value={step.direction}
                  onChange={(e) => updateStep(i, 'direction', e.target.value)}
                >
                  {SHOTOKAN_DIRECTIONS.map((dir) => (
                    <option key={dir.angle} value={dir.label}>
                      {dir.label} [{dir.kanji}]
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ width: 120 }}>
                <label style={{ fontSize: '0.75rem', marginBottom: '0.2rem', display: 'block', color: 'var(--text-muted)' }}>
                  Длительность (с)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="10"
                  value={step.duration || 2}
                  onChange={(e) => updateStep(i, 'duration', parseFloat(e.target.value) || 2)}
                />
              </div>

              <div style={{ paddingBottom: '0.55rem', minWidth: 130 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: step.kiai ? '#ef4444' : 'inherit' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(step.kiai)}
                    onChange={(e) => updateStep(i, 'kiai', e.target.checked)}
                  />
                  КИАЙ! (気合)
                </label>
              </div>

              <div style={{ flex: 1.5, minWidth: 180 }}>
                <label style={{ fontSize: '0.75rem', marginBottom: '0.2rem', display: 'block', color: 'var(--text-muted)' }}>
                  Тип траектории (Тай-сабаки)
                </label>
                <select
                  value={step.movementType || 'linear'}
                  onChange={(e) => updateStep(i, 'movementType', e.target.value)}
                >
                  {SHOTOKAN_MOVEMENT_TYPES.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Ряд 3: Наставление и биомеханика */}
            <div>
              <textarea
                rows={2}
                placeholder="Детальное описание биомеханики шага (акцент бедер, распределение веса, направление взгляда)..."
                value={step.description}
                onChange={(e) => updateStep(i, 'description', e.target.value)}
              />
            </div>
          </div>
        ))}
        {steps.length === 0 && (
          <div className="empty-state" style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.2)' }}>
            <p style={{ margin: 0 }}>Шаги ещё не добавлены. Нажмите «+ Добавить шаг» или выберите каноническое ката выше.</p>
          </div>
        )}

        {error && <p className="error-text" style={{ marginTop: '1rem' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.8rem' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Сохранение…' : isEdit ? 'Обновить ката' : 'Создать ката Шотокан'}
          </button>
          <button type="button" className="btn" onClick={() => navigate(-1)} disabled={saving}>
            Отмена
          </button>
        </div>
      </form>

      {/* Модальное окно каталога техник Шотокан */}
      {activePickerIndex !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(6px)',
            zIndex: 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
          onClick={() => setActivePickerIndex(null)}
        >
          <div
            style={{ width: '100%', maxWidth: 880 }}
            onClick={(e) => e.stopPropagation()}
          >
            <TechniquePicker
              onSelect={handleTechniqueSelect}
              onCancel={() => setActivePickerIndex(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
