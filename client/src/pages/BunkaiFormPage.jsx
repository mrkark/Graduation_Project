import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getBunkai, createBunkai, updateBunkai } from '../api/bunkai';
import { listKata } from '../api/kata';
import TechniquePicker from '../components/TechniquePicker';
import { SHOTOKAN_DIRECTIONS, SHOTOKAN_MOVEMENT_TYPES } from '../data/shotokanTechniques';

const emptyEpisode = () => ({
  attacker: 'Укэ 1 (фронтальный)',
  attackAngle: 'Прямо вперед (0°)',
  attackTechnique: 'Ой-цуки тюдан (прямой выпад кулаком)',
  toriMovement: 'Круговой уход с линии атаки (Тэнсин)',
  toriCounter: 'Сюто-укэ + залом запястья + контратака Гяку-цуки',
  outcome: 'Выведение из равновесия и сваливание на татами (Кудзуси)',
});

export default function BunkaiFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = !!id;
  const navigate = useNavigate();

  const [form, setForm] = useState({
    kataId: searchParams.get('kataId') || '',
    title: '',
    description: '',
    application: '',
    difficulty: 'beginner',
    videoUrl: '',
    thumbnailUrl: '',
  });

  // Формат бункая: дуэт (2 человека) или соревновательный командный (3 человека)
  const [participantMode, setParticipantMode] = useState('2-person'); // '2-person' | '3-person'
  const [episodes, setEpisodes] = useState([emptyEpisode()]);

  const [kataOptions, setKataOptions] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Состояние пикера техник: { episodeIndex, targetField: 'attack' | 'counter' }
  const [pickerTarget, setPickerTarget] = useState(null);

  useEffect(() => {
    listKata({ pageSize: 100, sort: 'title' }).then((res) => setKataOptions(res.data));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    getBunkai(id).then((b) => {
      setForm({
        kataId: b.Kata_ID,
        title: b.Title,
        description: b.Description || '',
        application: b.Application || '',
        difficulty: b.Difficulty,
        videoUrl: b.Video_URL || '',
        thumbnailUrl: b.Thumbnail_URL || '',
      });
      setLoading(false);
    });
  }, [id, isEdit]);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function updateEpisode(index, field, value) {
    setEpisodes((prev) =>
      prev.map((ep, idx) => (idx === index ? { ...ep, [field]: value } : ep))
    );
  }

  function addEpisode() {
    setEpisodes((prev) => [
      ...prev,
      {
        ...emptyEpisode(),
        attacker: participantMode === '3-person' && prev.length % 2 !== 0 ? 'Укэ 2 (фланговый)' : 'Укэ 1 (фронтальный)',
      },
    ]);
  }

  function removeEpisode(index) {
    setEpisodes((prev) => prev.filter((_, idx) => idx !== index));
  }

  function handleTechniquePicked(tech) {
    if (!pickerTarget) return;
    const { index, field } = pickerTarget;
    if (field === 'attack') {
      updateEpisode(index, 'attackTechnique', `${tech.nameRu} (${tech.kanji}) · ${tech.level}`);
    } else {
      updateEpisode(index, 'toriCounter', `${tech.nameRu} (${tech.kanji}) · ${tech.description}`);
    }
    setPickerTarget(null);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // Формируем структурированный текст боевого применения
    const modeLabel =
      participantMode === '3-person'
        ? '🏆 Соревновательный командный бункай (3 участника: Тори + Укэ 1 + Укэ 2)'
        : '🥋 Традиционный парный бункай (2 участника: Тори + Укэ)';

    let formattedApplication = `${modeLabel}\n\n`;
    episodes.forEach((ep, i) => {
      formattedApplication += `[Эпизод ${i + 1}]\n`;
      formattedApplication += `• Атакующий: ${ep.attacker} под углом ${ep.attackAngle}\n`;
      formattedApplication += `• Атака противника: ${ep.attackTechnique}\n`;
      formattedApplication += `• Траектория Тори: ${ep.toriMovement}\n`;
      formattedApplication += `• Защита и контратака: ${ep.toriCounter}\n`;
      formattedApplication += `• Итог: ${ep.outcome}\n\n`;
    });

    if (form.application.trim()) {
      formattedApplication += `Дополнительные примечания:\n${form.application}`;
    }

    try {
      const payload = {
        ...form,
        kataId: Number(form.kataId),
        application: formattedApplication,
      };
      const bunkai = isEdit ? await updateBunkai(id, payload) : await createBunkai(payload);
      navigate(`/bunkai/${bunkai.Bunkai_ID}`);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Не удалось сохранить бункай');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="loading">Загрузка…</p>;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.5rem' }}>
        <span className="hanko">分解</span>
        <h1>{isEdit ? 'Редактирование бункая' : 'Новый бункай Сётокан'}</h1>
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Разбор боевого применения движений ката. Учитывайте количество атакующих и траектории смещения.
      </p>

      <form onSubmit={onSubmit} className="panel">
        <div className="field">
          <label>Связанное ката Сётокан *</label>
          <select required value={form.kataId} onChange={update('kataId')} disabled={isEdit}>
            <option value="">Выберите ката из списка…</option>
            {kataOptions.map((k) => (
              <option key={k.Kata_ID} value={k.Kata_ID}>
                {k.Title} {k.Style ? `(${k.Style})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Название разбора бункая *</label>
          <input
            required
            value={form.title}
            onChange={update('title')}
            placeholder="Например: Разбор начальной связки Хэйан Сёдан против захвата и удара"
          />
        </div>

        <div className="field">
          <label>Общая концепция и тактический сценарий</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={update('description')}
            placeholder="Опишите контекст ситуации (нападение на улице, захват за отвороты, неожиданная атака с фланга)..."
          />
        </div>

        {/* ВЫБОР ФОРМАТА УЧАСТНИКОВ: 2 ИЛИ 3 ЧЕЛОВЕКА */}
        <div className="field">
          <label style={{ color: 'var(--gold)' }}>Формат участников бункая</label>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <label
              style={{
                flex: 1,
                minWidth: 240,
                display: 'flex',
                alignItems: 'center',
                gap: '0.7rem',
                background: participantMode === '2-person' ? 'rgba(197, 160, 89, 0.15)' : 'rgba(0,0,0,0.3)',
                border: `1px solid ${participantMode === '2-person' ? 'var(--gold)' : 'var(--border)'}`,
                padding: '0.8rem 1rem',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="mode"
                checked={participantMode === '2-person'}
                onChange={() => setParticipantMode('2-person')}
                style={{ width: 'auto', margin: 0 }}
              />
              <div>
                <strong style={{ color: '#fff' }}>2 участника (Дуэт)</strong>
                <div style={{ fontSize: '0.76rem', color: 'var(--washi-dim)' }}>
                  Тори (обороняющийся) + Укэ (нападающий)
                </div>
              </div>
            </label>

            <label
              style={{
                flex: 1,
                minWidth: 240,
                display: 'flex',
                alignItems: 'center',
                gap: '0.7rem',
                background: participantMode === '3-person' ? 'rgba(191, 38, 38, 0.18)' : 'rgba(0,0,0,0.3)',
                border: `1px solid ${participantMode === '3-person' ? 'var(--crimson-bright)' : 'var(--border)'}`,
                padding: '0.8rem 1rem',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="mode"
                checked={participantMode === '3-person'}
                onChange={() => setParticipantMode('3-person')}
                style={{ width: 'auto', margin: 0 }}
              />
              <div>
                <strong style={{ color: '#fff' }}>3 участника (Соревновательный)</strong>
                <div style={{ fontSize: '0.76rem', color: 'var(--washi-dim)' }}>
                  Тори + Укэ 1 (фронт) + Укэ 2 (фланг/спина)
                </div>
              </div>
            </label>
          </div>
        </div>

        <hr className="divider" />

        {/* ПОШАГОВЫЙ КОНСТРУКТОР БОЕВЫХ ЭПИЗОДОВ */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: 0 }}>Боевая цепочка бункая</h3>
            <small style={{ color: 'var(--text-muted)' }}>
              Нелинейные углы атаки, уход с линии (Тэнсин) и приемы Тори
            </small>
          </div>
          <button type="button" className="btn btn-gold" onClick={addEpisode}>
            + Добавить боевое действие
          </button>
        </div>

        {episodes.map((ep, i) => (
          <div
            key={i}
            className="step-card"
            style={{
              marginBottom: '1.2rem',
              padding: '1.2rem',
              borderLeft: `3px solid ${ep.attacker.includes('2') ? 'var(--crimson-bright)' : 'var(--gold)'}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <strong style={{ color: 'var(--gold-bright)' }}>Действие {i + 1}</strong>
                <span className="badge badge-pending">{ep.attacker}</span>
              </div>
              {episodes.length > 1 && (
                <button type="button" className="btn btn-danger" onClick={() => removeEpisode(i)}>
                  ✕
                </button>
              )}
            </div>

            {/* Нападающий и угол атаки */}
            <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
              {participantMode === '3-person' && (
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={{ fontSize: '0.75rem' }}>Кто атакует?</label>
                  <select
                    value={ep.attacker}
                    onChange={(e) => updateEpisode(i, 'attacker', e.target.value)}
                  >
                    <option value="Укэ 1 (фронтальный)">Укэ 1 (фронтальный)</option>
                    <option value="Укэ 2 (фланговый/сзади)">Укэ 2 (фланговый/сзади)</option>
                    <option value="Укэ 1 и Укэ 2 одновременно">Оба одновременно (захват + удар)</option>
                  </select>
                </div>
              )}

              <div style={{ flex: 1, minWidth: 180 }}>
                <label style={{ fontSize: '0.75rem' }}>Угол нападения (нелинейный)</label>
                <select
                  value={ep.attackAngle}
                  onChange={(e) => updateEpisode(i, 'attackAngle', e.target.value)}
                >
                  {SHOTOKAN_DIRECTIONS.map((dir) => (
                    <option key={dir.angle} value={dir.label}>
                      {dir.label} [{dir.kanji}]
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Атака Укэ */}
            <div style={{ marginBottom: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                <label style={{ fontSize: '0.75rem', margin: 0 }}>Атака противника (Укэ)</label>
                <button
                  type="button"
                  className="btn"
                  style={{ fontSize: '0.72rem', padding: '0.2em 0.6em' }}
                  onClick={() => setPickerTarget({ index: i, field: 'attack' })}
                >
                  📖 Выбрать удар из Сётокан
                </button>
              </div>
              <input
                value={ep.attackTechnique}
                onChange={(e) => updateEpisode(i, 'attackTechnique', e.target.value)}
                placeholder="Например: Прямой выпад Ой-цуки в лицо (Дзёдан)"
              />
            </div>

            {/* Траектория Тори (Тай-сабаки) */}
            <div style={{ marginBottom: '0.8rem' }}>
              <label style={{ fontSize: '0.75rem' }}>Маневр Тори (Траектория ухода)</label>
              <select
                value={ep.toriMovement}
                onChange={(e) => updateEpisode(i, 'toriMovement', e.target.value)}
              >
                {SHOTOKAN_MOVEMENT_TYPES.map((m) => (
                  <option key={m.id} value={m.label}>
                    {m.label} — {m.desc}
                  </option>
                ))}
              </select>
            </div>

            {/* Защита и контратака Тори */}
            <div style={{ marginBottom: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                <label style={{ fontSize: '0.75rem', margin: 0 }}>Защита и контратака Тори</label>
                <button
                  type="button"
                  className="btn"
                  style={{ fontSize: '0.72rem', padding: '0.2em 0.6em' }}
                  onClick={() => setPickerTarget({ index: i, field: 'counter' })}
                >
                  📖 Выбрать блок/удар из Сётокан
                </button>
              </div>
              <input
                value={ep.toriCounter}
                onChange={(e) => updateEpisode(i, 'toriCounter', e.target.value)}
                placeholder="Например: Блок Сюто-укэ, скручивание локтя, подсечка Аси-барай"
              />
            </div>

            {/* Итог */}
            <div>
              <label style={{ fontSize: '0.75rem' }}>Биомеханический результат</label>
              <input
                value={ep.outcome}
                onChange={(e) => updateEpisode(i, 'outcome', e.target.value)}
                placeholder="Сваливание на татами, залом сустава, нейтрализация атаки"
              />
            </div>
          </div>
        ))}

        <div className="field" style={{ marginTop: '1.4rem' }}>
          <label>Дополнительное текстовое описание практического применения</label>
          <textarea
            rows={3}
            value={form.application}
            onChange={update('application')}
            placeholder="Любые дополнительные нюансы: дистанция ма-ай, дыхание, точки воздействия кюсё..."
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1, minWidth: 220 }}>
            <label>Ссылка на видео демонстрации (YouTube)</label>
            <input value={form.videoUrl} onChange={update('videoUrl')} placeholder="https://youtube.com/watch?v=…" />
          </div>

          <div className="field" style={{ flex: 1, minWidth: 220 }}>
            <label>Ссылка на превью</label>
            <input value={form.thumbnailUrl} onChange={update('thumbnailUrl')} placeholder="https://…" />
          </div>
        </div>

        {error && <p className="error-text" style={{ marginTop: '1rem' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.8rem' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Сохранение…' : isEdit ? 'Обновить бункай' : 'Опубликовать бункай Сётокан'}
          </button>
          <button type="button" className="btn" onClick={() => navigate(-1)} disabled={saving}>
            Отмена
          </button>
        </div>
      </form>

      {/* Модальное окно каталога техник Сётокан */}
      {pickerTarget !== null && (
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
          onClick={() => setPickerTarget(null)}
        >
          <div style={{ width: '100%', maxWidth: 880 }} onClick={(e) => e.stopPropagation()}>
            <TechniquePicker
              onSelect={handleTechniquePicked}
              onCancel={() => setPickerTarget(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
