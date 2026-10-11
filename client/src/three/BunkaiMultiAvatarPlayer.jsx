import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import MultiAvatarModel from './MultiAvatarModel';
import TraditionalDojo from './TraditionalDojo';
import { resolveAvatarCollision, resolveThreeAvatarsCollision } from './collisionAvoidance';
import { animationRegistry } from './animationRegistry';

/**
 * Универсальный плеер боевого применения (Бункай) Шотокан с поддержкой 2 и 3 аватаров.
 * Обеспечивает:
 * - Точное воспроизведение структурированных шагов Бункая из БД.
 * - Интерактивную настройку боевой дистанции (Ма-ай) и угла атаки.
 * - Анти-проникновение тел (капсульные коллизии).
 * - Доводку рук через 2-Bone IK в окне боевого контакта.
 * - Детектирование отсутствующих анимаций и предупреждающие баннеры (без скрытых подмен).
 */

const DEFAULT_EPISODES = [
  {
    stepNumber: 1,
    title: 'Защита Сюто-укэ против выпада Ой-цуки',
    description: 'Укэ атакует мощным прямым выпадом в корпус. Тори смещается с линии атаки в Кокуцу-дати, сбивает предплечье блоком Сюто-укэ и контратакует Гяку-цуки.',
    optimalDistance: 1.45,
    attackAngleDeg: 0,
    interactionType: 'local_contact',
    tContact: 0.45,
    participants: [
      { role: 'tori', clipName: 'shuto_uke', stance: 'kokutsu' },
      { role: 'uke1', clipName: 'oi_zuki_right', stance: 'zenkutsu' },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready' },
    ],
  },
  {
    stepNumber: 2,
    title: 'Восходящий блок Агэ-укэ и сокрушительный локоть Эмпи',
    description: 'Отражение верхнего удара в голову с последующим глубоким входом и ударом локтем в челюсть.',
    optimalDistance: 1.25,
    attackAngleDeg: 15,
    interactionType: 'local_contact',
    tContact: 0.40,
    participants: [
      { role: 'tori', clipName: 'age_uke_left', stance: 'zenkutsu' },
      { role: 'uke1', clipName: 'oi_zuki_right', stance: 'zenkutsu' },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready' },
    ],
  },
  {
    stepNumber: 3,
    title: 'Нижний смет Гэдан-барай от прямого удара ногой Маэ-гэри',
    description: 'Укэ наносит прямой хлесткий удар ногой. Тори сметает голень блоком Гэдан-барай и добивает молотом Тэтцуи-учи.',
    optimalDistance: 1.65,
    attackAngleDeg: -10,
    interactionType: 'local_contact',
    tContact: 0.50,
    participants: [
      { role: 'tori', clipName: 'gedan_barai_left', stance: 'zenkutsu' },
      { role: 'uke1', clipName: 'mae_geri_right', stance: 'zenkutsu' },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready' },
    ],
  },
];

export default function BunkaiMultiAvatarPlayer({
  steps = null, // Шаги из API getBunkaiSteps()
  defaultParticipantMode = '2-person', // '2-person' | '3-person'
  height = 540,
  onStepChange = null,
}) {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [showUke2, setShowUke2] = useState(defaultParticipantMode === '3-person');
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1.0);
  const [phaseProgress, setPhaseProgress] = useState(0.5); // 0.0 (Kamae) .. 1.0 (Impact/Kime)
  const [isScrubbing, setIsScrubbing] = useState(false);

  // Пользовательские настройки геометрии боя
  const [distanceOffset, setDistanceOffset] = useState(0); // смещение относительно оптимальной дистанции (-0.5м .. +1.0м)
  const [angleOffsetDeg, setAngleOffsetDeg] = useState(0); // дополнительное смещение угла (-45° .. +45°)

  // Оповещения об отсутствующих клипах
  const [missingClips, setMissingClips] = useState([]);

  // Трекинг костей для IK
  const trackedBonesRef = useRef({ tori: null, uke1: null, uke2: null });
  const [ikTargets, setIkTargets] = useState({ toriTarget: null, ukeTarget: null });

  const controlsRef = useRef();

  // Нормализуем переданные шаги (из API или дефолтные)
  const activeEpisodes = useMemo(() => {
    if (Array.isArray(steps) && steps.length > 0) {
      return steps.map((s, idx) => {
        const toriPart = s.Participants?.find((p) => p.Role === 'tori') || {};
        const uke1Part = s.Participants?.find((p) => p.Role === 'uke' || p.Role === 'uke1') || {};
        const uke2Part = s.Participants?.find((p) => p.Role === 'uke2') || {};

        return {
          stepNumber: s.Step_Number || idx + 1,
          title: s.Title || `Эпизод ${idx + 1}`,
          description: s.Description || '',
          optimalDistance: s.Combat_Distance_Meters || 1.45,
          attackAngleDeg: s.Attack_Angle_Degrees || 0,
          interactionType: s.Interaction_Type || 'local_contact',
          tContact: 0.45,
          participants: [
            { role: 'tori', clipName: toriPart.Clip_Name || s.Clip_Name || 'shuto_uke', stance: toriPart.Stance_In || 'kokutsu' },
            { role: 'uke1', clipName: uke1Part.Clip_Name || 'oi_zuki_right', stance: uke1Part.Stance_In || 'zenkutsu' },
            { role: 'uke2', clipName: uke2Part.Clip_Name || 'idle_shizentai', stance: uke2Part.Stance_In || 'ready' },
          ],
        };
      });
    }
    return DEFAULT_EPISODES;
  }, [steps]);

  const currentEpisode = activeEpisodes[currentStepIdx] || activeEpisodes[0];

  // Проверка переходов между эпизодами
  useEffect(() => {
    if (activeEpisodes.length > 1 && currentStepIdx < activeEpisodes.length - 1) {
      const curTori = currentEpisode.participants.find((p) => p.role === 'tori');
      const nextTori = activeEpisodes[currentStepIdx + 1].participants.find((p) => p.role === 'tori');
      if (curTori?.clipName && nextTori?.clipName) {
        const res = animationRegistry.validateTransition(
          curTori.clipName,
          nextTori.clipName,
          `Bunkai Episode ${currentStepIdx + 1} -> ${currentStepIdx + 2}`
        );
        if (!res.compatible) {
          setMissingClips((prev) => Array.from(new Set([...prev, res.missingClipName || res.reason])));
        }
      }
    }
  }, [activeEpisodes, currentStepIdx, currentEpisode]);

  const handleMissingClipDetected = useCallback((clipName) => {
    setMissingClips((prev) => Array.from(new Set([...prev, clipName])));
  }, []);

  const handleTrackBones = useCallback((role, data) => {
    trackedBonesRef.current[role] = data;
    // Обновляем таргет для Тори: кулак или грудь Укэ 1
    if (role === 'uke1' && data.chest) {
      setIkTargets((prev) => ({ ...prev, toriTarget: data.chest.clone() }));
    }
    if (role === 'tori' && data.chest) {
      setIkTargets((prev) => ({ ...prev, ukeTarget: data.chest.clone() }));
    }
  }, []);

  // Расчет мировых позиций с учетом угла атаки, дистанции и предотвращения столкновения тел
  const { posTori, posUke1, posUke2, rotTori, rotUke1, rotUke2, hasCollision } = useMemo(() => {
    const baseDist = currentEpisode.optimalDistance + distanceOffset;
    const finalDist = Math.max(0.40, baseDist);

    const baseAngleRad = ((currentEpisode.attackAngleDeg + angleOffsetDeg) * Math.PI) / 180;

    // Тори находится в центре татами, обращен лицом к нападающему
    const rawPosTori = [0, 0, 0];

    // Укэ 1 нападает с фронта/угла baseAngleRad
    const rawPosUke1 = [
      Math.sin(baseAngleRad) * finalDist,
      0,
      Math.cos(baseAngleRad) * finalDist,
    ];

    // Укэ 2 (фланговый нападающий) атакует под углом +55 градусов слева
    const angleUke2Rad = baseAngleRad + (55 * Math.PI) / 180;
    const rawPosUke2 = [
      Math.sin(angleUke2Rad) * (finalDist + 0.35),
      0,
      Math.cos(angleUke2Rad) * (finalDist + 0.35),
    ];

    let pTori, pUke1, pUke2, collided;

    if (showUke2) {
      const col = resolveThreeAvatarsCollision(rawPosTori, rawPosUke1, rawPosUke2);
      pTori = col.correctedTori;
      pUke1 = col.correctedUke1;
      pUke2 = col.correctedUke2;
      collided = col.collided;
    } else {
      const col = resolveAvatarCollision(rawPosTori, rawPosUke1);
      pTori = col.correctedA;
      pUke1 = col.correctedB;
      pUke2 = rawPosUke2;
      collided = col.collided;
    }

    // Вращения: Тори смотрит на Укэ 1, Укэ 1 смотрит на Тори
    const dirUke1ToTori = Math.atan2(pTori[0] - pUke1[0], pTori[2] - pUke1[2]);
    const dirToriToUke1 = Math.atan2(pUke1[0] - pTori[0], pUke1[2] - pTori[2]);
    const dirUke2ToTori = Math.atan2(pTori[0] - pUke2[0], pTori[2] - pUke2[2]);

    return {
      posTori: pTori,
      posUke1: pUke1,
      posUke2: pUke2,
      rotTori: [0, dirToriToUke1, 0],
      rotUke1: [0, dirUke1ToTori, 0],
      rotUke2: [0, dirUke2ToTori, 0],
      hasCollision: collided,
    };
  }, [currentEpisode, distanceOffset, angleOffsetDeg, showUke2]);

  const toriData = currentEpisode.participants.find((p) => p.role === 'tori') || {};
  const uke1Data = currentEpisode.participants.find((p) => p.role === 'uke1' || p.role === 'uke') || {};
  const uke2Data = currentEpisode.participants.find((p) => p.role === 'uke2') || {};

  function handlePrevStep() {
    setCurrentStepIdx((prev) => {
      const next = Math.max(0, prev - 1);
      if (onStepChange) onStepChange(next);
      return next;
    });
  }

  function handleNextStep() {
    setCurrentStepIdx((prev) => {
      const next = Math.min(activeEpisodes.length - 1, prev + 1);
      if (onStepChange) onStepChange(next);
      return next;
    });
  }

  function resetCamera() {
    if (controlsRef.current) {
      controlsRef.current.reset();
      controlsRef.current.target.set(0, 0.95, 0.6);
    }
  }

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
          camera={{ position: [2.6, 1.8, 3.2], fov: 42 }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        >
          <color attach="background" args={['#0e0d0b']} />
          <ambientLight intensity={0.7} />
          <directionalLight
            position={[4, 6, 4]}
            intensity={1.4}
            castShadow
            shadow-mapSize={[1024, 1024]}
            shadow-camera-near={0.5}
            shadow-camera-far={15}
            shadow-camera-left={-3}
            shadow-camera-right={3}
            shadow-camera-top={3}
            shadow-camera-bottom={-3}
          />
          <directionalLight position={[-4, 3, -3]} intensity={0.4} color="#90cdf4" />

          {/* Традиционное японское додзё с разметкой татами */}
          <TraditionalDojo />

          {/* Аватар Тори (белое кимоно мастера) */}
          <MultiAvatarModel
            role="tori"
            clipName={toriData.clipName}
            stance={toriData.stance}
            position={posTori}
            rotation={rotTori}
            speed={speed}
            isPlaying={isPlaying}
            scrubProgress={isScrubbing ? phaseProgress : null}
            ikTarget={ikTargets.toriTarget}
            ikContactTime={currentEpisode.tContact}
            interactionType={currentEpisode.interactionType}
            onMissingClip={handleMissingClipDetected}
            onTrackBones={handleTrackBones}
          />

          {/* Аватар Укэ 1 (главный нападающий, доги цвета индиго) */}
          <MultiAvatarModel
            role="uke1"
            clipName={uke1Data.clipName}
            stance={uke1Data.stance}
            position={posUke1}
            rotation={rotUke1}
            speed={speed}
            isPlaying={isPlaying}
            scrubProgress={isScrubbing ? phaseProgress : null}
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
              clipName={uke2Data.clipName || 'idle_shizentai'}
              stance={uke2Data.stance || 'ready'}
              position={posUke2}
              rotation={rotUke2}
              speed={speed}
              isPlaying={isPlaying}
              scrubProgress={isScrubbing ? phaseProgress : null}
              interactionType="non_contact"
              onMissingClip={handleMissingClipDetected}
              onTrackBones={handleTrackBones}
            />
          )}

          <ContactShadows position={[0, 0, 0]} opacity={0.65} scale={8} blur={1.5} far={4} />

          <OrbitControls
            ref={controlsRef}
            target={[0, 0.95, 0.6]}
            minDistance={1.2}
            maxDistance={7.0}
            maxPolarAngle={Math.PI / 2 - 0.04}
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
              background: 'rgba(12, 9, 7, 0.88)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(197, 155, 39, 0.4)',
              borderRadius: 8,
              padding: '10px 16px',
              maxWidth: '520px',
              pointerEvents: 'auto',
            }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-gold)', fontWeight: 700 }}>
                Шотокан Бункай · Шаг {currentEpisode.stepNumber} из {activeEpisodes.length}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>•</span>
              <span style={{ fontSize: '0.75rem', color: showUke2 ? '#68d391' : '#63b3ed', fontWeight: 600 }}>
                {showUke2 ? '🏆 Командный бункай (3 бойца)' : '🥋 Парный бункай (Дуэль)'}
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

          {/* Легенда ролей участников */}
          <div
            style={{
              background: 'rgba(12, 9, 7, 0.88)',
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
              <span style={{ color: 'var(--color-text-muted)' }}>({toriData.clipName || 'Защита'})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#243346', border: '1px solid #63b3ed' }}></span>
              <span style={{ color: '#90cdf4', fontWeight: 600 }}>Укэ 1</span>
              <span style={{ color: 'var(--color-text-muted)' }}>({uke1Data.clipName || 'Атака'})</span>
            </div>
            {showUke2 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#342b2b', border: '1px solid #e53e3e' }}></span>
                <span style={{ color: '#feb2b2', fontWeight: 600 }}>Укэ 2</span>
                <span style={{ color: 'var(--color-text-muted)' }}>({uke2Data.clipName || 'Фланг'})</span>
              </div>
            )}
          </div>
        </div>

        {/* Предупреждение о коллизии и проникновении тел */}
        {hasCollision && (
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

        {/* Баннер обнаруженных отсутствующих клипов (БЕЗ СКРЫТЫХ ПОДМЕН) */}
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
        {/* Верхняя строка: навигация по шагам, режим участников и плеер */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          {/* Переключение шагов */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn"
              disabled={currentStepIdx === 0}
              onClick={handlePrevStep}
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            >
              ◀ Предыдущий эпизод
            </button>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-gold)', minWidth: 90, textAlign: 'center' }}>
              {currentStepIdx + 1} / {activeEpisodes.length}
            </span>
            <button
              className="btn"
              disabled={currentStepIdx === activeEpisodes.length - 1}
              onClick={handleNextStep}
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            >
              Следующий эпизод ▶
            </button>
          </div>

          {/* Кнопки плеера и переключения формата */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              style={{ minWidth: 120 }}
              onClick={() => {
                setIsPlaying(!isPlaying);
                setIsScrubbing(false);
              }}
            >
              {isPlaying ? '⏸ Пауза' : '▶ Воспроизведение'}
            </button>
            <button
              className="btn"
              onClick={() => setShowUke2(!showUke2)}
            >
              {showUke2 ? '2 Участника (Дуэль)' : '+ Добавить Укэ 2 (Трио)'}
            </button>
            <button className="btn btn-gold" onClick={resetCamera}>
              Сброс камеры
            </button>
          </div>

          {/* Скорость воспроизведения */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Скорость:</span>
            {[0.25, 0.5, 1.0].map((s) => (
              <button
                key={s}
                className="btn"
                style={{
                  padding: '4px 8px',
                  fontSize: '0.78rem',
                  borderColor: speed === s ? 'var(--color-gold)' : undefined,
                  background: speed === s ? 'rgba(197, 155, 39, 0.2)' : undefined,
                }}
                onClick={() => setSpeed(s)}
              >
                {s}x
              </button>
            ))}
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
                {(currentEpisode.optimalDistance + distanceOffset).toFixed(2)} м
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

        {/* Нижняя строка: пошаговый скраббер фаз взаимодействия */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
              Фаза приема (Kamae ➔ Impact ➔ Zanshin):
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-gold)' }}>
              {phaseProgress < 0.25 ? '1. Камаэ (Готовность)' : phaseProgress < 0.65 ? '2. Атака / Блок (Контакт)' : '3. Контратака и Киме'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { label: '1. Исходная стойка (Камаэ)', prog: 0.1 },
              { label: '2. Момент контакта (ИК-доводка)', prog: 0.45 },
              { label: '3. Фиксация киме (Дзансин)', prog: 0.9 },
            ].map((p, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setPhaseProgress(p.prog);
                  setIsScrubbing(true);
                  setIsPlaying(false);
                }}
                style={{
                  padding: '8px 10px',
                  borderRadius: 6,
                  textAlign: 'left',
                  cursor: 'pointer',
                  border: isScrubbing && Math.abs(phaseProgress - p.prog) < 0.2 ? '1px solid var(--color-gold)' : '1px solid var(--color-border)',
                  background: isScrubbing && Math.abs(phaseProgress - p.prog) < 0.2 ? 'rgba(197, 155, 39, 0.18)' : 'var(--color-bg)',
                  color: isScrubbing && Math.abs(phaseProgress - p.prog) < 0.2 ? 'var(--color-gold)' : 'var(--color-washi)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  transition: 'all 0.15s ease',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
