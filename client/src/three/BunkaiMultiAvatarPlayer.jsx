import {
  Trophy, Swords, MapPin, Target, Shield, AlertTriangle,
  Ruler, Compass, CheckCircle2, RotateCcw, Play, Pause,
  ChevronLeft, ChevronRight, Zap, Eye, Footprints, Sliders
} from 'lucide-react';
import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import MultiAvatarModel from './MultiAvatarModel';
import TraditionalDojo from './TraditionalDojo';
import BunkaiVisualAids from './BunkaiVisualAids';
import BunkaiMotionControlPanel from './BunkaiMotionControlPanel';
import {
  HEIAN_SHODAN_BUNKAI_18_STEPS,
  CANONICAL_BUNKAI_EPISODES,
  normalizeBunkaiEpisode,
  computeAvatarPlacement,
  chainBunkaiEpisodes,
  resolveBunkaiClip,
  isTechniqueStationary,
  SHOTOKAN_STANCES,
} from './bunkaiScenarioEngine';
import { resolveBodyInteractions } from './bodyColliderSystem';
import { animationRegistry } from './animationRegistry';

export const BUNKAI_ATTACK_STRIKES = [
  { value: 'oi_zuki_right', label: 'Ой-цуки (Прямой выпад кулаком вперед)' },
  { value: 'gyaku_zuki_right', label: 'Гяку-цуки (Реверсивный удар кулаком)' },
  { value: 'gyaku_zuki_left', label: 'Гяку-цуки левой рукой' },
  { value: 'choku_zuki', label: 'Чоку-цуки (Прямой удар на месте)' },
  { value: 'kizami_zuki', label: 'Кизами-цуки (Встречный джеб)' },
  { value: 'mae_geri_right', label: 'Маэ-гэри (Прямой удар правой ногой)' },
  { value: 'mae_geri_left', label: 'Маэ-гэри левой (Прямой удар ногой)' },
  { value: 'mawashi_geri', label: 'Маваси-гэри (Круговой удар ногой)' },
  { value: 'yoko_geri', label: 'Ёко-гэри (Боковой пробивающий удар)' },
  { value: 'ushiro_geri', label: 'Усиро-гэри (Удар пяткой назад)' },
  { value: 'uraken_uchi', label: 'Уракэн-учи (Бэкфист в висок)' },
  { value: 'tetsui_uchi', label: 'Тэтцуи-учи (Удар-молот)' },
  { value: 'empi_uchi', label: 'Эмпи-учи (Сокрушительный удар локтем)' },
  { value: 'shuto_uchi', label: 'Сюто-учи (Секущий удар ребром ладони)' },
  { value: 'hook', label: 'Хук / Боковой с размаха' },
  { value: 'ren_zuki', label: 'Рэн-цуки (Двойка кулаками)' },
  { value: 'sanbon_zuki', label: 'Санбон-цуки (Тройной пробивающий)' },
];

export const BUNKAI_DEFENSE_BLOCKS = [
  { value: 'age_uke_right', label: 'Агэ-укэ (Верхний восходящий блок)' },
  { value: 'age_uke_left', label: 'Агэ-укэ левой рукой' },
  { value: 'soto_uke', label: 'Сото-укэ (Блок снаружи-внутрь)' },
  { value: 'uchi_uke', label: 'Ути-укэ (Блок изнутри-наружу)' },
  { value: 'gedan_barai_left', label: 'Гэдан-барай (Нижний смет)' },
  { value: 'gedan_barai_right', label: 'Гэдан-барай правой рукой' },
  { value: 'shuto_uke', label: 'Сюто-укэ (Блок ребром ладони)' },
  { value: 'manji_uke', label: 'Манджи-укэ (Двойной блок)' },
  { value: 'gyaku_zuki_right', label: 'Контрудар Гяку-цуки (Реверсивный)' },
  { value: 'mae_geri_right', label: 'Контрудар Маэ-гэри (Навстречу)' },
  { value: 'empi_uchi', label: 'Контрудар Эмпи-учи (Локтем)' },
  { value: 'uraken_uchi', label: 'Контрудар Уракэн-учи (Бэкфист)' },
  { value: 'deashi_harai', label: 'Дэаси-харай (Сметающая подсечка)' },
  { value: 'ippon_seoi_nage', label: 'Иппон Сэои-нагэ (Бросок через плечо)' },
];

// Физические границы Додзё в симуляции бункай
const BUNKAI_DOJO_LIMITS = {
  minX: -7.2,
  maxX: 7.2,
  minZ: -7.2,
  maxZ: 7.2,
  minY: 0.25,
  maxY: 3.8,
  targetMinX: -4.8,
  targetMaxX: 4.8,
  targetMinZ: -4.8,
  targetMaxZ: 4.8,
  targetMinY: 0.4,
  targetMaxY: 1.8,
};

function BunkaiCameraBounds({ controlsRef }) {
  useFrame((state) => {
    if (!controlsRef.current) return;
    const controls = controlsRef.current;

    controls.target.x = THREE.MathUtils.clamp(controls.target.x, BUNKAI_DOJO_LIMITS.targetMinX, BUNKAI_DOJO_LIMITS.targetMaxX);
    controls.target.y = THREE.MathUtils.clamp(controls.target.y, BUNKAI_DOJO_LIMITS.targetMinY, BUNKAI_DOJO_LIMITS.targetMaxY);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, BUNKAI_DOJO_LIMITS.targetMinZ, BUNKAI_DOJO_LIMITS.targetMaxZ);

    state.camera.position.x = THREE.MathUtils.clamp(state.camera.position.x, BUNKAI_DOJO_LIMITS.minX, BUNKAI_DOJO_LIMITS.maxX);
    state.camera.position.y = THREE.MathUtils.clamp(state.camera.position.y, BUNKAI_DOJO_LIMITS.minY, BUNKAI_DOJO_LIMITS.maxY);
    state.camera.position.z = THREE.MathUtils.clamp(state.camera.position.z, BUNKAI_DOJO_LIMITS.minZ, BUNKAI_DOJO_LIMITS.maxZ);

    controls.update();
  });
  return null;
}

// Вспомогательное переключение стороны стойки (Левая ⇄ Правая)
function toggleStanceSide(st, defaultSt) {
  const current = st || defaultSt || 'zenkutsu_dachi_left';
  if (current.includes('left')) return current.replace('left', 'right');
  if (current.includes('right')) return current.replace('right', 'left');
  if (current === 'zenkutsu') return 'zenkutsu_dachi_right';
  if (current === 'kokutsu') return 'kokutsu_dachi_right';
  if (current === 'fudo' || current === 'fudo_dachi') return 'fudo_dachi_right';
  if (current === 'fudo_dachi_right') return 'fudo_dachi';
  return current;
}

/**
 * Плеер боевого применения (Бункай) Шотокан с динамическим контролем дистанции и анти-проникновением.
 * 
 * Особенности:
 * - Полноценная 18-шаговая последовательность Бункая «Хэйан Шодан» (1 — Тори атакующий, 2 — Укэ защищающийся).
 * - Динамическое изменение дистанции в зависимости от техники (То-ма, Иссоку-итто, Чика-ма, партер).
 * - Система анатомических коллайдеров и анти-проникновения:
 *   - Исключено прорезание кулака/стопы внутрь корпуса партнера.
 *   - Исключено взаимопроникновение тел (Torso Separation min 0.50м).
 *   - Фиксация допустимого контакта (блок, захват, болевой прием, удар в горло, добивание).
 * - Непрерывность боя: конечное положение каждого шага становится точным началом следующего.
 */
export default function BunkaiMultiAvatarPlayer({
  steps = null,
  defaultParticipantMode = '2-person',
  height = 540,
  onStepChange = null,
  activeStepIndex = 0,
  onStepParamChange = null,
  canEdit = true,
}) {
  const [currentStepIdx, setCurrentStepIdx] = useState(activeStepIndex || 0);
  const [showUke2, setShowUke2] = useState(defaultParticipantMode === '3-person');

  useEffect(() => {
    if (activeStepIndex !== undefined && activeStepIndex !== currentStepIdx) {
      setCurrentStepIdx(activeStepIndex);
      phraseRef.current = 0;
      setScrubProgress(null);
      setStepCompleted(false);
      zanshinTimerRef.current = 0;
      setIsPlaying(true);
    }
  }, [activeStepIndex]);

  useEffect(() => {
    setShowUke2(defaultParticipantMode === '3-person');
  }, [defaultParticipantMode]);

  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1.0);
  const [scrubProgress, setScrubProgress] = useState(null);
  const [stepCompleted, setStepCompleted] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [isLoopingStep, setIsLoopingStep] = useState(false);
  const zanshinTimerRef = useRef(0);

  const notifyParamChange = useCallback((field, value) => {
    if (typeof onStepParamChange === 'function') {
      onStepParamChange(currentStepIdx, field, value);
    }
  }, [onStepParamChange, currentStepIdx]);

  // Режим: 'continuous' (непрерывный боевой поток) | 'standalone' (центрированный изолированный шаг)
  const [stateMode, setStateMode] = useState('continuous');

  // Пользовательские интерактивные настройки управления движениями:
  // 1. Дистанция боя (Ма-ай)
  const [customDistance, setCustomDistance] = useState(null);

  // 2. Угол атаки Тори (Синий / Атакующий) и Угол ухода Укэ (Белый / Защищающийся / Тай-сабаки)
  const [toriAngleOffsetDeg, setToriAngleOffsetDeg] = useState(0);
  const [ukeEvasionAngleDeg, setUkeEvasionAngleDeg] = useState(0);

  // 3. Техники удара и блока
  const [customUkeClip, setCustomUkeClip] = useState('');
  const [customToriClip, setCustomToriClip] = useState('');

  // 4. Стойки и постановка ноги
  const [customToriStance, setCustomToriStance] = useState('');
  const [customToriFinalStance, setCustomToriFinalStance] = useState('');
  const [toriLandingMode, setToriLandingMode] = useState('auto'); // 'auto' | 'back' | 'forward'

  const [customUkeStance, setCustomUkeStance] = useState('');
  const [customUkeFinalStance, setCustomUkeFinalStance] = useState('');
  const [ukeLandingMode, setUkeLandingMode] = useState('auto'); // 'auto' | 'back' | 'forward'

  // Конечный угол поворота (End Yaw) для Тори и Укэ на текущем шаге
  const [customToriEndYawDeg, setCustomToriEndYawDeg] = useState(null);
  const [customUkeEndYawDeg, setCustomUkeEndYawDeg] = useState(null);
  const [orientationModeTori, setOrientationModeTori] = useState(undefined);
  const [orientationModeUke, setOrientationModeUke] = useState(undefined);
  const [customToriPosX, setCustomToriPosX] = useState(undefined);
  const [customToriPosZ, setCustomToriPosZ] = useState(undefined);
  const [customUkePosX, setCustomUkePosX] = useState(undefined);
  const [customUkePosZ, setCustomUkePosZ] = useState(undefined);
  const [showCoordinateHUD, setShowCoordinateHUD] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [missingClips, setMissingClips] = useState([]);

  // Режим отображения панели управления: 'universal' (9 групп настроек) | 'compact' (быстрые карточки)
  const [panelViewMode, setPanelViewMode] = useState('universal');
  const [visualAidSettings, setVisualAidSettings] = useState({
    showCoordinateSystem: true,
    showTorsoVector: true,
    showFootVectors: true,
    showAttackLine: true,
    showDistanceLine: true,
    showContactPoint: true,
    showSafeBoundaries: true,
  });

  const [replayNonce, setReplayNonce] = useState(0);

  const handleVisualAidToggle = useCallback((key, value) => {
    setVisualAidSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleScrubStep = useCallback((progress) => {
    setScrubProgress(progress);
    phraseRef.current = progress;
    setIsPlaying(false);
  }, []);

  const handleUniversalParamChange = useCallback((stepIdx, field, value) => {
    setHasUnsavedChanges(true);
    let isRotationOrPositionField = false;

    if (field === 'combatDistance') {
      setCustomDistance(value);
      isRotationOrPositionField = true;
    } else if (field === 'toriAngleOffsetDeg' || field === 'attackAngleDeg') {
      setToriAngleOffsetDeg(value);
      isRotationOrPositionField = true;
    } else if (field === 'ukeEvasionAngleDeg' || field === 'retreatAngleDeg' || field === 'taiSabakiAngleDeg') {
      setUkeEvasionAngleDeg(value);
      isRotationOrPositionField = true;
    } else if (field === 'toriEvasionAngleDeg') {
      setUkeEvasionAngleDeg(value);
      isRotationOrPositionField = true;
    } else if (field === 'toriEndAngleDeg' || field === 'customToriYawDeg' || field === 'toriYaw' || field === 'toriEndYaw') {
      setCustomToriEndYawDeg(Number(value));
      isRotationOrPositionField = true;
    } else if (field === 'ukeEndAngleDeg' || field === 'customUkeYawDeg' || field === 'ukeYaw' || field === 'ukeEndYaw') {
      setCustomUkeEndYawDeg(Number(value));
      isRotationOrPositionField = true;
    } else if (field === 'orientationModeTori') {
      setOrientationModeTori(value);
      isRotationOrPositionField = true;
    } else if (field === 'orientationModeUke') {
      setOrientationModeUke(value);
      isRotationOrPositionField = true;
    } else if (field === 'customToriPosX') {
      setCustomToriPosX(value);
      isRotationOrPositionField = true;
    } else if (field === 'customToriPosZ') {
      setCustomToriPosZ(value);
      isRotationOrPositionField = true;
    } else if (field === 'customUkePosX') {
      setCustomUkePosX(value);
      isRotationOrPositionField = true;
    } else if (field === 'customUkePosZ') {
      setCustomUkePosZ(value);
      isRotationOrPositionField = true;
    } else if (field === 'toriClip') {
      setCustomToriClip(value);
    } else if (field === 'ukeClip') {
      setCustomUkeClip(value);
    } else if (field === 'toriStance') {
      setCustomToriStance(value);
    } else if (field === 'ukeStance') {
      setCustomUkeStance(value);
    } else if (field === 'toriFinalStance') {
      setCustomToriFinalStance(value);
    } else if (field === 'ukeFinalStance') {
      setCustomUkeFinalStance(value);
    } else if (field === 'toriLandingMode') {
      setToriLandingMode(value);
    } else if (field === 'ukeLandingMode') {
      setUkeLandingMode(value);
    }

    if (isRotationOrPositionField) {
      // При интерактивной регулировке угла поворота (Yaw) и координат модели:
      // НЕ сбрасываем фазу движения в 0 и не перезапускаем цикл!
      // Модель мгновенно разворачивается в 3D сцене прямо под курсором ползунка.
      notifyParamChange(field, value);
      return;
    }

    // Быстрый перезапуск движения при смене боевых техник (клипы, стойки)
    setScrubProgress(null);
    phraseRef.current = 0;
    setStepCompleted(false);
    zanshinTimerRef.current = 0;
    setIsPlaying(true);
    setReplayNonce((n) => n + 1);
    notifyParamChange(field, value);
  }, [notifyParamChange]);

  // Трекинг сочленений и коллизий
  const trackedJointsRef = useRef({ tori: null, uke1: null, uke2: null });
  const [bodyInteraction, setBodyInteraction] = useState({
    collided: false,
    penetrationPrevented: false,
    validContact: false,
    statusText: '',
    clampedIkTargetA: null,
    clampedIkTargetB: null,
  });

  const controlsRef = useRef();

  // Нормализуем шаги: если переданы пользовательские шаги, используем их, иначе 18 канонических шагов Хэйан Шодан
  const baseEpisodes = useMemo(() => {
    if (Array.isArray(steps) && steps.length > 0) {
      return steps.map((s, idx) => normalizeBunkaiEpisode(s, idx));
    }
    return HEIAN_SHODAN_BUNKAI_18_STEPS.map((s, idx) => normalizeBunkaiEpisode(s, idx));
  }, [steps]);

  // Обогащаем шаги динамическими настройками стоек, ударов, блоков, дистанции и конечного разворота
  const effectiveEpisodes = useMemo(() => {
    return baseEpisodes.map((ep, idx) => {
      if (idx !== currentStepIdx) return ep;
      const parts = (ep.participants || []).map((p) => {
        if (p.role === 'tori') {
          return {
            ...p,
            clipName: customToriClip || p.clipName,
            stance: customToriStance || p.stance,
            finalStance: customToriFinalStance || p.finalStance,
            landingMode: toriLandingMode !== 'auto' ? toriLandingMode : (p.landingMode || 'auto'),
            customStanceApplied: Boolean(customToriStance || customToriFinalStance),
          };
        }
        if (p.role === 'uke' || p.role === 'uke1') {
          return {
            ...p,
            clipName: customUkeClip || p.clipName,
            stance: customUkeStance || p.stance,
            finalStance: customUkeFinalStance || p.finalStance,
            landingMode: ukeLandingMode !== 'auto' ? ukeLandingMode : (p.landingMode || 'auto'),
            customStanceApplied: Boolean(customUkeStance || customUkeFinalStance),
          };
        }
        return p;
      });

      const effectiveToriYawDeg = customToriEndYawDeg !== null ? customToriEndYawDeg : ep.toriEndAngleDeg;
      const effectiveUkeYawDeg = customUkeEndYawDeg !== null ? customUkeEndYawDeg : ep.ukeEndAngleDeg;

      return {
        ...ep,
        optimalDistance: customDistance !== null ? customDistance : (ep.optimalDistance || 1.45),
        toriEndAngleDeg: effectiveToriYawDeg,
        ukeEndAngleDeg: effectiveUkeYawDeg,
        toriEndYaw: effectiveToriYawDeg !== undefined && effectiveToriYawDeg !== null ? (effectiveToriYawDeg * Math.PI) / 180 : ep.toriEndYaw,
        ukeEndYaw: effectiveUkeYawDeg !== undefined && effectiveUkeYawDeg !== null ? (effectiveUkeYawDeg * Math.PI) / 180 : ep.ukeEndYaw,
        toriTrajectory: effectiveToriYawDeg !== undefined && effectiveToriYawDeg !== null ? {
          ...(ep.toriTrajectory || {}),
          endYaw: (effectiveToriYawDeg * Math.PI) / 180,
        } : ep.toriTrajectory,
        ukeTrajectory: effectiveUkeYawDeg !== undefined && effectiveUkeYawDeg !== null ? {
          ...(ep.ukeTrajectory || {}),
          endYaw: (effectiveUkeYawDeg * Math.PI) / 180,
        } : ep.ukeTrajectory,
        participants: parts,
      };
    });
  }, [baseEpisodes, currentStepIdx, customDistance, customToriClip, customUkeClip, customToriStance, customToriFinalStance, toriLandingMode, customUkeStance, customUkeFinalStance, ukeLandingMode, customToriEndYawDeg, customUkeEndYawDeg]);

  // Вычисляем цепочку эпизодов с непрерывным сохранением позиций
  const chainedEpisodes = useMemo(() => {
    return chainBunkaiEpisodes(effectiveEpisodes, stateMode);
  }, [effectiveEpisodes, stateMode]);

  const currentEpisode = chainedEpisodes[currentStepIdx] || chainedEpisodes[0];

  // Сброс локальных кастомных параметров при смене шага
  useEffect(() => {
    setCustomToriEndYawDeg(null);
    setCustomUkeEndYawDeg(null);
    setOrientationModeTori(undefined);
    setOrientationModeUke(undefined);
    setCustomToriPosX(undefined);
    setCustomToriPosZ(undefined);
    setCustomUkePosX(undefined);
    setCustomUkePosZ(undefined);
  }, [currentStepIdx]);

  // Расчет взаимного пространственного расположения участников
  const placement = useMemo(() => {
    return computeAvatarPlacement({
      episode: currentEpisode,
      distanceOffset: 0,
      customDistance,
      toriAngleOffsetDeg,
      ukeEvasionAngleDeg,
      showUke2,
      baseToriPos: currentEpisode.toriStartPos || [0, 0, -1.0],
      targetRole: 'uke1',
      customToriClip,
      customUkeClip,
      toriLandingMode,
      ukeLandingMode,
      customToriYawDeg: customToriEndYawDeg !== null ? customToriEndYawDeg : undefined,
      customUkeYawDeg: customUkeEndYawDeg !== null ? customUkeEndYawDeg : undefined,
      orientationModeTori: orientationModeTori || (customToriEndYawDeg !== null ? 'mode1_free' : undefined),
      orientationModeUke: orientationModeUke || (customUkeEndYawDeg !== null ? 'mode1_free' : undefined),
      customToriPosX,
      customToriPosZ,
      customUkePosX,
      customUkePosZ,
    });
  }, [
    currentEpisode,
    customDistance,
    toriAngleOffsetDeg,
    ukeEvasionAngleDeg,
    showUke2,
    customToriClip,
    customUkeClip,
    toriLandingMode,
    ukeLandingMode,
    customToriEndYawDeg,
    customUkeEndYawDeg,
    orientationModeTori,
    orientationModeUke,
    customToriPosX,
    customToriPosZ,
    customUkePosX,
    customUkePosZ,
  ]);

  const resetAngles = useCallback(() => {
    setToriAngleOffsetDeg(0);
    setUkeEvasionAngleDeg(0);
  }, []);

  // Проверка клипов в библиотеке
  useEffect(() => {
    currentEpisode.participants.forEach((p) => {
      if (p.clipName) {
        const resolved = resolveBunkaiClip(p.clipName);
        if (!resolved.isKnown) {
          setMissingClips((prev) => Array.from(new Set([...prev, p.clipName])));
        }
      }
    });
  }, [currentEpisode]);

  const handleMissingClipDetected = useCallback((clipName) => {
    setMissingClips((prev) => Array.from(new Set([...prev, clipName])));
  }, []);

  // Трекинг сочленений для анатомической системы BodyColliderSystem
  const lastInteractionUpdateRef = useRef(0);
  const handleTrackJoints = useCallback((role, joints) => {
    trackedJointsRef.current[role] = joints;
    const now = performance.now();
    if (now - lastInteractionUpdateRef.current > 100) {
      lastInteractionUpdateRef.current = now;
      if (trackedJointsRef.current.tori && trackedJointsRef.current.uke1) {
        const inter = resolveBodyInteractions(
          trackedJointsRef.current.tori,
          trackedJointsRef.current.uke1,
          {
            contactType: currentEpisode.contactType,
            stepNumber: currentEpisode.stepNumber,
            isGroundStep: Boolean(currentEpisode.isGround || currentEpisode.participants?.[0]?.isGround),
            minTorsoDistance: (currentEpisode.contactType === 'sweep_fall' || currentEpisode.isGround) ? 0.38 : 0.52,
            isEvaded: placement.isEvaded,
            attackDirectrix: placement.attackDirectrix,
          }
        );
        setBodyInteraction(inter);
      }
    }
  }, [currentEpisode]);

  function handlePrevStep() {
    setScrubProgress(null);
    setCurrentStepIdx((prev) => {
      const next = Math.max(0, prev - 1);
      if (onStepChange) onStepChange(next);
      return next;
    });
  }

  function handleNextStep() {
    setScrubProgress(null);
    setCurrentStepIdx((prev) => {
      const next = Math.min(chainedEpisodes.length - 1, prev + 1);
      if (onStepChange) onStepChange(next);
      return next;
    });
  }

  const handleReplayStep = useCallback(() => {
    setScrubProgress(null);
    phraseRef.current = 0;
    setStepCompleted(false);
    zanshinTimerRef.current = 0;
    setIsPlaying(true);
    setReplayNonce((n) => n + 1);
  }, []);

  const handlePlayEntireBunkai = useCallback(() => {
    setScrubProgress(null);
    setCurrentStepIdx(0);
    if (onStepChange) onStepChange(0);
    phraseRef.current = 0;
    setStepCompleted(false);
    zanshinTimerRef.current = 0;
    setStateMode('continuous');
    setAutoAdvance(true);
    setIsLoopingStep(false);
    setIsPlaying(true);
    setReplayNonce((n) => n + 1);
  }, [onStepChange]);

  const handleStepSelect = useCallback((idx) => {
    setScrubProgress(null);
    setCurrentStepIdx(idx);
    if (onStepChange) onStepChange(idx);
    phraseRef.current = 0;
    setStepCompleted(false);
    zanshinTimerRef.current = 0;
    setIsPlaying(true);
    setReplayNonce((n) => n + 1);
  }, [onStepChange]);

  const handleTogglePlay = useCallback(() => {
    setScrubProgress(null);
    if (!isPlaying && phraseRef.current >= 1.0) {
      phraseRef.current = 0;
      setStepCompleted(false);
      zanshinTimerRef.current = 0;
      setIsPlaying(true);
      setReplayNonce((n) => n + 1);
    } else {
      setIsPlaying((p) => !p);
    }
  }, [isPlaying]);

  // Быстрые горячие клавиши для тестирования: R — повторить шаг, Space — пауза/воспроизведение
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) {
        return;
      }
      if (e.code === 'KeyR') {
        e.preventDefault();
        handleReplayStep();
      } else if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleReplayStep, handleTogglePlay]);

  function resetCamera() {
    if (controlsRef.current) {
      controlsRef.current.reset();
      const targetPos = placement.posTori;
      controlsRef.current.target.set(targetPos[0], 0.95, targetPos[2]);
    }
  }

  const toriPart = currentEpisode.participants.find((p) => p.role === 'tori') || {};
  const uke1Part = currentEpisode.participants.find((p) => p.role === 'uke1') || {};
  const uke2Part = currentEpisode.participants.find((p) => p.role === 'uke2') || {};

  const activeToriClip = customToriClip || toriPart.clipName || '';
  const activeUkeClip = customUkeClip || uke1Part.clipName || '';

  const isToriKick = Boolean(
    activeToriClip && (
      activeToriClip.includes('mae_geri') ||
      activeToriClip.includes('mawashi_geri') ||
      activeToriClip.includes('yoko_geri') ||
      activeToriClip.includes('ushiro_geri') ||
      activeToriClip.includes('kick') ||
      activeToriClip.includes('geri')
    )
  );

  const isUkeKick = Boolean(
    activeUkeClip && (
      activeUkeClip.includes('mae_geri') ||
      activeUkeClip.includes('mawashi_geri') ||
      activeUkeClip.includes('yoko_geri') ||
      activeUkeClip.includes('ushiro_geri') ||
      activeUkeClip.includes('kick') ||
      activeUkeClip.includes('geri')
    )
  );

  const isToriMaeGeri = isToriKick;
  const isUkeMaeGeri = isUkeKick;

  const phraseRef = useRef(0);
  const rootsRef = useRef({ tori: placement.posTori, uke1: placement.posUke1 });

  useEffect(() => {
    phraseRef.current = 0;
    setStepCompleted(false);
    zanshinTimerRef.current = 0;
    setCustomDistance(null);
    setToriAngleOffsetDeg(0);
    setUkeEvasionAngleDeg(0);
    setCustomUkeClip('');
    setCustomToriClip('');
    setCustomToriStance('');
    setCustomToriFinalStance('');
    setToriLandingMode('auto');
    setCustomUkeStance('');
    setCustomUkeFinalStance('');
    setUkeLandingMode('auto');
  }, [currentStepIdx]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    let last = performance.now();
    let frameId = 0;
    const dur = Math.max(1.8, currentEpisode.duration || 2.4);

    const tick = (now) => {
      const dt = (now - last) / 1000;
      last = now;

      if (phraseRef.current < 1.0) {
        // Однократное естественное выполнение боевой техники от начала до конца:
        // Модель наносит удар / ставит блок / входит в стойку и надежно фиксирует позицию (Кимэ)
        const nextPhrase = Math.min(1.0, phraseRef.current + (dt * speed) / dur);
        phraseRef.current = nextPhrase;
        if (nextPhrase >= 1.0) {
          setStepCompleted(true);
        }
      } else if (isLoopingStep) {
        // Режим зацикливания одного шага: короткая пауза фиксации (0.6с) и повтор
        zanshinTimerRef.current += dt * speed;
        if (zanshinTimerRef.current >= 0.6) {
          zanshinTimerRef.current = 0;
          phraseRef.current = 0;
          setStepCompleted(false);
        }
      } else if (autoAdvance) {
        // В режиме непрерывного авто-боя: выдерживаем паузу боевой бдительности (Дзансин 1.4с),
        // после чего плавно переходим к следующему шагу сценария без скачков и сбросов
        zanshinTimerRef.current += dt * speed;
        if (zanshinTimerRef.current >= 1.4) {
          zanshinTimerRef.current = 0;
          setCurrentStepIdx((prev) => {
            if (prev < chainedEpisodes.length - 1) {
              const next = prev + 1;
              if (onStepChange) onStepChange(next);
              return next;
            }
            setIsPlaying(false);
            return prev;
          });
        }
      }

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying, speed, currentStepIdx, currentEpisode, autoAdvance, isLoopingStep, chainedEpisodes.length, onStepChange]);

  // Описание дистанции (Ма-ай)
  const maaiInfo = useMemo(() => {
    const d = placement.finalDist;
    if (d < 1.0) {
      return { label: 'Чика-ма (近間)', desc: 'Ближний бой, захват, залом сустава / партер', color: '#f59e0b' };
    }
    if (d <= 1.85) {
      return { label: 'Иссоку-итто (一足一刀)', desc: 'Дистанция одного шага и удара (основная боевая)', color: '#10b981' };
    }
    return { label: 'То-ма (遠間)', desc: 'Дальняя дистанция маневрирования и поклона', color: '#cbd5e1' };
  }, [placement.finalDist]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        background: '#0a0a0c',
        borderRadius: 12,
        overflow: 'hidden',
        border: '1.5px solid var(--color-border)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}
    >
      {/* 3D Canvas арены Бункая */}
      <div style={{ width: '100%', height, position: 'relative' }}>
        <Canvas
          shadows
          camera={{ position: [placement.posTori[0] + 2.8, 1.8, placement.posTori[2] + 3.2], fov: 42 }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              console.warn('[BunkaiPlayer] WebGL Context Lost handled.');
            }, false);
            gl.domElement.addEventListener('webglcontextrestored', () => {
              console.info('[BunkaiPlayer] WebGL Context Restored.');
            }, false);
          }}
        >
          <color attach="background" args={['#0e0d0b']} />
          <ambientLight intensity={0.7} />
          <directionalLight
            position={[placement.posTori[0] + 4, 6, placement.posTori[2] + 4]}
            intensity={1.4}
            castShadow
            shadow-mapSize={[1024, 1024]}
            shadow-camera-near={0.5}
            shadow-camera-far={15}
            shadow-camera-left={-4}
            shadow-camera-right={4}
            shadow-camera-top={4}
            shadow-camera-bottom={-4}
          />
          <directionalLight position={[-4, 3, -3]} intensity={0.4} color="#f1f5f9" />

          {/* Традиционное японское додзё с разметкой татами */}
          <TraditionalDojo />

          {/* Аватар 1: Тори — Атакующий (Синее доги) */}
          <MultiAvatarModel
            role="tori"
            clipName={customToriClip || (customToriStance ? null : toriPart.clipName)}
            stance={customToriStance || toriPart.stance || 'zenkutsu'}
            finalStance={customToriFinalStance || toriPart.finalStance}
            landingMode={toriLandingMode !== 'auto' ? toriLandingMode : (toriPart.landingMode || 'auto')}
            position={placement.endPosTori}
            startPosition={placement.startPosTori}
            rotation={placement.rotTori}
            startRotation={placement.startRotTori}
            isStationary={placement.isStationaryTori}
            phraseRef={phraseRef}
            rootsRef={rootsRef}
            speed={speed}
            isPlaying={isPlaying}
            replayTrigger={replayNonce}
            scrubProgress={scrubProgress}
            timelineTime={null}
            delaySeconds={toriPart.delaySeconds || 0}
            ikTarget={bodyInteraction.clampedIkTargetA}
            ikContactTime={currentEpisode.tContact}
            interactionType={currentEpisode.interactionType}
            isGround={Boolean(currentEpisode.isGround || toriPart.isGround)}
            isRising={Boolean(currentEpisode.isRising || toriPart.isRising)}
            onMissingClip={handleMissingClipDetected}
            onTrackJoints={handleTrackJoints}
            trackedJointsRef={trackedJointsRef}
            combatOptions={{
              stepNumber: currentEpisode?.stepNumber,
              contactType: currentEpisode?.contactType,
              interactionType: currentEpisode?.interactionType,
              ikContactTime: currentEpisode?.tContact || 0.48,
              isEvaded: placement.isEvaded,
              attackDirectrix: placement.attackDirectrix,
            }}
          />

          {/* Аватар 2: Укэ 1 — Защищающийся (Белое доги) */}
          <MultiAvatarModel
            role="uke1"
            clipName={customUkeClip || (customUkeStance ? null : uke1Part.clipName)}
            stance={customUkeStance || uke1Part.stance || 'zenkutsu'}
            finalStance={customUkeFinalStance || uke1Part.finalStance}
            landingMode={ukeLandingMode !== 'auto' ? ukeLandingMode : (uke1Part.landingMode || 'auto')}
            position={placement.endPosUke1}
            startPosition={placement.startPosUke1}
            rotation={placement.rotUke1}
            startRotation={placement.startRotUke1}
            isStationary={placement.isStationaryUke}
            phraseRef={phraseRef}
            rootsRef={rootsRef}
            speed={speed}
            isPlaying={isPlaying}
            replayTrigger={replayNonce}
            scrubProgress={scrubProgress}
            timelineTime={null}
            delaySeconds={uke1Part.delaySeconds || 0}
            ikTarget={bodyInteraction.clampedIkTargetB}
            ikContactTime={currentEpisode.tContact}
            interactionType={currentEpisode.interactionType}
            isGround={false}
            onMissingClip={handleMissingClipDetected}
            onTrackJoints={handleTrackJoints}
            trackedJointsRef={trackedJointsRef}
            combatOptions={{
              stepNumber: currentEpisode?.stepNumber,
              contactType: currentEpisode?.contactType,
              interactionType: currentEpisode?.interactionType,
              ikContactTime: currentEpisode?.tContact || 0.48,
              isEvaded: placement.isEvaded,
              attackDirectrix: placement.attackDirectrix,
            }}
          />

          {/* Аватар 3: Укэ 2 (если включен командный режим) */}
          {showUke2 && (
            <MultiAvatarModel
              role="uke2"
              clipName={uke2Part.clipName}
              stance={uke2Part.stance || 'ready'}
              position={placement.posUke2}
              rotation={placement.rotUke2}
              speed={speed}
              isPlaying={isPlaying}
              replayTrigger={replayNonce}
              timelineTime={null}
              delaySeconds={uke2Part.delaySeconds || 0}
              interactionType="body_contact"
              onMissingClip={handleMissingClipDetected}
              onTrackJoints={handleTrackJoints}
            />
          )}

          <ContactShadows position={[0, 0, 0]} opacity={0.65} scale={10} blur={1.5} far={4} />

          {/* Визуальные 3D индикаторы и манипуляторы в Додзё (направление корпуса, стопы, линия атаки, дистанция) */}
          <BunkaiVisualAids
            placement={placement}
            showCoordinateSystem={visualAidSettings.showCoordinateSystem !== false}
            showTorsoVector={visualAidSettings.showTorsoVector}
            showFootVectors={visualAidSettings.showFootVectors}
            showAttackLine={visualAidSettings.showAttackLine}
            showDistanceLine={visualAidSettings.showDistanceLine}
            showContactPoint={visualAidSettings.showContactPoint}
            showSafeBoundaries={visualAidSettings.showSafeBoundaries}
            contactPoint={bodyInteraction.contactPoint}
            isContactActive={bodyInteraction.validContact}
            bodyInteraction={bodyInteraction}
          />

          <BunkaiCameraBounds controlsRef={controlsRef} />

          <OrbitControls
            ref={controlsRef}
            target={[placement.posTori[0], 0.95, placement.posTori[2]]}
            minDistance={1.2}
            maxDistance={6.4}
            maxPolarAngle={Math.PI / 2 - 0.06}
            minPolarAngle={0.12}
            enablePan
            enableDamping
            dampingFactor={0.08}
          />
        </Canvas>

        {/* Плавающий оверлей телеметрии и системы координат Бункай */}
        <div
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            zIndex: 10,
            background: 'rgba(15, 23, 42, 0.94)',
            backdropFilter: 'blur(8px)',
            border: '1.5px solid rgba(56, 189, 248, 0.4)',
            borderRadius: 8,
            padding: '8px 12px',
            color: '#f8fafc',
            fontSize: '0.74rem',
            boxShadow: '0 6px 24px rgba(0,0,0,0.6)',
            minWidth: 260,
            maxWidth: 320,
            pointerEvents: 'auto',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.12)', paddingBottom: 4 }}>
            <span style={{ fontWeight: 700, color: '#38bdf8', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              🧭 Система координат Бункай
            </span>
            <button
              type="button"
              onClick={() => setShowCoordinateHUD(!showCoordinateHUD)}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid #475569',
                borderRadius: 4,
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '1px 6px',
                fontSize: '0.68rem',
              }}
            >
              {showCoordinateHUD ? 'Свернуть' : 'Развернуть'}
            </button>
          </div>

          {showCoordinateHUD && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Тори (Синий - Атакующий) */}
              <div style={{ background: 'rgba(37, 99, 235, 0.16)', borderLeft: '3px solid #2563eb', padding: '4px 6px', borderRadius: '0 4px 4px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#93c5fd' }}>
                  <span>1 — Тори (Атакующий):</span>
                  <span style={{ fontFamily: 'monospace' }}>Yaw: {placement.coordinates?.tori?.yawDeg ?? Math.round((placement.rotTori[1] * 180) / Math.PI)}°</span>
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.70rem', color: '#cbd5e1' }}>
                  X: <span style={{ color: '#f87171' }}>{placement.posTori[0].toFixed(2)}м</span> | Y: <span style={{ color: '#4ade80' }}>{placement.posTori[1].toFixed(2)}м</span> | Z: <span style={{ color: '#60a5fa' }}>{placement.posTori[2].toFixed(2)}м</span>
                </div>
              </div>

              {/* Укэ (Белый - Защищающийся) */}
              <div style={{ background: 'rgba(248, 250, 252, 0.12)', borderLeft: '3px solid #f8fafc', padding: '4px 6px', borderRadius: '0 4px 4px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#f8fafc' }}>
                  <span>2 — Укэ (Защищающийся):</span>
                  <span style={{ fontFamily: 'monospace' }}>Yaw: {placement.coordinates?.uke1?.yawDeg ?? Math.round((placement.rotUke1[1] * 180) / Math.PI)}°</span>
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.70rem', color: '#cbd5e1' }}>
                  X: <span style={{ color: '#f87171' }}>{placement.posUke1[0].toFixed(2)}м</span> | Y: <span style={{ color: '#4ade80' }}>{placement.posUke1[1].toFixed(2)}м</span> | Z: <span style={{ color: '#60a5fa' }}>{placement.posUke1[2].toFixed(2)}м</span>
                </div>
                <div style={{ fontSize: '0.68rem', color: placement.coordinates?.uke1?.isFacingOpponent ? '#34d399' : '#f59e0b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>{placement.coordinates?.uke1?.isFacingOpponent ? '🎯 Развернут к Тори (соосность 100%)' : `Отклонение от Тори: ${placement.coordinates?.uke1?.facingAngleToOpponentDeg || 0}°`}</span>
                </div>
              </div>

              {/* Геометрия взаимодействия */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, background: 'rgba(0,0,0,0.3)', padding: '4px 6px', borderRadius: 4, fontSize: '0.68rem' }}>
                <div>Ма-ай: <strong style={{ color: '#38bdf8' }}>{placement.finalDist?.toFixed(2)}м</strong></div>
                <div>Тай-сабаки: <strong style={{ color: placement.isEvaded ? '#c084fc' : '#94a3b8' }}>{(placement.lateralOffsetMeters || 0).toFixed(2)}м</strong></div>
              </div>
            </div>
          )}
        </div>

        {/* Нижний статус-бар: контакт и анти-проникновение */}
        <div
          style={{
            position: 'absolute',
            bottom: 14,
            left: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          {bodyInteraction.validContact && (
            <div
              style={{
                background: 'rgba(6, 78, 59, 0.90)',
                color: '#6ee7b7',
                padding: '5px 12px',
                borderRadius: 6,
                fontSize: '0.78rem',
                fontWeight: 600,
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                border: '1px solid rgba(16, 185, 129, 0.4)',
              }}
            >
              <CheckCircle2 size={14} color="#34d399" />
              <span>Допустимый контакт: {bodyInteraction.statusText || 'Точки взаимодействия согласованы'}</span>
            </div>
          )}

          {/* Индикатор живого предпросмотра при изменении параметров */}
          {hasUnsavedChanges && (
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.20)',
                color: '#34d399',
                padding: '5px 12px',
                borderRadius: 6,
                fontSize: '0.78rem',
                fontWeight: 600,
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                border: '1px solid rgba(16, 185, 129, 0.5)',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
              <span>Живой предпросмотр: изменения применяются мгновенно</span>
            </div>
          )}

          {/* Защита от проникновения моделей друг в друга */}
          <div
            style={{
              background: (placement.hasCollision || bodyInteraction.penetrationPrevented) ? 'rgba(220, 38, 38, 0.20)' : 'rgba(255, 255, 255, 0.08)',
              color: '#f8fafc',
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: '0.78rem',
              fontWeight: 600,
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              border: (placement.hasCollision || bodyInteraction.penetrationPrevented) ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(255, 255, 255, 0.18)',
            }}
          >
            <Shield size={14} color={(placement.hasCollision || bodyInteraction.penetrationPrevented) ? '#f87171' : '#cbd5e1'} />
            <span>
              {(placement.hasCollision || bodyInteraction.penetrationPrevented)
                ? 'Анти-проникновение активно: дистанция ограничена, контакт поверхностный (без наложения тел)'
                : 'Анти-проникновение активно: анатомические границы тел защищены от пересечения'}
            </span>
          </div>

          {/* Индикатор фиксации взгляда и сохранения директрисы атаки */}
          {(placement.isEvaded || Math.abs(ukeEvasionAngleDeg) > 0.001) && (
            <div
              style={{
                background: 'rgba(14, 116, 144, 0.90)',
                color: '#e0f2fe',
                padding: '5px 12px',
                borderRadius: 6,
                fontSize: '0.78rem',
                fontWeight: 600,
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                border: '1px solid rgba(56, 189, 248, 0.4)',
              }}
            >
              <Eye size={14} color="#38bdf8" />
              <span>Тайсабаки: Укэ (Белый) ушел на {(placement.lateralOffsetMeters || 0).toFixed(2)}м и развернут лицом к Тори | Тори (Синий) сохраняет прямую линию атаки</span>
            </div>
          )}

          {/* Индикатор постановки ноги при ударе ногой */}
          {(isToriKick || isUkeKick) && (
            <div
              style={{
                background: 'rgba(30, 41, 59, 0.92)',
                color: '#38bdf8',
                padding: '5px 12px',
                borderRadius: 6,
                fontSize: '0.78rem',
                fontWeight: 600,
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                border: '1px solid rgba(56, 189, 248, 0.4)',
              }}
            >
              <Footprints size={14} color="#38bdf8" />
              <span>
                {isToriKick && (
                  `Удар ногой Тори: ${
                    (toriLandingMode === 'forward' || (!toriLandingMode && toriPart.landingMode === 'forward'))
                      ? 'Постановка ноги вперед (+0.65м)'
                      : 'Возврат ноги назад в исходную стойку'
                  }`
                )}
                {isToriKick && isUkeKick && ' | '}
                {isUkeKick && (
                  `Удар ногой Укэ: ${
                    (ukeLandingMode === 'forward' || (!ukeLandingMode && uke1Part.landingMode === 'forward'))
                      ? 'Постановка ноги вперед (+0.65м)'
                      : 'Возврат ноги назад в исходную стойку'
                  }`
                )}
              </span>
            </div>
          )}
        </div>

        {/* Баннер обнаруженных отсутствующих клипов */}
        {missingClips.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 86,
              left: 14,
              background: 'rgba(217, 119, 6, 0.92)',
              color: '#fff',
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: '0.8rem',
              maxWidth: 480,
              boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
              zIndex: 10,
            }}
          >
            <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <AlertTriangle size={15} color="#f59e0b" /> Зафиксировано отсутствие клипов:
            </strong> {missingClips.join(', ')}.
          </div>
        )}
      </div>

      {/* Панель управления боевым взаимодействием */}
      <div style={{ background: 'var(--color-surface)', padding: '12px 14px', borderTop: '1px solid var(--color-border)', overflowX: 'hidden' }}>
        {/* Верхняя строка: навигация по шагам, плеер, режим и сброс */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          {/* Переключение шагов */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn"
              disabled={currentStepIdx === 0}
              onClick={handlePrevStep}
              style={{ padding: '6px 10px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <ChevronLeft size={14} /> Предыдущий
            </button>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-gold)', minWidth: 65, textAlign: 'center' }}>
              {currentStepIdx + 1} / {chainedEpisodes.length}
            </span>
            <button
              className="btn"
              disabled={currentStepIdx === chainedEpisodes.length - 1}
              onClick={handleNextStep}
              style={{ padding: '6px 10px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              Следующий <ChevronRight size={14} />
            </button>
          </div>

          {/* Кнопки плеера и переключения режима */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn"
              style={{
                minWidth: 135,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                background: '#f8fafc',
                color: '#0f172a',
                border: '1px solid #ffffff',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
              onClick={handleTogglePlay}
            >
              {isPlaying && !stepCompleted ? (
                <><Pause size={13} fill="currentColor" /> Пауза</>
              ) : (
                <><Play size={13} fill="currentColor" /> Воспроизведение</>
              )}
            </button>
            <button
              className="btn"
              style={{
                borderColor: '#475569',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#f8fafc',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
              onClick={handlePlayEntireBunkai}
              title="Запустить непрерывное воспроизведение всего бункая от шага 1 до 18"
            >
              <Swords size={14} color="#f8fafc" />
              Во весь бункай (18 шагов)
            </button>
            <button
              className="btn"
              onClick={handleReplayStep}
              title="Повторить выполнение текущего шага"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            >
              <RotateCcw size={13} /> Повторить шаг
            </button>
            <button
              className="btn"
              style={{
                borderColor: isLoopingStep ? '#10b981' : undefined,
                background: isLoopingStep ? 'rgba(16, 185, 129, 0.22)' : undefined,
                color: isLoopingStep ? '#6ee7b7' : undefined,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
              onClick={() => {
                const next = !isLoopingStep;
                setIsLoopingStep(next);
                if (next) setAutoAdvance(false);
              }}
              title="Зациклить воспроизведение выбранного шага"
            >
              <RotateCcw size={13} color={isLoopingStep ? '#34d399' : undefined} />
              {isLoopingStep ? 'Повтор шага: ВКЛ' : 'Повтор шага: ВЫКЛ'}
            </button>
            <button
              className="btn"
              style={{
                borderColor: autoAdvance ? '#10b981' : undefined,
                background: autoAdvance ? 'rgba(16, 185, 129, 0.20)' : undefined,
                color: autoAdvance ? '#6ee7b7' : undefined,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
              onClick={() => {
                const next = !autoAdvance;
                setAutoAdvance(next);
                if (next) setIsLoopingStep(false);
              }}
              title="Непрерывный авто-бой: автоматический переход к следующему шагу после паузы Дзансин"
            >
              <Swords size={13} color={autoAdvance ? '#34d399' : undefined} />
              {autoAdvance ? 'Авто-бой: ВКЛ' : 'Авто-бой: ВЫКЛ'}
            </button>
            <button
              className="btn"
              onClick={() => setShowUke2(!showUke2)}
            >
              {showUke2 ? '2 Участника (Дуэль)' : '+ Добавить Укэ 2 (Трио)'}
            </button>
            <button
              className="btn"
              style={{
                borderColor: stateMode === 'continuous' ? '#e2e8f0' : undefined,
                background: stateMode === 'continuous' ? 'rgba(255, 255, 255, 0.12)' : undefined,
                color: stateMode === 'continuous' ? '#ffffff' : undefined,
              }}
              onClick={() => setStateMode(stateMode === 'continuous' ? 'standalone' : 'continuous')}
            >
              {stateMode === 'continuous' ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={13} /> Непрерывный бой
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Target size={13} /> Изолированный шаг
                </span>
              )}
            </button>
            <button className="btn btn-subtle" onClick={resetCamera} style={{ border: '1px solid #475569', color: '#f8fafc' }}>
              Сброс камеры
            </button>
            <button
              className="btn btn-subtle"
              onClick={() => handleVisualAidToggle('showCoordinateSystem', !visualAidSettings.showCoordinateSystem)}
              style={{
                border: visualAidSettings.showCoordinateSystem ? '1px solid #38bdf8' : '1px solid #475569',
                color: visualAidSettings.showCoordinateSystem ? '#38bdf8' : '#94a3b8',
                background: visualAidSettings.showCoordinateSystem ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
              title="Переключить отображение системы координат (оси X, Y, Z, разметка метров)"
            >
              🧭 Оси X/Y/Z
            </button>
          </div>

          {/* Скорость воспроизведения */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600 }}>Скорость:</span>
            {[0.25, 0.5, 1.0, 1.5].map((s) => {
              const isActive = speed === s;
              return (
                <button
                  key={s}
                  type="button"
                  style={{
                    padding: '5px 10px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    borderRadius: 6,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    border: isActive ? '1px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.2)',
                    background: isActive ? '#f8fafc' : 'rgba(255, 255, 255, 0.08)',
                    color: isActive ? '#0f172a' : '#f1f5f9',
                    boxShadow: isActive ? '0 2px 8px rgba(0, 0, 0, 0.4)' : 'none',
                  }}
                  onClick={() => setSpeed(s)}
                >
                  {s}x
                </button>
              );
            })}
          </div>
        </div>

        {canEdit ? (
          <>
            {/* ПЕРЕКЛЮЧАТЕЛЬ РЕЖИМА ПАНЕЛИ: УНИВЕРСАЛЬНАЯ ПАНЕЛЬ (9 ГРУПП) vs КОМПАКТНЫЕ КАРТОЧКИ */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn"
            onClick={() => setPanelViewMode('universal')}
            style={{
              padding: '6px 14px',
              fontSize: '0.82rem',
              fontWeight: 700,
              background: panelViewMode === 'universal' ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.05)',
              border: panelViewMode === 'universal' ? '1.5px solid #f8fafc' : '1px solid #334155',
              color: panelViewMode === 'universal' ? '#f8fafc' : '#cbd5e1',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Sliders size={14} color={panelViewMode === 'universal' ? '#f8fafc' : '#cbd5e1'} />
            Универсальная панель управления движениями (9 групп)
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setPanelViewMode('compact')}
            style={{
              padding: '6px 14px',
              fontSize: '0.82rem',
              fontWeight: 700,
              background: panelViewMode === 'compact' ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.05)',
              border: panelViewMode === 'compact' ? '1.5px solid #f8fafc' : '1px solid #334155',
              color: panelViewMode === 'compact' ? '#f8fafc' : '#cbd5e1',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Zap size={14} color={panelViewMode === 'compact' ? '#f8fafc' : '#cbd5e1'} />
            Компактные карточки
          </button>
        </div>

        {panelViewMode === 'universal' ? (
          <BunkaiMotionControlPanel
            currentStepIndex={currentStepIdx}
            currentEpisode={currentEpisode}
            placement={placement}
            showUke2={showUke2}
            onParamChange={handleUniversalParamChange}
            onReplayStep={handleReplayStep}
            onScrubStep={handleScrubStep}
            visualAidSettings={visualAidSettings}
            onVisualAidToggle={handleVisualAidToggle}
          />
        ) : (
          /* ПАНЕЛЬ УПРАВЛЕНИЯ ДВИЖЕНИЯМИ БУНКАЙ (ДИСТАНЦИЯ, УГЛЫ, СТОЙКИ, УДАРЫ, БЛОКИ) */
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
              gap: 14,
              background: '#121217',
              padding: '14px 16px',
              borderRadius: 8,
              border: '1px solid #272732',
            }}
          >
          {/* КАРТОЧКА 1: ДИСТАНЦИЯ МА-АЙ И УГЛЫ ВЗАИМОДЕЙСТВИЯ */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              padding: '12px 14px',
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            {/* 1.1 Боевая дистанция (Ма-ай) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', marginBottom: 6 }}>
                <span style={{ color: '#c5a059', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <Ruler size={14} /> Дистанция боя (Ма-ай):
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      background: (maaiInfo.color || '#10b981') + '22',
                      color: maaiInfo.color || '#10b981',
                      border: `1px solid ${(maaiInfo.color || '#10b981')}55`,
                      padding: '2px 7px',
                      borderRadius: 4,
                      fontSize: '0.74rem',
                      fontWeight: 700,
                    }}
                  >
                    {placement.finalDist.toFixed(2)} м · {maaiInfo.label.split(' ')[0]}
                  </span>
                  {customDistance !== null && (
                    <button
                      type="button"
                      onClick={() => setCustomDistance(null)}
                      title="Сбросить дистанцию в сценарную"
                      style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                    >
                      <RotateCcw size={12} />
                    </button>
                  )}
                </div>
              </div>
              <input
                type="range"
                min="0.80"
                max="2.80"
                step="0.05"
                value={customDistance !== null ? customDistance : (currentEpisode.optimalDistance || 1.45)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setCustomDistance(val);
                  notifyParamChange('combatDistance', val);
                }}
                style={{ width: '100%', accentColor: '#c5a059', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#94a3b8', marginTop: 2 }}>
                <span>0.8м (Чика-ма)</span>
                <span>1.45м (Иссоку)</span>
                <span>2.8м (То-ма)</span>
              </div>
            </div>

            {/* 1.2 Направление атаки Тори (Синий) - сохраняет вектор, не доворачивается к защитнику */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', marginBottom: 4 }}>
                <span style={{ color: '#60a5fa', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <Compass size={14} color="#3b82f6" /> Направление атаки Тори (Синий):
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#93c5fd', fontWeight: 700, fontFamily: 'monospace' }}>
                    {toriAngleOffsetDeg > 0 ? `+${toriAngleOffsetDeg}` : toriAngleOffsetDeg}°
                    {toriAngleOffsetDeg === 0 ? ' (Прямо)' : toriAngleOffsetDeg < 0 ? ' (Слева)' : ' (Справа)'}
                  </span>
                  {toriAngleOffsetDeg !== 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setToriAngleOffsetDeg(0);
                        notifyParamChange('attackAngleDeg', 0);
                        notifyParamChange('toriAngleOffsetDeg', 0);
                      }}
                      title="Сбросить направление атаки"
                      style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                    >
                      <RotateCcw size={12} />
                    </button>
                  )}
                </div>
              </div>
              <div style={{ fontSize: '0.70rem', color: '#94a3b8', marginBottom: 4 }}>
                Траектория атаки Тори строго зафиксирована (не доворачивается к защитнику)
              </div>
              <input
                type="range"
                min="-90"
                max="90"
                step="5"
                value={toriAngleOffsetDeg}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setToriAngleOffsetDeg(val);
                  notifyParamChange('toriAngleOffsetDeg', val);
                }}
                style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#94a3b8', marginTop: 2 }}>
                <span>-90° (Слева)</span>
                <span>Фронт (0°)</span>
                <span>+90° (Справа)</span>
              </div>
            </div>

            {/* 1.3 Угол ухода защищающегося (Укэ / Тай-сабаки) - модель всегда смотрит на противника */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', marginBottom: 4 }}>
                <span style={{ color: '#f8fafc', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <Shield size={14} color="#f8fafc" /> Угол ухода Укэ (Белый / Тай-сабаки):
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#f8fafc', fontWeight: 700, fontFamily: 'monospace' }}>
                    {ukeEvasionAngleDeg > 0 ? `+${ukeEvasionAngleDeg}` : ukeEvasionAngleDeg}°
                    {ukeEvasionAngleDeg === 0 ? ' (По линии)' : ukeEvasionAngleDeg < 0 ? ' (Влево)' : ' (Вправо)'}
                  </span>
                  {ukeEvasionAngleDeg !== 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setUkeEvasionAngleDeg(0);
                        notifyParamChange('ukeEvasionAngleDeg', 0);
                      }}
                      title="Сбросить угол ухода"
                      style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                    >
                      <RotateCcw size={12} />
                    </button>
                  )}
                </div>
              </div>
              <div style={{ fontSize: '0.70rem', color: '#94a3b8', marginBottom: 6 }}>
                Уход с линии атаки (Тай-сабаки) · <strong style={{ color: '#f8fafc' }}>Укэ всем телом смотрит на Тори</strong>
              </div>

              {/* Быстрые пресеты Тай-сабаки для проверки взаимодействия */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                {[
                  { label: 'Диаг. влево (-45°)', deg: -45 },
                  { label: 'Влево (-35°)', deg: -35 },
                  { label: 'Линия (0°)', deg: 0 },
                  { label: 'Вправо (+35°)', deg: 35 },
                  { label: 'Диаг. вправо (+45°)', deg: 45 },
                ].map((preset) => {
                  const isCurrent = ukeEvasionAngleDeg === preset.deg;
                  return (
                    <button
                      key={preset.deg}
                      type="button"
                      onClick={() => {
                        setUkeEvasionAngleDeg(preset.deg);
                        notifyParamChange('ukeEvasionAngleDeg', preset.deg);
                      }}
                      style={{
                        padding: '2px 7px',
                        borderRadius: 4,
                        fontSize: '0.70rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: isCurrent ? '1px solid #f8fafc' : '1px solid #334155',
                        background: isCurrent ? 'rgba(255, 255, 255, 0.16)' : '#1e293b',
                        color: isCurrent ? '#ffffff' : '#cbd5e1',
                      }}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              <input
                type="range"
                min="-90"
                max="90"
                step="5"
                value={ukeEvasionAngleDeg}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setUkeEvasionAngleDeg(val);
                  notifyParamChange('ukeEvasionAngleDeg', val);
                }}
                style={{ width: '100%', accentColor: '#f8fafc', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#94a3b8', marginTop: 2 }}>
                <span>-90° (Влево)</span>
                <span>0° (Прямо)</span>
                <span>+90° (Вправо)</span>
              </div>
            </div>
          </div>

          {/* КАРТОЧКА 2: АТАКУЮЩИЙ (ТОРИ — СИНЕЕ ДОГИ) */}
          <div
            style={{
              background: 'rgba(59, 130, 246, 0.05)',
              padding: '12px 14px',
              borderRadius: 8,
              border: '1px solid rgba(59, 130, 246, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#60a5fa', fontWeight: 700, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Zap size={15} color="#3b82f6" /> Тори — Атакующий (Синее доги / 攻撃)
              </span>
              {customToriClip && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomToriClip('');
                    notifyParamChange('toriClip', '');
                  }}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '0.7rem', cursor: 'pointer' }}
                >
                  Сбросить атаку
                </button>
              )}
            </div>

            {/* Выбор удара Тори */}
            <div>
              <label style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: 3 }}>
                Удар / Атака кулаком или ногой:
              </label>
              <select
                value={customToriClip || toriPart.clipName || 'oi_zuki_right'}
                onChange={(e) => {
                  setCustomToriClip(e.target.value);
                  notifyParamChange('toriClip', e.target.value);
                }}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: 6,
                  background: '#1a1a24',
                  color: '#f8fafc',
                  border: '1px solid #475569',
                  fontSize: '0.79rem',
                  cursor: 'pointer',
                }}
              >
                {BUNKAI_ATTACK_STRIKES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Стойки Тори: Начальная и Конечная */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <label style={{ fontSize: '0.73rem', color: '#cbd5e1' }}>Нач. стойка Тори:</label>
                  <button
                    type="button"
                    onClick={() => {
                      const next = toggleStanceSide(customToriStance, toriPart.stance);
                      setCustomToriStance(next);
                      notifyParamChange('toriStance', next);
                    }}
                    title="Сменить сторону"
                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', borderRadius: 3, padding: '1px 5px', fontSize: '0.68rem', cursor: 'pointer' }}
                  >
                    ⇄
                  </button>
                </div>
                <select
                  value={customToriStance}
                  onChange={(e) => {
                    setCustomToriStance(e.target.value);
                    notifyParamChange('toriStance', e.target.value);
                  }}
                  style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: '#1a1a24', color: '#f8fafc', border: '1px solid #334155', fontSize: '0.76rem', cursor: 'pointer' }}
                >
                  <option value="">По сценарию ({toriPart.stance || 'zenkutsu'})</option>
                  <optgroup label="Дзэнкуцу-дати">
                    <option value="zenkutsu_dachi_left">Левая Дзэнкуцу (Хидари)</option>
                    <option value="zenkutsu_dachi_right">Правая Дзэнкуцу (Миги)</option>
                  </optgroup>
                  <optgroup label="Кокуцу-дати">
                    <option value="kokutsu_dachi_left">Левая Кокуцу (Хидари)</option>
                    <option value="kokutsu_dachi_right">Правая Кокуцу (Миги)</option>
                  </optgroup>
                  <optgroup label="Фудо-дати">
                    <option value="fudo_dachi">Левая Фудо (Хидари)</option>
                    <option value="fudo_dachi_right">Правая Фудо (Миги)</option>
                  </optgroup>
                  <optgroup label="Симметричные">
                    <option value="kiba_dachi">Киба-дати (Всадник)</option>
                    <option value="stance_shiko">Сико-дати (Квадрат)</option>
                    <option value="heiko_dachi">Хэйко-дати (Готовность)</option>
                    <option value="stance_musubi">Мусуби-дати (Поклон)</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <label style={{ fontSize: '0.73rem', color: '#cbd5e1' }}>Кон. стойка Тори:</label>
                  {customToriFinalStance && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomToriFinalStance('');
                        notifyParamChange('toriFinalStance', '');
                      }}
                      style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '0.68rem', cursor: 'pointer', padding: 0 }}
                    >
                      Сброс
                    </button>
                  )}
                </div>
                <select
                  value={customToriFinalStance}
                  onChange={(e) => {
                    setCustomToriFinalStance(e.target.value);
                    notifyParamChange('toriFinalStance', e.target.value);
                  }}
                  style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: '#1a1a24', color: '#f8fafc', border: '1px solid #334155', fontSize: '0.76rem', cursor: 'pointer' }}
                >
                  <option value="">Авто (по сценарию)</option>
                  <optgroup label="Дзэнкуцу-дати">
                    <option value="zenkutsu_dachi_left">Левая Дзэнкуцу</option>
                    <option value="zenkutsu_dachi_right">Правая Дзэнкуцу</option>
                  </optgroup>
                  <optgroup label="Кокуцу-дати">
                    <option value="kokutsu_dachi_left">Левая Кокуцу</option>
                    <option value="kokutsu_dachi_right">Правая Кокуцу</option>
                  </optgroup>
                  <optgroup label="Фудо-дати">
                    <option value="fudo_dachi">Левая Фудо</option>
                    <option value="fudo_dachi_right">Правая Фудо</option>
                  </optgroup>
                  <optgroup label="Симметричные">
                    <option value="kiba_dachi">Киба-дати</option>
                    <option value="stance_shiko">Сико-дати</option>
                    <option value="heiko_dachi">Хэйко-дати</option>
                  </optgroup>
                </select>
              </div>
            </div>

            {/* Контекстная постановка ноги при ударе ногой Тори */}
            {isToriKick && (
              <div style={{ padding: '8px 10px', background: 'rgba(59, 130, 246, 0.08)', borderRadius: 6, border: '1px solid rgba(59, 130, 246, 0.28)' }}>
                <div style={{ fontSize: '0.73rem', color: '#60a5fa', fontWeight: 600, marginBottom: 5 }}>
                  Постановка ноги при ударе ногой Тори:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <button
                    type="button"
                    style={{
                      padding: '5px 8px',
                      borderRadius: 4,
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: (toriLandingMode === 'back' || (toriLandingMode === 'auto' && toriPart.landingMode === 'back')) ? '#f8fafc' : '#1e293b',
                      color: (toriLandingMode === 'back' || (toriLandingMode === 'auto' && toriPart.landingMode === 'back')) ? '#0f172a' : '#f8fafc',
                      border: (toriLandingMode === 'back' || (toriLandingMode === 'auto' && toriPart.landingMode === 'back')) ? '1px solid #ffffff' : '1px solid #334155',
                    }}
                    onClick={() => {
                      setToriLandingMode('back');
                      notifyParamChange('toriLandingMode', 'back');
                      const finalSt = customToriStance || toriPart.stance || 'zenkutsu_dachi_left';
                      setCustomToriFinalStance(finalSt);
                      notifyParamChange('toriFinalStance', finalSt);
                    }}
                  >
                    🔙 Ногу назад (в исходную)
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: '5px 8px',
                      borderRadius: 4,
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: (toriLandingMode === 'forward' || (toriLandingMode === 'auto' && toriPart.landingMode === 'forward')) ? '#f8fafc' : '#1e293b',
                      color: (toriLandingMode === 'forward' || (toriLandingMode === 'auto' && toriPart.landingMode === 'forward')) ? '#0f172a' : '#f8fafc',
                      border: (toriLandingMode === 'forward' || (toriLandingMode === 'auto' && toriPart.landingMode === 'forward')) ? '1px solid #ffffff' : '1px solid #334155',
                    }}
                    onClick={() => {
                      setToriLandingMode('forward');
                      notifyParamChange('toriLandingMode', 'forward');
                      const nextStance = (customToriStance || toriPart.stance || '').includes('left') ? 'zenkutsu_dachi_right' : 'zenkutsu_dachi_left';
                      setCustomToriFinalStance(nextStance);
                      notifyParamChange('toriFinalStance', nextStance);
                    }}
                  >
                    🔜 Ногу вперед (со сменой)
                  </button>
                </div>
              </div>
            )}

            {/* Конечный угол поворота Тори (End Yaw) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <label style={{ fontSize: '0.73rem', color: '#cbd5e1', fontWeight: 600 }}>Конечный угол поворота Тори:</label>
                <span style={{ fontSize: '0.75rem', color: '#f8fafc', fontWeight: 700, fontFamily: 'monospace' }}>
                  {(() => {
                    const dispToriAngle = customToriEndYawDeg !== null
                      ? customToriEndYawDeg
                      : (placement.coordinates?.tori?.yawDeg ?? Math.round(((placement.angles?.toriYaw ?? placement.rotTori[1]) * 180) / Math.PI));
                    return `${dispToriAngle > 0 ? `+${dispToriAngle}` : dispToriAngle}°`;
                  })()}
                </span>
              </div>
              <input
                type="range"
                min="-180"
                max="180"
                step="5"
                value={customToriEndYawDeg !== null
                  ? customToriEndYawDeg
                  : (placement.coordinates?.tori?.yawDeg ?? Math.round(((placement.angles?.toriYaw ?? placement.rotTori[1]) * 180) / Math.PI))}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setCustomToriEndYawDeg(val);
                  notifyParamChange('toriEndAngleDeg', val);
                  notifyParamChange('customToriYawDeg', val);
                }}
                style={{ width: '100%', accentColor: '#60a5fa', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                {[0, 45, 90, 180, -90, -45].map((ang) => {
                  const currentVal = customToriEndYawDeg !== null
                    ? customToriEndYawDeg
                    : (placement.coordinates?.tori?.yawDeg ?? Math.round(((placement.angles?.toriYaw ?? placement.rotTori[1]) * 180) / Math.PI));
                  return (
                    <button
                      key={ang}
                      type="button"
                      onClick={() => {
                        setCustomToriEndYawDeg(ang);
                        notifyParamChange('toriEndAngleDeg', ang);
                        notifyParamChange('customToriYawDeg', ang);
                      }}
                      style={{
                        flex: 1,
                        padding: '2px 4px',
                        fontSize: '0.67rem',
                        fontWeight: 600,
                        borderRadius: 4,
                        background: currentVal === ang ? '#f8fafc' : '#1e293b',
                        color: currentVal === ang ? '#0f172a' : '#cbd5e1',
                        border: '1px solid #334155',
                        cursor: 'pointer',
                      }}
                    >
                      {ang}°
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* КАРТОЧКА 3: ЗАЩИЩАЮЩИЙСЯ (УКЭ 1 — БЕЛОЕ ДОГИ) */}
          <div
            style={{
              background: 'rgba(248, 250, 252, 0.04)',
              padding: '12px 14px',
              borderRadius: 8,
              border: '1px solid rgba(248, 250, 252, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Shield size={15} color="#f8fafc" /> Укэ 1 — Защищающийся (Белое доги / 防御)
              </span>
              {customUkeClip && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomUkeClip('');
                    notifyParamChange('ukeClip', '');
                  }}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '0.7rem', cursor: 'pointer' }}
                >
                  Сбросить блок
                </button>
              )}
            </div>

            {/* Выбор блока / защиты Укэ */}
            <div>
              <label style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: 3 }}>
                Блок / Защитное действие или контрудар:
              </label>
              <select
                value={customUkeClip || uke1Part.clipName || 'age_uke_left'}
                onChange={(e) => {
                  setCustomUkeClip(e.target.value);
                  notifyParamChange('ukeClip', e.target.value);
                }}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: 6,
                  background: '#1a1a24',
                  color: '#f8fafc',
                  border: '1px solid #475569',
                  fontSize: '0.79rem',
                  cursor: 'pointer',
                }}
              >
                {BUNKAI_DEFENSE_BLOCKS.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
            </div>

            {/* Стойки Укэ: Начальная и Конечная */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <label style={{ fontSize: '0.73rem', color: '#cbd5e1' }}>Нач. стойка Укэ:</label>
                  <button
                    type="button"
                    onClick={() => {
                      const next = toggleStanceSide(customUkeStance, uke1Part.stance);
                      setCustomUkeStance(next);
                      notifyParamChange('ukeStance', next);
                    }}
                    title="Сменить сторону"
                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', borderRadius: 3, padding: '1px 5px', fontSize: '0.68rem', cursor: 'pointer' }}
                  >
                    ⇄
                  </button>
                </div>
                <select
                  value={customUkeStance}
                  onChange={(e) => {
                    setCustomUkeStance(e.target.value);
                    notifyParamChange('ukeStance', e.target.value);
                  }}
                  style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: '#1a1a24', color: '#f8fafc', border: '1px solid #334155', fontSize: '0.76rem', cursor: 'pointer' }}
                >
                  <option value="">По сценарию ({uke1Part.stance || 'zenkutsu'})</option>
                  <optgroup label="Дзэнкуцу-дати">
                    <option value="zenkutsu_dachi_left">Левая Дзэнкуцу (Хидари)</option>
                    <option value="zenkutsu_dachi_right">Правая Дзэнкуцу (Миги)</option>
                  </optgroup>
                  <optgroup label="Кокуцу-дати">
                    <option value="kokutsu_dachi_left">Левая Кокуцу (Хидари)</option>
                    <option value="kokutsu_dachi_right">Правая Кокуцу (Миги)</option>
                  </optgroup>
                  <optgroup label="Фудо-дати">
                    <option value="fudo_dachi">Левая Фудо (Хидари)</option>
                    <option value="fudo_dachi_right">Правая Фудо (Миги)</option>
                  </optgroup>
                  <optgroup label="Симметричные">
                    <option value="kiba_dachi">Киба-дати (Всадник)</option>
                    <option value="stance_shiko">Сико-дати (Квадрат)</option>
                    <option value="heiko_dachi">Хэйко-дати (Готовность)</option>
                    <option value="stance_musubi">Мусуби-дати (Поклон)</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <label style={{ fontSize: '0.73rem', color: '#cbd5e1' }}>Кон. стойка Укэ:</label>
                  {customUkeFinalStance && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomUkeFinalStance('');
                        notifyParamChange('ukeFinalStance', '');
                      }}
                      style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '0.68rem', cursor: 'pointer', padding: 0 }}
                    >
                      Сброс
                    </button>
                  )}
                </div>
                <select
                  value={customUkeFinalStance}
                  onChange={(e) => {
                    setCustomUkeFinalStance(e.target.value);
                    notifyParamChange('ukeFinalStance', e.target.value);
                  }}
                  style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: '#1a1a24', color: '#f8fafc', border: '1px solid #334155', fontSize: '0.76rem', cursor: 'pointer' }}
                >
                  <option value="">Авто (по сценарию)</option>
                  <optgroup label="Дзэнкуцу-дати">
                    <option value="zenkutsu_dachi_left">Левая Дзэнкуцу</option>
                    <option value="zenkutsu_dachi_right">Правая Дзэнкуцу</option>
                  </optgroup>
                  <optgroup label="Кокуцу-дати">
                    <option value="kokutsu_dachi_left">Левая Кокуцу</option>
                    <option value="kokutsu_dachi_right">Правая Кокуцу</option>
                  </optgroup>
                  <optgroup label="Фудо-дати">
                    <option value="fudo_dachi">Левая Фудо</option>
                    <option value="fudo_dachi_right">Правая Фудо</option>
                  </optgroup>
                  <optgroup label="Симметричные">
                    <option value="kiba_dachi">Киба-дати</option>
                    <option value="stance_shiko">Сико-дати</option>
                    <option value="heiko_dachi">Хэйко-дати</option>
                  </optgroup>
                </select>
              </div>
            </div>

            {/* Контекстная постановка ноги при ударе ногой Укэ */}
            {isUkeKick && (
              <div style={{ padding: '8px 10px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.20)' }}>
                <div style={{ fontSize: '0.73rem', color: '#f8fafc', fontWeight: 600, marginBottom: 5 }}>
                  Постановка ноги при ударе ногой Укэ:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <button
                    type="button"
                    style={{
                      padding: '5px 8px',
                      borderRadius: 4,
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: (ukeLandingMode === 'back' || (ukeLandingMode === 'auto' && uke1Part.landingMode === 'back')) ? '#f8fafc' : '#1e293b',
                      color: (ukeLandingMode === 'back' || (ukeLandingMode === 'auto' && uke1Part.landingMode === 'back')) ? '#0f172a' : '#f8fafc',
                      border: (ukeLandingMode === 'back' || (ukeLandingMode === 'auto' && uke1Part.landingMode === 'back')) ? '1px solid #ffffff' : '1px solid #334155',
                    }}
                    onClick={() => {
                      setUkeLandingMode('back');
                      notifyParamChange('ukeLandingMode', 'back');
                      const finalSt = customUkeStance || uke1Part.stance || 'zenkutsu_dachi_left';
                      setCustomUkeFinalStance(finalSt);
                      notifyParamChange('ukeFinalStance', finalSt);
                    }}
                  >
                    🔙 Ногу назад (в исходную)
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: '5px 8px',
                      borderRadius: 4,
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: (ukeLandingMode === 'forward' || (ukeLandingMode === 'auto' && uke1Part.landingMode === 'forward')) ? '#f8fafc' : '#1e293b',
                      color: (ukeLandingMode === 'forward' || (ukeLandingMode === 'auto' && uke1Part.landingMode === 'forward')) ? '#0f172a' : '#f8fafc',
                      border: (ukeLandingMode === 'forward' || (ukeLandingMode === 'auto' && uke1Part.landingMode === 'forward')) ? '1px solid #ffffff' : '1px solid #334155',
                    }}
                    onClick={() => {
                      setUkeLandingMode('forward');
                      notifyParamChange('ukeLandingMode', 'forward');
                      const nextStance = (customUkeStance || uke1Part.stance || '').includes('left') ? 'zenkutsu_dachi_right' : 'zenkutsu_dachi_left';
                      setCustomUkeFinalStance(nextStance);
                      notifyParamChange('ukeFinalStance', nextStance);
                    }}
                  >
                    🔜 Ногу вперед (со сменой)
                  </button>
                </div>
              </div>
            )}

            {/* Конечный угол поворота Укэ 1 (End Yaw) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <label style={{ fontSize: '0.73rem', color: '#cbd5e1', fontWeight: 600 }}>Конечный угол поворота Укэ:</label>
                <span style={{ fontSize: '0.75rem', color: '#f8fafc', fontWeight: 700, fontFamily: 'monospace' }}>
                  {(() => {
                    const dispUkeAngle = customUkeEndYawDeg !== null
                      ? customUkeEndYawDeg
                      : (placement.coordinates?.uke1?.yawDeg ?? Math.round(((placement.angles?.uke1Yaw ?? placement.rotUke1[1]) * 180) / Math.PI));
                    return `${dispUkeAngle > 0 ? `+${dispUkeAngle}` : dispUkeAngle}°`;
                  })()}
                </span>
              </div>
              <input
                type="range"
                min="-180"
                max="180"
                step="5"
                value={customUkeEndYawDeg !== null
                  ? customUkeEndYawDeg
                  : (placement.coordinates?.uke1?.yawDeg ?? Math.round(((placement.angles?.uke1Yaw ?? placement.rotUke1[1]) * 180) / Math.PI))}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setCustomUkeEndYawDeg(val);
                  notifyParamChange('ukeEndAngleDeg', val);
                  notifyParamChange('customUkeYawDeg', val);
                }}
                style={{ width: '100%', accentColor: '#cbd5e1', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                {[180, 0, 90, -90, 45, -45].map((ang) => {
                  const currentVal = customUkeEndYawDeg !== null
                    ? customUkeEndYawDeg
                    : (placement.coordinates?.uke1?.yawDeg ?? Math.round(((placement.angles?.uke1Yaw ?? placement.rotUke1[1]) * 180) / Math.PI));
                  return (
                    <button
                      key={ang}
                      type="button"
                      onClick={() => {
                        setCustomUkeEndYawDeg(ang);
                        notifyParamChange('ukeEndAngleDeg', ang);
                        notifyParamChange('customUkeYawDeg', ang);
                      }}
                      style={{
                        flex: 1,
                        padding: '2px 4px',
                        fontSize: '0.67rem',
                        fontWeight: 600,
                        borderRadius: 4,
                        background: currentVal === ang ? '#f8fafc' : '#1e293b',
                        color: currentVal === ang ? '#0f172a' : '#cbd5e1',
                        border: '1px solid #334155',
                        cursor: 'pointer',
                      }}
                    >
                      {ang}°
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        )}
          </>
        ) : (
          <div
            style={{
              padding: '12px 16px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.82rem',
              color: '#94a3b8',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <Shield size={15} color="#f8fafc" />
              <span>Режим интерактивного просмотра · <strong style={{ color: '#e2e8f0' }}>Панель изменения движений доступна только создателю бункая</strong></span>
            </span>
            <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
              Все анимации, стойки и траектории зафиксированы автором сценария
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
