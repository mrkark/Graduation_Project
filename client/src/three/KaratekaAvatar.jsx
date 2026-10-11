import React, { useMemo, useRef, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import KarateMasterModel from './KarateMasterModel';
import TraditionalDojo from './TraditionalDojo';

/**
 * Аутентичные канонические стойки и положения мастера каратэ Шотокан
 */
export const SHOTOKAN_STANCES = {
  ready: {
    label: 'Стойка Йой (Сидзэнтай / Хэйко)',
    desc: 'Каноническая исходная стойка готовности: стопы на ширине плеч, кулаки опущены вниз и вперед перед собой, концентрация внимания (Дзансин).',
  },
  zenkutsu: {
    label: 'Дзэнкуцу-дати (Передняя стойка)',
    desc: 'Низкая наступательная стойка: переднее колено согнуто под 90°, задняя нога прямая, распределение веса 70/30.',
  },
  zenkutsu_dachi_right: {
    label: 'Дзэнкуцу-дати (Правая)',
    desc: 'Правосторонняя передняя наступательная стойка Шотокан.',
  },
  kokutsu: {
    label: 'Кокуцу-дати (Защитная стойка)',
    desc: 'Защитная стойка мастера: 70% веса на согнутой задней ноге, стопы под прямым углом.',
  },
  kokutsu_dachi_right: {
    label: 'Кокуцу-дати (Правая)',
    desc: 'Правосторонняя задняя защитная стойка.',
  },
  heiko: {
    label: 'Хэйко-дати (Параллельная)',
    desc: 'Параллельная стойка на ширине плеч.',
  },
  fudo: {
    label: 'Фудо-дати (Укоренённая)',
    desc: 'Монолитная боевая стойка мастера: укоренённый центр тяжести (50/50).',
  },
  kiba: {
    label: 'Киба-дати (Стойка всадника)',
    desc: 'Стойка всадника из ката Тэкки: колени широко разведены наружу, мощный центр тяжести.',
  },
  gankaku: {
    label: 'Цуру-аси-дати (Журавль на скале)',
    desc: 'Балансирующая стойка на одной ноге. Стопа поджата к колену.',
  },
};

/**
 * Динамические канонические техники каратэ Шотокан
 */
export const KARATE_TECHNIQUES = [
  // Удары руками (Цуки и Учи)
  { id: 'oi_zuki_right',      label: '👊 Ой-цуки (Правый)', category: 'hands' },
  { id: 'oi_zuki_left',       label: '👊 Ой-цуки (Левый)', category: 'hands' },
  { id: 'gyaku_zuki_right',   label: '💥 Гяку-цуки (Правый реверс)', category: 'hands' },
  { id: 'gyaku_zuki_left',    label: '💥 Гяку-цуки (Левый реверс)', category: 'hands' },
  { id: 'chudan_zuki_right',  label: '👊 Чудан-цуки (Корпус)', category: 'hands' },
  { id: 'jodan_zuki_right',   label: '🎯 Дзёдан-цуки (Голова)', category: 'hands' },
  { id: 'choku_zuki',         label: '👊 Чоку-цуки (Прямой)', category: 'hands' },
  { id: 'kizami_zuki',        label: '⚡ Кизами-цуки (Джеб)', category: 'hands' },
  { id: 'ren_zuki',           label: '🔄 Рэн-цуки (Двойка)', category: 'hands' },
  { id: 'uraken_uchi',        label: '🥊 Уракэн-учи (Бэкфист)', category: 'hands' },
  { id: 'tetsui_uchi',        label: '🔨 Тэтцуи-учи (Молот)', category: 'hands' },
  { id: 'empi_uchi',          label: '💥 Эмпи-учи (Локоть)', category: 'hands' },
  { id: 'shuto_uchi',         label: '✋ Сюто-учи (Ладонь)', category: 'hands' },

  // Защитные блоки
  { id: 'gedan_barai_left',   label: '🥋 Гэдан-барай (Левый смет)', category: 'blocks' },
  { id: 'gedan_barai_right',  label: '🥋 Гэдан-барай (Правый смет)', category: 'blocks' },
  { id: 'age_uke_left',       label: '🛡️ Агэ-укэ (Левый верхний)', category: 'blocks' },
  { id: 'age_uke_right',      label: '🛡️ Агэ-укэ (Правый верхний)', category: 'blocks' },
  { id: 'soto_uke',           label: '🛡️ Сото-укэ (Снаружи-внутрь)', category: 'blocks' },
  { id: 'uchi_uke',           label: '🛡️ Ути-укэ (Изнутри-наружу)', category: 'blocks' },
  { id: 'shuto_uke',          label: '✋ Сюто-укэ (Ребро ладони)', category: 'blocks' },

  // Удары ногами
  { id: 'mae_geri_right',     label: '🦶 Маэ-гэри (Правый прямой)', category: 'kicks' },
  { id: 'mae_geri_left',      label: '🦶 Маэ-гэри (Левый прямой)', category: 'kicks' },
  { id: 'mae_geri_chamber_right', label: '🦵 Камаэ колена Маэ-гэри', category: 'kicks' },
  { id: 'yoko_geri',          label: '🦶 Ёко-гэри (Боковой)', category: 'kicks' },
  { id: 'mawashi_geri',       label: '🔄 Маваси-гэри (Круговой)', category: 'kicks' },
  { id: 'ushiro_geri',        label: '🦶 Усиро-гэри (Назад)', category: 'kicks' },

  // Локомоция (Шаги и перемещения)
  { id: 'step_forward',       label: '👣 Шаг вперед (Сури-аси)', category: 'moves' },
  { id: 'step_backward',      label: '👣 Шаг назад', category: 'moves' },
  { id: 'slide_forward',      label: '🥋 Цуги-аси (Скольжение вперед)', category: 'moves' },
  { id: 'slide_backward',     label: '🥋 Скольжение назад', category: 'moves' },

  // Развороты и пивоты
  { id: 'turn_left',          label: '🔄 Разворот влево (45°)', category: 'moves' },
  { id: 'turn_right',         label: '🔄 Разворот вправо (45°)', category: 'moves' },
  { id: 'pivot_left',         label: '📐 Пивот таза Koshi влево', category: 'moves' },
  { id: 'pivot_right',        label: '📐 Пивот таза Koshi вправо', category: 'moves' },
  { id: 'turn_with_step_left',label: '👣 Разворот с шагом', category: 'moves' },

  // Хикитэ и взведения
  { id: 'hikite_right',       label: '⚡ Хикитэ правый к ребрам', category: 'moves' },
  { id: 'hikite_left',        label: '⚡ Хикитэ левый к ребрам', category: 'moves' },
  { id: 'chamber_left',       label: '🛡️ Чембер на блок', category: 'moves' },

  // Ката целиком
  { id: 'heian_shodan_preview', label: '📜 Хэйан Шодан (Превью формы)', category: 'moves' },
];

function RotatingGroup({ animate, children }) {
  const groupRef = useRef();
  useFrame((_, delta) => {
    if (groupRef.current && animate) {
      groupRef.current.rotation.y += delta * 0.45;
    }
  });
  return <group ref={groupRef}>{children}</group>;
}

export default function KaratekaAvatar({
  height = '100%',
  initialStance = 'ready',
  showControls = true,
  role = 'tori',
  subtitle = null,
}) {
  const [stance, setStance] = useState(initialStance);
  const [activeClip, setActiveClip] = useState(null);
  const [animate, setAnimate] = useState(false);
  const controlsRef = useRef();

  const stanceKeys = useMemo(() => Object.keys(SHOTOKAN_STANCES), []);
  const currentInfo = SHOTOKAN_STANCES[stance] || SHOTOKAN_STANCES.ready;

  function resetCamera() {
    controlsRef.current?.reset();
  }

  function handleTriggerClip(clipId) {
    setActiveClip(null);
    setTimeout(() => {
      setActiveClip(clipId);
    }, 20);
  }

  return (
    <div className="avatar-widget" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="avatar-canvas" style={{ width: '100%', flex: 1, minHeight: typeof height === 'number' ? `${height}px` : height, position: 'relative' }}>
        <Canvas shadows camera={{ position: [0, 1.15, 2.6], fov: 44 }}>
          <color attach="background" args={['#17120d']} />

          {/* Мягкое атмосферное освещение традиционного зала Додзё */}
          <ambientLight intensity={0.40} color="#fff1e0" />
          <hemisphereLight skyColor="#fff6ec" groundColor="#3a281c" intensity={0.50} />
          <directionalLight
            position={[4, 7, 3.5]}
            intensity={0.95}
            color="#fff8f0"
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-bias={-0.0003}
            shadow-normalBias={0.03}
          />
          <pointLight position={[-3.5, 2.2, -2.5]} intensity={0.35} color="#e59e45" distance={10} />
          <pointLight position={[3.5, 2.2, -2.5]} intensity={0.35} color="#e59e45" distance={10} />

          {/* Полное 3D традиционное Додзё: 18x18м, татами, сёдзи, камидза, свиток и фонари */}
          <TraditionalDojo />

          <RotatingGroup animate={animate}>
            <Suspense fallback={null}>
              <KarateMasterModel
                role={role}
                stance={stance}
                activeClip={activeClip}
                position={[0, 0, 0]}
              />
            </Suspense>
          </RotatingGroup>

          {/* Контактная тень на поверхности татами */}
          <ContactShadows position={[0, 0.002, 0]} opacity={0.75} scale={5.5} blur={1.8} far={1.8} />

          <OrbitControls
            ref={controlsRef}
            enablePan={false}
            minDistance={1.3}
            maxDistance={5.5}
            maxPolarAngle={Math.PI / 2 - 0.03}
            target={[0, 0.88, 0]}
          />
        </Canvas>

        {/* Бейдж текущей техники в углу 3D сцены */}
        <div style={{
          position: 'absolute',
          top: 14,
          left: 14,
          background: 'rgba(18, 13, 9, 0.92)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(197, 155, 39, 0.6)',
          borderRadius: 8,
          padding: '9px 15px',
          maxWidth: '82%',
          pointerEvents: 'none',
          boxShadow: '0 6px 20px rgba(0, 0, 0, 0.65)',
          zIndex: 5,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-gold, #c59b27)', fontWeight: 700 }}>
              🥋 Хонбу Додзё • Мастер Каратэ Шотокан
            </span>
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-washi, #f4eee2)', marginTop: 3 }}>
            {currentInfo.label}
          </div>
          {currentInfo.desc && (
            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted, #c0b8aa)', marginTop: 4, lineHeight: 1.35 }}>
              {currentInfo.desc}
            </div>
          )}
        </div>
      </div>

      {showControls && (
        <div className="avatar-controls">
          <div className="avatar-controls__row">
            <label htmlFor="stance-select">Каноническая стойка:</label>
            <select
              id="stance-select"
              value={stance}
              onChange={(e) => {
                setStance(e.target.value);
                setActiveClip(null);
              }}
            >
              {stanceKeys.map((key) => (
                <option key={key} value={key}>
                  {SHOTOKAN_STANCES[key].label}
                </option>
              ))}
            </select>
          </div>

          <div className="avatar-controls__row" style={{ marginTop: 2 }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--gold, #c59b27)', fontWeight: 600 }}>
              Приёмы в движении:
            </span>
            {KARATE_TECHNIQUES.map((tech) => (
              <button
                key={tech.id}
                type="button"
                className={`btn ${activeClip === tech.id ? 'btn-gold' : ''}`}
                style={{ fontSize: '0.82rem', padding: '0.4em 0.8em' }}
                onClick={() => handleTriggerClip(tech.id)}
              >
                {tech.label}
              </button>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="btn"
                onClick={() => setAnimate((a) => !a)}
                title="Автоматическое вращение камеры 360°"
              >
                {animate ? '⏸ Пауза' : '🔄 360°'}
              </button>
              <button
                type="button"
                className="btn btn-gold"
                onClick={resetCamera}
                title="Сбросить ракурс камеры"
              >
                Сброс
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
