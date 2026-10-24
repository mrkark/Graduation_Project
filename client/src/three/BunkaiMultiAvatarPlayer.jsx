import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import MultiAvatarModel from './MultiAvatarModel';
import TraditionalDojo from './TraditionalDojo';
import {
  CANONICAL_BUNKAI_EPISODES,
  normalizeBunkaiEpisode,
  computeAvatarPlacement,
  evaluateTimelineState,
  chainBunkaiEpisodes,
  resolveBunkaiClip,
} from './bunkaiScenarioEngine';
import { animationRegistry } from './animationRegistry';

// Задача 21: Физические границы Додзё в симуляции бункай
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

/**
 * Универсальный плеер боевого применения (Бункай) Шотокан с поддержкой 2 и 3 аватаров.
 * Обеспечивает:
 * - Воспроизведение структурированных шагов Бункая из БД / конструктора / канонических сценариев.
 * - Интерактивную настройку боевой дистанции (Ма-ай) и угла атаки противника.
 * - Анти-проникновение тел (капсульные коллизии min 0.54м).
 * - Доводку рук через 2-Bone IK в окне боевого контакта.
 * - Мастер-шкалу времени (timelineTime) с задержками (delaySeconds) и плавным скраббингом.
 * - Поддержку командного бункая (3 участника) с разворотом Тори ко второму нападающему.
 * - Сохранение состояния (позиций и углов) между последовательными эпизодами.
 * - Детектирование отсутствующих анимаций и предупреждающие баннеры (без скрытых подмен).
 */

export default function BunkaiMultiAvatarPlayer({
  steps = null, // Шаги из API getBunkaiSteps() или формы
  defaultParticipantMode = '2-person', // '2-person' | '3-person'
  height = 540,
  onStepChange = null,
}) {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [showUke2, setShowUke2] = useState(defaultParticipantMode === '3-person');
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1.0);
  const [timelineTime, setTimelineTime] = useState(0); // Мастер-время в секундах

  // Режим сохранения состояния: 'continuous' (непрерывный бой) | 'standalone' (центрированный шаг)
  const [stateMode, setStateMode] = useState('continuous');

  // Пользовательские настройки геометрии боя
  const [distanceOffset, setDistanceOffset] = useState(0); // смещение относительно оптимальной дистанции (-0.7м .. +1.2м)
  const [angleOffsetDeg, setAngleOffsetDeg] = useState(0); // дополнительное смещение угла (-60° .. +60°)

  // Оповещения об отсутствующих клипах
  const [missingClips, setMissingClips] = useState([]);

  // Трекинг костей для аналитического IK
  const trackedBonesRef = useRef({ tori: null, uke1: null, uke2: null });
  const [ikTargets, setIkTargets] = useState({ toriTarget: null, ukeTarget: null });

  const controlsRef = useRef();

  // Нормализуем переданные шаги (из API или канонические по умолчанию)
  const baseEpisodes = useMemo(() => {
    if (Array.isArray(steps) && steps.length > 0) {
      return steps.map((s, idx) => normalizeBunkaiEpisode(s, idx));
    }
    return CANONICAL_BUNKAI_EPISODES.map((s, idx) => normalizeBunkaiEpisode(s, idx));
  }, [steps]);

  // Вычисляем цепочку эпизодов с непрерывным сохранением позиций
  const chainedEpisodes = useMemo(() => {
    return chainBunkaiEpisodes(baseEpisodes, stateMode);
  }, [baseEpisodes, stateMode]);

  const currentEpisode = chainedEpisodes[currentStepIdx] || chainedEpisodes[0];

  // Синхронизатор мастер-шкалы времени для текущего эпизода
  const timelineState = useMemo(() => {
    return evaluateTimelineState({
      episode: currentEpisode,
      timelineTime,
      speed,
    });
  }, [currentEpisode, timelineTime, speed]);

  const totalDuration = timelineState.totalDuration;

  // Таймер непрерывного воспроизведения мастер-шкалы
  useEffect(() => {
    if (!isPlaying) return;
    let lastTime = performance.now();
    let animId;

    const tick = (now) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      setTimelineTime((prev) => {
        const next = prev + dt * speed;
        if (next >= totalDuration) {
          return 0; // Плавное зацикливание
        }
        return next;
      });

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, speed, totalDuration]);

  // Сброс таймера при смене эпизода
  useEffect(() => {
    setTimelineTime(0);
  }, [currentStepIdx]);

  // Расчет взаимного пространственного расположения и ориентации участников
  const placement = useMemo(() => {
    return computeAvatarPlacement({
      episode: currentEpisode,
      distanceOffset,
      angleOffsetDeg,
      showUke2,
      baseToriPos: currentEpisode.toriStartPos || [0, 0, 0],
      targetRole: timelineState.currentTargetRole,
    });
  }, [currentEpisode, distanceOffset, angleOffsetDeg, showUke2, timelineState.currentTargetRole]);

  // Динамический угол поворота Тори с плавной интерполяцией при развороте ко второму противнику
  const toriRotation = useMemo(() => {
    if (timelineState.isTurningToUke2) {
      const p = timelineState.turnProgress;
      const yawUke1 = placement.angles.toriYaw; // направление на первого
      const dirUke2 = Math.atan2(placement.posUke2[0] - placement.posTori[0], placement.posUke2[2] - placement.posTori[2]);
      const interpolatedYaw = THREE.MathUtils.lerp(yawUke1, dirUke2, p);
      return [0, interpolatedYaw, 0];
    }
    return placement.rotTori;
  }, [timelineState.isTurningToUke2, timelineState.turnProgress, placement]);

  // Проверка переходов и валидация клипов в реестре
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

  // Трекинг костей для аналитического IK
  const handleTrackBones = useCallback((role, data) => {
    trackedBonesRef.current[role] = data;
    if (role === 'uke1' && data.chest) {
      setIkTargets((prev) => ({ ...prev, toriTarget: data.chest.clone() }));
    }
    if (role === 'tori' && data.chest) {
      setIkTargets((prev) => ({ ...prev, ukeTarget: data.chest.clone() }));
    }
  }, []);

  function handlePrevStep() {
    setCurrentStepIdx((prev) => {
      const next = Math.max(0, prev - 1);
      if (onStepChange) onStepChange(next);
      return next;
    });
  }

  function handleNextStep() {
    setCurrentStepIdx((prev) => {
      const next = Math.min(chainedEpisodes.length - 1, prev + 1);
      if (onStepChange) onStepChange(next);
      return next;
    });
  }

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
          camera={{ position: [placement.posTori[0] + 2.8, 1.9, placement.posTori[2] + 3.4], fov: 42 }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
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
          <directionalLight position={[-4, 3, -3]} intensity={0.4} color="#90cdf4" />

          {/* Традиционное японское додзё с разметкой татами */}
          <TraditionalDojo />

          {/* Аватар Тори (белое доги мастера) */}
          <MultiAvatarModel
            role="tori"
            clipName={timelineState.toriState.activeClip}
            stance={toriPart.stance || 'kokutsu'}
            position={placement.posTori}
            rotation={toriRotation}
            speed={speed}
            isPlaying={isPlaying}
            timelineTime={timelineTime}
            delaySeconds={toriPart.delaySeconds || 0}
            ikTarget={ikTargets.toriTarget}
            ikContactTime={currentEpisode.tContact}
            interactionType={currentEpisode.interactionType}
            onMissingClip={handleMissingClipDetected}
            onTrackBones={handleTrackBones}
          />

          {/* Аватар Укэ 1 (главный нападающий, доги цвета индиго) */}
          <MultiAvatarModel
            role="uke1"
            clipName={timelineState.uke1State.activeClip}
            stance={uke1Part.stance || 'zenkutsu'}
            position={placement.posUke1}
            rotation={placement.rotUke1}
            speed={speed}
            isPlaying={isPlaying}
            timelineTime={timelineTime}
            delaySeconds={uke1Part.delaySeconds || 0}
            ikTarget={ikTargets.ukeTarget}
            ikContactTime={currentEpisode.tContact}
            interactionType={currentEpisode.interactionType}
            onMissingClip={handleMissingClipDetected}
            onTrackBones={handleTrackBones}
          />

          {/* Аватар Укэ 2 (фланговый нападающий, графитовое доги) */}
          {showUke2 && (
            <MultiAvatarModel
              role="uke2"
              clipName={timelineState.uke2State.activeClip}
              stance={uke2Part.stance || 'ready'}
              position={placement.posUke2}
              rotation={placement.rotUke2}
              speed={speed}
              isPlaying={isPlaying}
              timelineTime={timelineTime}
              delaySeconds={uke2Part.delaySeconds || 1.35}
              interactionType={timelineState.currentTargetRole === 'uke2' ? 'local_contact' : 'non_contact'}
              onMissingClip={handleMissingClipDetected}
              onTrackBones={handleTrackBones}
            />
          )}

          <ContactShadows position={[0, 0, 0]} opacity={0.65} scale={10} blur={1.5} far={4} />

          {/* Задача 21: Предотвращение вылета камеры за пределы Додзё */}
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

        {/* Верхний инфо-оверлей боевого эпизода */}
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            right: 14,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <div
            style={{
              background: 'rgba(12, 9, 7, 0.90)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(197, 155, 39, 0.45)',
              borderRadius: 8,
              padding: '10px 16px',
              maxWidth: '520px',
              pointerEvents: 'auto',
            }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-gold)', fontWeight: 700 }}>
                Шотокан Бункай · Эпизод {currentEpisode.stepNumber} из {chainedEpisodes.length}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>•</span>
              <span style={{ fontSize: '0.75rem', color: showUke2 ? '#68d391' : '#63b3ed', fontWeight: 600 }}>
                {showUke2 ? '🏆 Командный бункай (3 бойца)' : '🥋 Парный бункай (Дуэль)'}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>•</span>
              <span style={{ fontSize: '0.72rem', color: stateMode === 'continuous' ? '#f6ad55' : 'var(--color-text-muted)' }}>
                {stateMode === 'continuous' ? '📍 Непрерывный бой' : '🎯 Центрирован'}
              </span>
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-washi)' }}>
              {currentEpisode.title}
            </div>
            {currentEpisode.description && (
              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginTop: 4, lineHeight: 1.35 }}>
                {currentEpisode.description}
              </div>
            )}
          </div>

          {/* Легенда ролей участников с индикатором активного нападающего */}
          <div
            style={{
              background: 'rgba(12, 9, 7, 0.90)',
              backdropFilter: 'blur(8px)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              padding: '8px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              fontSize: '0.78rem',
              pointerEvents: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#fbf8f2', border: '1px solid #999' }}></span>
              <span style={{ color: '#fff', fontWeight: 600 }}>Тори</span>
              <span style={{ color: 'var(--color-text-muted)' }}>({timelineState.toriState.activeClip})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: '#243346',
                  border: timelineState.currentTargetRole === 'uke1' ? '2px solid #63b3ed' : '1px solid #4a5568',
                  boxShadow: timelineState.currentTargetRole === 'uke1' ? '0 0 6px #63b3ed' : 'none',
                }}
              ></span>
              <span style={{ color: '#90cdf4', fontWeight: 600 }}>Укэ 1</span>
              <span style={{ color: 'var(--color-text-muted)' }}>({timelineState.uke1State.activeClip})</span>
              {timelineState.currentTargetRole === 'uke1' && (
                <span style={{ fontSize: '0.65rem', background: 'rgba(99,179,237,0.2)', color: '#63b3ed', padding: '1px 4px', borderRadius: 3 }}>Цель</span>
              )}
            </div>
            {showUke2 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: '#342b2b',
                    border: timelineState.currentTargetRole === 'uke2' ? '2px solid #e53e3e' : '1px solid #742a2a',
                    boxShadow: timelineState.currentTargetRole === 'uke2' ? '0 0 6px #e53e3e' : 'none',
                  }}
                ></span>
                <span style={{ color: '#feb2b2', fontWeight: 600 }}>Укэ 2</span>
                <span style={{ color: 'var(--color-text-muted)' }}>({timelineState.uke2State.activeClip})</span>
                {timelineState.currentTargetRole === 'uke2' && (
                  <span style={{ fontSize: '0.65rem', background: 'rgba(229,62,62,0.2)', color: '#feb2b2', padding: '1px 4px', borderRadius: 3 }}>Цель</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Предупреждение о коллизии и капсульном анти-проникновении */}
        {placement.hasCollision && (
          <div
            style={{
              position: 'absolute',
              bottom: 16,
              left: 14,
              background: 'rgba(185, 28, 28, 0.90)',
              color: '#fff',
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: '0.78rem',
              fontWeight: 600,
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              zIndex: 10,
            }}
          >
            🛡️ Анти-проникновение: дистанция ограничена защитной капсулой торса (0.54м)
          </div>
        )}

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
            <strong>⚠️ Зафиксировано отсутствие клипов:</strong> {missingClips.join(', ')}.
            <div style={{ fontSize: '0.72rem', marginTop: 3, opacity: 0.9 }}>
              Потребность зарегистрирована в базе данных для генерации анимационным агентом.
            </div>
          </div>
        )}
      </div>

      {/* Панель интерактивного управления боевым взаимодействием */}
      <div style={{ background: 'var(--color-surface)', padding: '16px 20px', borderTop: '1px solid var(--color-border)' }}>
        {/* Верхняя строка: навигация по шагам, режим участников, непрерывность и плеер */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          {/* Переключение шагов */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn"
              disabled={currentStepIdx === 0}
              onClick={handlePrevStep}
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            >
              ◀ Предыдущий
            </button>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-gold)', minWidth: 90, textAlign: 'center' }}>
              {currentStepIdx + 1} / {chainedEpisodes.length}
            </span>
            <button
              className="btn"
              disabled={currentStepIdx === chainedEpisodes.length - 1}
              onClick={handleNextStep}
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            >
              Следующий ▶
            </button>
          </div>

          {/* Кнопки плеера и переключения формата */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              style={{ minWidth: 120 }}
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? '⏸ Пауза' : '▶ Воспроизведение'}
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
                borderColor: stateMode === 'continuous' ? 'var(--color-gold)' : undefined,
                background: stateMode === 'continuous' ? 'rgba(197, 155, 39, 0.15)' : undefined,
              }}
              onClick={() => setStateMode(stateMode === 'continuous' ? 'standalone' : 'continuous')}
            >
              {stateMode === 'continuous' ? '📍 Непрерывный бой' : '🎯 Изолированный шаг'}
            </button>
            <button className="btn btn-gold" onClick={resetCamera}>
              Сброс камеры
            </button>
          </div>

          {/* Скорость воспроизведения — Задача 20: четкий контрастный дизайн, без "черного на черном" */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600 }}>Скорость:</span>
            {[0.25, 0.5, 1.0].map((s) => {
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

        {/* Средняя строка: Слайдеры управления боевой дистанцией (Ма-ай) и углом атаки */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
            background: 'rgba(0,0,0,0.25)',
            padding: '12px 16px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.06)',
            marginBottom: 14,
          }}
        >
          {/* Слайдер дистанции Ма-ай */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
              <span style={{ color: 'var(--color-gold)', fontWeight: 600 }}>
                📏 Боевая дистанция (Ма-ай):
              </span>
              <span style={{ color: '#fff', fontWeight: 700 }}>
                {placement.finalDist.toFixed(2)} м
              </span>
            </div>
            <input
              type="range"
              min="-0.70"
              max="1.20"
              step="0.05"
              value={distanceOffset}
              onChange={(e) => setDistanceOffset(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--color-gold)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
              <span>Ближний бой (0.75м)</span>
              <span>Оптимальная ({currentEpisode.optimalDistance.toFixed(2)}м)</span>
              <span>Дальняя (2.65м)</span>
            </div>
          </div>

          {/* Слайдер угла атаки */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
              <span style={{ color: 'var(--color-gold)', fontWeight: 600 }}>
                🧭 Угол атаки противника:
              </span>
              <span style={{ color: '#fff', fontWeight: 700 }}>
                {currentEpisode.attackAngleDeg + angleOffsetDeg}°
              </span>
            </div>
            <input
              type="range"
              min="-60"
              max="60"
              step="5"
              value={angleOffsetDeg}
              onChange={(e) => setAngleOffsetDeg(parseInt(e.target.value, 10))}
              style={{ width: '100%', accentColor: 'var(--color-gold)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
              <span>Фланг слева (-60°)</span>
              <span>Фронт (0°)</span>
              <span>Фланг справа (+60°)</span>
            </div>
          </div>
        </div>

        {/* Нижняя строка: мастер-скраббер времени и пошаговые фазы взаимодействия */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
              Мастер-шкала боевого времени ({timelineTime.toFixed(2)}с / {totalDuration.toFixed(2)}с):
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-gold)' }}>
              {timelineState.phase === 'kamae'
                ? '1. Камаэ (Исходная боевая стойка)'
                : timelineState.phase === 'contact'
                ? '2. Момент контакта (Атака / Блок / ИК)'
                : '3. Контратака и фиксация (Кимэ / Дзансин)'}
            </span>
          </div>

          {/* Плавный мастер-слайдер времени */}
          <div style={{ marginBottom: 10 }}>
            <input
              type="range"
              min="0"
              max={totalDuration}
              step="0.02"
              value={timelineTime}
              onChange={(e) => {
                setIsPlaying(false);
                setTimelineTime(parseFloat(e.target.value));
              }}
              style={{ width: '100%', accentColor: 'var(--color-gold)' }}
            />
          </div>

          {/* Кнопки быстрого перехода по ключевым фазам */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { label: '1. Исходная стойка (Камаэ)', time: 0.1 },
              { label: '2. Момент контакта (ИК-доводка)', time: uke1Part.delaySeconds + currentEpisode.tContact },
              { label: '3. Фиксация киме (Дзансин)', time: totalDuration * 0.9 },
            ].map((p, idx) => {
              const isActive = Math.abs(timelineTime - p.time) < 0.25;
              return (
                <button
                  key={idx}
                  onClick={() => {
                    setTimelineTime(p.time);
                    setIsPlaying(false);
                  }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 6,
                    textAlign: 'left',
                    cursor: 'pointer',
                    border: isActive ? '1px solid var(--color-gold)' : '1px solid var(--color-border)',
                    background: isActive ? 'rgba(197, 155, 39, 0.18)' : 'var(--color-bg)',
                    color: isActive ? 'var(--color-gold)' : 'var(--color-washi)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
