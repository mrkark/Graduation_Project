import * as THREE from 'three';

/**
 * Просторное традиционное японское Додзё (Honbu Dojo)
 * Особенности:
 * - Увеличенные масштабы зала: 18x18 метров, высота потолка 5.5м (свободное пространство для обзора)
 * - Поверхность пола точно на уровне Y = 0.0 (персонажи стоят прямо на татами, не зависая в воздухе)
 * - Большой центральный боевой помост из традиционных соломенных матов Татами с тёмно-зелёным кантом
 * - Раздвижные стены Сёдзи (Shoji) из рисовой бумаги и тёмного кедра отодвинуты на 9 метров назад
 * - Величественная почётная ниша Токонома (Камидза) со свитком каллиграфии «空手道» и мечом боккэн
 * - Массивные потолочные балки из кедра
 * - Напольные японские фонари Андон с тёплым золотистым светом
 */

// Бумажная решетчатая панель Сёдзи
function ShojiWall({ width = 6, height = 4.8, position = [0, 0, 0], rotation = [0, 0, 0] }) {
  const woodColor = '#24160e';
  const paperColor = '#faf5ea';

  return (
    <group position={position} rotation={rotation}>
      {/* Рисовая бумага васи */}
      <mesh position={[0, height / 2, 0]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color={paperColor} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>

      {/* Верхняя и нижняя балки рамы */}
      <mesh position={[0, height, 0.02]}>
        <boxGeometry args={[width + 0.1, 0.12, 0.06]} />
        <meshStandardMaterial color={woodColor} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.06, 0.02]}>
        <boxGeometry args={[width + 0.1, 0.12, 0.06]} />
        <meshStandardMaterial color={woodColor} roughness={0.7} />
      </mesh>
      {/* Боковые стойки */}
      <mesh position={[-width / 2, height / 2, 0.02]}>
        <boxGeometry args={[0.1, height, 0.06]} />
        <meshStandardMaterial color={woodColor} roughness={0.7} />
      </mesh>
      <mesh position={[width / 2, height / 2, 0.02]}>
        <boxGeometry args={[0.1, height, 0.06]} />
        <meshStandardMaterial color={woodColor} roughness={0.7} />
      </mesh>

      {/* Вертикальные рейки решётки */}
      {[-width * 0.35, -width * 0.175, 0, width * 0.175, width * 0.35].map((x, i) => (
        <mesh key={`v-${i}`} position={[x, height / 2, 0.015]}>
          <boxGeometry args={[0.035, height - 0.12, 0.025]} />
          <meshStandardMaterial color={woodColor} roughness={0.75} />
        </mesh>
      ))}

      {/* Горизонтальные рейки решётки кумико */}
      {[0.6, 1.2, 1.8, 2.4, 3.0, 3.6, 4.2].map((y, i) => (
        <mesh key={`h-${i}`} position={[0, y, 0.015]}>
          <boxGeometry args={[width - 0.1, 0.03, 0.025]} />
          <meshStandardMaterial color={woodColor} roughness={0.75} />
        </mesh>
      ))}
    </group>
  );
}

// Величественная ниша Камидза (Токонома)
function GrandKamiza({ position = [0, 0, -8.8] }) {
  const woodDark = '#1a0e08';
  const scrollSilk = '#f2e8d5';

  return (
    <group position={position}>
      {/* Задняя стена ниши */}
      <mesh position={[0, 2.6, 0]}>
        <planeGeometry args={[5.2, 5.2]} />
        <meshStandardMaterial color="#cbbdaf" roughness={0.95} />
      </mesh>

      {/* Левый и правый массивные деревянные столбы (Хасира) */}
      <mesh position={[-2.6, 2.6, 0.2]} castShadow>
        <cylinderGeometry args={[0.16, 0.18, 5.2, 16]} />
        <meshStandardMaterial color={woodDark} roughness={0.6} />
      </mesh>
      <mesh position={[2.6, 2.6, 0.2]} castShadow>
        <cylinderGeometry args={[0.16, 0.18, 5.2, 16]} />
        <meshStandardMaterial color={woodDark} roughness={0.6} />
      </mesh>

      {/* Верхняя массивная балка перекрытия */}
      <mesh position={[0, 5.15, 0.2]}>
        <boxGeometry args={[5.5, 0.28, 0.35]} />
        <meshStandardMaterial color={woodDark} roughness={0.6} />
      </mesh>

      {/* Нижний приподнятый помост ниши (Токо-гамати) */}
      <mesh position={[0, 0.15, 0.4]} receiveShadow>
        <boxGeometry args={[5.5, 0.3, 0.95]} />
        <meshStandardMaterial color="#2d1a10" roughness={0.45} />
      </mesh>

      {/* БОЛЬШОЙ НАСТЕННЫЙ СВИТОК «空手道» (КАРАТЭ-ДО) */}
      <group position={[0, 3.1, 0.05]}>
        {/* Шёлковое полотно свитка */}
        <mesh castShadow>
          <boxGeometry args={[1.1, 2.9, 0.02]} />
          <meshStandardMaterial color={scrollSilk} roughness={0.8} />
        </mesh>
        {/* Синий шёлковый кант сверху и снизу */}
        <mesh position={[0, 1.34, 0.015]}>
          <boxGeometry args={[1.12, 0.24, 0.024]} />
          <meshStandardMaterial color="#16273d" roughness={0.8} />
        </mesh>
        <mesh position={[0, -1.34, 0.015]}>
          <boxGeometry args={[1.12, 0.24, 0.024]} />
          <meshStandardMaterial color="#16273d" roughness={0.8} />
        </mesh>
        {/* Нижний круглый валик (дзикуги) */}
        <mesh position={[0, -1.48, 0.015]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.045, 0.045, 1.3, 16]} />
          <meshStandardMaterial color="#0d0d0d" roughness={0.3} />
        </mesh>

        {/* 1. Иероглиф 空 (Кара — Пустота/Дух) */}
        <group position={[0, 0.82, 0.018]}>
          <mesh position={[0, 0.2, 0]}><boxGeometry args={[0.06, 0.13, 0.006]} /><meshStandardMaterial color="#080808" /></mesh>
          <mesh position={[0, 0.13, 0]}><boxGeometry args={[0.54, 0.065, 0.006]} /><meshStandardMaterial color="#080808" /></mesh>
          <mesh position={[-0.22, 0.04, 0]}><boxGeometry args={[0.06, 0.13, 0.006]} /><meshStandardMaterial color="#080808" /></mesh>
          <mesh position={[0.22, 0.03, 0]}><boxGeometry args={[0.06, 0.14, 0.006]} /><meshStandardMaterial color="#080808" /></mesh>
          <mesh position={[0, -0.08, 0]}><boxGeometry args={[0.38, 0.06, 0.006]} /><meshStandardMaterial color="#080808" /></mesh>
          <mesh position={[0, -0.18, 0]}><boxGeometry args={[0.065, 0.18, 0.006]} /><meshStandardMaterial color="#080808" /></mesh>
          <mesh position={[0, -0.27, 0]}><boxGeometry args={[0.45, 0.065, 0.006]} /><meshStandardMaterial color="#080808" /></mesh>
        </group>

        {/* 2. Иероглиф 手 (Тэ — Рука) */}
        <group position={[0, 0.05, 0.018]}>
          <mesh position={[0, 0.22, 0]}><boxGeometry args={[0.42, 0.06, 0.006]} /><meshStandardMaterial color="#080808" /></mesh>
          <mesh position={[0, 0.06, 0]}><boxGeometry args={[0.52, 0.062, 0.006]} /><meshStandardMaterial color="#080808" /></mesh>
          <mesh position={[0.03, -0.09, 0]}><boxGeometry args={[0.07, 0.44, 0.006]} /><meshStandardMaterial color="#080808" /></mesh>
          <mesh position={[-0.07, -0.27, 0]} rotation={[0, 0, 0.45]}>
            <boxGeometry args={[0.15, 0.06, 0.006]} />
            <meshStandardMaterial color="#080808" />
          </mesh>
        </group>

        {/* 3. Иероглиф 道 (До — Путь) */}
        <group position={[0, -0.74, 0.018]}>
          <mesh position={[0.06, 0.2, 0]}><boxGeometry args={[0.34, 0.055, 0.006]} /><meshStandardMaterial color="#080808" /></mesh>
          <mesh position={[0.06, 0.08, 0]}><boxGeometry args={[0.32, 0.16, 0.006]} /><meshStandardMaterial color="#080808" /></mesh>
          <mesh position={[-0.18, 0.14, 0]}><boxGeometry args={[0.075, 0.08, 0.006]} /><meshStandardMaterial color="#080808" /></mesh>
          <mesh position={[-0.2, -0.03, 0]}><boxGeometry args={[0.07, 0.24, 0.006]} /><meshStandardMaterial color="#080808" /></mesh>
          <mesh position={[0, -0.19, 0]}><boxGeometry args={[0.54, 0.07, 0.006]} /><meshStandardMaterial color="#080808" /></mesh>
        </group>

        {/* Красная квадратная печать Ханко */}
        <mesh position={[0.26, -1.04, 0.018]}>
          <boxGeometry args={[0.1, 0.1, 0.008]} />
          <meshStandardMaterial color="#b91c1c" roughness={0.4} />
        </mesh>
      </group>

      {/* Подставка для меча (Катанакакэ) и тренировочный меч Боккэн */}
      <group position={[0, 0.42, 0.45]}>
        <mesh castShadow>
          <boxGeometry args={[0.9, 0.06, 0.24]} />
          <meshStandardMaterial color="#111111" roughness={0.3} />
        </mesh>
        <mesh position={[-0.3, 0.14, 0]} castShadow>
          <boxGeometry args={[0.04, 0.26, 0.08]} />
          <meshStandardMaterial color="#111111" roughness={0.3} />
        </mesh>
        <mesh position={[0.3, 0.14, 0]} castShadow>
          <boxGeometry args={[0.04, 0.26, 0.08]} />
          <meshStandardMaterial color="#111111" roughness={0.3} />
        </mesh>
        {/* Деревянный боккэн */}
        <mesh position={[0, 0.22, 0]} rotation={[0, 0, -0.02]} castShadow>
          <cylinderGeometry args={[0.022, 0.026, 1.15, 8]} rotation={[0, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#7a4421" roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
}

// Напольный деревянный фонарь Андон
function BigAndonLantern({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[0.42, 1.2, 0.42]} />
        <meshStandardMaterial
          color="#fff6e5"
          roughness={0.9}
          emissive="#ffe2b0"
          emissiveIntensity={0.5}
        />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[0.5, 0.06, 0.5]} />
        <meshStandardMaterial color="#24140c" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.23, 0]}>
        <boxGeometry args={[0.5, 0.06, 0.5]} />
        <meshStandardMaterial color="#24140c" roughness={0.7} />
      </mesh>
      <pointLight position={[0, 0.7, 0]} intensity={1.1} color="#ffbe6b" distance={7} decay={2} />
    </group>
  );
}

export default function TraditionalDojo() {
  return (
    <group>
      {/* ================= ПОЛ ДОДЗЁ НА УРОВНЕ Y = 0.0 ================= */}
      {/* 1. Общий полированный деревянный пол зала из кипариса Хиноки (18 x 18 метров) */}
      <mesh position={[0, -0.06, 0]} receiveShadow>
        <boxGeometry args={[18, 0.12, 18]} />
        <meshStandardMaterial color="#945f37" roughness={0.35} metalness={0.05} />
      </mesh>

      {/* 2. Центральная зона татами (10 x 10 метров) — поверхность ровно Y = 0.00! */}
      <mesh position={[0, -0.001, 0]} receiveShadow>
        <boxGeometry args={[10, 0.002, 10]} />
        <meshStandardMaterial color="#826645" roughness={0.65} />
      </mesh>

      {/* Тёмно-коричневая тканевая окантовка татами (хэри) */}
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[4.88, 5.0, 4]} rotation={[0, 0, Math.PI / 4]} />
        <meshStandardMaterial color="#1a140f" roughness={0.8} />
      </mesh>

      {/* Золотистый круг Эмбусэн в центре пола */}
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.65, 32]} />
        <meshStandardMaterial color="#c59b27" metalness={0.6} roughness={0.3} opacity={0.3} transparent />
      </mesh>

      {/* ================= СТЕНЫ ДОДЗЁ (ОТОДВИНУТЫ НА 9 МЕТРОВ) ================= */}
      {/* Главная стена (Камидза) */}
      <GrandKamiza position={[0, 0, -8.8]} />
      <ShojiWall width={6.2} height={5.0} position={[-5.8, 0, -8.8]} />
      <ShojiWall width={6.2} height={5.0} position={[5.8, 0, -8.8]} />

      {/* Левая стена Сёдзи */}
      <ShojiWall width={6.0} height={5.0} position={[-8.9, 0, -5.8]} rotation={[0, Math.PI / 2, 0]} />
      <ShojiWall width={6.0} height={5.0} position={[-8.9, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
      <ShojiWall width={6.0} height={5.0} position={[-8.9, 0, 5.8]} rotation={[0, Math.PI / 2, 0]} />

      {/* Правая стена Сёдзи */}
      <ShojiWall width={6.0} height={5.0} position={[8.9, 0, -5.8]} rotation={[0, -Math.PI / 2, 0]} />
      <ShojiWall width={6.0} height={5.0} position={[8.9, 0, 0]} rotation={[0, -Math.PI / 2, 0]} />
      <ShojiWall width={6.0} height={5.0} position={[8.9, 0, 5.8]} rotation={[0, -Math.PI / 2, 0]} />

      {/* ================= ПОТОЛОЧНЫЕ БАЛКИ ================= */}
      {[-6.0, -3.0, 0, 3.0, 6.0].map((z, idx) => (
        <mesh key={`beam-${idx}`} position={[0, 5.2, z]} castShadow>
          <boxGeometry args={[18.2, 0.26, 0.32]} />
          <meshStandardMaterial color="#21130b" roughness={0.7} />
        </mesh>
      ))}

      {/* ================= ФОНАРИ АНДОН ================= */}
      <BigAndonLantern position={[-5.5, 0, -7.5]} />
      <BigAndonLantern position={[5.5, 0, -7.5]} />
      <BigAndonLantern position={[-7.5, 0, 5.5]} />
      <BigAndonLantern position={[7.5, 0, 5.5]} />
    </group>
  );
}
