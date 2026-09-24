import React, { useMemo, useRef, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import RealisticSenseiModel from './RealisticSenseiModel';
import TraditionalDojo from './TraditionalDojo';

/**
 * Аутентичные канонические стойки и положения мастера каратэ Шотокан
 */
export const SHOTOKAN_STANCES = {
  ready: {
    label: 'Стойка Йой (Хэйко-дати / Сидзэнтай)',
    desc: 'Каноническая исходная стойка Йой: стопы на ширине плеч, кулаки опущены вниз и вперед перед собой, концентрация внимания (Дзансин).',
  },
  zenkutsu: {
    label: 'Дзэнкуцу-дати + Ой-цуки (Прямой удар в чудан)',
    desc: 'Низкая наступательная стойка: левая нога согнута под 90° впереди, правая прямая сзади. Правый кулак наносит пробивающий удар в солнечное сплетение, левый кулак в хикитэ у бедра.',
  },
  gedan_barai: {
    label: 'Дзэнкуцу-дати + Гэдан-барай (Нижний смет)',
    desc: 'Канонический нижний смет: левое предплечье сметает нижнюю атаку под углом 45° над передним бедром, правый кулак отведен в хикитэ у бедра.',
  },
  age_uke: {
    label: 'Дзэнкуцу-дати + Агэ-укэ (Верхний блок головы)',
    desc: 'Защита головы от удара сверху: левое предплечье поднято под углом 45° над лбом, кулак направлен наружу, правый в хикитэ.',
  },
  kokutsu: {
    label: 'Кокуцу-дати + Сюто-укэ (Блок ребром ладони)',
    desc: 'Защитная стойка мастера: 70% веса на согнутой задней ноге. Передняя рука блокирует ребром открытой ладони (сюто), задняя ладонь у солнечного сплетения.',
  },
  kiba: {
    label: 'Киба-дати + Каги-цуки (Стойка всадника с крюком)',
    desc: 'Стойка всадника из ката Тэкки: колени широко разведены наружу, мощный укорененный центр тяжести с боковым крюком кулаком.',
  },
  fudo: {
    label: 'Фудо-дати (Стойка мастера Сочин — Непоколебимость)',
    desc: 'Монолитная боевая стойка мастера каратэ Сочин: укорененный центр тяжести, вертикальный защитный кулак мусо-камаэ.',
  },
  gankaku: {
    label: 'Цуру-аси-дати (Журавль на скале — Ганкаку)',
    desc: 'Балансирующая стойка на одной ноге. Правая стопа поджата к колену, готовность нанести взрывной удар ногой и бэкфист.',
  },
};

/**
 * Динамические канонические техники каратэ Шотокан
 */
export const KARATE_TECHNIQUES = [
  // Удары руками (Цуки и Учи)
  { id: 'choku_zuki',   label: '👊 Чоку-цуки (Прямой)', category: 'hands' },
  { id: 'oi_zuki',      label: '👊 Ой-цуки (С шагом)', category: 'hands' },
  { id: 'gyaku_zuki',   label: '💥 Гяку-цуки (Реверс)', category: 'hands' },
  { id: 'kizami_zuki',  label: '⚡ Кизами-цуки (Джеб)', category: 'hands' },
  { id: 'ren_zuki',     label: '🔄 Рэн-цуки (Двойка)', category: 'hands' },
  { id: 'uraken_uchi',  label: '🥊 Уракэн-учи (Бэкфист)', category: 'hands' },
  { id: 'tetsui_uchi',  label: '🔨 Тэтцуи-учи (Молот)', category: 'hands' },
  { id: 'empi_uchi',    label: '💥 Эмпи-учи (Локоть)', category: 'hands' },
  { id: 'shuto_uchi',   label: '✋ Сюто-учи (Ладонь)', category: 'hands' },
  { id: 'morote_zuki',  label: '⚡ Моротэ-цуки (Двойной)', category: 'hands' },
  { id: 'hook',         label: '🥊 Каги-цуки (Крюк)', category: 'hands' },

  // Защитные блоки
  { id: 'age_uke',      label: '🛡️ Агэ-укэ (Верхний блок)', category: 'blocks' },
  { id: 'soto_uke',     label: '🛡️ Сото-укэ (Блок снаружи)', category: 'blocks' },
  { id: 'uchi_uke',     label: '🛡️ Ути-укэ (Блок изнутри)', category: 'blocks' },
  { id: 'gedan_barai',  label: '🥋 Гэдан-барай (Нижний смет)', category: 'blocks' },
  { id: 'shuto_uke',    label: '✋ Сюто-укэ (Ребро ладони)', category: 'blocks' },

  // Удары ногами и перемещения
  { id: 'mae_geri',     label: '🦶 Маэ-гэри (Прямой)', category: 'kicks' },
  { id: 'yoko_geri',    label: '🦶 Ёко-гэри (Боковой)', category: 'kicks' },
  { id: 'mawashi_geri', label: '🔄 Маваси-гэри (Круговой)', category: 'kicks' },
  { id: 'ushiro_geri',  label: '🦶 Усиро-гэри (Назад)', category: 'kicks' },
  { id: 'step',         label: '🥋 Цуги-аси (Подшаг)', category: 'moves' },
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

          {/* Теплое гармоничное освещение традиционного зала Додзё */}
          <ambientLight intensity={0.95} color="#fff6ea" />
          <directionalLight
            position={[4, 6, 4]}
            intensity={1.6}
            color="#fffcf5"
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />
          <pointLight position={[-3, 2, -2]} intensity={0.7} color="#f5b358" />
          <pointLight position={[3, 2, -2]} intensity={0.7} color="#f5b358" />

          {/* Полное 3D традиционное Додзё: 18x18м, татами, сёдзи, камидза, свиток и фонари */}
          <TraditionalDojo />

          <RotatingGroup animate={animate}>
            <Suspense fallback={null}>
              <RealisticSenseiModel
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
