import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getBunkai, createBunkai, updateBunkai, getBunkaiSteps, saveBunkaiSteps } from '../api/bunkai';
import { listKata } from '../api/kata';
import { listClips } from '../api/animations';
import TechniquePicker from '../components/TechniquePicker';
import BunkaiMultiAvatarPlayer from '../three/BunkaiMultiAvatarPlayer';
import { SHOTOKAN_DIRECTIONS, SHOTOKAN_MOVEMENT_TYPES } from '../data/shotokanTechniques';

const TORI_CLIPS = [
  { id: 'shuto_uke', label: 'Сюто-укэ (Блок ребром ладони)' },
  { id: 'age_uke_left', label: 'Агэ-укэ (Верхний восходящий блок)' },
  { id: 'gedan_barai_left', label: 'Гэдан-барай (Нижний смет)' },
  { id: 'soto_uke', label: 'Сото-укэ (Блок снаружи-внутрь)' },
  { id: 'uchi_uke', label: 'Ути-укэ (Блок изнутри-наружу)' },
  { id: 'gyaku_zuki_right', label: 'Гяку-цуки (Реверсивный контрудар кулаком)' },
  { id: 'empi_uchi', label: 'Эмпи-учи (Сокрушительный удар локтем)' },
  { id: 'uraken_uchi', label: 'Уракэн-учи (Бэкфист в висок)' },
  { id: 'tetsui_uchi', label: 'Тэтцуи-учи (Удар-молот)' },
  { id: 'kizami_zuki', label: 'Кизами-цуки (Встречный джеб)' },
  { id: 'ippon_seoi_nage', label: 'Иппон Сэои-нагэ (Бросок через плечо)' },
  { id: 'deashi_harai', label: 'Дэаси-харай (Сметающая подсечка)' },
];

const UKE_CLIPS = [
  { id: 'oi_zuki_right', label: 'Ой-цуки (Прямой выпад кулаком)' },
  { id: 'mae_geri_right', label: 'Маэ-гэри (Прямой удар ногой)' },
  { id: 'mawashi_geri', label: 'Маваси-гэри (Круговой удар ногой)' },
  { id: 'choku_zuki', label: 'Чоку-цуки (Прямой удар кулаком)' },
  { id: 'yoko_geri', label: 'Ёко-гэри (Боковой пробивающий удар)' },
  { id: 'ushiro_geri', label: 'Усиро-гэри (Удар пяткой назад)' },
  { id: 'hook', label: 'Хук / Боковой с размаха' },
  { id: 'ren_zuki', label: 'Рэн-цуки (Двойка кулаками)' },
  { id: 'sanbon_zuki', label: 'Санбон-цуки (Тройной пробивающий)' },
  { id: 'idle_shizentai', label: 'Сидзэнтай (Ожидание / финт)' },
];

const emptyEpisode = () => ({
  attacker: 'Укэ 1 (фронтальный)',
  attackAngle: 'Прямо вперед (0°)',
  attackAngleDeg: 0,
  combatDistance: 1.45,
  toriClip: 'shuto_uke',
  ukeClip: 'oi_zuki_right',
  uke2Clip: 'idle_shizentai',
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
  const [clipsList, setClipsList] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Состояние пикера техник: { episodeIndex, targetField: 'attack' | 'counter' }
  const [pickerTarget, setPickerTarget] = useState(null);

  // Карта сопоставления имени клипа и Clip_ID
  const clipIdMap = useMemo(() => {
    const map = new Map();
    clipsList.forEach((c) => {
      if (c.Clip_Name && c.Clip_ID) {
        map.set(c.Clip_Name, c.Clip_ID);
      }
    });
    return map;
  }, [clipsList]);

  useEffect(() => {
    Promise.all([
      listKata({ pageSize: 100, sort: 'title' }),
      listClips().catch(() => []),
    ]).then(([kataRes, clipsRes]) => {
      setKataOptions(kataRes.data || []);
      setClipsList(clipsRes || []);
    });
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    Promise.all([
      getBunkai(id),
      getBunkaiSteps(id).catch(() => []),
    ])
      .then(([b, steps]) => {
        setForm({
          kataId: b.Kata_ID,
          title: b.Title,
          description: b.Description || '',
          application: b.Application || '',
          difficulty: b.Difficulty,
          videoUrl: b.Video_URL || '',
          thumbnailUrl: b.Thumbnail_URL || '',
        });

        if (Array.isArray(steps) && steps.length > 0) {
          const loadedEpisodes = steps.map((s) => {
            const toriPart = s.participants?.find((p) => p.role === 'tori') || {};
            const ukePart = s.participants?.find((p) => p.role === 'uke' || p.role === 'uke1') || {};
            const uke2Part = s.participants?.find((p) => p.role === 'uke2') || {};
            return {
              attacker: s.participantCount === 3 ? 'Укэ 1 и Укэ 2' : 'Укэ 1 (фронтальный)',
              attackAngle: `${s.targetAngle || 0}°`,
              attackAngleDeg: s.targetAngle || 0,
              combatDistance: s.targetDistance || 1.45,
              toriClip: toriPart.clipName || 'shuto_uke',
              ukeClip: ukePart.clipName || 'oi_zuki_right',
              uke2Clip: uke2Part.clipName || 'idle_shizentai',
              attackTechnique: ukePart.clipTitle || 'Ой-цуки тюдан',
              toriMovement: 'Круговой уход с линии атаки (Тэнсин)',
              toriCounter: toriPart.clipTitle || 'Сюто-укэ и контратака',
              outcome: s.description || 'Выведение из равновесия (Кудзуси)',
            };
          });
          setEpisodes(loadedEpisodes);
          if (steps.some((s) => s.participantCount === 3 || s.participants?.some((p) => p.role === 'uke2'))) {
            setParticipantMode('3-person');
          }
        }
      })
      .finally(() => setLoading(false));
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

  // Генерация шагов для 3D предпросмотра в реальном времени
  const previewSteps = useMemo(() => {
    return episodes.map((ep, idx) => ({
      stepNumber: idx + 1,
      title: `Эпизод ${idx + 1}`,
      description: `${ep.attackTechnique} против ${ep.toriCounter}`,
      optimalDistance: ep.combatDistance || 1.45,
      attackAngleDeg: ep.attackAngleDeg || 0,
      interactionType: 'local_contact',
      tContact: 0.45,
      participants: [
        { role: 'tori', clipName: ep.toriClip, stance: 'kokutsu' },
        { role: 'uke1', clipName: ep.ukeClip, stance: 'zenkutsu' },
        { role: 'uke2', clipName: ep.uke2Clip || 'idle_shizentai', stance: 'ready' },
      ],
    }));
  }, [episodes]);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const modeLabel =
      participantMode === '3-person'
        ? '🏆 Соревновательный командный бункай (3 участника: Тори + Укэ 1 + Укэ 2)'
        : '🥋 Традиционный парный бункай (2 участника: Тори + Укэ)';

    let formattedApplication = `${modeLabel}\n\n`;
    episodes.forEach((ep, i) => {
      formattedApplication += `[Эпизод ${i + 1}]\n`;
      formattedApplication += `• Атакующий: ${ep.attacker} под углом ${ep.attackAngleDeg}° (Дистанция: ${ep.combatDistance}м)\n`;
      formattedApplication += `• Атака противника (Клип: ${ep.ukeClip}): ${ep.attackTechnique}\n`;
      formattedApplication += `• Траектория Тори: ${ep.toriMovement}\n`;
      formattedApplication += `• Защита и контратака (Клип: ${ep.toriClip}): ${ep.toriCounter}\n`;
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
      const bunkaiId = bunkai.Bunkai_ID || id;

      // Формируем структурированные шаги и участников для dbo.BunkaiSteps / BunkaiStepParticipants
      const is3Person = participantMode === '3-person';
      const structuredSteps = episodes.map((ep, idx) => {
        const participants = [
          {
            role: 'tori',
            clipId: clipIdMap.get(ep.toriClip) || null,
            initialStance: 'kokutsu_dachi_left',
            offsetX: 0.0,
            offsetZ: 0.0,
            rotationY: 0.0,
            delaySeconds: 0.0,
          },
          {
            role: 'uke1',
            clipId: clipIdMap.get(ep.ukeClip) || null,
            initialStance: 'zenkutsu_dachi_left',
            offsetX: 0.0,
            offsetZ: ep.combatDistance || 1.45,
            rotationY: 180.0,
            delaySeconds: 0.0,
          },
        ];

        if (is3Person) {
          participants.push({
            role: 'uke2',
            clipId: clipIdMap.get(ep.uke2Clip) || null,
            initialStance: 'idle_shizentai',
            offsetX: 0.85,
            offsetZ: (ep.combatDistance || 1.45) + 0.35,
            rotationY: 155.0,
            delaySeconds: 0.3,
          });
        }

        return {
          stepNumber: idx + 1,
          title: `Эпизод ${idx + 1}: ${ep.toriClip}`,
          description: `${ep.attackTechnique} -> ${ep.toriCounter}. ${ep.outcome}`,
          duration: 2.8,
          participantCount: is3Person ? 3 : 2,
          targetDistance: ep.combatDistance || 1.45,
          targetAngle: ep.attackAngleDeg || 0.0,
          participants,
        };
      });

      await saveBunkaiSteps(bunkaiId, structuredSteps).catch((err) => {
        console.warn('Ошибка сохранения структурированных шагов:', err);
      });

      navigate(`/bunkai/${bunkaiId}`);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Не удалось сохранить бункай');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="loading">Загрузка…</p>;

  return (
    <div style={{ maxWidth: 880, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.5rem' }}>
        <span className="hanko">分解</span>
        <h1>{isEdit ? 'Редактирование бункая' : 'Новый бункай Сётокан'}</h1>
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Конструктор боевого применения ката с интерактивной 3D-ареной, настройкой дистанции (Ма-ай) и углов атаки.
      </p>

      {/* ИНТЕРАКТИВНЫЙ 3D ПРЕДПРОСМОТР В РЕАЛЬНОМ ВРЕМЕНИ */}
      <div style={{ marginBottom: '1.8rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🥋</span>
            <span>Интерактивный 3D-предпросмотр симуляции</span>
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-gold)', fontWeight: 600 }}>
            {participantMode === '3-person' ? '3 Участника (Тори + 2 Укэ)' : '2 Участника (Дуэль)'}
          </span>
        </div>
        <BunkaiMultiAvatarPlayer
          steps={previewSteps}
          defaultParticipantMode={participantMode}
          height={380}
        />
      </div>

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
                  Тори (белое доги) + Укэ (индиго доги)
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
                  Тори + Укэ 1 (фронт) + Укэ 2 (фланг)
                </div>
              </div>
            </label>
          </div>
        </div>

        <hr className="divider" />

        {/* ПОШАГОВЫЙ КОНСТРУКТОР БОЕВЫХ ЭПИЗОДОВ */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: 0 }}>Боевая цепочка бункая (Эпизоды)</h3>
            <small style={{ color: 'var(--text-muted)' }}>
              Настройка 3D-анимаций, дистанции (Ма-ай) и углов атаки для каждого шага
            </small>
          </div>
          <button type="button" className="btn btn-gold" onClick={addEpisode}>
            + Добавить эпизод
          </button>
        </div>

        {episodes.map((ep, i) => (
          <div
            key={i}
            className="step-card"
            style={{
              marginBottom: '1.4rem',
              padding: '1.2rem',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              borderLeft: `4px solid ${ep.attacker.includes('2') ? 'var(--crimson-bright)' : 'var(--gold)'}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <strong style={{ color: 'var(--gold-bright)', fontSize: '0.95rem' }}>Эпизод {i + 1}</strong>
                <span className="badge badge-pending">{ep.attacker}</span>
              </div>
              {episodes.length > 1 && (
                <button type="button" className="btn btn-danger" onClick={() => removeEpisode(i)} style={{ padding: '4px 8px' }}>
                  ✕ Удалить
                </button>
              )}
            </div>

            {/* Выбор 3D-анимаций для участников эпизода */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 14 }}>
              {/* Клип Тори */}
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--color-gold)', fontWeight: 600 }}>
                  🥋 3D Анимация Тори (Защита/Контратака):
                </label>
                <select
                  value={ep.toriClip}
                  onChange={(e) => updateEpisode(i, 'toriClip', e.target.value)}
                  style={{ width: '100%', marginTop: 4 }}
                >
                  {TORI_CLIPS.map((tc) => (
                    <option key={tc.id} value={tc.id}>
                      {tc.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Клип Укэ 1 */}
              <div>
                <label style={{ fontSize: '0.78rem', color: '#90cdf4', fontWeight: 600 }}>
                  💥 3D Анимация Укэ 1 (Атака):
                </label>
                <select
                  value={ep.ukeClip}
                  onChange={(e) => updateEpisode(i, 'ukeClip', e.target.value)}
                  style={{ width: '100%', marginTop: 4 }}
                >
                  {UKE_CLIPS.map((uc) => (
                    <option key={uc.id} value={uc.id}>
                      {uc.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Клип Укэ 2 (если 3 участника) */}
              {participantMode === '3-person' && (
                <div>
                  <label style={{ fontSize: '0.78rem', color: '#feb2b2', fontWeight: 600 }}>
                    🥊 3D Анимация Укэ 2 (Фланг):
                  </label>
                  <select
                    value={ep.uke2Clip}
                    onChange={(e) => updateEpisode(i, 'uke2Clip', e.target.value)}
                    style={{ width: '100%', marginTop: 4 }}
                  >
                    {UKE_CLIPS.map((uc) => (
                      <option key={uc.id} value={uc.id}>
                        {uc.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Слайдеры дистанции и угла */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 14, background: 'rgba(0,0,0,0.25)', padding: 12, borderRadius: 6 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: 4 }}>
                  <span style={{ color: 'var(--color-gold)' }}>📏 Дистанция Ма-ай:</span>
                  <strong style={{ color: '#fff' }}>{ep.combatDistance} м</strong>
                </div>
                <input
                  type="range"
                  min="0.80"
                  max="2.50"
                  step="0.05"
                  value={ep.combatDistance}
                  onChange={(e) => updateEpisode(i, 'combatDistance', parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--color-gold)' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: 4 }}>
                  <span style={{ color: 'var(--color-gold)' }}>🧭 Угол атаки:</span>
                  <strong style={{ color: '#fff' }}>{ep.attackAngleDeg}°</strong>
                </div>
                <input
                  type="range"
                  min="-60"
                  max="60"
                  step="5"
                  value={ep.attackAngleDeg}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    updateEpisode(i, 'attackAngleDeg', val);
                    updateEpisode(i, 'attackAngle', `${val}°`);
                  }}
                  style={{ width: '100%', accentColor: 'var(--color-gold)' }}
                />
              </div>
            </div>

            {/* Текстовые поля описания приема */}
            <div style={{ marginBottom: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                <label style={{ fontSize: '0.75rem', margin: 0 }}>Атака противника (описание)</label>
                <button
                  type="button"
                  className="btn"
                  style={{ fontSize: '0.72rem', padding: '0.2em 0.6em' }}
                  onClick={() => setPickerTarget({ index: i, field: 'attack' })}
                >
                  📖 Справочник ударов
                </button>
              </div>
              <input
                value={ep.attackTechnique}
                onChange={(e) => updateEpisode(i, 'attackTechnique', e.target.value)}
                placeholder="Например: Прямой выпад Ой-цуки в лицо (Дзёдан)"
              />
            </div>

            <div style={{ marginBottom: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                <label style={{ fontSize: '0.75rem', margin: 0 }}>Защита и контратака Тори</label>
                <button
                  type="button"
                  className="btn"
                  style={{ fontSize: '0.72rem', padding: '0.2em 0.6em' }}
                  onClick={() => setPickerTarget({ index: i, field: 'counter' })}
                >
                  📖 Справочник блоков
                </button>
              </div>
              <input
                value={ep.toriCounter}
                onChange={(e) => updateEpisode(i, 'toriCounter', e.target.value)}
                placeholder="Например: Блок Сюто-укэ, скручивание локтя, контрудар Гяку-цуки"
              />
            </div>

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
            {saving ? 'Сохранение в БД…' : isEdit ? 'Обновить бункай' : 'Опубликовать бункай Сётокан'}
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
