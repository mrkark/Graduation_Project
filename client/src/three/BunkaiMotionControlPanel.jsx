import React, { useState, useMemo, useCallback } from 'react';
import {
  User, Shield, Swords, Compass, Ruler, Footprints, Move,
  RotateCw, RotateCcw, Zap, Flame, Hand, Lock, Activity, CornerDownRight,
  TrendingDown, ShieldAlert, TrendingUp, Layers, CheckCircle2,
  AlertTriangle, Eye, Sliders, ChevronDown, ChevronUp, RefreshCw,
  Clock, Target
} from 'lucide-react';
import {
  SHOTOKAN_STANCES,
  BUNKAI_ORIENTATION_MODES,
  BUNKAI_TURN_MECHANICS,
  BUNKAI_ACTION_TYPES,
  validateBunkaiBiomechanics,
} from './bunkaiScenarioEngine';

export const BUNKAI_TECHNIQUE_CATEGORIES = [
  {
    id: 'punches',
    label: 'Удары руками (Цуки / Учи)',
    techniques: [
      { value: 'oi_zuki_right', label: 'Ой-цуки (Прямой выпад кулаком)', level: 'chudan' },
      { value: 'gyaku_zuki_right', label: 'Гяку-цуки (Реверсивный удар правой)', level: 'chudan' },
      { value: 'gyaku_zuki_left', label: 'Гяку-цуки левой рукой', level: 'chudan' },
      { value: 'choku_zuki', label: 'Чоку-цуки (Прямой удар на месте)', level: 'chudan' },
      { value: 'kizami_zuki', label: 'Кизами-цуки (Встречный резкий джеб)', level: 'jodan' },
      { value: 'uraken_uchi', label: 'Уракэн-учи (Бэкфист в висок)', level: 'jodan' },
      { value: 'tetsui_uchi', label: 'Тэтцуи-учи (Удар кулаком-молотом)', level: 'jodan' },
      { value: 'empi_uchi', label: 'Эмпи-учи (Сокрушительный удар локтем)', level: 'chudan' },
      { value: 'shuto_uchi', label: 'Сюто-учи (Секущий удар ребром ладони)', level: 'jodan' },
      { value: 'ren_zuki', label: 'Рэн-цуки (Сдвоенный удар кулаками)', level: 'chudan' },
      { value: 'sanbon_zuki', label: 'Санбон-цуки (Тройной пробивающий)', level: 'chudan' },
    ],
  },
  {
    id: 'kicks',
    label: 'Удары ногами (Гери)',
    techniques: [
      { value: 'mae_geri_right', label: 'Маэ-гэри (Прямой удар правой ногой)', level: 'chudan' },
      { value: 'mae_geri_left', label: 'Маэ-гэри левой (Прямой удар ногой)', level: 'chudan' },
      { value: 'mawashi_geri', label: 'Маваси-гэри (Круговой удар ногой)', level: 'jodan' },
      { value: 'yoko_geri', label: 'Ёко-гэри (Боковой пробивающий удар)', level: 'chudan' },
      { value: 'ushiro_geri', label: 'Усиро-гэри (Удар пяткой назад)', level: 'chudan' },
    ],
  },
  {
    id: 'blocks',
    label: 'Блоки (Укэ)',
    techniques: [
      { value: 'age_uke_right', label: 'Агэ-укэ правой (Верхний блок)', level: 'jodan' },
      { value: 'age_uke_left', label: 'Агэ-укэ левой (Верхний блок)', level: 'jodan' },
      { value: 'soto_uke', label: 'Сото-укэ (Блок снаружи-внутрь)', level: 'chudan' },
      { value: 'uchi_uke', label: 'Ути-укэ (Блок изнутри-наружу)', level: 'chudan' },
      { value: 'gedan_barai_left', label: 'Гэдан-барай левой (Нижний смет)', level: 'gedan' },
      { value: 'gedan_barai_right', label: 'Гэдан-барай правой рукой', level: 'gedan' },
      { value: 'shuto_uke', label: 'Сюто-укэ (Блок ребром ладони)', level: 'chudan' },
      { value: 'manji_uke', label: 'Манджи-укэ (Двойной верхний/нижний блок)', level: 'jodan' },
    ],
  },
  {
    id: 'takedowns',
    label: 'Подсечки, броски и захваты',
    techniques: [
      { value: 'deashi_harai', label: 'Дэаси-харай (Сметающая подсечка стопой)', level: 'gedan' },
      { value: 'ippon_seoi_nage', label: 'Иппон Сэои-нагэ (Бросок через спину/плечо)', level: 'chudan' },
      { value: 'wrist_lock', label: 'Кансэцу-вадза (Рычаг/скручивание запястья)', level: 'chudan' },
      { value: 'collar_grab', label: 'Захват отворота доги и контроль дистанции', level: 'chudan' },
    ],
  },
  {
    id: 'falls',
    label: 'Падения и подъём с татами',
    techniques: [
      { value: 'fallen_ukemi', label: 'Укэми (Страховка при падении на спину/бок)', level: 'gedan' },
      { value: 'rise_zenkutsu', label: 'Окиагари (Подъём с защитой в Дзэнкуцу-дати)', level: 'chudan' },
    ],
  },
];

/**
 * Универсальная панель управления движениями 3D-персонажей в Bunkai Explorer.
 * Предоставляет полный контроль над стойками, направлением, углами поворота всего тела,
 * дистанцией, техниками, взаимодействиями и биомеханической валидацией.
 */
export default function BunkaiMotionControlPanel({
  currentStepIndex = 0,
  currentEpisode = {},
  placement = null,
  showUke2 = false,
  onParamChange = null,
  onReplayStep = null,
  onScrubStep = null,
  visualAidSettings = {},
  onVisualAidToggle = null,
}) {
  // Активный выбранный участник: 'tori' | 'uke1' | 'uke2'
  const [selectedParticipant, setSelectedParticipant] = useState('tori');

  // Активный тип действия участника
  const [activeActionType, setActiveActionType] = useState('stance');

  // Управление раскрытием разделов панели (аккордеон)
  const [expandedSections, setExpandedSections] = useState({
    spatial: true,
    orientation: true,
    stance: true,
    locomotion: false,
    technique: true,
    interaction: false,
    timing: false,
    visuals: true,
    validation: true,
  });

  const toggleSection = useCallback((sec) => {
    setExpandedSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  }, []);

  // Извлечение текущих параметров участников
  const toriPart = currentEpisode?.participants?.find((p) => p.role === 'tori') || {};
  const uke1Part = currentEpisode?.participants?.find((p) => p.role === 'uke' || p.role === 'uke1') || {};
  const uke2Part = currentEpisode?.participants?.find((p) => p.role === 'uke2') || {};

  const activePart = selectedParticipant === 'tori'
    ? toriPart
    : selectedParticipant === 'uke1'
    ? uke1Part
    : uke2Part;

  // Параметры стойки активного участника
  const currentStanceId = activePart.stance || 'zenkutsu_dachi_left';
  const currentStanceSpec = SHOTOKAN_STANCES[currentStanceId] || SHOTOKAN_STANCES['zenkutsu_dachi_left'];
  const currentStanceSide = currentStanceSpec.side || (currentStanceId.includes('right') ? 'right' : 'left');

  // Режим ориентации (Режимы 1-5)
  const [orientationMode, setOrientationMode] = useState(
    selectedParticipant === 'tori'
      ? (currentEpisode.orientationModeTori || 'mode2_look_at')
      : (currentEpisode.orientationModeUke || 'mode2_look_at')
  );

  // Относительный угол
  const [relativeAngleDeg, setRelativeAngleDeg] = useState(
    selectedParticipant === 'tori'
      ? (currentEpisode.toriAngleOffsetDeg || currentEpisode.attackAngleDeg || 0)
      : (currentEpisode.ukeEvasionAngleDeg || currentEpisode.scenarioAngles?.retreatAngleDeg || 0)
  );

  // Свободный угол
  const [freeYawDeg, setFreeYawDeg] = useState(0);

  // Текущий конечный угол разворота выбранного участника (End Yaw)
  const currentEndYawDeg = useMemo(() => {
    if (selectedParticipant === 'tori') {
      if (currentEpisode.toriEndAngleDeg !== undefined && currentEpisode.toriEndAngleDeg !== null) {
        return Number(currentEpisode.toriEndAngleDeg);
      }
      if (placement?.rotTori?.[1] !== undefined) {
        return Math.round((placement.rotTori[1] * 180) / Math.PI);
      }
      if (currentEpisode.toriTrajectory?.endYaw !== undefined) {
        return Math.round((currentEpisode.toriTrajectory.endYaw * 180) / Math.PI);
      }
      return 0;
    } else {
      if (currentEpisode.ukeEndAngleDeg !== undefined && currentEpisode.ukeEndAngleDeg !== null) {
        return Number(currentEpisode.ukeEndAngleDeg);
      }
      if (placement?.rotUke1?.[1] !== undefined) {
        return Math.round((placement.rotUke1[1] * 180) / Math.PI);
      }
      if (currentEpisode.ukeTrajectory?.endYaw !== undefined) {
        return Math.round((currentEpisode.ukeTrajectory.endYaw * 180) / Math.PI);
      }
      return 180;
    }
  }, [selectedParticipant, currentEpisode, placement]);

  const getDirectionLabel = useCallback((deg) => {
    const d = Math.round(deg);
    if (d === 0) return '0° (Север / прямо)';
    if (d === 35) return '+35° (Северо-Восток уход)';
    if (d === 45) return '+45° (Северо-Восток)';
    if (d === 90) return '+90° (Восток / направо)';
    if (d === 135) return '+135° (Юго-Восток)';
    if (d === 180 || d === -180) return '180° (Юг / полный разворот назад)';
    if (d === -35) return '-35° (Северо-Запад уход)';
    if (d === -45) return '-45° (Северо-Запад)';
    if (d === -90) return '-90° (Запад / налево)';
    if (d === -135) return '-135° (Юго-Запад)';
    return `${d > 0 ? `+${d}` : d}°`;
  }, []);

  // Механика разворота
  const [turnMechanic, setTurnMechanic] = useState('pivot_support');

  // Сторона выполнения техники (Левая / Правая - независима от стойки!)
  const [limbSide, setLimbSide] = useState('right');

  // Параметры перемещения
  const [locomotionDir, setLocomotionDir] = useState('forward');
  const [stepLengthMeters, setStepLengthMeters] = useState(0.65);
  const [stepCount, setStepCount] = useState(1);
  const [motionSpeed, setMotionSpeed] = useState(1.4);
  const [motionType, setMotionType] = useState('step');

  // Взаимодействие
  const [contactType, setContactType] = useState(currentEpisode.contactType || 'none');
  const [contactZone, setContactZone] = useState('forearm');
  const [jointAngleDeg, setJointAngleDeg] = useState(25);

  // Дистанция боя
  const combatDistance = currentEpisode.optimalDistance || 1.45;

  // Оповещение родителя об изменении параметра
  const notify = useCallback((field, value) => {
    if (typeof onParamChange === 'function') {
      onParamChange(currentStepIndex, field, value);
    }
  }, [onParamChange, currentStepIndex]);

  // Смена стороны стойки (Хидари ⇄ Миги)
  const handleStanceSideChange = useCallback((side) => {
    let nextStanceId = currentStanceId;
    if (side === 'left') {
      nextStanceId = currentStanceId.replace('right', 'left');
      if (nextStanceId === 'fudo_dachi_right') nextStanceId = 'fudo_dachi';
    } else if (side === 'right') {
      nextStanceId = currentStanceId.replace('left', 'right');
      if (nextStanceId === 'fudo_dachi') nextStanceId = 'fudo_dachi_right';
    }
    const fieldName = selectedParticipant === 'tori' ? 'toriStance' : 'ukeStance';
    notify(fieldName, nextStanceId);
  }, [currentStanceId, selectedParticipant, notify]);

  // Выбор стойки Сётокан
  const handleStanceSelect = useCallback((stanceId) => {
    const fieldName = selectedParticipant === 'tori' ? 'toriStance' : 'ukeStance';
    notify(fieldName, stanceId);
  }, [selectedParticipant, notify]);

  // Выбор конечной стойки
  const handleFinalStanceSelect = useCallback((stanceId) => {
    const fieldName = selectedParticipant === 'tori' ? 'toriFinalStance' : 'ukeFinalStance';
    notify(fieldName, stanceId);
  }, [selectedParticipant, notify]);

  // Выбор техники
  const handleTechniqueSelect = useCallback((techClip) => {
    const fieldName = selectedParticipant === 'tori' ? 'toriClip' : 'ukeClip';
    notify(fieldName, techClip);
  }, [selectedParticipant, notify]);

  // Изменение угла ориентации
  const handleRelativeAngleChange = useCallback((deg) => {
    setRelativeAngleDeg(deg);
    if (selectedParticipant === 'tori') {
      notify('toriAngleOffsetDeg', deg);
      notify('attackAngleDeg', deg);
    } else {
      notify('ukeEvasionAngleDeg', deg);
      notify('taiSabakiAngleDeg', deg);
    }
  }, [selectedParticipant, notify]);

  // Изменение целевого конечного угла поворота (End Yaw)
  const handleEndYawChange = useCallback((deg) => {
    let normalized = Number(deg);
    while (normalized > 180) normalized -= 360;
    while (normalized < -180) normalized += 360;

    if (selectedParticipant === 'tori') {
      notify('toriEndAngleDeg', normalized);
      notify('customToriYawDeg', normalized);
    } else {
      notify('ukeEndAngleDeg', normalized);
      notify('customUkeYawDeg', normalized);
    }
  }, [selectedParticipant, notify]);

  // Координаты положения по осям X, Y, Z
  const currentPosX = (selectedParticipant === 'tori' ? placement?.posTori?.[0] : placement?.posUke1?.[0]) ?? 0;
  const currentPosY = (selectedParticipant === 'tori' ? placement?.posTori?.[1] : placement?.posUke1?.[1]) ?? 0;
  const currentPosZ = (selectedParticipant === 'tori' ? placement?.posTori?.[2] : placement?.posUke1?.[2]) ?? 0;

  const handlePosXChange = useCallback((val) => {
    const field = selectedParticipant === 'tori' ? 'customToriPosX' : 'customUkePosX';
    notify(field, Number(val));
  }, [selectedParticipant, notify]);

  const handlePosZChange = useCallback((val) => {
    const field = selectedParticipant === 'tori' ? 'customToriPosZ' : 'customUkePosZ';
    notify(field, Number(val));
  }, [selectedParticipant, notify]);

  // Идеальный угол поворота лицом к противнику
  const idealFacingYawDeg = useMemo(() => {
    if (!placement) return 0;
    const pTori = placement.posTori || [0, 0, 0];
    const pUke = placement.posUke1 || [0, 0, 1.45];
    if (selectedParticipant === 'tori') {
      const rad = Math.atan2(pUke[0] - pTori[0], pUke[2] - pTori[2]);
      return Math.round((rad * 180) / Math.PI);
    } else {
      const rad = Math.atan2(pTori[0] - pUke[0], pTori[2] - pUke[2]);
      return Math.round((rad * 180) / Math.PI);
    }
  }, [placement, selectedParticipant]);

  const handleFaceOpponent = useCallback(() => {
    handleEndYawChange(idealFacingYawDeg);
    setOrientationMode('mode2_look_at');
    notify(selectedParticipant === 'tori' ? 'orientationModeTori' : 'orientationModeUke', 'mode2_look_at');
  }, [handleEndYawChange, idealFacingYawDeg, selectedParticipant, notify]);

  // Биомеханическая проверка в реальном времени
  const biomechanicsAudit = useMemo(() => {
    return validateBunkaiBiomechanics({
      stance: currentStanceId,
      stanceSide: currentStanceSide,
      limbSide,
      orientationMode,
      relativeAngleDeg,
      distance: combatDistance,
      isStationary: activePart.isStationary,
      displacement: currentEpisode.displacementTori || [0, 0, 0],
      contactType,
      jointAngleDeg,
    });
  }, [currentStanceId, currentStanceSide, limbSide, orientationMode, relativeAngleDeg, combatDistance, activePart.isStationary, currentEpisode.displacementTori, contactType, jointAngleDeg]);

  return (
    <div
      style={{
        background: '#0f0f14',
        border: '1.5px solid #272733',
        borderRadius: 10,
        padding: '16px 18px',
        color: '#f8fafc',
        marginTop: 12,
        boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
      }}
    >
      {/* ЗАГОЛОВОК ПАНЕЛИ И СЕЛЕКТОР УЧАСТНИКА */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          paddingBottom: 14,
          borderBottom: '1px solid #272733',
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sliders size={20} color="#f8fafc" />
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#f1f5f9' }}>
            Универсальная панель управления движениями бункай
          </h3>
          <span style={{ fontSize: '0.74rem', background: 'rgba(255, 255, 255, 0.10)', color: '#f8fafc', border: '1px solid rgba(255, 255, 255, 0.22)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
            Эпизод {currentStepIndex + 1}
          </span>
        </div>

        {/* Выбор активного участника: Тори / Укэ 1 / Укэ 2 и быстрое тестирование */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {onReplayStep && (
            <button
              type="button"
              onClick={onReplayStep}
              title="Мгновенно повторить текущий шаг для быстрой проверки изменений (Горячая клавиша: R)"
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: '1.5px solid #f8fafc',
                background: 'rgba(255, 255, 255, 0.12)',
                color: '#f8fafc',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease',
              }}
            >
              <RotateCcw size={14} /> Повторить шаг (R)
            </button>
          )}
          <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginLeft: 4 }}>Участник:</span>
          <button
            type="button"
            onClick={() => setSelectedParticipant('tori')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: selectedParticipant === 'tori' ? '1.5px solid #f8fafc' : '1px solid #334155',
              background: selectedParticipant === 'tori' ? 'rgba(255, 255, 255, 0.18)' : '#1e1e28',
              color: selectedParticipant === 'tori' ? '#ffffff' : '#cbd5e1',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Zap size={14} color={selectedParticipant === 'tori' ? '#ffffff' : '#94a3b8'} /> Тори — Атакующий (Синее доги)
          </button>
          <button
            type="button"
            onClick={() => setSelectedParticipant('uke1')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: selectedParticipant === 'uke1' ? '1.5px solid #f8fafc' : '1px solid #334155',
              background: selectedParticipant === 'uke1' ? 'rgba(248, 250, 252, 0.20)' : '#1e1e28',
              color: selectedParticipant === 'uke1' ? '#f8fafc' : '#cbd5e1',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Shield size={14} color="#f8fafc" /> Укэ 1 — Защищающийся (Белое доги)
          </button>
          {showUke2 && (
            <button
              type="button"
              onClick={() => setSelectedParticipant('uke2')}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: selectedParticipant === 'uke2' ? '1.5px solid #94a3b8' : '1px solid #334155',
                background: selectedParticipant === 'uke2' ? 'rgba(148, 163, 184, 0.20)' : '#1e1e28',
                color: selectedParticipant === 'uke2' ? '#cbd5e1' : '#64748b',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <User size={14} color="#94a3b8" /> Укэ 2 — Ассистент (Графит)
            </button>
          )}
        </div>
      </div>

      {/* ТИП ДЕЙСТВИЯ (ACTION TYPE SELECTOR) */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, marginBottom: 6 }}>
          Тип действия ({selectedParticipant === 'tori' ? 'Тори' : 'Укэ'}):
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {BUNKAI_ACTION_TYPES.map((act) => {
            const isActive = activeActionType === act.id;
            return (
              <button
                key={act.id}
                type="button"
                onClick={() => setActiveActionType(act.id)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 5,
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: isActive ? '1px solid #ffffff' : '1px solid #334155',
                  background: isActive ? '#f8fafc' : '#171720',
                  color: isActive ? '#0f172a' : '#e2e8f0',
                  transition: 'all 0.12s ease',
                  boxShadow: isActive ? '0 2px 6px rgba(0, 0, 0, 0.4)' : 'none',
                }}
              >
                {act.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 9 РАЗДЕЛОВ УНИВЕРСАЛЬНОЙ ПАНЕЛИ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        
        {/* ГРУППА 1: ПОЛОЖЕНИЕ В ПРОСТРАНСТВЕ */}
        <div style={{ background: '#14141c', border: '1px solid #272733', borderRadius: 8, padding: 12 }}>
          <div
            onClick={() => toggleSection('spatial')}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: expandedSections.spatial ? 10 : 0 }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Move size={15} color="#f8fafc" /> 1. Положение в пространстве (X, Y, Z, Ма-ай)
            </span>
            {expandedSections.spatial ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
          </div>

          {expandedSections.spatial && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Боевая дистанция боя (Ма-ай) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
                  <span style={{ color: '#cbd5e1', fontWeight: 600 }}>Дистанция боя (Ма-ай):</span>
                  <span style={{ color: '#38bdf8', fontWeight: 700, fontFamily: 'monospace' }}>
                    {(placement?.finalDist || combatDistance).toFixed(2)} м
                  </span>
                </div>
                <input
                  type="range"
                  min="0.80"
                  max="2.80"
                  step="0.05"
                  value={combatDistance}
                  onChange={(e) => notify('combatDistance', parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => notify('combatDistance', 0.85)}
                    style={{ flex: 1, padding: '3px 4px', fontSize: '0.68rem', borderRadius: 4, background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', cursor: 'pointer' }}
                  >
                    Чика-ма (0.85м)
                  </button>
                  <button
                    type="button"
                    onClick={() => notify('combatDistance', 1.45)}
                    style={{ flex: 1, padding: '3px 4px', fontSize: '0.68rem', borderRadius: 4, background: '#1e293b', border: '1px solid #334155', color: '#34d399', cursor: 'pointer' }}
                  >
                    Иссоку (1.45м)
                  </button>
                  <button
                    type="button"
                    onClick={() => notify('combatDistance', 2.30)}
                    style={{ flex: 1, padding: '3px 4px', fontSize: '0.68rem', borderRadius: 4, background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', cursor: 'pointer' }}
                  >
                    То-ма (2.30м)
                  </button>
                </div>
              </div>

              {/* Координаты положения по осям X, Y, Z */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 10, borderRadius: 6, border: '1px solid #334155' }}>
                <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#f8fafc', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Координаты по осям ({selectedParticipant === 'tori' ? '1 — Тори' : '2 — Укэ'}):</span>
                  <span style={{ fontSize: '0.70rem', color: '#94a3b8' }}>Единицы: метры (м)</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  <div>
                    <label style={{ fontSize: '0.70rem', color: '#fca5a5', fontWeight: 600 }}>Ось X (Боковой сдвиг):</label>
                    <input
                      type="number"
                      step="0.05"
                      value={Number(currentPosX).toFixed(2)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) handlePosXChange(val);
                      }}
                      style={{ width: '100%', padding: '4px 6px', borderRadius: 4, background: '#1a1a24', color: '#f8fafc', border: '1px solid #ef4444', fontSize: '0.75rem', fontFamily: 'monospace' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.70rem', color: '#86efac', fontWeight: 600 }}>Ось Y (Высота):</label>
                    <input
                      type="number"
                      step="0.05"
                      value={Number(currentPosY).toFixed(2)}
                      readOnly
                      style={{ width: '100%', padding: '4px 6px', borderRadius: 4, background: '#1a1a24', color: '#86efac', border: '1px solid #22c55e', fontSize: '0.75rem', fontFamily: 'monospace' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.70rem', color: '#93c5fd', fontWeight: 600 }}>Ось Z (Дистанция):</label>
                    <input
                      type="number"
                      step="0.05"
                      value={Number(currentPosZ).toFixed(2)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) handlePosZChange(val);
                      }}
                      style={{ width: '100%', padding: '4px 6px', borderRadius: 4, background: '#1a1a24', color: '#f8fafc', border: '1px solid #3b82f6', fontSize: '0.75rem', fontFamily: 'monospace' }}
                    />
                  </div>
                </div>

                {/* Быстрые кнопки смещения Тай-сабаки */}
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => handlePosXChange((currentPosX || 0) - 0.35)}
                    style={{ flex: 1, padding: '3px 4px', fontSize: '0.68rem', borderRadius: 4, background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', cursor: 'pointer' }}
                  >
                    ← Уход влево (-0.35м)
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePosXChange(0)}
                    style={{ flex: 1, padding: '3px 4px', fontSize: '0.68rem', borderRadius: 4, background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', cursor: 'pointer' }}
                  >
                    Центр (X=0)
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePosXChange((currentPosX || 0) + 0.35)}
                    style={{ flex: 1, padding: '3px 4px', fontSize: '0.68rem', borderRadius: 4, background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', cursor: 'pointer' }}
                  >
                    Уход вправо (+0.35м) →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ГРУППА 2: УПРАВЛЕНИЕ НАПРАВЛЕНИЕМ И УГЛАМИ ПОВОРОТА (КРИТИЧЕСКОЕ ТРЕБОВАНИЕ) */}
        <div style={{ background: '#14141c', border: '1px solid #272733', borderRadius: 8, padding: 12 }}>
          <div
            onClick={() => toggleSection('orientation')}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: expandedSections.orientation ? 10 : 0 }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#38bdf8', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Compass size={15} color="#38bdf8" /> 2. Ориентация и поворот всего тела
            </span>
            {expandedSections.orientation ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
          </div>

          {expandedSections.orientation && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* БЛОК 1: ЦЕЛЕВОЙ КОНЕЧНЫЙ УГОЛ ПОВОРОТА МОДЕЛИ (END YAW) */}
              <div style={{ padding: '10px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 6, border: '1px solid #334155' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.78rem', color: '#f8fafc', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <RotateCcw size={13} color="#38bdf8" /> Конечный угол поворота {selectedParticipant === 'tori' ? 'Тори (Синий)' : 'Укэ (Белый)'}:
                  </span>
                  <span style={{ fontSize: '0.82rem', color: '#f8fafc', fontWeight: 700, fontFamily: 'monospace', background: '#1e293b', padding: '2px 6px', borderRadius: 4, border: '1px solid #334155' }}>
                    {currentEndYawDeg > 0 ? `+${currentEndYawDeg}` : currentEndYawDeg}°
                  </span>
                </div>
                <div style={{ fontSize: '0.70rem', color: '#94a3b8', marginBottom: 6 }}>
                  Ориентация в конце шага: <strong style={{ color: '#f8fafc' }}>{getDirectionLabel(currentEndYawDeg)}</strong>
                </div>

                {/* Кнопка мгновенной ориентации на противника */}
                <button
                  type="button"
                  onClick={handleFaceOpponent}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    borderRadius: 5,
                    background: 'rgba(16, 185, 129, 0.16)',
                    color: '#34d399',
                    border: '1px solid #10b981',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    marginBottom: 8,
                  }}
                  title="Автоматически развернуть модель лицом к противнику"
                >
                  <Target size={14} color="#34d399" />
                  🎯 Развернуть лицом к противнику ({idealFacingYawDeg > 0 ? `+${idealFacingYawDeg}` : idealFacingYawDeg}°)
                </button>

                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="5"
                  value={currentEndYawDeg}
                  onChange={(e) => handleEndYawChange(parseInt(e.target.value, 10))}
                  style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                />

                {/* Быстрые углы пресетов */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginTop: 6 }}>
                  {[
                    { deg: 0, label: '0° (Север)' },
                    { deg: 45, label: '+45°' },
                    { deg: 90, label: '+90° (Восток)' },
                    { deg: 180, label: '180° (Юг)' },
                    { deg: -45, label: '-45°' },
                    { deg: -90, label: '-90° (Запад)' },
                    { deg: 35, label: '+35° (Уход)' },
                    { deg: -35, label: '-35° (Уход)' },
                  ].map((preset) => (
                    <button
                      key={preset.deg}
                      type="button"
                      onClick={() => handleEndYawChange(preset.deg)}
                      style={{
                        padding: '4px 2px',
                        fontSize: '0.68rem',
                        fontWeight: currentEndYawDeg === preset.deg ? 700 : 500,
                        borderRadius: 4,
                        background: currentEndYawDeg === preset.deg ? '#f8fafc' : '#1e293b',
                        color: currentEndYawDeg === preset.deg ? '#0f172a' : '#cbd5e1',
                        border: currentEndYawDeg === preset.deg ? '1px solid #ffffff' : '1px solid #334155',
                        cursor: 'pointer',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Шаговые кнопки и сброс */}
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => handleEndYawChange(currentEndYawDeg - 90)}
                    title="Повернуть влево на 90 градусов"
                    style={{
                      flex: 1,
                      padding: '4px 2px',
                      fontSize: '0.70rem',
                      fontWeight: 600,
                      borderRadius: 4,
                      background: '#1e293b',
                      color: '#cbd5e1',
                      border: '1px solid #334155',
                      cursor: 'pointer',
                    }}
                  >
                    ↺ -90°
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEndYawChange(currentEndYawDeg + 90)}
                    title="Повернуть вправо на 90 градусов"
                    style={{
                      flex: 1,
                      padding: '4px 2px',
                      fontSize: '0.70rem',
                      fontWeight: 600,
                      borderRadius: 4,
                      background: '#1e293b',
                      color: '#cbd5e1',
                      border: '1px solid #334155',
                      cursor: 'pointer',
                    }}
                  >
                    ↻ +90°
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEndYawChange(currentEndYawDeg + 180)}
                    title="Развернуться кругом на 180 градусов"
                    style={{
                      flex: 1,
                      padding: '4px 2px',
                      fontSize: '0.70rem',
                      fontWeight: 600,
                      borderRadius: 4,
                      background: '#1e293b',
                      color: '#cbd5e1',
                      border: '1px solid #334155',
                      cursor: 'pointer',
                    }}
                  >
                    ⟲ 180°
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEndYawChange(0)}
                    title="Сбросить конечный угол разворота в 0°"
                    style={{
                      flex: 1,
                      padding: '4px 2px',
                      fontSize: '0.70rem',
                      fontWeight: 600,
                      borderRadius: 4,
                      background: '#1e293b',
                      color: '#cbd5e1',
                      border: '1px solid #334155',
                      cursor: 'pointer',
                    }}
                  >
                    Сброс (0°)
                  </button>
                </div>

                {/* Кнопки мгновенного предпросмотра конечной позы или анимации */}
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {onScrubStep && (
                    <button
                      type="button"
                      onClick={() => onScrubStep(1.0)}
                      title="Мгновенно зафиксировать модели в конечной позе шага для оценки угла поворота"
                      style={{
                        flex: 1,
                        padding: '4px 6px',
                        fontSize: '0.70rem',
                        fontWeight: 600,
                        borderRadius: 4,
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: '#f8fafc',
                        border: '1px solid #475569',
                        cursor: 'pointer',
                      }}
                    >
                      👁 Финальная поза шага
                    </button>
                  )}
                  {onReplayStep && (
                    <button
                      type="button"
                      onClick={onReplayStep}
                      title="Воспроизвести шаг с плавным переходом к заданному конечному повороту"
                      style={{
                        flex: 1,
                        padding: '4px 6px',
                        fontSize: '0.70rem',
                        fontWeight: 600,
                        borderRadius: 4,
                        background: '#1e293b',
                        color: '#f8fafc',
                        border: '1px solid #475569',
                        cursor: 'pointer',
                      }}
                    >
                      ▶ Проиграть шаг
                    </button>
                  )}
                </div>
              </div>

              {/* БЛОК 2: Режимы ориентации (Режим 1 - 5) */}
              <div>
                <label style={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Режим ориентации:
                </label>
                <select
                  value={orientationMode}
                  onChange={(e) => {
                    const mode = e.target.value;
                    setOrientationMode(mode);
                    notify(selectedParticipant === 'tori' ? 'orientationModeTori' : 'orientationModeUke', mode);
                  }}
                  style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: '#1a1a24', color: '#f8fafc', border: '1px solid #334155', fontSize: '0.76rem', cursor: 'pointer' }}
                >
                  {BUNKAI_ORIENTATION_MODES.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* БЛОК 3: Угол относительно противника (0°, 30°, 45°, 90°, 180°) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
                  <span style={{ color: '#cbd5e1', fontWeight: 600 }}>Относительный угол к противнику:</span>
                  <span style={{ color: '#f8fafc', fontWeight: 700, fontFamily: 'monospace' }}>
                    {relativeAngleDeg > 0 ? `+${relativeAngleDeg}` : relativeAngleDeg}°
                  </span>
                </div>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="5"
                  value={relativeAngleDeg}
                  onChange={(e) => handleRelativeAngleChange(parseInt(e.target.value, 10))}
                  style={{ width: '100%', accentColor: '#cbd5e1', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  {[0, 30, 45, 90, 180].map((ang) => (
                    <button
                      key={ang}
                      type="button"
                      onClick={() => handleRelativeAngleChange(ang)}
                      style={{
                        flex: 1,
                        padding: '3px 2px',
                        fontSize: '0.68rem',
                        fontWeight: relativeAngleDeg === ang ? 700 : 500,
                        borderRadius: 4,
                        background: relativeAngleDeg === ang ? '#f8fafc' : '#1e293b',
                        color: relativeAngleDeg === ang ? '#0f172a' : '#cbd5e1',
                        border: relativeAngleDeg === ang ? '1px solid #ffffff' : '1px solid #334155',
                        cursor: 'pointer',
                      }}
                    >
                      {ang}°
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#38bdf8', marginTop: 4 }}>
                  ✓ Включает согласованный разворот стоп, коленей, таза, корпуса и плеч.
                </div>
              </div>

              {/* Механика разворота */}
              <div>
                <label style={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Механика разворота:
                </label>
                <select
                  value={turnMechanic}
                  onChange={(e) => setTurnMechanic(e.target.value)}
                  style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: '#1a1a24', color: '#f8fafc', border: '1px solid #334155', fontSize: '0.76rem', cursor: 'pointer' }}
                >
                  {BUNKAI_TURN_MECHANICS.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* ГРУППА 3: НАСТРОЙКА СТОЙКИ И ЕЁ СТОРОНЫ (ХИДАРИ / МИГИ) */}
        <div style={{ background: '#14141c', border: '1px solid #272733', borderRadius: 8, padding: 12 }}>
          <div
            onClick={() => toggleSection('stance')}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: expandedSections.stance ? 10 : 0 }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#34d399', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Footprints size={15} color="#34d399" /> 3. Стойка и её сторона (Хидари / Миги)
            </span>
            {expandedSections.stance ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
          </div>

          {expandedSections.stance && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Явный переключатель стороны стойки */}
              <div>
                <label style={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Сторона стойки (отдельный параметр):
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => handleStanceSideChange('left')}
                    style={{
                      padding: '5px 8px',
                      borderRadius: 5,
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: currentStanceSide === 'left' ? '#10b981' : '#1e293b',
                      color: currentStanceSide === 'left' ? '#000' : '#f8fafc',
                      border: '1px solid #334155',
                    }}
                  >
                    Хидари (Левая нога впереди)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStanceSideChange('right')}
                    style={{
                      padding: '5px 8px',
                      borderRadius: 5,
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: currentStanceSide === 'right' ? '#10b981' : '#1e293b',
                      color: currentStanceSide === 'right' ? '#000' : '#f8fafc',
                      border: '1px solid #334155',
                    }}
                  >
                    Миги (Правая нога впереди)
                  </button>
                </div>
              </div>

              {/* Выбор стойки Сётокан */}
              <div>
                <label style={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Стойка Сётокан:
                </label>
                <select
                  value={currentStanceId}
                  onChange={(e) => handleStanceSelect(e.target.value)}
                  style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: '#1a1a24', color: '#f8fafc', border: '1px solid #334155', fontSize: '0.76rem', cursor: 'pointer' }}
                >
                  <optgroup label="Дзэнкуцу-дати (前屈立ち)">
                    <option value="zenkutsu_dachi_left">Дзэнкуцу-дати (Хидари — левая)</option>
                    <option value="zenkutsu_dachi_right">Дзэнкуцу-дати (Миги — правая)</option>
                  </optgroup>
                  <optgroup label="Кокуцу-дати (後屈立ち)">
                    <option value="kokutsu_dachi_left">Кокуцу-дати (Хидари — левая)</option>
                    <option value="kokutsu_dachi_right">Кокуцу-дати (Миги — правая)</option>
                  </optgroup>
                  <optgroup label="Фудо-дати (不動立ち)">
                    <option value="fudo_dachi">Фудо-дати (Хидари — левая)</option>
                    <option value="fudo_dachi_right">Фудо-дати (Миги — правая)</option>
                  </optgroup>
                  <optgroup label="Симметричные">
                    <option value="kiba_dachi">Киба-дати (Стойка всадника)</option>
                    <option value="stance_shiko">Сико-дати (Квадратная стойка)</option>
                    <option value="heiko_dachi">Хэйко-дати (Параллельная стойка)</option>
                    <option value="stance_musubi">Мусуби-дати (Стойка поклона)</option>
                    <option value="stance_heisoku">Хэйсоку-дати (Сомкнутая стойка)</option>
                  </optgroup>
                </select>
              </div>

              {/* Анатомическая справка стойки */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)', fontSize: '0.72rem' }}>
                <div style={{ color: '#34d399', fontWeight: 700, marginBottom: 4 }}>
                  {currentStanceSpec.nameRu} ({currentStanceSpec.kanji}) · {currentStanceSpec.sideRu}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', marginBottom: 3 }}>
                  <span>Распределение веса:</span>
                  <span style={{ color: '#f8fafc', fontWeight: 600 }}>{currentStanceSpec.weightRatio?.[0]}% передняя / {currentStanceSpec.weightRatio?.[1]}% задняя</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', marginBottom: 3 }}>
                  <span>Длина / Ширина:</span>
                  <span style={{ color: '#f8fafc', fontWeight: 600 }}>{currentStanceSpec.feetDistance}м / {currentStanceSpec.feetWidth}м</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                  <span>Сгиб коленей:</span>
                  <span style={{ color: '#f8fafc', fontWeight: 600 }}>{currentStanceSpec.kneeFlex}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ГРУППА 4: УПРАВЛЕНИЕ ПЕРЕМЕЩЕНИЕМ (LOCOMOTION) */}
        <div style={{ background: '#14141c', border: '1px solid #272733', borderRadius: 8, padding: 12 }}>
          <div
            onClick={() => toggleSection('locomotion')}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: expandedSections.locomotion ? 10 : 0 }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fbbf24', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Move size={15} color="#fbbf24" /> 4. Настройка перемещения (Сабаки)
            </span>
            {expandedSections.locomotion ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
          </div>

          {expandedSections.locomotion && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>Тип перемещения:</label>
                  <select
                    value={motionType}
                    onChange={(e) => setMotionType(e.target.value)}
                    style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: '#1a1a24', color: '#f8fafc', border: '1px solid #334155', fontSize: '0.76rem', cursor: 'pointer' }}
                  >
                    <option value="step">Шаг вперёд (Аюми-аси)</option>
                    <option value="yuri_ashi">Подшаг (Юри-аси)</option>
                    <option value="lunge">Выпад (Ой-коми)</option>
                    <option value="pivot">Разворот (Тэнсин)</option>
                    <option value="slide">Скольжение (Сури-аси)</option>
                    <option value="strike_on_move">Удар в движении</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>Направление:</label>
                  <select
                    value={locomotionDir}
                    onChange={(e) => setLocomotionDir(e.target.value)}
                    style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: '#1a1a24', color: '#f8fafc', border: '1px solid #334155', fontSize: '0.76rem', cursor: 'pointer' }}
                  >
                    <option value="forward">Вперёд</option>
                    <option value="backward">Назад</option>
                    <option value="left">Влево</option>
                    <option value="right">Вправо</option>
                    <option value="diagonal">По диагонали (45°)</option>
                  </select>
                </div>
              </div>

              {/* Постановка ноги при ударе ногой */}
              <div style={{ background: 'rgba(251, 191, 36, 0.08)', padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(251, 191, 36, 0.25)' }}>
                <div style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 600, marginBottom: 5 }}>
                  Постановка ноги при ударе ногой:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => notify(selectedParticipant === 'tori' ? 'toriLandingMode' : 'ukeLandingMode', 'back')}
                    style={{
                      padding: '4px 6px',
                      borderRadius: 4,
                      fontSize: '0.70rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: (activePart.landingMode === 'back') ? '#f8fafc' : '#1e293b',
                      color: (activePart.landingMode === 'back') ? '#0f172a' : '#f8fafc',
                      border: (activePart.landingMode === 'back') ? '1px solid #ffffff' : '1px solid #334155',
                    }}
                  >
                    🔙 Ногу назад (в исходную)
                  </button>
                  <button
                    type="button"
                    onClick={() => notify(selectedParticipant === 'tori' ? 'toriLandingMode' : 'ukeLandingMode', 'forward')}
                    style={{
                      padding: '4px 6px',
                      borderRadius: 4,
                      fontSize: '0.70rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: (activePart.landingMode === 'forward') ? '#f8fafc' : '#1e293b',
                      color: (activePart.landingMode === 'forward') ? '#0f172a' : '#f8fafc',
                      border: (activePart.landingMode === 'forward') ? '1px solid #ffffff' : '1px solid #334155',
                    }}
                  >
                    🔜 Ногу вперед (со сменой)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ГРУППА 5: НАСТРОЙКА ТЕХНИКИ И КОНЕЧНОСТЕЙ */}
        <div style={{ background: '#14141c', border: '1px solid #272733', borderRadius: 8, padding: 12 }}>
          <div
            onClick={() => toggleSection('technique')}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: expandedSections.technique ? 10 : 0 }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f43f5e', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Zap size={15} color="#f43f5e" /> 5. Техника и конечности
            </span>
            {expandedSections.technique ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
          </div>

          {expandedSections.technique && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Независимый выбор стороны конечности (Левая / Правая) */}
              <div>
                <label style={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Конечность выполнения (независима от стойки):
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setLimbSide('left')}
                    style={{
                      padding: '5px 8px',
                      borderRadius: 4,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: limbSide === 'left' ? '#f43f5e' : '#1e293b',
                      color: limbSide === 'left' ? '#fff' : '#cbd5e1',
                      border: '1px solid #334155',
                    }}
                  >
                    Левая рука / нога (Хидари)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLimbSide('right')}
                    style={{
                      padding: '5px 8px',
                      borderRadius: 4,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: limbSide === 'right' ? '#f43f5e' : '#1e293b',
                      color: limbSide === 'right' ? '#fff' : '#cbd5e1',
                      border: '1px solid #334155',
                    }}
                  >
                    Правая рука / нога (Миги)
                  </button>
                </div>
              </div>

              {/* Выбор техники из библиотеки */}
              <div>
                <label style={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Боевая техника:
                </label>
                <select
                  value={activePart.clipName || 'oi_zuki_right'}
                  onChange={(e) => handleTechniqueSelect(e.target.value)}
                  style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: '#1a1a24', color: '#f8fafc', border: '1px solid #334155', fontSize: '0.76rem', cursor: 'pointer' }}
                >
                  {BUNKAI_TECHNIQUE_CATEGORIES.map((cat) => (
                    <optgroup key={cat.id} label={cat.label}>
                      {cat.techniques.map((tech) => (
                        <option key={tech.value} value={tech.value}>{tech.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* ГРУППА 6: ВЗАИМОДЕЙСТВИЕ С ПРОТИВНИКОМ (INTERACTION) */}
        <div style={{ background: '#14141c', border: '1px solid #272733', borderRadius: 8, padding: 12 }}>
          <div
            onClick={() => toggleSection('interaction')}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: expandedSections.interaction ? 10 : 0 }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#a855f7', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Hand size={15} color="#a855f7" /> 6. Взаимодействие и контакт
            </span>
            {expandedSections.interaction ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
          </div>

          {expandedSections.interaction && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>Тип контакта:</label>
                  <select
                    value={contactType}
                    onChange={(e) => {
                      setContactType(e.target.value);
                      notify('contactType', e.target.value);
                    }}
                    style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: '#1a1a24', color: '#f8fafc', border: '1px solid #334155', fontSize: '0.76rem', cursor: 'pointer' }}
                  >
                    <option value="none">Дистанция (без касания)</option>
                    <option value="block_haivan">Блок предплечья (Укэ)</option>
                    <option value="block_gedan">Нижний блок (Гэдан)</option>
                    <option value="block_jodan">Верхний блок (Агэ-укэ)</option>
                    <option value="arm_strike">Удар второй рукой выше локтя</option>
                    <option value="joint_lock">Залом сустава (Кансэцу)</option>
                    <option value="sweep_fall">Подсечка и падение</option>
                    <option value="ground_finish">Добивание в партере</option>
                    <option value="strike_chudan">Удар в корпус</option>
                    <option value="strike_throat">Удар в горло</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>Зона контакта:</label>
                  <select
                    value={contactZone}
                    onChange={(e) => setContactZone(e.target.value)}
                    style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: '#1a1a24', color: '#f8fafc', border: '1px solid #334155', fontSize: '0.76rem', cursor: 'pointer' }}
                  >
                    <option value="above_elbow">Выше локтя (Плечевой сегмент)</option>
                    <option value="wrist">Запястье (Тэкуби)</option>
                    <option value="forearm">Предплечье (Удэ)</option>
                    <option value="ribs">Ребра / Корпус (Тюдан)</option>
                    <option value="throat">Горло / Шея (Нодо)</option>
                    <option value="jaw">Челюсть (Аго)</option>
                    <option value="ankle">Голеностоп / стопа (Аси)</option>
                  </select>
                </div>
              </div>

              {/* Контроль суставных ограничений */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: 2 }}>
                  <span style={{ color: '#cbd5e1' }}>Угол выкручивания сустава:</span>
                  <span style={{ color: jointAngleDeg > 45 ? '#f87171' : '#34d399', fontWeight: 700 }}>{jointAngleDeg}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="65"
                  value={jointAngleDeg}
                  onChange={(e) => setJointAngleDeg(parseInt(e.target.value, 10))}
                  style={{ width: '100%', accentColor: jointAngleDeg > 45 ? '#ef4444' : '#10b981', cursor: 'pointer' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ГРУППА 7: ВРЕМЕННЫЕ ПАРАМЕТРЫ И ФАЗЫ (TIMING) */}
        <div style={{ background: '#14141c', border: '1px solid #272733', borderRadius: 8, padding: 12 }}>
          <div
            onClick={() => toggleSection('timing')}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: expandedSections.timing ? 10 : 0 }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Clock size={15} color="#f59e0b" /> 7. Параметры времени и фазы
            </span>
            {expandedSections.timing ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
          </div>

          {expandedSections.timing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>Длительность шага:</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="6.0"
                    value={currentEpisode.duration || 2.4}
                    onChange={(e) => notify('duration', parseFloat(e.target.value))}
                    style={{ width: '100%', padding: '4px 6px', borderRadius: 4, background: '#1a1a24', color: '#f8fafc', border: '1px solid #334155', fontSize: '0.75rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>Момент контакта (0..1):</label>
                  <input
                    type="number"
                    step="0.02"
                    min="0.1"
                    max="0.9"
                    value={currentEpisode.tContact || 0.48}
                    onChange={(e) => notify('tContact', parseFloat(e.target.value))}
                    style={{ width: '100%', padding: '4px 6px', borderRadius: 4, background: '#1a1a24', color: '#f8fafc', border: '1px solid #334155', fontSize: '0.75rem' }}
                  />
                </div>
              </div>

              {/* 4 Ключевые фазы */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, textAlign: 'center', fontSize: '0.66rem' }}>
                <div style={{ background: '#1e293b', padding: '4px 2px', borderRadius: 4, color: '#94a3b8' }}>
                  0-20%<br />Камаэ
                </div>
                <div style={{ background: '#1e293b', padding: '4px 2px', borderRadius: 4, color: '#38bdf8' }}>
                  20-60%<br />Сближение
                </div>
                <div style={{ background: '#1e293b', padding: '4px 2px', borderRadius: 4, color: '#f43f5e' }}>
                  60-75%<br />Кимэ
                </div>
                <div style={{ background: '#1e293b', padding: '4px 2px', borderRadius: 4, color: '#f8fafc' }}>
                  75-100%<br />Дзансин
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ГРУППА 8: ВИЗУАЛИЗАЦИЯ 3D И МАНИПУЛЯТОРЫ */}
        <div style={{ background: '#14141c', border: '1px solid #272733', borderRadius: 8, padding: 12 }}>
          <div
            onClick={() => toggleSection('visuals')}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: expandedSections.visuals ? 10 : 0 }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#06b6d4', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Eye size={15} color="#06b6d4" /> 8. Визуальные индикаторы в 3D сцене
            </span>
            {expandedSections.visuals ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
          </div>

          {expandedSections.visuals && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.76rem', color: '#cbd5e1', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={visualAidSettings.showCoordinateSystem !== false}
                  onChange={(e) => onVisualAidToggle && onVisualAidToggle('showCoordinateSystem', e.target.checked)}
                />
                <span style={{ fontWeight: 600, color: '#38bdf8' }}>🧭 Система координат Бункай (оси X, Y, Z и вектор поворотов)</span>
              </label>
            </div>
          )}
        </div>

        {/* ГРУППА 9: БИОМЕХАНИЧЕСКАЯ ВАЛИДАЦИЯ И ПРЕДУПРЕЖДЕНИЯ */}
        <div style={{ background: '#14141c', border: '1px solid #272733', borderRadius: 8, padding: 12 }}>
          <div
            onClick={() => toggleSection('validation')}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: expandedSections.validation ? 10 : 0 }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: biomechanicsAudit.isValid ? '#10b981' : '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {biomechanicsAudit.isValid ? <CheckCircle2 size={15} color="#10b981" /> : <AlertTriangle size={15} color="#f59e0b" />}
              9. Проверка биомеханики и безопасности
            </span>
            {expandedSections.validation ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
          </div>

          {expandedSections.validation && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {biomechanicsAudit.isValid && (
                <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.35)', color: '#6ee7b7', padding: '6px 10px', borderRadius: 6, fontSize: '0.74rem', fontWeight: 600 }}>
                  ✓ Все параметры согласованы: стойка, углы всего тела, безопасная дистанция и контакты корректны.
                </div>
              )}

              {biomechanicsAudit.warnings.map((warn, wIdx) => (
                <div key={wIdx} style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', padding: '6px 10px', borderRadius: 6, fontSize: '0.72rem', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <AlertTriangle size={13} color="#f87171" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{warn}</span>
                </div>
              ))}

              {biomechanicsAudit.checks.map((chk, cIdx) => (
                <div key={cIdx} style={{ fontSize: '0.70rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <CheckCircle2 size={12} color="#10b981" /> {chk}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
