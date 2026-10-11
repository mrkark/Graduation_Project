import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import KaratekaLowpolyModel from './KaratekaLowpolyModel';
import TraditionalDojo from './TraditionalDojo';
import { animationRegistry } from './animationRegistry';

/**
 * Непрерывный секвенсер Ката Шотокан (Kata Sequencer v4).
 * 
 * Особенности:
 * - Пошаговый разбор канонических движений Heian Shodan на базе точной MoCap-анимации.
 * - Извлечение точных подклипов шагов [startTime, endTime] из 60 FPS мастер-анимации.
 * - Полноразмерный непрерывный мастер-прогон всей формы с live-трекингом шагов.
 * - Отображение реальной траектории эмбусэна (H/I-форма) с кликабельными маркерами на татами.
 * - Маркеры боевого духа КИАЙ на 9-м и 17-м шагах.
 * - Интеллектуальная камера (следование за мастером или общий обзор додзё).
 * - Скраббинг времени, замедление (0.25x, 0.5x, 1x, 1.5x), повтор и зацикливание шагов.
 */

const ALL_KATA_SLUGS = [
  'heian_shodan', 'heian_nidan', 'heian_sandan', 'heian_yondan', 'heian_godan',
  'tekki_shodan', 'tekki_nidan', 'tekki_sandan',
  'bassai_dai', 'bassai_sho', 'kanku_dai', 'kanku_sho',
  'jion', 'jiin', 'jitte', 'empi', 'hangetsu', 'gankaku',
  'sochin', 'nijushiho', 'meikyo', 'unsu', 'wankan',
  'gojushiho_dai', 'gojushiho_sho', 'chinte'
];

export function resolveKataSlug(title = '') {
  const t = title.toLowerCase().trim();
  if (ALL_KATA_SLUGS.includes(t)) return t;
  if (t.includes('шодан') || t.includes('shodan')) {
    if (t.includes('тэкки') || t.includes('tekki')) return 'tekki_shodan';
    return 'heian_shodan';
  }
  if (t.includes('нидан') || t.includes('nidan')) {
    if (t.includes('тэкки') || t.includes('tekki')) return 'tekki_nidan';
    return 'heian_nidan';
  }
  if (t.includes('сандан') || t.includes('sandan')) {
    if (t.includes('тэкки') || t.includes('tekki')) return 'tekki_sandan';
    return 'heian_sandan';
  }
  if (t.includes('ёндан') || t.includes('yondan')) return 'heian_yondan';
  if (t.includes('годан') || t.includes('godan')) return 'heian_godan';
  if (t.includes('бассай дай') || t.includes('bassai dai') || t.includes('bassai_dai')) return 'bassai_dai';
  if (t.includes('бассай шо') || t.includes('bassai sho') || t.includes('bassai_sho')) return 'bassai_sho';
  if (t.includes('канку дай') || t.includes('kanku dai') || t.includes('kanku_dai')) return 'kanku_dai';
  if (t.includes('канку шо') || t.includes('kanku sho') || t.includes('kanku_sho')) return 'kanku_sho';
  if (t.includes('дзиин') || t.includes("дзи'ин") || t.includes('jiin') || t.includes("ji'in")) return 'jiin';
  if (t.includes('дзион') || t.includes('jion')) return 'jion';
  if (t.includes('джиттэ') || t.includes('jitte')) return 'jitte';
  if (t.includes('эмпи') || t.includes('empi')) return 'empi';
  if (t.includes('хангэцу') || t.includes('hangetsu')) return 'hangetsu';
  if (t.includes('ганкаку') || t.includes('gankaku')) return 'gankaku';
  if (t.includes('сочин') || t.includes('sochin')) return 'sochin';
  if (t.includes('нидзюсихо') || t.includes('nijushiho')) return 'nijushiho';
  if (t.includes('мэйкё') || t.includes('meikyo')) return 'meikyo';
  if (t.includes('унсу') || t.includes('unsu')) return 'unsu';
  if (t.includes('ванкан') || t.includes('wankan')) return 'wankan';
  if (t.includes('годзюсихо дай') || t.includes('gojushiho dai') || t.includes('gojushiho_dai')) return 'gojushiho_dai';
  if (t.includes('годзюсихо шо') || t.includes('gojushiho sho') || t.includes('gojushiho_sho')) return 'gojushiho_sho';
  if (t.includes('чинтэ') || t.includes('chinte')) return 'chinte';
  return 'heian_shodan';
}

// Канонические координаты эмбусэна Heian Shodan (извлеченные из Root Motion анимации)
const CANONICAL_EMBUSEN = {
  heian_shodan: [
    [0.23, 0.02, -0.06],    // 1: Поворот 90° влево — Гэдан-барай
    [1.13, 0.02, -0.06],    // 2: Шаг вперед — Ой-цуки
    [0.33, 0.02, -0.34],    // 3: Разворот 180° вправо — Гэдан-барай
    [0.51, 0.02, -0.34],    // 4: Подтягивание ноги (Мото-дати) — Тэтцуи-учи
    [-0.12, 0.02, -0.34],   // 5: Шаг вперед — Ой-цуки
    [0.42, 0.02, -0.08],    // 6: Поворот влево 90° на ось эмбусэн — Гэдан-барай
    [0.42, 0.02, 0.82],     // 7: Шаг вперед — 1-й Агэ-укэ
    [0.42, 0.02, 1.72],     // 8: Шаг вперед — 2-й Агэ-укэ
    [0.42, 0.02, 2.62],     // 9: Шаг вперед — 3-й Агэ-укэ [КИАЙ]
    [-0.12, 0.02, 3.26],    // 10: Разворот через спину 270° влево — Гэдан-барай
    [-1.02, 0.02, 3.26],    // 11: Шаг вперед — Ой-цуки
    [-0.22, 0.02, 3.54],    // 12: Разворот 180° вправо — Гэдан-барай
    [0.68, 0.02, 3.54],     // 13: Шаг вперед — Ой-цуки
    [0.14, 0.02, 3.28],     // 14: Поворот влево 90° на центральную ось — Гэдан-барай
    [0.14, 0.02, 2.38],     // 15: Шаг вперед — 1-й Ой-цуки
    [0.14, 0.02, 1.48],     // 16: Шаг вперед — 2-й Ой-цуки
    [0.14, 0.02, 0.58],     // 17: Шаг вперед — 3-й Ой-цуки [КИАЙ]
    [0.47, 0.02, -0.04],    // 18: Разворот через спину 90° — Сюто-укэ в Кокуцу-дати
    [1.07, 0.02, 0.09],     // 19: Шаг 45° — Сюто-укэ
    [0.83, 0.02, -0.25],    // 20: Разворот через спину 135° — Сюто-укэ
    [0.23, 0.02, -0.12],    // 21: Шаг 45° — Финальный Сюто-укэ
  ],
};

// Канонические временные интервалы всех 21 шагов из мастер-анимации Heian Shodan (60 FPS)
const HEIAN_SHODAN_CANONICAL_EVENTS = [
  { moveNumber: 1, startTime: 1.20, endTime: 2.46, form: 'zenkutsu' },
  { moveNumber: 2, startTime: 2.46, endTime: 3.56, form: 'zenkutsu' },
  { moveNumber: 3, startTime: 3.56, endTime: 4.97, form: 'zenkutsu' },
  { moveNumber: 4, startTime: 4.97, endTime: 6.21, form: 'moto' },
  { moveNumber: 5, startTime: 6.21, endTime: 7.31, form: 'zenkutsu' },
  { moveNumber: 6, startTime: 7.31, endTime: 8.62, form: 'zenkutsu' },
  { moveNumber: 7, startTime: 8.62, endTime: 9.80, form: 'zenkutsu' },
  { moveNumber: 8, startTime: 9.80, endTime: 10.98, form: 'zenkutsu' },
  { moveNumber: 9, startTime: 10.98, endTime: 12.16, form: 'zenkutsu', kiai: true },
  { moveNumber: 10, startTime: 12.16, endTime: 13.72, form: 'zenkutsu' },
  { moveNumber: 11, startTime: 13.72, endTime: 14.82, form: 'zenkutsu' },
  { moveNumber: 12, startTime: 14.82, endTime: 16.23, form: 'zenkutsu' },
  { moveNumber: 13, startTime: 16.23, endTime: 17.33, form: 'zenkutsu' },
  { moveNumber: 14, startTime: 17.33, endTime: 18.64, form: 'zenkutsu' },
  { moveNumber: 15, startTime: 18.64, endTime: 19.74, form: 'zenkutsu' },
  { moveNumber: 16, startTime: 19.74, endTime: 20.84, form: 'zenkutsu' },
  { moveNumber: 17, startTime: 20.84, endTime: 21.94, form: 'zenkutsu', kiai: true },
  { moveNumber: 18, startTime: 21.94, endTime: 23.55, form: 'kokutsu' },
  { moveNumber: 19, startTime: 23.55, endTime: 24.86, form: 'kokutsu' },
  { moveNumber: 20, startTime: 24.86, endTime: 26.42, form: 'kokutsu' },
  { moveNumber: 21, startTime: 26.42, endTime: 27.73, form: 'kokutsu' },
];

/**
 * Плавный кинематографический риг камеры:
 * Исключает рывки, резкие скачки и непроизвольные сбросы ракурса при переключении шагов.
 * При включенном следовании (Follow) камера плавно скользит за мастером по татами,
 * синхронно перемещая фокус и позицию, благодаря чему угол поворота и зум пользователя сохраняются.
 * В статическом режиме камера полностью неподвижна, позволяя изучать форму из одной точки.
 */
function SmoothCameraRig({ targetPosition, follow, hasStarted, controlsRef }) {
  useFrame((state, delta) => {
    if (!controlsRef.current) return;
    const controls = controlsRef.current;

    if (!hasStarted) return;

    if (follow && targetPosition) {
      const tx = targetPosition[0];
      const tz = targetPosition[2];
      const ty = 0.95;

      const factor = 1.0 - Math.exp(-3.5 * Math.min(delta, 0.1));
      const dx = (tx - controls.target.x) * factor;
      const dy = (ty - controls.target.y) * factor;
      const dz = (tz - controls.target.z) * factor;

      // Синхронно смещаем и target, и camera.position, чтобы ориентация орбиты пользователя не нарушалась
      controls.target.x += dx;
      controls.target.y += dy;
      controls.target.z += dz;

      state.camera.position.x += dx;
      state.camera.position.y += dy;
      state.camera.position.z += dz;

      controls.update();
    }
  });

  return null;
}

export default function KataSequencer({
  kataTitle = 'Хэйан Шодан',
  steps = [],
  height = 500,
  activeStepIndex = 0,
  onStepChange = null,
}) {
  const [hasStarted, setHasStarted] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(activeStepIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [speed, setSpeed] = useState(1.0);
  const [cameraFollow, setCameraFollow] = useState(true);
  const [warningMessage, setWarningMessage] = useState(null);
  const [playbackMode, setPlaybackMode] = useState('steps'); // 'steps' | 'full'
  const [kataJsonData, setKataJsonData] = useState(null);
  const [replayTrigger, setReplayTrigger] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(29.48);
  const [scrubProgress, setScrubProgress] = useState(null);

  const controlsRef = useRef();

  const kataSlug = useMemo(() => resolveKataSlug(kataTitle), [kataTitle]);

  // Загружаем канонические метаданные ката из /kata_data/*.json
  useEffect(() => {
    if (!kataSlug) return;
    fetch(`/kata_data/${kataSlug}.json`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setKataJsonData(data);
        if (data?.duration) setTotalDuration(data.duration);
      })
      .catch(() => {});
  }, [kataSlug]);

  // Синхронизация внешнего индекса шага
  useEffect(() => {
    if (activeStepIndex !== undefined && activeStepIndex !== currentIdx) {
      setCurrentIdx(activeStepIndex);
      setHasStarted(true);
      setIsPlaying(true);
    }
  }, [activeStepIndex]);

  // Вычисление траектории эмбусэна (реальные координаты Root Motion либо эвристика)
  const { stepPositions, embusenPoints } = useMemo(() => {
    if (CANONICAL_EMBUSEN[kataSlug]) {
      const pts = CANONICAL_EMBUSEN[kataSlug];
      const positions = pts.map((p) => ({
        position: [p[0], 0, p[2]],
        rotation: [0, 0, 0],
      }));
      return { stepPositions: positions, embusenPoints: pts };
    }

    let curX = 0;
    let curZ = 0;
    let curAngleDeg = 0;
    const positions = [];
    const points = [[0, 0.02, 0]];

    steps.forEach((s) => {
      const dx = s.Root_Displacement_X || 0;
      const dz = s.Root_Displacement_Z || 0;
      const dYaw = s.Root_Rotation_Yaw || 0;

      let stepDx = dx;
      let stepDz = dz;
      let stepYaw = dYaw;

      if (dx === 0 && dz === 0) {
        const dir = (s.Direction || '').toLowerCase();
        if (dir.includes('влево') || dir.includes('left') || dir.includes('90°')) {
          stepDx = -0.85;
          stepYaw = 90;
        } else if (dir.includes('вправо') || dir.includes('right')) {
          stepDx = 0.85;
          stepYaw = -90;
        } else if (dir.includes('вперед') || dir.includes('forward')) {
          stepDz = 0.85;
          stepYaw = 0;
        } else if (dir.includes('назад') || dir.includes('backward') || dir.includes('180°')) {
          stepDz = -0.85;
          stepYaw = 180;
        }
      }

      curX += stepDx;
      curZ += stepDz;
      curAngleDeg += stepYaw;

      positions.push({
        position: [curX, 0, curZ],
        rotation: [0, (curAngleDeg * Math.PI) / 180, 0],
      });

      points.push([curX, 0.02, curZ]);
    });

    return { stepPositions: positions, embusenPoints: points };
  }, [steps, kataSlug]);

  const events = kataJsonData?.events || (kataSlug === 'heian_shodan' ? HEIAN_SHODAN_CANONICAL_EVENTS : []);
  const totalStepsCount = Math.max(steps.length, events.length) || 21;
  const currentStep = steps[currentIdx] || steps[0] || {};
  const currentPosData = stepPositions[currentIdx] || { position: [0, 0, 0], rotation: [0, 0, 0] };
  const currentEvent = events[currentIdx];

  // Временной диапазон текущего шага в MoCap-анимации Heian Shodan
  const kataTimeRange = useMemo(() => {
    if (playbackMode === 'full') return null;
    if (currentEvent && currentEvent.startTime !== undefined && currentEvent.endTime !== undefined) {
      return [currentEvent.startTime, currentEvent.endTime];
    }
    return null;
  }, [playbackMode, currentEvent]);

  // Длительность текущего шага в секундах
  const stepDurationSec = useMemo(() => {
    if (currentEvent && currentEvent.startTime !== undefined && currentEvent.endTime !== undefined) {
      return (currentEvent.endTime - currentEvent.startTime).toFixed(2);
    }
    return (currentStep.Duration || 2.0).toFixed(2);
  }, [currentEvent, currentStep.Duration]);

  // При первом переходе из стойки Йой к изучению ката однократно плавно фокусируем мастера
  useEffect(() => {
    if (hasStarted && controlsRef.current) {
      const pos = currentPosData.position;
      controlsRef.current.target.set(pos[0], 0.95, pos[2]);
      controlsRef.current.update();
    }
  }, [hasStarted]);

  const selectStep = useCallback((idx) => {
    setCurrentIdx(idx);
    setHasStarted(true);
    setIsPlaying(true);
    setScrubProgress(null);
    if (onStepChange) onStepChange(idx);
  }, [onStepChange]);

  const handleStepEnd = useCallback(() => {
    if (playbackMode === 'steps') {
      if (!isLooping) {
        if (currentIdx < totalStepsCount - 1) {
          selectStep(currentIdx + 1);
        } else {
          setIsPlaying(false);
        }
      }
    } else if (playbackMode === 'full') {
      setIsPlaying(false);
    }
  }, [playbackMode, isLooping, currentIdx, totalStepsCount, selectStep]);

  // Синхронизация времени в реальном времени при полном мастер-прогоне
  const handleTimeUpdate = useCallback((time, dur) => {
    setCurrentTime(time);
    if (dur > 0) setTotalDuration(dur);

    if (playbackMode === 'full') {
      const activeEvents = kataJsonData?.events || (kataSlug === 'heian_shodan' ? HEIAN_SHODAN_CANONICAL_EVENTS : []);
      const evIdx = activeEvents.findIndex(
        (ev) => time >= ev.startTime && time <= ev.endTime
      );
      if (evIdx !== -1 && evIdx !== currentIdx) {
        setCurrentIdx(evIdx);
        if (onStepChange) onStepChange(evIdx);
      }
    }
  }, [playbackMode, kataJsonData, kataSlug, currentIdx, onStepChange]);

  function resetCamera() {
    if (controlsRef.current) {
      controlsRef.current.reset();
      const pos = currentPosData.position || [0, 0, 0];
      controlsRef.current.target.set(pos[0], 0.95, pos[2]);
      controlsRef.current.update();
    }
  }

  const isCurrentKiai = Boolean(
    currentEvent?.kiai ||
    kataJsonData?.kiaiMoves?.includes(currentIdx + 1) ||
    currentStep.Title?.includes('КИАЙ') ||
    currentStep.Technique?.includes('КИАЙ')
  );

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        background: '#0a0a0c',
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid rgba(197, 160, 89, 0.25)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}
    >
      {/* 3D Сцена Додзё */}
      <div style={{ width: '100%', height, position: 'relative' }}>
        <Canvas
          shadows
          camera={{ position: [0.0, 1.5, 3.8], fov: 42 }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        >
          <color attach="background" args={['#0e0d0b']} />
          <ambientLight intensity={0.65} color="#fff6e5" />
          <directionalLight
            position={[3.5, 6.0, 3.5]}
            intensity={1.1}
            castShadow
            shadow-mapSize={[1024, 1024]}
            shadow-bias={-0.0002}
          />
          <directionalLight position={[-3.5, 3.5, -2.5]} intensity={0.35} color="#cbd5e1" />

          {/* Традиционное деревянное додзё и татами */}
          <TraditionalDojo />

          {/* Аватар мастера Шотокан: точные подклипы шагов или непрерывная форма */}
          <KaratekaLowpolyModel
            role="tori"
            kataMode={hasStarted}
            stance="ready"
            kataClipName={kataSlug}
            kataTimeRange={playbackMode === 'steps' ? kataTimeRange : null}
            kataScrubProgress={scrubProgress}
            speed={speed}
            isPlaying={hasStarted && isPlaying}
            isLooping={playbackMode === 'steps' ? isLooping : false}
            replayTrigger={replayTrigger}
            position={[0, 0, 0]}
            rotation={[0, 0, 0]}
            onStepEnd={handleStepEnd}
            onTimeUpdate={handleTimeUpdate}
          />

          <ContactShadows
            position={[0, 0.01, 0]}
            opacity={0.6}
            scale={6.5}
            blur={1.5}
            far={3.0}
          />

          <SmoothCameraRig
            targetPosition={currentPosData.position}
            follow={cameraFollow}
            hasStarted={hasStarted}
            controlsRef={controlsRef}
          />

          <OrbitControls
            ref={controlsRef}
            minDistance={1.2}
            maxDistance={7.5}
            maxPolarAngle={Math.PI / 2 - 0.04}
            enablePan
            enableDamping
            dampingFactor={0.08}
          />
        </Canvas>

        {/* Оверлей приглашения к началу изучения в стойке Йой */}
        {!hasStarted && (
          <div
            style={{
              position: 'absolute',
              bottom: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 20,
              pointerEvents: 'auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                background: 'rgba(12, 10, 8, 0.92)',
                backdropFilter: 'blur(10px)',
                border: '1.5px solid var(--color-gold, #c5a059)',
                borderRadius: 12,
                padding: '12px 24px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
              }}
            >
              <div style={{ fontSize: '0.85rem', color: 'var(--color-gold, #c5a059)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                🥋 Стойка Йой (Готовность)
              </div>
              <div style={{ fontSize: '0.84rem', color: '#fff', marginBottom: 10 }}>
                Мастер готов. Нажмите для перехода к изучению шагов формы:
              </div>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setHasStarted(true);
                  setIsPlaying(true);
                }}
                style={{
                  padding: '8px 24px',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #c5a059, #dfba73)',
                  color: '#1a140b',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(197, 160, 89, 0.4)',
                }}
              >
                ▶ Начать изучение шагов
              </button>
            </div>
          </div>
        )}

        {/* Компактный информационный оверлей */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            right: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <div
            style={{
              background: 'rgba(12, 10, 8, 0.88)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(197, 160, 89, 0.35)',
              borderRadius: 8,
              padding: '6px 14px',
              pointerEvents: 'auto',
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-gold, #c5a059)', fontWeight: 700 }}>
                {kataTitle}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>•</span>
              <span style={{ fontSize: '0.76rem', color: !hasStarted ? 'var(--color-gold, #c5a059)' : (playbackMode === 'full' ? '#68d391' : 'var(--color-washi, #f4efe6)'), fontWeight: 600 }}>
                {!hasStarted
                  ? '🥋 Стойка Йой (Готовность)'
                  : (playbackMode === 'full'
                      ? `⚡ Мастер-прогон (${currentTime.toFixed(1)}с / ${totalDuration.toFixed(1)}с)`
                      : `Шаг ${currentIdx + 1} из ${totalStepsCount}`)}
              </span>
              {isCurrentKiai && hasStarted && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    background: '#b91c1c',
                    color: '#fff',
                    padding: '2px 7px',
                    borderRadius: 8,
                    fontWeight: 800,
                    letterSpacing: '0.05em',
                  }}
                >
                  КИАЙ!
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--color-gold, #c5a059)', marginTop: 2, fontWeight: 600 }}>
              {!hasStarted ? 'Стойка Йой (Сидзэнтай) — готовность к началу' : (currentStep.Technique || 'Каноническая техника')}
            </div>
          </div>

          {/* Быстрые кнопки камеры */}
          <div
            style={{
              display: 'flex',
              gap: 6,
              pointerEvents: 'auto',
            }}
          >
            <button
              onClick={() => setCameraFollow(!cameraFollow)}
              style={{
                background: 'rgba(12, 10, 8, 0.88)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 6,
                padding: '6px 10px',
                color: cameraFollow ? '#68d391' : 'var(--color-text-muted, #a0a0a0)',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="Переключить слежение камеры за мастером"
            >
              {cameraFollow ? '🎥 Слежение' : '🎥 Статика'}
            </button>
            <button
              onClick={resetCamera}
              style={{
                background: 'rgba(12, 10, 8, 0.88)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 6,
                padding: '6px 10px',
                color: 'var(--color-washi, #fff)',
                fontSize: '0.74rem',
                cursor: 'pointer',
              }}
              title="Сбросить ракурс камеры"
            >
              Сброс
            </button>
          </div>
        </div>

        {/* Индикатор предупреждений */}
        {warningMessage && (
          <div
            style={{
              position: 'absolute',
              bottom: 16,
              left: 14,
              right: 14,
              background: 'rgba(217, 119, 6, 0.94)',
              color: '#fff',
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: '0.8rem',
              maxWidth: 600,
              boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
              zIndex: 10,
            }}
          >
            <strong>⚠️ Зафиксировано требование:</strong> {warningMessage}
          </div>
        )}
      </div>

      {/* Панель управления 3D-воспроизведением */}
      <div style={{ background: 'var(--color-surface, #141416)', padding: '12px 16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Режимы: Пошагово / Всё ката */}
          <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.3)', padding: 3, borderRadius: 6 }}>
            <button
              className="btn"
              onClick={() => {
                setPlaybackMode('steps');
                setHasStarted(true);
                setIsPlaying(true);
              }}
              style={{
                padding: '5px 12px',
                fontSize: '0.8rem',
                border: playbackMode === 'steps' ? '1px solid var(--color-gold, #c5a059)' : 'none',
                background: playbackMode === 'steps' ? 'rgba(197, 160, 89, 0.2)' : 'transparent',
                color: playbackMode === 'steps' ? 'var(--color-gold, #c5a059)' : 'var(--color-text-muted, #a0a0a0)',
                fontWeight: playbackMode === 'steps' ? 700 : 500,
              }}
            >
              🥋 Пошагово
            </button>
            <button
              className="btn"
              onClick={() => {
                setPlaybackMode('full');
                setHasStarted(true);
                setIsPlaying(true);
              }}
              style={{
                padding: '5px 12px',
                fontSize: '0.8rem',
                border: playbackMode === 'full' ? '1px solid #68d391' : 'none',
                background: playbackMode === 'full' ? 'rgba(104, 211, 145, 0.2)' : 'transparent',
                color: playbackMode === 'full' ? '#68d391' : 'var(--color-text-muted, #a0a0a0)',
                fontWeight: playbackMode === 'full' ? 700 : 500,
              }}
            >
              ⚡ Всё ката (как на aimokap)
            </button>
          </div>

          {/* Кнопки воспроизведения, паузы и повтора */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn btn-primary"
              style={{ minWidth: 140, padding: '6px 14px', fontSize: '0.85rem' }}
              onClick={() => {
                if (!hasStarted) {
                  setHasStarted(true);
                  setIsPlaying(true);
                } else {
                  setIsPlaying(!isPlaying);
                }
              }}
            >
              {!hasStarted ? '▶ Начать изучение' : (isPlaying ? '⏸ Пауза' : '▶ Воспроизвести')}
            </button>
            <button
              className="btn"
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              onClick={() => {
                setHasStarted(true);
                setIsPlaying(true);
                setReplayTrigger((prev) => prev + 1);
              }}
              title="Повторить текущее движение с начала"
            >
              🔄 С начала
            </button>
            {hasStarted && (
              <button
                className="btn"
                style={{ padding: '6px 12px', fontSize: '0.85rem', color: 'var(--color-gold, #c5a059)' }}
                onClick={() => {
                  setHasStarted(false);
                  setIsPlaying(false);
                  setCurrentIdx(0);
                  if (onStepChange) onStepChange(0);
                }}
                title="Вернуться в исходную стойку Йой"
              >
                🥋 В стойку Йой
              </button>
            )}
            {playbackMode === 'steps' && (
              <button
                className="btn"
                style={{
                  padding: '6px 12px',
                  fontSize: '0.85rem',
                  border: isLooping ? '1px solid var(--color-gold, #c5a059)' : undefined,
                  color: isLooping ? 'var(--color-gold, #c5a059)' : 'var(--color-text-muted, #a0a0a0)',
                }}
                onClick={() => setIsLooping(!isLooping)}
                title={isLooping ? 'Зацикливание включено' : 'Автопереход к следующему шагу включен'}
              >
                {isLooping ? '🔁 Зациклить' : '▶ Автопереход'}
              </button>
            )}
          </div>

          {/* Селектор скорости (Slow-Mo) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted, #a0a0a0)', marginRight: 2 }}>Скорость:</span>
            {[0.5, 1.0, 1.5].map((s) => (
              <button
                key={s}
                className="btn"
                style={{
                  padding: '4px 8px',
                  fontSize: '0.76rem',
                  borderColor: speed === s ? 'var(--color-gold, #c5a059)' : undefined,
                  background: speed === s ? 'rgba(197, 160, 89, 0.2)' : undefined,
                }}
                onClick={() => setSpeed(s)}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Слайдер таймлайна в режиме полного ката */}
        {playbackMode === 'full' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted, #a0a0a0)', minWidth: 40 }}>
              {currentTime.toFixed(1)}с
            </span>
            <input
              type="range"
              min="0"
              max={totalDuration}
              step="0.05"
              value={currentTime}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setCurrentTime(val);
                setScrubProgress(val / totalDuration);
              }}
              style={{ flex: 1, accentColor: 'var(--color-gold, #c5a059)', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted, #a0a0a0)', minWidth: 40 }}>
              {totalDuration.toFixed(1)}с
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

