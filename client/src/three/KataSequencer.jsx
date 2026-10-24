import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
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

import {
  ALL_KATA_SLUGS,
  resolveKataSlug,
  CANONICAL_EMBUSEN,
  HEIAN_SHODAN_CANONICAL_EVENTS,
  normalizeAngleDeg,
  parseStepOrientation,
  computeTrajectory,
} from './kataMotionUtils';

import {
  compileKataScenario,
  resolveComposedClip,
  TECHNIQUE_REGISTRY,
} from './kataCompositionEngine';

export {
  ALL_KATA_SLUGS,
  resolveKataSlug,
  CANONICAL_EMBUSEN,
  HEIAN_SHODAN_CANONICAL_EVENTS,
  normalizeAngleDeg,
  parseStepOrientation,
  computeTrajectory,
  compileKataScenario,
  resolveComposedClip,
  TECHNIQUE_REGISTRY,
};

/**
 * Интерактивная 3D-траектория эмбусэна на татами:
 * - Золотая каноническая линия между точками шагов
 * - Маркеры шагов с подсветкой текущего положения и точек КИАЙ
 * - Поддержка клика по маркеру для перехода к нужному шагу
 */
function EmbusenTrajectory({ points = [], currentIdx = 0, onSelectStep = null, events = [] }) {
  const linePoints = useMemo(() => {
    if (!points || points.length === 0) return [];
    return points.map((p) => new THREE.Vector3(p[0], 0.02, p[2]));
  }, [points]);

  const lineGeometry = useMemo(() => {
    if (linePoints.length < 2) return null;
    return new THREE.BufferGeometry().setFromPoints(linePoints);
  }, [linePoints]);

  return (
    <group>
      {lineGeometry && (
        <line geometry={lineGeometry}>
          <lineBasicMaterial color="#c5a059" opacity={0.65} transparent linewidth={2} />
        </line>
      )}
      {points.map((p, idx) => {
        const isCurrent = idx === currentIdx;
        const isKiai = Boolean(events[idx]?.kiai);
        const markerColor = isCurrent ? '#ffd700' : (isKiai ? '#ef4444' : '#c5a059');
        const markerRadius = isCurrent ? 0.08 : 0.045;

        return (
          <mesh
            key={idx}
            position={[p[0], 0.025, p[2]]}
            rotation={[-Math.PI / 2, 0, 0]}
            onClick={(e) => {
              e.stopPropagation();
              if (onSelectStep) onSelectStep(idx);
            }}
          >
            <circleGeometry args={[markerRadius, 16]} />
            <meshBasicMaterial color={markerColor} opacity={isCurrent ? 0.95 : 0.6} transparent />
          </mesh>
        );
      })}
    </group>
  );
}

/**
 * Плавный кинематографический риг камеры с физическими границами Додзё:
 * - Исключает рывки, резкие скачки и непроизвольные сбросы ракурса.
 * - Ограничивает перемещение камеры (clamping): камера НЕ может вылететь за пределы додзё
 *   ни при автоматическом следовании, ни при ручном вращении/панорамировании (Задача 11).
 */
const DOJO_LIMITS = {
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

function SmoothCameraRig({ targetPosition, avatarRealPosRef, isFullMode, follow, hasStarted, controlsRef }) {
  useFrame((state, delta) => {
    if (!controlsRef.current) return;
    const controls = controlsRef.current;

    if (hasStarted && follow) {
      const currentPos = (isFullMode && avatarRealPosRef?.current)
        ? avatarRealPosRef.current
        : targetPosition;

      if (currentPos) {
        const tx = currentPos[0];
        const tz = currentPos[2];
        const ty = 0.95;

        const factor = 1.0 - Math.exp(-3.5 * Math.min(delta, 0.1));
        const dx = (tx - controls.target.x) * factor;
        const dy = (ty - controls.target.y) * factor;
        const dz = (tz - controls.target.z) * factor;

        controls.target.x += dx;
        controls.target.y += dy;
        controls.target.z += dz;

        state.camera.position.x += dx;
        state.camera.position.y += dy;
        state.camera.position.z += dz;
      }
    }

    // Задача 11: жестко ограничиваем координаты камеры и фокуса в пределах стен и потолка Додзё
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, DOJO_LIMITS.targetMinX, DOJO_LIMITS.targetMaxX);
    controls.target.y = THREE.MathUtils.clamp(controls.target.y, DOJO_LIMITS.targetMinY, DOJO_LIMITS.targetMaxY);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, DOJO_LIMITS.targetMinZ, DOJO_LIMITS.targetMaxZ);

    state.camera.position.x = THREE.MathUtils.clamp(state.camera.position.x, DOJO_LIMITS.minX, DOJO_LIMITS.maxX);
    state.camera.position.y = THREE.MathUtils.clamp(state.camera.position.y, DOJO_LIMITS.minY, DOJO_LIMITS.maxY);
    state.camera.position.z = THREE.MathUtils.clamp(state.camera.position.z, DOJO_LIMITS.minZ, DOJO_LIMITS.maxZ);

    controls.update();
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
  const kataSlug = useMemo(() => resolveKataSlug(kataTitle), [kataTitle]);
  const [executionMethod, setExecutionMethod] = useState('composed'); // 'composed' | 'mocap'
  const [kataJsonData, setKataJsonData] = useState(null);
  const [replayTrigger, setReplayTrigger] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(29.48);
  const [scrubProgress, setScrubProgress] = useState(null);

  const controlsRef = useRef();
  const avatarRealPosRef = useRef([0, 0, 0]);

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

  // Синхронизация внешнего индекса шага: немедленный перезапуск одиночного действия
  useEffect(() => {
    if (activeStepIndex !== undefined && activeStepIndex !== currentIdx) {
      setCurrentIdx(activeStepIndex);
      setHasStarted(true);
      setIsPlaying(true);
      setReplayTrigger((prev) => prev + 1);
    }
  }, [activeStepIndex]);

  const rawJsonSteps = kataJsonData?.steps || kataJsonData?.events || [];

  // Единая компиляция сценария ката через kataCompositionEngine
  const composedScenario = useMemo(() => {
    const rawSteps = (steps && steps.length > 0) ? steps : rawJsonSteps;
    return compileKataScenario(rawSteps, kataSlug);
  }, [steps, rawJsonSteps, kataSlug]);

  const composedSteps = composedScenario.steps;
  const embusenPoints = composedScenario.embusenPoints;
  const totalStepsCount = composedSteps.length || 21;
  const currentStep = composedSteps[currentIdx] || {};
  const currentPosData = currentStep.position
    ? { position: currentStep.position, rotation: currentStep.rotation }
    : { position: [0, 0, 0], rotation: [0, 0, 0] };

  // Временной диапазон текущего шага в MoCap-анимации Heian Shodan
  const kataTimeRange = useMemo(() => {
    if (playbackMode === 'full') return null;
    const sTime = currentStep.mocapStartTime !== undefined ? currentStep.mocapStartTime : currentStep.startTime;
    const eTime = currentStep.mocapEndTime !== undefined ? currentStep.mocapEndTime : currentStep.endTime;
    if (sTime !== undefined && eTime !== undefined) {
      return [sTime, eTime];
    }
    return null;
  }, [playbackMode, currentStep]);

  // Длительность текущего шага в секундах
  const stepDurationSec = useMemo(() => {
    if (currentStep.duration !== undefined) {
      return Number(currentStep.duration).toFixed(2);
    }
    return (currentStep.Duration || 2.0).toFixed(2);
  }, [currentStep]);

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
    setReplayTrigger((prev) => prev + 1);
    if (onStepChange) onStepChange(idx);
  }, [onStepChange]);

  const handleStepEnd = useCallback(() => {
    if (playbackMode === 'steps') {
      if (!isLooping) {
        if (currentIdx < totalStepsCount - 1) {
          // Выдерживаем паузу Дзансин (фиксация техники перед следующим шагом)
          setTimeout(() => {
            selectStep(currentIdx + 1);
          }, 300);
        } else {
          setIsPlaying(false);
        }
      }
    } else if (playbackMode === 'full') {
      setIsPlaying(false);
      setCurrentTime(totalDuration);
    }
  }, [playbackMode, isLooping, currentIdx, totalStepsCount, selectStep, totalDuration]);

  // Синхронизация времени в реальном времени при полном мастер-прогоне
  const handleTimeUpdate = useCallback((time, dur, rootPos) => {
    setCurrentTime(time);
    if (dur > 0 && playbackMode === 'full') setTotalDuration(dur);
    if (rootPos) {
      avatarRealPosRef.current = rootPos;
    }

    if (playbackMode === 'full') {
      const activeEvents = composedSteps;
      const evIdx = activeEvents.findIndex((ev) => {
        const sTime = ev.mocapStartTime !== undefined ? ev.mocapStartTime : ev.startTime;
        const eTime = ev.mocapEndTime !== undefined ? ev.mocapEndTime : ev.endTime;
        return time >= sTime && time <= eTime;
      });
      if (evIdx !== -1 && evIdx !== currentIdx) {
        setCurrentIdx(evIdx);
        if (onStepChange) onStepChange(evIdx);
      }
    }
  }, [playbackMode, composedSteps, currentIdx, onStepChange]);

  function resetCamera() {
    if (controlsRef.current) {
      controlsRef.current.reset();
      const pos = currentPosData.position || [0, 0, 0];
      controlsRef.current.target.set(pos[0], 0.95, pos[2]);
      controlsRef.current.update();
    }
  }

  const isCurrentKiai = Boolean(currentStep.kiai);

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

          {/* Аватар мастера Шотокан: в стойке Йой до старта (Задача 9), далее клиповая композиция/MoCap */}
          <KaratekaLowpolyModel
            role="tori"
            kataMode={hasStarted}
            stance={!hasStarted ? 'ready' : (currentStep.stance || 'ready')}
            stepClip={!hasStarted ? null : (playbackMode === 'full' ? null : (executionMethod === 'composed' ? currentStep.clipName : null))}
            blendDuration={currentStep.blendDuration || 0.14}
            kataExecutionMode={playbackMode === 'full' ? 'full' : executionMethod}
            kataClipName={kataSlug}
            kataTimeRange={playbackMode === 'steps' && executionMethod === 'mocap' ? kataTimeRange : null}
            kataScrubProgress={scrubProgress}
            speed={speed}
            isPlaying={hasStarted && isPlaying}
            isLooping={playbackMode === 'steps' ? isLooping : false}
            replayTrigger={replayTrigger}
            currentStep={currentStep}
            prevStep={composedSteps[currentIdx - 1] || null}
            position={!hasStarted ? [0, 0, 0] : (playbackMode === 'full' ? [0, 0, 0] : (executionMethod === 'composed' ? currentPosData.position : [0, 0, 0]))}
            rotation={!hasStarted ? [0, 0, 0] : (playbackMode === 'full' ? [0, 0, 0] : (executionMethod === 'composed' ? currentPosData.rotation : [0, 0, 0]))}
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
            avatarRealPosRef={avatarRealPosRef}
            isFullMode={playbackMode === 'full'}
            follow={cameraFollow}
            hasStarted={hasStarted}
            controlsRef={controlsRef}
          />

          <OrbitControls
            ref={controlsRef}
            minDistance={1.2}
            maxDistance={6.4}
            maxPolarAngle={Math.PI / 2 - 0.06}
            minPolarAngle={0.12}
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
              {!hasStarted
                ? 'Стойка Йой (Сидзэнтай) — готовность к началу'
                : `${currentStep.technique || currentStep.title || 'Каноническая техника'} • Стойка: ${currentStep.stance || 'zenkutsu'} • ${currentStep.facingDeg}°`}
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
                setScrubProgress(null);
                setReplayTrigger((prev) => prev + 1);
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
                setCurrentTime(0);
                setScrubProgress(0);
                setReplayTrigger((prev) => prev + 1);
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
              ⚡ Всё ката
            </button>
          </div>

          {/* Метод воспроизведения: Клипы v4 (Композиция) vs MoCap мастер */}
          <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.3)', padding: 3, borderRadius: 6 }}>
            <button
              className="btn"
              onClick={() => setExecutionMethod('composed')}
              style={{
                padding: '5px 10px',
                fontSize: '0.78rem',
                border: executionMethod === 'composed' ? '1px solid var(--color-gold, #c5a059)' : 'none',
                background: executionMethod === 'composed' ? 'rgba(197, 160, 89, 0.2)' : 'transparent',
                color: executionMethod === 'composed' ? 'var(--color-gold, #c5a059)' : 'var(--color-text-muted, #a0a0a0)',
                fontWeight: executionMethod === 'composed' ? 700 : 500,
              }}
              title="Собрать ката из библиотеки 213 переиспользуемых клипов техник и стоек Шотокан"
            >
              🥋 Клипы v4
            </button>
            {kataSlug === 'heian_shodan' && (
              <button
                className="btn"
                onClick={() => setExecutionMethod('mocap')}
                style={{
                  padding: '5px 10px',
                  fontSize: '0.78rem',
                  border: executionMethod === 'mocap' ? '1px solid #68d391' : 'none',
                  background: executionMethod === 'mocap' ? 'rgba(104, 211, 145, 0.2)' : 'transparent',
                  color: executionMethod === 'mocap' ? '#68d391' : 'var(--color-text-muted, #a0a0a0)',
                  fontWeight: executionMethod === 'mocap' ? 700 : 500,
                }}
                title="Монолитная MoCap запись ката"
              >
                ⚡ MoCap
              </button>
            )}
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
            {/* Кнопка "В стойку Йой" (Задача 12) — стабильно присутствует, исключая скачки верстки (Задача 13) */}
            <button
              type="button"
              className="btn"
              style={{
                padding: '6px 12px',
                fontSize: '0.85rem',
                color: hasStarted ? '#c5a059' : 'rgba(197, 160, 89, 0.4)',
                borderColor: hasStarted ? 'rgba(197, 160, 89, 0.4)' : 'rgba(255, 255, 255, 0.1)',
                opacity: hasStarted ? 1 : 0.45,
                pointerEvents: hasStarted ? 'auto' : 'none',
              }}
              onClick={() => {
                setHasStarted(false);
                setIsPlaying(false);
                setCurrentIdx(0);
                setScrubProgress(null);
                setCurrentTime(0);
                if (onStepChange) onStepChange(0);
                if (controlsRef.current) {
                  controlsRef.current.target.set(0, 0.95, 0);
                  controlsRef.current.update();
                }
              }}
              title="Вернуться в исходную стойку Йой"
            >
              🥋 В стойку Йой
            </button>
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

          {/* Селектор скорости (Slow-Mo) — Задача 10: четкий контрастный дизайн, без "черного на черном" */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.8rem', color: '#cbd5e1', marginRight: 2, fontWeight: 600 }}>Скорость:</span>
            {[0.5, 1.0, 1.5].map((s) => {
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
                    border: isActive ? '1px solid #ffd700' : '1px solid rgba(255, 255, 255, 0.2)',
                    background: isActive ? '#c5a059' : 'rgba(255, 255, 255, 0.08)',
                    color: isActive ? '#14110b' : '#f1f5f9',
                    boxShadow: isActive ? '0 0 10px rgba(197, 160, 89, 0.5)' : 'none',
                  }}
                  onClick={() => setSpeed(s)}
                >
                  {s}x
                </button>
              );
            })}
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

