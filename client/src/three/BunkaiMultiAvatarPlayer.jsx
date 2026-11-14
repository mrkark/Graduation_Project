import { Trophy, Swords, MapPin, Target, Shield, AlertTriangle, Ruler, Compass, CheckCircle2, RotateCcw, Play, Pause } from 'lucide-react';
import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import MultiAvatarModel from './MultiAvatarModel';
import TraditionalDojo from './TraditionalDojo';
import {
  HEIAN_SHODAN_BUNKAI_18_STEPS,
  CANONICAL_BUNKAI_EPISODES,
  normalizeBunkaiEpisode,
  computeAvatarPlacement,
  chainBunkaiEpisodes,
  resolveBunkaiClip,
} from './bunkaiScenarioEngine';
import { resolveBodyInteractions } from './bodyColliderSystem';
import { animationRegistry } from './animationRegistry';

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
}) {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [showUke2, setShowUke2] = useState(defaultParticipantMode === '3-person');

  useEffect(() => {
    setShowUke2(defaultParticipantMode === '3-person');
  }, [defaultParticipantMode]);

  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1.0);
  const [stepCompleted, setStepCompleted] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const zanshinTimerRef = useRef(0);

  // Режим: 'continuous' (непрерывный боевой поток) | 'standalone' (центрированный изолированный шаг)
  const [stateMode, setStateMode] = useState('continuous');

  // Пользовательские настройки смещения дистанции и угла
  const [distanceOffset, setDistanceOffset] = useState(0);
  const [angleOffsetDeg, setAngleOffsetDeg] = useState(0);

  const [missingClips, setMissingClips] = useState([]);

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

  // Вычисляем цепочку эпизодов с непрерывным сохранением позиций
  const chainedEpisodes = useMemo(() => {
    return chainBunkaiEpisodes(baseEpisodes, stateMode);
  }, [baseEpisodes, stateMode]);

  const currentEpisode = chainedEpisodes[currentStepIdx] || chainedEpisodes[0];

  // Расчет взаимного пространственного расположения участников
  const placement = useMemo(() => {
    return computeAvatarPlacement({
      episode: currentEpisode,
      distanceOffset,
      angleOffsetDeg,
      showUke2,
      baseToriPos: currentEpisode.toriStartPos || [0, 0, -1.0],
      targetRole: 'uke1',
    });
  }, [currentEpisode, distanceOffset, angleOffsetDeg, showUke2]);

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
            minTorsoDistance: (currentEpisode.contactType === 'sweep_fall' || currentEpisode.isGround) ? 0.38 : 0.58,
          }
        );
        setBodyInteraction(inter);
      }
    }
  }, [currentEpisode]);

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

  function handleReplayStep() {
    phraseRef.current = 0;
    setStepCompleted(false);
    zanshinTimerRef.current = 0;
    setIsPlaying(true);
  }

  function handleTogglePlay() {
    if (!isPlaying && phraseRef.current >= 1.0) {
      phraseRef.current = 0;
      setStepCompleted(false);
      zanshinTimerRef.current = 0;
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
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

  const phraseRef = useRef(0);
  const rootsRef = useRef({ tori: placement.posTori, uke1: placement.posUke1 });

  useEffect(() => {
    phraseRef.current = 0;
    setStepCompleted(false);
    zanshinTimerRef.current = 0;
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
  }, [isPlaying, speed, currentStepIdx, currentEpisode, autoAdvance, chainedEpisodes.length, onStepChange]);

  // Описание дистанции (Ма-ай)
  const maaiInfo = useMemo(() => {
    const d = placement.finalDist;
    if (d < 1.0) {
      return { label: 'Чика-ма (近間)', desc: 'Ближний бой, захват, залом сустава / партер', color: '#f59e0b' };
    }
    if (d <= 1.85) {
      return { label: 'Иссоку-итто (一足一刀)', desc: 'Дистанция одного шага и удара (основная боевая)', color: '#10b981' };
    }
    return { label: 'То-ма (遠間)', desc: 'Дальняя дистанция маневрирования и поклона', color: '#63b3ed' };
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

          {/* Аватар 1: Тори (атакующий, белое доги мастера) */}
          <MultiAvatarModel
            role="tori"
            clipName={toriPart.clipName}
            stance={toriPart.stance || 'zenkutsu'}
            position={placement.endPosTori}
            startPosition={placement.startPosTori}
            rotation={placement.rotTori}
            startRotation={placement.startRotTori}
            isStationary={placement.isStationaryTori}
            phraseRef={phraseRef}
            rootsRef={rootsRef}
            speed={speed}
            isPlaying={isPlaying}
            timelineTime={null}
            delaySeconds={toriPart.delaySeconds || 0}
            ikTarget={bodyInteraction.clampedIkTargetA}
            ikContactTime={currentEpisode.tContact}
            interactionType={currentEpisode.interactionType}
            isGround={Boolean(currentEpisode.isGround || toriPart.isGround)}
            isRising={Boolean(currentEpisode.isRising || toriPart.isRising)}
            onMissingClip={handleMissingClipDetected}
            onTrackJoints={handleTrackJoints}
          />

          {/* Аватар 2: Укэ 1 (защищающийся, доги цвета индиго) */}
          <MultiAvatarModel
            role="uke1"
            clipName={uke1Part.clipName}
            stance={uke1Part.stance || 'zenkutsu'}
            position={placement.endPosUke1}
            startPosition={placement.startPosUke1}
            rotation={placement.rotUke1}
            startRotation={placement.startRotUke1}
            isStationary={placement.isStationaryUke}
            phraseRef={phraseRef}
            rootsRef={rootsRef}
            speed={speed}
            isPlaying={isPlaying}
            timelineTime={null}
            delaySeconds={uke1Part.delaySeconds || 0}
            ikTarget={bodyInteraction.clampedIkTargetB}
            ikContactTime={currentEpisode.tContact}
            interactionType={currentEpisode.interactionType}
            isGround={false}
            onMissingClip={handleMissingClipDetected}
            onTrackJoints={handleTrackJoints}
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
              timelineTime={null}
              delaySeconds={uke2Part.delaySeconds || 0}
              interactionType="body_contact"
              onMissingClip={handleMissingClipDetected}
              onTrackJoints={handleTrackJoints}
            />
          )}

          <ContactShadows position={[0, 0, 0]} opacity={0.65} scale={10} blur={1.5} far={4} />

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

          {(placement.hasCollision || bodyInteraction.penetrationPrevented) && (
            <div
              style={{
                background: 'rgba(30, 58, 138, 0.90)',
                color: '#93c5fd',
                padding: '5px 12px',
                borderRadius: 6,
                fontSize: '0.78rem',
                fontWeight: 600,
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                border: '1px solid rgba(59, 130, 246, 0.4)',
              }}
            >
              <Shield size={14} color="#60a5fa" />
              <span>Анти-проникновение: глубина удара ограничена поверхностью тела (без взаимного наложения)</span>
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
              style={{ padding: '6px 10px', fontSize: '0.82rem' }}
            >
              ◀ Предыдущий
            </button>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-gold)', minWidth: 65, textAlign: 'center' }}>
              {currentStepIdx + 1} / {chainedEpisodes.length}
            </span>
            <button
              className="btn"
              disabled={currentStepIdx === chainedEpisodes.length - 1}
              onClick={handleNextStep}
              style={{ padding: '6px 10px', fontSize: '0.82rem' }}
            >
              Следующий ▶
            </button>
          </div>

          {/* Кнопки плеера и переключения режима */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              style={{ minWidth: 125 }}
              onClick={handleTogglePlay}
            >
              {isPlaying && !stepCompleted ? '⏸ Пауза' : '▶ Воспроизведение'}
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
                borderColor: autoAdvance ? '#10b981' : undefined,
                background: autoAdvance ? 'rgba(16, 185, 129, 0.20)' : undefined,
                color: autoAdvance ? '#6ee7b7' : undefined,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
              onClick={() => setAutoAdvance(!autoAdvance)}
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
                borderColor: stateMode === 'continuous' ? 'var(--color-gold)' : undefined,
                background: stateMode === 'continuous' ? 'rgba(197, 155, 39, 0.15)' : undefined,
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
            <button className="btn btn-gold" onClick={resetCamera}>
              Сброс камеры
            </button>
          </div>

          {/* Скорость воспроизведения */}
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

        {/* Слайдеры управления боевой дистанцией (Ма-ай) и углом атаки */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 14,
            background: 'rgba(0,0,0,0.25)',
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* Слайдер дистанции Ма-ай */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
              <span style={{ color: 'var(--color-gold)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Ruler size={14} /> Боевая дистанция (Ма-ай):
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
              <span style={{ color: 'var(--color-gold)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Compass size={14} /> Угол атаки противника:
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
      </div>
    </div>
  );
}
