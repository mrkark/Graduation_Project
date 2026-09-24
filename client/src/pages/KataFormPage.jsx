import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getKata, createKata, updateKata } from '../api/kata';
import TechniquePicker from '../components/TechniquePicker';
import {
  SHOTOKAN_KATA_LIST,
  SHOTOKAN_DIRECTIONS,
  SHOTOKAN_MOVEMENT_TYPES,
} from '../data/shotokanTechniques';

const emptyStep = () => ({
  stepNumber: 1,
  title: '',
  description: '',
  technique: '',
  direction: 'Прямо вперед (0°)',
  movementType: 'linear',
});

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
    getKata(id).then((kata) => {
      setForm({
        title: kata.Title,
        description: kata.Description || '',
        difficulty: kata.Difficulty,
        style: kata.Style || 'Шотокан (松濤館流)',
        videoUrl: kata.Video_URL || '',
        thumbnailUrl: kata.Thumbnail_URL || '',
      });
      setSteps(
        (kata.Steps || []).map((s) => ({
          stepNumber: s.Step_Number,
          title: s.Title,
          description: s.Description || '',
          technique: s.Technique || '',
          direction: s.Direction || 'Прямо вперед (0°)',
          movementType: 'linear',
        }))
      );
      setLoading(false);
    });
  }, [id, isEdit]);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function updateStep(i, field, value) {
    setSteps((s) => s.map((step, idx) => (idx === i ? { ...step, [field]: value } : step)));
  }

  function addStep() {
    setSteps((s) => [...s, { ...emptyStep(), stepNumber: s.length + 1 }]);
  }

  function removeStep(i) {
    setSteps((s) => s.filter((_, idx) => idx !== i).map((step, idx) => ({ ...step, stepNumber: idx + 1 })));
  }

  // Быстрый выбор канонического ката Сётокан
  function onSelectCanonicalKata(k) {
    setForm((f) => ({
      ...f,
      title: `${k.name} (${k.kanji})`,
      difficulty: k.level,
      style: 'Шотокан (松濤館流)',
      description: `Традиционное ката стиля Сётокан каратэдо. Каноническое количество шагов: ${k.stepsCount}.`,
    }));
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
    setActivePickerIndex(null);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form, steps };
      const kata = isEdit ? await updateKata(id, payload) : await createKata(payload);
      navigate(`/kata/${kata.Kata_ID}`);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Не удалось сохранить ката');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="loading">Загрузка…</p>;

  return (
    <div style={{ maxWidth: 840, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.5rem' }}>
        <span className="hanko">松濤館</span>
        <h1>{isEdit ? 'Редактирование ката' : 'Новое ката Сётокан'}</h1>
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Материал будет отправлен на модерацию и появится в каталоге после одобрения инструктором.
      </p>

      {/* Быстрый выбор канонических ката Сётокан */}
      {!isEdit && (
        <div className="panel" style={{ marginBottom: '1.5rem', background: 'rgba(197, 160, 89, 0.04)' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--gold)', marginBottom: '0.6rem', fontWeight: 600 }}>
            Быстрый выбор из 26 канонических ката Сётокан:
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
          <input required value={form.title} onChange={update('title')} placeholder="Например: Хэйан Сёдан (平安初段)" />
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: 0 }}>Пошаговая структура ката</h3>
            <small style={{ color: 'var(--text-muted)' }}>
              Добавляйте стойки, блоки и удары с указанием направления и нелинейных траекторий
            </small>
          </div>
          <button type="button" className="btn btn-gold" onClick={addStep}>
            + Добавить шаг
          </button>
        </div>

        {steps.map((step, i) => (
          <div key={i} className="step-card" style={{ marginBottom: '1.2rem', padding: '1.1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <strong style={{ color: 'var(--gold-bright)' }}>Шаг {i + 1}</strong>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-gold"
                  style={{ fontSize: '0.78rem', padding: '0.3em 0.8em' }}
                  onClick={() => setActivePickerIndex(i)}
                >
                  📖 Выбрать технику из каталога Сётокан
                </button>
                <button type="button" className="btn btn-danger" onClick={() => removeStep(i)} title="Удалить шаг">
                  ✕
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
              <input
                style={{ flex: 2, minWidth: 200 }}
                required
                placeholder={`Название шага (например: Дзэнкуцу-дати, Гэдан-барай)`}
                value={step.title}
                onChange={(e) => updateStep(i, 'title', e.target.value)}
              />
              <input
                style={{ flex: 1, minWidth: 180 }}
                placeholder="Техника (Гэдан-барай)"
                value={step.technique}
                onChange={(e) => updateStep(i, 'technique', e.target.value)}
              />
            </div>

            {/* Траектория и нелинейный угол перемещения */}
            <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label style={{ fontSize: '0.75rem', marginBottom: '0.2rem' }}>Направление перемещения (угол)</label>
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

              <div style={{ flex: 1, minWidth: 180 }}>
                <label style={{ fontSize: '0.75rem', marginBottom: '0.2rem' }}>Тип траектории (Тай-сабаки)</label>
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
            {saving ? 'Сохранение…' : isEdit ? 'Обновить ката' : 'Создать ката Сётокан'}
          </button>
          <button type="button" className="btn" onClick={() => navigate(-1)} disabled={saving}>
            Отмена
          </button>
        </div>
      </form>

      {/* Модальное окно каталога техник Сётокан */}
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
