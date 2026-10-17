import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { getBunkai, createBunkai, updateBunkai, getBunkaiSteps, saveBunkaiSteps } from '../api/bunkai';
import { listKata } from '../api/kata';
import { listClips } from '../api/animations';
import TechniquePicker from '../components/TechniquePicker';
import BunkaiMultiAvatarPlayer from '../three/BunkaiMultiAvatarPlayer';
import './BunkaiEditor.css';

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

const PHASES = [
  'Атака и реакция',
  'Встречный сбив (Укэ)',
  'Уход с линии (Тайсабаки)',
  'Залом сустава (Кансэцу)',
  'Бросок / сваливание (Нагэ)',
  'Контрудар (Атэми)',
  'Фиксация и контроль (Дзансин)',
];

const emptyEpisode = () => ({
  attacker: 'Укэ 1 (фронтальный)',
  attackAngle: '0°',
  attackAngleDeg: 0,
  combatDistance: 1.45,
  toriClip: 'shuto_uke',
  ukeClip: 'oi_zuki_right',
  uke2Clip: 'idle_shizentai',
  attackTechnique: 'Ой-цуки тюдан (прямой выпад кулаком)',
  toriMovement: 'Круговой уход с линии атаки (Тэнсин)',
  toriCounter: 'Сюто-укэ + залом запястья + контратака Гяку-цуки',
  phase: 'Встречный сбив (Укэ)',
  outcome: 'Выведение из равновесия и сваливание на татами (Кудзуси)',
});

function getMaaiInfo(dist) {
  if (dist < 1.10) {
    return {
      name: 'Чика-ма (近間)',
      desc: 'Ближний бой, захваты, клинч и заломы суставов',
      className: 'maai-zone--chika',
    };
  }
  if (dist <= 1.80) {
    return {
      name: 'Иссоку-итто (一足一刀)',
      desc: 'Дистанция одного шага и удара (базовая боевая дистанция каратэ)',
      className: 'maai-zone--issoku',
    };
  }
  return {
    name: 'То-ма (遠間)',
    desc: 'Дальняя дистанция маневрирования и входа в атаку',
    className: 'maai-zone--toma',
  };
}

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

  const [participantMode, setParticipantMode] = useState('2-person'); // '2-person' | '3-person'
  const [episodes, setEpisodes] = useState([emptyEpisode()]);
  const [activeEpisodeIdx, setActiveEpisodeIdx] = useState(0);

  const [kataOptions, setKataOptions] = useState([]);
  const [clipsList, setClipsList] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showMediaDetails, setShowMediaDetails] = useState(false);

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
              phase: 'Встречный сбив (Укэ)',
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
    setEpisodes((prev) => {
      const nextEp = {
        ...emptyEpisode(),
        attacker: participantMode === '3-person' && prev.length % 2 !== 0 ? 'Укэ 2 (фланговый)' : 'Укэ 1 (фронтальный)',
      };
      return [...prev, nextEp];
    });
    setActiveEpisodeIdx(episodes.length);
  }

  function removeEpisode(index) {
    if (episodes.length <= 1) return;
    setEpisodes((prev) => prev.filter((_, idx) => idx !== index));
    if (activeEpisodeIdx >= episodes.length - 1) {
      setActiveEpisodeIdx(Math.max(0, episodes.length - 2));
    }
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
    if (e) e.preventDefault();
    setSaving(true);
    setError(null);

    const modeLabel =
      participantMode === '3-person'
        ? '🏆 Соревновательный командный бункай (3 участника: Тори + Укэ 1 + Укэ 2)'
        : '🥋 Традиционный парный бункай (2 участника: Тори + Укэ)';

    let formattedApplication = `${modeLabel}\n\n`;
    episodes.forEach((ep, i) => {
      formattedApplication += `[Эпизод ${i + 1}]\n`;
      formattedApplication += `• Фаза: ${ep.phase || 'Встречный сбив'}\n`;
      formattedApplication += `• Атакующий: ${ep.attacker} под углом ${ep.attackAngleDeg}° (Дистанция: ${ep.combatDistance}м)\n`;
      formattedApplication += `• Атака противника (Клип: ${ep.ukeClip}): ${ep.attackTechnique}\n`;
      formattedApplication += `• Траектория Тори: ${ep.toriMovement}\n`;
      formattedApplication += `• Защита и контратака (Клип: ${ep.toriClip}): ${ep.toriCounter}\n`;
      formattedApplication += `• Биомеханический итог: ${ep.outcome}\n\n`;
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

  if (loading) return <p className="loading">Загрузка мастерской бункая…</p>;

  const currentEp = episodes[activeEpisodeIdx] || episodes[0] || emptyEpisode();
  const currentMaai = getMaaiInfo(currentEp.combatDistance);

  return (
    <div className="bunkai-studio">
      {/* ВЕРХНИЙ БАР СТУДИИ */}
      <header className="bunkai-studio__header">
        <div className="bunkai-studio__header-left">
          <span className="hanko hanko--lg">分解場</span>
          <div>
            <h1 className="bunkai-studio__title">
              {isEdit ? 'Студия разбора бункай (Редактирование)' : 'Студия боевого применения Сётокан (Бункай-дзё)'}
            </h1>
            <p className="bunkai-studio__subtitle">
              Конструктор тактических связок: симуляция 3D-аватаров, шкала Ма-ай и таймлайн эпизодов
            </p>
          </div>
        </div>

        <div className="bunkai-studio__header-actions">
          <button type="button" className="btn" onClick={() => navigate(-1)} disabled={saving}>
            Отмена
          </button>
          <button type="button" className="btn btn-primary" onClick={onSubmit} disabled={saving}>
            {saving ? 'Сохранение в БД…' : isEdit ? 'Обновить бункай' : 'Опубликовать бункай'}
          </button>
        </div>
      </header>

      {/* ВЕРХНЯЯ ПАНЕЛЬ: МЕТАДАННЫЕ И ВЫБОР РЕЖИМА */}
      <section className="bunkai-studio__meta-panel">
        <div className="bunkai-studio__meta-grid">
          <div className="field" style={{ margin: 0 }}>
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

          <div className="field" style={{ margin: 0 }}>
            <label>Название разбора бункая *</label>
            <input
              required
              value={form.title}
              onChange={update('title')}
              placeholder="Например: Разбор начальной связки Хэйан Сёдан против захвата и удара"
            />
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label>Уровень сложности</label>
            <select value={form.difficulty} onChange={update('difficulty')}>
              <option value="beginner">Начальный (Белый / Жёлтый пояс)</option>
              <option value="intermediate">Средний (Зелёный / Синий пояс)</option>
              <option value="advanced">Продвинутый (Коричневый пояс)</option>
              <option value="master">Мастерский (Чёрный пояс / Дан)</option>
            </select>
          </div>
        </div>

        {/* Выбор режима участников: 2 или 3 человека */}
        <div style={{ marginTop: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--gold)', fontWeight: 600, marginBottom: '0.4rem' }}>
            Формат боевого взаимодействия (Участники)
          </label>
          <div className="bunkai-mode-toggle">
            <div
              className={`bunkai-mode-option ${participantMode === '2-person' ? 'active' : ''}`}
              onClick={() => setParticipantMode('2-person')}
            >
              <span style={{ fontSize: '1.4rem' }}>🥋</span>
              <div>
                <strong style={{ color: '#fff', fontSize: '0.92rem' }}>Дуэт (2 участника)</strong>
                <div style={{ fontSize: '0.76rem', color: 'var(--washi-dim)' }}>
                  Тори (защита/контратака) + Укэ 1 (нападающий)
                </div>
              </div>
            </div>

            <div
              className={`bunkai-mode-option bunkai-mode-option--3p ${participantMode === '3-person' ? 'active' : ''}`}
              onClick={() => setParticipantMode('3-person')}
            >
              <span style={{ fontSize: '1.4rem' }}>🏆</span>
              <div>
                <strong style={{ color: '#fff', fontSize: '0.92rem' }}>Трио (3 участника — Соревновательный бункай)</strong>
                <div style={{ fontSize: '0.76rem', color: 'var(--washi-dim)' }}>
                  Тори + Укэ 1 (фронтальный выпад) + Укэ 2 (фланговая атака)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Дополнительный концепт и ссылки на медиа */}
        <div style={{ marginTop: '1.1rem' }}>
          <div className="field" style={{ margin: 0 }}>
            <label>Тактический сценарий и контекст применения</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={update('description')}
              placeholder="Опишите контекст ситуации (нападение на улице, захват за отвороты кимоно, неожиданная атака с фланга)..."
            />
          </div>
        </div>

        <div style={{ marginTop: '0.8rem' }}>
          <button
            type="button"
            className="btn"
            style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}
            onClick={() => setShowMediaDetails(!showMediaDetails)}
          >
            {showMediaDetails ? '▲ Скрыть ссылки на медиа' : '▼ Добавить ссылки на видео / превью'}
          </button>

          {showMediaDetails && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.8rem' }}>
              <div className="field" style={{ margin: 0 }}>
                <label>Ссылка на видео демонстрации (YouTube)</label>
                <input value={form.videoUrl} onChange={update('videoUrl')} placeholder="https://youtube.com/watch?v=…" />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Ссылка на изображение превью</label>
                <input value={form.thumbnailUrl} onChange={update('thumbnailUrl')} placeholder="https://…" />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ЦЕНТР СТУДИИ: БОЛЬШАЯ 3D-АРЕНА ДОДЗЁ */}
      <section className="bunkai-studio__arena-wrap">
        <div className="bunkai-studio__arena-bar">
          <div className="bunkai-studio__arena-title">
            <span>🥋</span>
            <span>Интерактивная 3D-арена боевого взаимодействия (Тори и Укэ)</span>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--gold)', fontWeight: 600 }}>
            {participantMode === '3-person' ? 'Режим: 3 участника (Команда)' : 'Режим: 2 участника (Дуэт)'}
          </span>
        </div>

        <BunkaiMultiAvatarPlayer
          steps={previewSteps}
          defaultParticipantMode={participantMode}
          height={480}
        />
      </section>

      {/* ГОРИЗОНТАЛЬНЫЙ ТАЙМЛАЙН БОЕВЫХ ЭПИЗОДОВ */}
      <section className="bunkai-timeline">
        <div className="bunkai-timeline__header">
          <h3 className="bunkai-timeline__title">
            <span>⚔️</span>
            <span>Хронология боевых эпизодов (Кэйко-дзюн / 稽古順)</span>
            <span style={{ fontSize: '0.82rem', color: 'var(--washi-dim)', fontWeight: 400 }}>
              (Всего эпизодов: {episodes.length})
            </span>
          </h3>

          <button type="button" className="btn btn-gold" onClick={addEpisode} style={{ fontSize: '0.82rem' }}>
            + Добавить боевой эпизод
          </button>
        </div>

        <div className="bunkai-timeline__strip">
          {episodes.map((ep, idx) => {
            const epMaai = getMaaiInfo(ep.combatDistance);
            const isActive = idx === activeEpisodeIdx;
            return (
              <div
                key={idx}
                className={`bunkai-step-pill ${isActive ? 'active' : ''}`}
                onClick={() => setActiveEpisodeIdx(idx)}
              >
                <div className="bunkai-step-pill__head">
                  <span className="bunkai-step-pill__num">
                    第 {idx + 1} 幕 · Эпизод {idx + 1}
                  </span>
                  <span className={`bunkai-step-pill__maai ${epMaai.className}`}>
                    {ep.combatDistance}м
                  </span>
                </div>

                <div className="bunkai-step-pill__summary">
                  <strong style={{ color: '#fff' }}>{ep.phase || 'Встречный сбив'}:</strong>{' '}
                  {ep.attackTechnique} против {ep.toriCounter}
                </div>

                <div className="bunkai-step-pill__footer">
                  <span>{ep.attacker.includes('2') ? '🔴 Укэ 2' : '🔵 Укэ 1'} ({ep.attackAngleDeg}°)</span>
                  {episodes.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeEpisode(idx);
                      }}
                      title="Удалить этот эпизод"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          <div className="bunkai-step-add-card" onClick={addEpisode}>
            <span style={{ fontSize: '1.4rem' }}>➕</span>
            <span>Новый шаг</span>
          </div>
        </div>
      </section>

      {/* ИНСПЕКТОР ВЫБРАННОГО ЭПИЗОДА (3 КОЛОНКИ: АТАКА, МА-АЙ, КОНТРАТАКА) */}
      <section className="bunkai-inspector">
        <div className="bunkai-inspector__header">
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span className="hanko">第{activeEpisodeIdx + 1}幕</span>
              <span>Параметры эпизода {activeEpisodeIdx + 1} из {episodes.length}</span>
            </h3>
            <p style={{ margin: '0.2rem 0 0', color: 'var(--washi-dim)', fontSize: '0.84rem' }}>
              Тонкая настройка анимаций, углов, фазы взаимодействия и дистанции Ма-ай
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <span className="badge badge--gold">Фаза: {currentEp.phase || 'Встречный сбив'}</span>
            {episodes.length > 1 && (
              <button
                type="button"
                className="btn btn-danger"
                style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}
                onClick={() => removeEpisode(activeEpisodeIdx)}
              >
                ✕ Удалить эпизод
              </button>
            )}
          </div>
        </div>

        <div className="bunkai-inspector__grid">
          {/* КОЛОНКА 1: АТАКА ПРОТИВНИКА (УКЭ) */}
          <div className="bunkai-card-column">
            <h4 className="bunkai-card-column__title bunkai-card-column__title--attack">
              <span>💥</span>
              <span>Атака противника (Укэ / 攻撃)</span>
            </h4>

            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--washi-dim)' }}>Атакующий противник:</label>
              <select
                value={currentEp.attacker}
                onChange={(e) => updateEpisode(activeEpisodeIdx, 'attacker', e.target.value)}
                style={{ width: '100%', marginTop: 4 }}
              >
                <option value="Укэ 1 (фронтальный)">Укэ 1 (фронтальный нападающий)</option>
                {participantMode === '3-person' && (
                  <option value="Укэ 2 (фланговый)">Укэ 2 (фланговый нападающий)</option>
                )}
                {participantMode === '3-person' && (
                  <option value="Укэ 1 и Укэ 2">Одновременная атака (Укэ 1 + Укэ 2)</option>
                )}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.76rem', color: '#90cdf4', fontWeight: 600 }}>
                3D-анимация Укэ 1:
              </label>
              <select
                value={currentEp.ukeClip}
                onChange={(e) => updateEpisode(activeEpisodeIdx, 'ukeClip', e.target.value)}
                style={{ width: '100%', marginTop: 4 }}
              >
                {UKE_CLIPS.map((uc) => (
                  <option key={uc.id} value={uc.id}>
                    {uc.label}
                  </option>
                ))}
              </select>
            </div>

            {participantMode === '3-person' && (
              <div>
                <label style={{ fontSize: '0.76rem', color: '#fca5a5', fontWeight: 600 }}>
                  3D-анимация Укэ 2 (Фланг):
                </label>
                <select
                  value={currentEp.uke2Clip}
                  onChange={(e) => updateEpisode(activeEpisodeIdx, 'uke2Clip', e.target.value)}
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

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={{ fontSize: '0.76rem', margin: 0, color: 'var(--washi-dim)' }}>
                  Техника удара (Shotokan)
                </label>
                <button
                  type="button"
                  className="btn"
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                  onClick={() => setPickerTarget({ index: activeEpisodeIdx, field: 'attack' })}
                >
                  📖 Справочник
                </button>
              </div>
              <input
                value={currentEp.attackTechnique}
                onChange={(e) => updateEpisode(activeEpisodeIdx, 'attackTechnique', e.target.value)}
                placeholder="Прямой выпад Ой-цуки в голову (Дзёдан)"
              />
            </div>

            {/* Слайдер угла атаки */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: 4 }}>
                <span style={{ color: 'var(--washi-dim)' }}>Угол направления атаки:</span>
                <strong style={{ color: '#fff' }}>
                  {currentEp.attackAngleDeg > 0 ? `+${currentEp.attackAngleDeg}°` : `${currentEp.attackAngleDeg}°`}
                  {currentEp.attackAngleDeg === 0 ? ' (Прямо)' : currentEp.attackAngleDeg < 0 ? ' (Слева)' : ' (Справа)'}
                </strong>
              </div>
              <input
                type="range"
                min="-60"
                max="60"
                step="5"
                value={currentEp.attackAngleDeg}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  updateEpisode(activeEpisodeIdx, 'attackAngleDeg', val);
                  updateEpisode(activeEpisodeIdx, 'attackAngle', `${val}°`);
                }}
                style={{ width: '100%', accentColor: '#90cdf4' }}
              />
            </div>
          </div>

          {/* КОЛОНКА 2: ДИСТАНЦИЯ МА-АЙ (間合い) */}
          <div className="bunkai-card-column">
            <h4 className="bunkai-card-column__title bunkai-card-column__title--maai">
              <span>📏</span>
              <span>Дистанция контакта (Ма-ай / 間合い)</span>
            </h4>

            <div className="maai-scale">
              <div className="maai-meter">
                <span style={{ fontSize: '0.8rem', color: 'var(--washi-dim)' }}>Расстояние контакта:</span>
                <span className="maai-meter__val">{currentEp.combatDistance.toFixed(2)} м</span>
              </div>

              <div className={`maai-zone-badge ${currentMaai.className}`}>
                {currentMaai.name}
              </div>

              <input
                type="range"
                min="0.80"
                max="2.50"
                step="0.05"
                value={currentEp.combatDistance}
                onChange={(e) => updateEpisode(activeEpisodeIdx, 'combatDistance', parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--gold-bright)' }}
              />

              <div className="maai-zones-legend">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#fca5a5', fontWeight: 600 }}>0.8 - 1.1 м:</span>
                  <span>Чика-ма (ближний бой, заломы)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--gold-bright)', fontWeight: 600 }}>1.1 - 1.8 м:</span>
                  <span>Иссоку-итто (шаг и удар)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#93c5fd', fontWeight: 600 }}>1.8 - 2.5 м:</span>
                  <span>То-ма (дальняя дистанция)</span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.76rem', color: 'var(--washi-dim)' }}>Фаза взаимодействия:</label>
                <select
                  value={currentEp.phase || 'Встречный сбив (Укэ)'}
                  onChange={(e) => updateEpisode(activeEpisodeIdx, 'phase', e.target.value)}
                  style={{ width: '100%', marginTop: 4 }}
                >
                  {PHASES.map((ph) => (
                    <option key={ph} value={ph}>
                      {ph}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* КОЛОНКА 3: ЗАЩИТА И КОНТРАТАКА (ТОРИ) */}
          <div className="bunkai-card-column">
            <h4 className="bunkai-card-column__title bunkai-card-column__title--counter">
              <span>🥋</span>
              <span>Защита и контрудар (Тори / 防御・反撃)</span>
            </h4>

            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--gold)', fontWeight: 600 }}>
                3D-анимация Тори:
              </label>
              <select
                value={currentEp.toriClip}
                onChange={(e) => updateEpisode(activeEpisodeIdx, 'toriClip', e.target.value)}
                style={{ width: '100%', marginTop: 4 }}
              >
                {TORI_CLIPS.map((tc) => (
                  <option key={tc.id} value={tc.id}>
                    {tc.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--washi-dim)' }}>
                Траектория перемещения (Тайсабаки / Тэнсин):
              </label>
              <input
                value={currentEp.toriMovement}
                onChange={(e) => updateEpisode(activeEpisodeIdx, 'toriMovement', e.target.value)}
                placeholder="Круговой уход с линии атаки (Тэнсин), шаг назад (Хики-аси)"
                style={{ marginTop: 4 }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={{ fontSize: '0.76rem', margin: 0, color: 'var(--washi-dim)' }}>
                  Защитное действие и контрудар
                </label>
                <button
                  type="button"
                  className="btn"
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                  onClick={() => setPickerTarget({ index: activeEpisodeIdx, field: 'counter' })}
                >
                  📖 Справочник
                </button>
              </div>
              <input
                value={currentEp.toriCounter}
                onChange={(e) => updateEpisode(activeEpisodeIdx, 'toriCounter', e.target.value)}
                placeholder="Сюто-укэ, залом запястья, контратака Гяку-цуки"
              />
            </div>

            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--washi-dim)' }}>
                Биомеханический итог (Кудзуси / Сваливание):
              </label>
              <input
                value={currentEp.outcome}
                onChange={(e) => updateEpisode(activeEpisodeIdx, 'outcome', e.target.value)}
                placeholder="Выведение из равновесия и нейтрализация противника"
                style={{ marginTop: 4 }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* НИЖНЯЯ ПАНЕЛЬ ДЕЙСТВИЙ */}
      <footer className="bunkai-studio__actions">
        <div>
          {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}
          {!error && (
            <p style={{ margin: 0, color: 'var(--washi-dim)', fontSize: '0.88rem' }}>
              Всего настроено эпизодов: <strong>{episodes.length}</strong> · Активный: <strong>Эпизод {activeEpisodeIdx + 1}</strong>
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button type="button" className="btn" onClick={() => navigate(-1)} disabled={saving}>
            Отмена
          </button>
          <button type="button" className="btn btn-primary" onClick={onSubmit} disabled={saving}>
            {saving ? 'Сохранение в базе данных…' : isEdit ? 'Обновить бункай' : '🥋 Опубликовать бункай Сётокан'}
          </button>
        </div>
      </footer>

      {/* Модальное окно справочника приемов Shotokan */}
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
