import { useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import KarateMasterModel from './KarateMasterModel';

/**
 * Интерактивная 3D-сцена Бункая (боевое взаимодействие минимум 2-3 бойцов: Тори и Укэ)
 * Тори (Защитник/Исполнитель) — в белоснежном доги мастера с 5-м даном.
 * Укэ 1 (Главный нападающий) — в аутентичном доги цвета индиго с соревновательным поясом.
 * Укэ 2 (Фланговый нападающий) — подключается для отработки соревновательного бункая.
 */

// Канонические сценарии боевого разбора (Бункай)
export const BUNKAI_SCENARIOS = [
  {
    id: 'shuto_counter',
    title: 'Защита Сюто-укэ против прямого выпада Ой-цуки',
    description: 'Укэ наносит мощный удар в корпус. Тори уходит с линии атаки (тай-сабаки) в Кокуцу-дати, сбивает руку ребром ладони Сюто-укэ и проводит контрудар Гяку-цуки.',
    phases: [
      { name: '1. Камаэ (Дистанция Ма-ай)', desc: 'Бойцы оценивают дистанцию перед атакой.' },
      { name: '2. Выпад Укэ', desc: 'Укэ делает взрывной выпад с прямым ударом Ой-цуки в средний уровень.' },
      { name: '3. Блок Тори', desc: 'Тори смещается назад-вбок в Кокуцу-дати с жестким блоком Сюто-укэ.' },
      { name: '4. Контратака Тори', desc: 'Захват запястья Укэ и сокрушительный пробивающий удар Гяку-цуки в ребра.' },
    ],
  },
  {
    id: 'age_uke_empi',
    title: 'Верхний блок Агэ-укэ и сокрушительный локоть Эмпи',
    description: 'Отражение удара в голову сверху. Тори поднимает Агэ-укэ, закручивает атакующую руку и наносит удар локтем Эмпи-учи в челюсть.',
    phases: [
      { name: '1. Камаэ (Дистанция)', desc: 'Исходная боевая стойка.' },
      { name: '2. Атака Дзёдан', desc: 'Укэ атакует ударом кулака в голову.' },
      { name: '3. Сбив Агэ-укэ', desc: 'Тори входит под удар с восходящим блоком предплечья.' },
      { name: '4. Удар локтем', desc: 'Тори сближается и наносит сокрушительный локоть снизу-вверх.' },
    ],
  },
  {
    id: 'gedan_counter',
    title: 'Нижний смет Гэдан-барай от удара ногой Маэ-гэри',
    description: 'Укэ бьет прямой ногой в живот. Тори уводит корпус с линии удара, сметает голень блоком Гэдан-барай и добивает ударом Тэтцуи.',
    phases: [
      { name: '1. Готовность', desc: 'Оценка дистанции для удара ногой.' },
      { name: '2. Удар Маэ-гэри', desc: 'Укэ пробивает прямой хлесткий удар ногой.' },
      { name: '3. Смет Гэдан-барай', desc: 'Тори сметает атакующую ногу в сторону, раскрывая спину соперника.' },
      { name: '4. Добивание Тэтцуи', desc: 'Удар основанием кулака по ключице или затылку соперника.' },
    ],
  },
];

// Рассчет поз для Тори и Укэ в зависимости от сценария и текущей фазы (0..3)
function getCombatPoses(scenarioId, phaseProgress) {
  // phaseProgress: от 0.0 до 3.0 (плавная интерполяция фаз)
  const p = Math.max(0, Math.min(3, phaseProgress));

  if (scenarioId === 'age_uke_empi') {
    // Тори позиции
    const toriAngles = {
      leftHipX: 0.1 + p * 0.18,
      leftHipZ: 0.05,
      leftKneeX: 0.1 + p * 0.3,
      rightHipX: -0.1 - p * 0.12,
      rightHipZ: -0.05,
      rightKneeX: 0.1,
      // В фазе 2-3 поднимает блок, затем локоть
      leftShoulderX: p < 2 ? -0.2 - p * 0.6 : -1.4,
      leftShoulderZ: p < 2 ? 0.2 + p * 0.1 : 0.35,
      leftElbowX: p < 2 ? 0.5 + p * 0.5 : 1.6,
      rightShoulderX: p < 2.5 ? 0.3 : -1.1,
      rightShoulderZ: -0.15,
      rightElbowX: p < 2.5 ? 0.8 : 2.2, // взлет правого локтя
      torsoRotX: 0.04,
      torsoRotY: p > 2 ? -0.25 : 0,
    };

    // Укэ позиции (атакующий)
    const ukeAngles = {
      leftHipX: p > 1 ? 0.65 : 0.15,
      leftHipZ: 0.05,
      leftKneeX: p > 1 ? 1.0 : 0.2,
      rightHipX: p > 1 ? -0.4 : -0.1,
      rightHipZ: -0.05,
      rightKneeX: 0.1,
      rightShoulderX: p > 1 ? -1.35 : -0.3,
      rightShoulderZ: -0.05,
      rightElbowX: p > 1 ? 0.1 : 0.7,
      leftShoulderX: 0.4,
      leftShoulderZ: 0.2,
      leftElbowX: 1.8,
      torsoRotX: p > 1 ? 0.08 : 0,
      torsoRotY: 0.05,
    };

    const toriPos = [0, -1.05, p > 1 ? 0.25 : 0];
    const ukePos = [0, -1.05, p > 1 ? 1.35 : 1.7];

    return { toriAngles, ukeAngles, toriPos, ukePos };
  }

  // По умолчанию: shuto_counter
  const toriAngles = {
    leftHipX: p > 1 ? 0.32 : 0.08,
    leftHipZ: 0.06,
    leftKneeX: p > 1 ? 0.35 : 0.1,
    rightHipX: p > 1 ? -0.55 : -0.08,
    rightHipZ: -0.12,
    rightKneeX: p > 1 ? 1.2 : 0.12,
    leftShoulderX: p > 1 ? -0.45 : -0.2,
    leftShoulderZ: p > 1 ? 0.42 : 0.15,
    leftElbowX: p > 1 ? 0.75 : 0.4,
    rightShoulderX: p >= 2.5 ? -1.15 : 0.5, // контрудар в финальной фазе
    rightShoulderZ: -0.15,
    rightElbowX: p >= 2.5 ? 0.1 : 1.9,
    torsoRotX: 0.03,
    torsoRotY: p > 1 ? 0.2 : 0,
  };

  const ukeAngles = {
    leftHipX: p > 0.8 ? 0.7 : 0.12,
    leftHipZ: 0.05,
    leftKneeX: p > 0.8 ? 1.05 : 0.15,
    rightHipX: p > 0.8 ? -0.45 : -0.1,
    rightHipZ: -0.05,
    rightKneeX: 0.1,
    rightShoulderX: p > 0.8 ? -1.25 : -0.25,
    rightShoulderZ: -0.08,
    rightElbowX: p > 0.8 ? 0.12 : 0.8,
    leftShoulderX: 0.45,
    leftShoulderZ: 0.2,
    leftElbowX: 1.8,
    torsoRotX: p > 0.8 ? 0.06 : 0,
    torsoRotY: -0.06,
  };

  const toriPos = [0, -1.05, p > 1 ? -0.25 : 0];
  const ukePos = [0, -1.05, p > 0.8 ? 1.3 : 1.8];

  return { toriAngles, ukeAngles, toriPos, ukePos };
}

function DojoCombatRing() {
  return (
    <group position={[0, -1.06, 0]}>
      {/* Главный настил Додзё */}
      <mesh receiveShadow position={[0, -0.04, 0]}>
        <cylinderGeometry args={[3.2, 3.25, 0.08, 36]} />
        <meshStandardMaterial color="#18130f" roughness={0.45} metalness={0.1} />
      </mesh>
      {/* Внешний кант татами цвета киновари и золота */}
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.0, 3.08, 36]} />
        <meshStandardMaterial color="#c59b27" roughness={0.3} metalness={0.7} />
      </mesh>
      {/* Центральный боевой круг */}
      <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.5, 1.54, 36]} />
        <meshStandardMaterial color="#8b2500" opacity={0.75} transparent />
      </mesh>
    </group>
  );
}

function DuelSimulation({ scenario, phase, isPlaying, speed, showUke2 }) {
  const currentPhase = useRef(phase);
  const toriGroupRef = useRef();
  const ukeGroupRef = useRef();
  const lastDiscretePhase = useRef(Math.floor(phase));
  const [currentStancePhase, setCurrentStancePhase] = useState(() => Math.floor(phase));

  useFrame((_, delta) => {
    const safeDelta = Math.min(delta, 0.033);
    if (isPlaying) {
      currentPhase.current = (currentPhase.current + safeDelta * 0.8 * speed) % 4;
    } else {
      currentPhase.current += (phase - currentPhase.current) * (1 - Math.exp(-safeDelta * 8));
    }

    const poses = getCombatPoses(scenario.id, currentPhase.current);
    if (toriGroupRef.current && poses.toriPos) {
      toriGroupRef.current.position.set(poses.toriPos[0], poses.toriPos[1], poses.toriPos[2]);
    }
    if (ukeGroupRef.current && poses.ukePos) {
      ukeGroupRef.current.position.set(poses.ukePos[0], poses.ukePos[1], poses.ukePos[2]);
    }

    // Обновляем стойки только при смене тактовой фазы, исключая 60 setState в секунду
    const discrete = Math.floor(currentPhase.current);
    if (discrete !== lastDiscretePhase.current) {
      lastDiscretePhase.current = discrete;
      setCurrentStancePhase(discrete);
    }
  });

  const discretePoses = getCombatPoses(scenario.id, currentStancePhase);

  return (
    <>
      <DojoCombatRing />

      {/* ТОРИ — Мастер каратэ (Белое доги, 5-й Дан) */}
      <group ref={toriGroupRef} position={discretePoses.toriPos} rotation={[0, 0, 0]}>
        <KarateMasterModel role="tori" angles={discretePoses.toriAngles} />
      </group>

      {/* УКЭ 1 — Атакующий (Тёмно-синее доги цвета индиго) */}
      <group ref={ukeGroupRef} position={discretePoses.ukePos} rotation={[0, Math.PI, 0]}>
        <KarateMasterModel role="uke" angles={discretePoses.ukeAngles} />
      </group>

      {/* УКЭ 2 — Фланговый нападающий (для соревновательного бункая) */}
      {showUke2 && (
        <group position={[-1.6, -1.05, 0.6]} rotation={[0, Math.PI / 2.5, 0]}>
          <KarateMasterModel
            role="uke2"
            angles={{
              leftHipX: 0.15,
              rightHipX: -0.15,
              leftShoulderX: -0.85,
              leftShoulderZ: 0.25,
              leftElbowX: 1.1,
              rightShoulderX: 0.35,
              rightElbowX: 1.8,
            }}
          />
        </group>
      )}

      <ContactShadows position={[0, -1.05, 0]} opacity={0.65} scale={7} blur={2.2} far={2.5} />
    </>
  );
}

export default function BunkaiDuelScene({ height = 480 }) {
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [phase, setPhase] = useState(2); // По умолчанию фаза 2 (Блок и уход)
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showUke2, setShowUke2] = useState(false);
  const controlsRef = useRef();

  const currentScenario = BUNKAI_SCENARIOS[scenarioIdx];

  function resetCamera() {
    controlsRef.current?.reset();
  }

  return (
    <div className="bunkai-duel-widget" style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
      {/* 3D Сцена */}
      <div style={{ width: '100%', height, position: 'relative', background: '#0c0907' }}>
        <Canvas shadows camera={{ position: [3.4, 2.0, 3.8], fov: 38 }}>
          <color attach="background" args={['#0c0907']} />

          {/* Освещение Додзё */}
          <ambientLight intensity={0.7} color="#fbf4ea" />
          <directionalLight
            position={[4, 7, 3]}
            intensity={1.3}
            color="#fff8ef"
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />
          <pointLight position={[-4, 3, -3]} intensity={0.7} color="#c59b27" />
          <pointLight position={[3, 2, -3]} intensity={0.5} color="#a12828" />

          <DuelSimulation
            scenario={currentScenario}
            phase={phase}
            isPlaying={isPlaying}
            speed={speed}
            showUke2={showUke2}
          />

          <OrbitControls
            ref={controlsRef}
            enablePan={false}
            minDistance={2.0}
            maxDistance={7.5}
            target={[0, 0.4, 0.6]}
          />
        </Canvas>

        {/* Информационный баннер текущей связки бункая */}
        <div style={{
          position: 'absolute',
          top: 14,
          left: 14,
          right: 14,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          pointerEvents: 'none',
        }}>
          <div style={{
            background: 'rgba(12, 9, 7, 0.88)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(197, 155, 39, 0.4)',
            borderRadius: 8,
            padding: '10px 16px',
            maxWidth: '520px',
          }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-gold)', fontWeight: 700 }}>
                Шотокан Бункай (分解)
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>•</span>
              <span style={{ fontSize: '0.75rem', color: '#68d391', fontWeight: 600 }}>
                {showUke2 ? '3 Бойца (Соревнование)' : 'Дуэль (Тори vs Укэ)'}
              </span>
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-washi)' }}>
              {currentScenario.title}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginTop: 4, lineHeight: 1.35 }}>
              {currentScenario.description}
            </div>
          </div>

          {/* Легенда цветов кимоно бойцов */}
          <div style={{
            background: 'rgba(12, 9, 7, 0.88)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: '8px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            fontSize: '0.78rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#fbf8f2', border: '1px solid #999' }}></span>
              <span style={{ color: '#fff', fontWeight: 600 }}>Тори</span>
              <span style={{ color: 'var(--color-text-muted)' }}>(Ката / Защита)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#1c2833', border: '1px solid #d4af37' }}></span>
              <span style={{ color: '#90cdf4', fontWeight: 600 }}>Укэ 1</span>
              <span style={{ color: 'var(--color-text-muted)' }}>(Атакующий)</span>
            </div>
            {showUke2 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#2b303a', border: '1px solid #63b3ed' }}></span>
                <span style={{ color: '#63b3ed', fontWeight: 600 }}>Укэ 2</span>
                <span style={{ color: 'var(--color-text-muted)' }}>(Фланг)</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Панель управления бункаем: выбор связки, пошаговый скраббер и скорость */}
      <div style={{ background: 'var(--color-surface)', padding: '16px 20px', borderTop: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          {/* Селектор сценария */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 320px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-gold)', whiteSpace: 'nowrap' }}>
              Боевая связка:
            </label>
            <select
              style={{ flex: 1, padding: '6px 12px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, color: '#fff' }}
              value={scenarioIdx}
              onChange={(e) => {
                setScenarioIdx(Number(e.target.value));
                setPhase(0);
                setIsPlaying(false);
              }}
            >
              {BUNKAI_SCENARIOS.map((sc, i) => (
                <option key={sc.id} value={i}>
                  {sc.title}
                </option>
              ))}
            </select>
          </div>

          {/* Кнопки плеера */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn btn-primary"
              style={{ minWidth: 120 }}
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? '⏸ Пауза' : '▶ Боевая анимация'}
            </button>
            <button
              className="btn"
              onClick={() => setShowUke2(!showUke2)}
            >
              {showUke2 ? 'Убрать Укэ 2' : '+ Добавить Укэ 2 (Трио)'}
            </button>
            <button className="btn btn-gold" onClick={resetCamera}>
              Сброс камеры
            </button>
          </div>
        </div>

        {/* Пошаговый скраббер фаз приёма */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
              Фаза взаимодействия:
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-gold)' }}>
              {currentScenario.phases[Math.round(phase)]?.name}
            </span>
          </div>

          {/* Сетка шагов фаз */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 6 }}>
            {currentScenario.phases.map((ph, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setPhase(idx);
                  setIsPlaying(false);
                }}
                style={{
                  padding: '8px 10px',
                  borderRadius: 6,
                  textAlign: 'left',
                  cursor: 'pointer',
                  border: Math.round(phase) === idx ? '1px solid var(--color-gold)' : '1px solid var(--color-border)',
                  background: Math.round(phase) === idx ? 'rgba(197, 155, 39, 0.15)' : 'var(--color-bg)',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: Math.round(phase) === idx ? 'var(--color-gold)' : 'var(--color-washi)' }}>
                  {ph.name}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ph.desc}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
