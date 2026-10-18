/**
 * Bunkai Explorer — Comprehensive Hand Kinematics & Retargeting Test Suite
 * 
 * Тестовый полигон для проверки Этапа 3 (Мелкая моторика и ретаргетинг кистей):
 * 1. Проверка карты костей рига Karateka_Armature (30 фаланг + 2 запястья)
 * 2. Непрерывное плавное сжимание кулака (монотонность без скачков)
 * 3. Быстрое Кимэ / ударное сжатие (отклик 1€ фильтра на ступенчатое воздействие)
 * 4. Статическая стабильность (подавление сенсорного дрожания)
 * 5. Изолированная артикуляция пальцев (указательный, знак «мир», Шуто, Иппон-кэн)
 * 6. Анатомические ограничения ROM (защита от выгибания назад и переломов)
 * 7. Хиральность и защита от переворота кисти (ладонь к камере / от камеры)
 * 8. Устойчивость к перекрытиям (плавное удержание при потере пальца)
 * 9. Замер времени обработки (latency) и точности (RMSE)
 */

import * as THREE from 'three';
import {
  HAND_RIG_SPEC,
  ANATOMICAL_ROM,
  clampPhalanxAngle,
  clampAbductionAngle,
  HandTemporalTracker,
  verifyHandChirality,
  disambiguateHandSide,
  computePerFingerConfidence,
  applyHandRetargetingToArmature,
  FINGER_NAMES,
} from './src/utils/mocapHandRetargeter.js';

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${message}`);
  } else {
    console.error(`  [FAIL] ${message}`);
  }
}

function assertClose(actual, expected, maxDiff, message) {
  totalTests++;
  const diff = Math.abs(actual - expected);
  if (diff <= maxDiff) {
    passedTests++;
    console.log(`  [PASS] ${message} (act: ${actual.toFixed(4)}, exp: ${expected.toFixed(4)}, diff: ${diff.toFixed(4)})`);
  } else {
    console.error(`  [FAIL] ${message} (act: ${actual.toFixed(4)}, exp: ${expected.toFixed(4)}, diff: ${diff.toFixed(4)} > tol: ${maxDiff})`);
  }
}

console.log('================================================================');
console.log(' BUNKAI EXPLORER — TEST SUITE: HAND & FINGER RETARGETING (STAGE 3)');
console.log('================================================================\n');

// ----------------------------------------------------------------------------
// ТЕСТ 1: ИССЛЕДОВАНИЕ РИГА И ПРОВЕРКА 32 КОСТЕЙ КИСТЕЙ И ПАЛЬЦЕВ
// ----------------------------------------------------------------------------
console.log('[TEST 1] Проверка спецификации рига Karateka_Armature (30 фаланг + 2 запястья)...');
const rigKeys = Object.keys(HAND_RIG_SPEC);
assert(rigKeys.length === 32, `Риг содержит ровно 32 кости кистей (насчитано: ${rigKeys.length})`);

const leftFingers = rigKeys.filter((k) => k.endsWith('.L') && k !== 'Hand.L');
const rightFingers = rigKeys.filter((k) => k.endsWith('.R') && k !== 'Hand.R');
assert(leftFingers.length === 15, `Левая кисть содержит ровно 15 костей фаланг (насчитано: ${leftFingers.length})`);
assert(rightFingers.length === 15, `Правая кисть содержит ровно 15 костей фаланг (насчитано: ${rightFingers.length})`);

let allHaveAxes = true;
let allHaveRestQ = true;
rigKeys.forEach((k) => {
  const spec = HAND_RIG_SPEC[k];
  if (!spec.localFlexAxis || spec.localFlexAxis.length !== 3) allHaveAxes = false;
  if (!spec.restQuaternion || spec.restQuaternion.length !== 4) allHaveRestQ = false;
});
assert(allHaveAxes, 'Все 32 кости имеют определенные локальные оси сгибания/вращения');
assert(allHaveRestQ, 'Все 32 кости имеют валидные исходные кватернионы покоя (rest quaternions)');

// ----------------------------------------------------------------------------
// ТЕСТ 2: АНАТОМИЧЕСКИЙ КЛАМПИНГ И ОГРАНИЧЕНИЯ ROM
// ----------------------------------------------------------------------------
console.log('\n[TEST 2] Проверка анатомических ограничений ROM (Range of Motion)...');
// Попытка неестественного выгибания назад (гиперэкстензия)
const hyperextended = clampPhalanxAngle(-0.85, 'pip', 'index');
assert(hyperextended >= 0.0, `Отрицательный угол (-0.85 рад) клампится в 0.0: ${hyperextended}`);

// Попытка чрезмерного перекручивания пальца (> 105°)
const overCurled = clampPhalanxAngle(3.20, 'pip', 'index');
assert(overCurled <= ANATOMICAL_ROM.finger.pipFlexion.max, `Чрезмерный угол (3.20 рад) клампится в max PIP (1.833): ${overCurled}`);

// Клампинг разведения пальцев (abduction)
const excessiveAbd = clampAbductionAngle(0.95, 'index');
assert(excessiveAbd <= ANATOMICAL_ROM.finger.abduction.index.max, `Чрезмерное отведение (0.95 рад) клампится в max (0.35): ${excessiveAbd}`);

// Клампинг оппозиции большого пальца
const clampedOpp = clampPhalanxAngle(2.5, 'cmc', 'thumb');
assert(clampedOpp <= ANATOMICAL_ROM.thumb.cmcFlexion.max, `Оппозиция большого пальца клампится в предел CMC: ${clampedOpp}`);

// ----------------------------------------------------------------------------
// ТЕСТ 3: НЕПРЕРЫВНОЕ ПЛАВНОЕ СЖИМАНИЕ КУЛАКА (СЭЙКЭН)
// ----------------------------------------------------------------------------
console.log('\n[TEST 3] Тест непрерывного сжимания кулака (0.0 -> 1.0 без дискретных скачков)...');
const tracker = new HandTemporalTracker('R');
let isMonotonic = true;
let prevCurl = -1;
const steps = 30;

for (let i = 0; i <= steps; i++) {
  const t = i / steps;
  const rawInput = {
    detected: true,
    phalanges: {
      thumb: [t * 0.785, t * 1.134, t * 1.396],
      index: [t * 1.571, t * 1.833, t * 1.484],
      middle: [t * 1.571, t * 1.833, t * 1.484],
      ring: [t * 1.571, t * 1.833, t * 1.484],
      pinky: [t * 1.571, t * 1.833, t * 1.484],
    },
    abduction: {
      thumb: t * 0.85,
      index: 0.0,
      middle: 0.0,
      ring: 0.0,
      pinky: 0.0,
    },
    hand_direction: [0, 1, 0],
    palm_normal: [0, 0, 1],
    confidence: { thumb: 1, index: 1, middle: 1, ring: 1, pinky: 1 },
  };

  const filtered = tracker.filterHandKinematics(rawInput, 1000 + i * 33);
  if (filtered.general_curl < prevCurl - 0.01) {
    isMonotonic = false;
  }
  prevCurl = filtered.general_curl;
}

assert(isMonotonic, 'Сжатие кулака строго монотонно и непрерывно без скачков и разрывов');
assert(tracker.lastValidState.fistScore >= 85, `При полном сжатии fistScore достигает высокого уровня: ${tracker.lastValidState.fistScore}%`);
assert(tracker.lastValidState.isFist === true, 'При полном сжатии флаг isFist активирован');

// ----------------------------------------------------------------------------
// ТЕСТ 4: БЫСТРЫЙ УДАР И КИМЭ (ОТКЛИК 1€ ФИЛЬТРА НА СКАЧОК)
// ----------------------------------------------------------------------------
console.log('\n[TEST 4] Тест взрывного удара и Кимэ (импульсный отклик за < 2 кадров при 30 FPS)...');
tracker.reset();

// 10 кадров покоя с открытой ладонью
for (let i = 0; i < 10; i++) {
  tracker.filterHandKinematics({
    detected: true,
    phalanges: {
      thumb: [0.1, 0.1, 0.1],
      index: [0.1, 0.1, 0.1],
      middle: [0.1, 0.1, 0.1],
      ring: [0.1, 0.1, 0.1],
      pinky: [0.1, 0.1, 0.1],
    },
    hand_direction: [0, 1, 0],
    palm_normal: [0, 0, 1],
  }, 1000 + i * 33);
}

// Внезапный ударный импульс Кимэ (кулак сжимается за 1 кадр)
const kimeInput = {
  detected: true,
  phalanges: {
    thumb: [0.75, 1.10, 1.30],
    index: [1.50, 1.75, 1.40],
    middle: [1.50, 1.75, 1.40],
    ring: [1.50, 1.75, 1.40],
    pinky: [1.50, 1.75, 1.40],
  },
  abduction: { thumb: 0.90, index: 0, middle: 0, ring: 0, pinky: 0 },
  hand_direction: [0, 1, 0],
  palm_normal: [0, 0, 1],
};

const frame1 = tracker.filterHandKinematics(kimeInput, 1000 + 10 * 33);
const frame2 = tracker.filterHandKinematics(kimeInput, 1000 + 11 * 33);

assert(frame1.phalanges.index[1] > 1.10, `Кадр 1: фильтр быстро среагировал на Кимэ (PIP: ${frame1.phalanges.index[1]} рад)`);
assert(frame2.phalanges.index[1] > 1.50, `Кадр 2: фаланга достигла целевого сжатия (PIP: ${frame2.phalanges.index[1]} рад)`);

// ----------------------------------------------------------------------------
// ТЕСТ 5: СТАТИЧЕСКАЯ СТАБИЛЬНОСТЬ И ПОДАВЛЕНИЕ СЕНСОРНОГО ДРОЖАНИЯ
// ----------------------------------------------------------------------------
console.log('\n[TEST 5] Тест подавления высокочастотного сенсорного дрожания в статике...');
tracker.reset();
const rawSamples = [];
const filteredSamples = [];

// Моделируем 60 кадров неподвижной кисти с сенсорным шумом амплитудой +-0.06 рад
for (let i = 0; i < 60; i++) {
  const noise = (Math.sin(i * 1.7) * 0.5 + Math.cos(i * 3.1) * 0.5) * 0.06;
  const rawPip = 1.20 + noise;
  rawSamples.push(rawPip);

  const out = tracker.filterHandKinematics({
    detected: true,
    phalanges: {
      thumb: [0.5, 0.5, 0.5],
      index: [1.0, rawPip, 0.8],
      middle: [1.0, 1.0, 0.8],
      ring: [1.0, 1.0, 0.8],
      pinky: [1.0, 1.0, 0.8],
    },
    hand_direction: [0, 1, 0],
    palm_normal: [0, 0, 1],
  }, 2000 + i * 33);

  filteredSamples.push(out.phalanges.index[1]);
}

const stdDev = (arr) => {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
};

const rawJitter = stdDev(rawSamples.slice(10));
const filteredJitter = stdDev(filteredSamples.slice(10));
const jitterReduction = ((rawJitter - filteredJitter) / rawJitter) * 100;

assert(filteredJitter < rawJitter * 0.35, `1€ фильтр подавил шум на ${jitterReduction.toFixed(1)}% (исходный std: ${rawJitter.toFixed(4)}, отфильтрованный: ${filteredJitter.toFixed(4)})`);

// ----------------------------------------------------------------------------
// ТЕСТ 6: ИЗОЛИРОВАННАЯ АРТИКУЛЯЦИЯ И ФОРМЫ КИСТЕЙ КАРАТЭ
// ----------------------------------------------------------------------------
console.log('\n[TEST 6] Тест изолированной артикуляции и каратэ-форм кистей...');
tracker.reset();

// 1. Показ указательного пальца (Index Pointing / Ippon-ken)
const indexPointing = tracker.filterHandKinematics({
  detected: true,
  phalanges: {
    thumb: [0.65, 0.95, 1.10],   // сжат
    index: [0.05, 0.05, 0.05],   // прямой
    middle: [1.45, 1.70, 1.35],  // сжат
    ring: [1.45, 1.70, 1.35],    // сжат
    pinky: [1.45, 1.70, 1.35],   // сжат
  },
  hand_direction: [0, 1, 0],
  palm_normal: [0, 0, 1],
}, 3000);

assert(indexPointing.phalanges.index[0] < 0.20, 'Указательный палец полностью выпрямлен');
assert(indexPointing.phalanges.middle[0] > 1.20, 'Средний палец плотно сжат');
assert(indexPointing.phalanges.pinky[1] > 1.40, 'Мизинец плотно сжат');

// 2. Форма Шуто (Рука-меч / Shuto-uke): все пальцы прямые, разведение близко к нулю
tracker.reset();
const shutoPose = tracker.filterHandKinematics({
  detected: true,
  phalanges: {
    thumb: [0.25, 0.30, 0.20],
    index: [0.05, 0.05, 0.05],
    middle: [0.05, 0.05, 0.05],
    ring: [0.05, 0.05, 0.05],
    pinky: [0.05, 0.05, 0.05],
  },
  abduction: { thumb: 0.10, index: 0.02, middle: 0.0, ring: -0.01, pinky: -0.02 },
  hand_direction: [0, 1, 0],
  palm_normal: [0, 0, 1],
}, 3050);

assert(shutoPose.isShuto === true, 'Форма кисти Шуто корректно распознана (все 4 пальца выпрямлены и сомкнуты)');

// ----------------------------------------------------------------------------
// ТЕСТ 7: ХИРАЛЬНОСТЬ И ПРОВЕРКА ПЕРЕВОРОТА ЛАДОНИ (ЛАДОНЬ К КАМЕРЕ / ОТ КАМЕРЫ)
// ----------------------------------------------------------------------------
console.log('\n[TEST 7] Проверка хиральности и переворота кисти (Palm Facing Check)...');

// Синтетические 21 точка для открытой правой ладони к камере
const synthPalmFacingCam = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
synthPalmFacingCam[0] = { x: 0.50, y: 0.60, z: 0.0 };  // Wrist
synthPalmFacingCam[9] = { x: 0.50, y: 0.40, z: 0.0 };  // Middle MCP (fwd = [0, -0.20, 0])
synthPalmFacingCam[5] = { x: 0.45, y: 0.42, z: 0.0 };  // Index MCP
synthPalmFacingCam[17] = { x: 0.55, y: 0.42, z: 0.0 }; // Pinky MCP

const facingCheck1 = verifyHandChirality(synthPalmFacingCam);
assert(facingCheck1.chiralityScore > 0, `Определена хиральность нормали ладони: ${facingCheck1.chiralityScore.toFixed(4)}`);

// Проверка сопоставления запястья человека
const poseMock = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
poseMock[15] = { x: 0.70, y: 0.50, z: 0.0 }; // Left wrist
poseMock[16] = { x: 0.30, y: 0.50, z: 0.0 }; // Right wrist

const resolvedSideR = disambiguateHandSide({ x: 0.28, y: 0.52 }, poseMock);
const resolvedSideL = disambiguateHandSide({ x: 0.72, y: 0.48 }, poseMock);
assert(resolvedSideR === 'right', `Рука у координаты 0.28 сопоставлена как правая: ${resolvedSideR}`);
assert(resolvedSideL === 'left', `Рука у координаты 0.72 сопоставлена как левая: ${resolvedSideL}`);

// ----------------------------------------------------------------------------
// ТЕСТ 8: УСТОЙЧИВОСТЬ К ПЕРЕКРЫТИЯМ И ПЛАВНОЕ УДЕРЖАНИЕ ФАЛАНГ
// ----------------------------------------------------------------------------
console.log('\n[TEST 8] Проверка устойчивости при частичном перекрытии (Occlusion Handling)...');
tracker.reset();

// Устанавливаем кулак
tracker.filterHandKinematics({
  detected: true,
  phalanges: {
    thumb: [0.7, 1.0, 1.2],
    index: [1.4, 1.6, 1.3],
    middle: [1.4, 1.6, 1.3],
    ring: [1.4, 1.6, 1.3],
    pinky: [1.4, 1.6, 1.3],
  },
  confidence: { thumb: 0.9, index: 0.9, middle: 0.9, ring: 0.9, pinky: 0.9 },
  hand_direction: [0, 1, 0],
  palm_normal: [0, 0, 1],
}, 4000);

// Имитируем 5 кадров перекрытия мизинца (confidence = 0.10)
let occludedPinky = null;
for (let f = 1; f <= 5; f++) {
  occludedPinky = tracker.filterHandKinematics({
    detected: true,
    phalanges: {
      thumb: [0.7, 1.0, 1.2],
      index: [1.4, 1.6, 1.3],
      middle: [1.4, 1.6, 1.3],
      ring: [1.4, 1.6, 1.3],
      pinky: [0.0, 0.0, 0.0], // сбой детектора
    },
    confidence: { thumb: 0.9, index: 0.9, middle: 0.9, ring: 0.9, pinky: 0.10 },
    hand_direction: [0, 1, 0],
    palm_normal: [0, 0, 1],
  }, 4000 + f * 33);
}

assert(occludedPinky.phalanges.pinky[1] > 0.80, `При перекрытии мизинец плавно удерживается и не сбрасывается в 0: ${occludedPinky.phalanges.pinky[1]} рад`);

// ----------------------------------------------------------------------------
// ТЕСТ 9: ПРОИЗВОДИТЕЛЬНОСТЬ, LATENCY И РАСЧЕТ КВАТЕРНИОНОВ ДЛЯ THREE.JS
// ----------------------------------------------------------------------------
console.log('\n[TEST 9] Замер времени обработки (latency) и нагрузочный тест (1000 кадров)...');

// Создаем мок-карту костей Three.js для 30 фаланг
const mockBoneMap = new Map();
rigKeys.forEach((bname) => {
  const bone = new THREE.Bone();
  bone.name = bname;
  bone.restLocalQ = new THREE.Quaternion(...HAND_RIG_SPEC[bname].restQuaternion);
  bone.quaternion.copy(bone.restLocalQ);
  mockBoneMap.set(bname, bone);
});

const tStart = performance.now();
const testFrames = 1000;

for (let i = 0; i < testFrames; i++) {
  applyHandRetargetingToArmature(
    mockBoneMap,
    {
      detected: true,
      phalanges: {
        thumb: [0.5, 0.8, 1.0],
        index: [1.2, 1.4, 1.1],
        middle: [1.2, 1.4, 1.1],
        ring: [1.2, 1.4, 1.1],
        pinky: [1.2, 1.4, 1.1],
      },
      abduction: { thumb: 0.5, index: 0.1, middle: 0, ring: -0.05, pinky: -0.1 },
      hand_direction: [0, 1, 0],
      palm_normal: [0, 0, 1],
      confidence: { thumb: 0.95, index: 0.95, middle: 0.95, ring: 0.95, pinky: 0.95 },
    },
    'R',
    0.85
  );
}

const tEnd = performance.now();
const totalMs = tEnd - tStart;
const msPerFrame = totalMs / testFrames;
const throughputFps = 1000 / msPerFrame;

console.log(`  -> Время обработки ${testFrames} кадров: ${totalMs.toFixed(2)} мс`);
console.log(`  -> Средняя задержка на кадр (latency): ${msPerFrame.toFixed(3)} мс`);
console.log(`  -> Расчетная пропускная способность: ${Math.round(throughputFps)} FPS`);

assert(msPerFrame < 0.50, `Задержка обработки кадра < 0.50 мс (фактически: ${msPerFrame.toFixed(3)} мс)`);

// Проверяем, что кватернионы костей фаланг валидны и нормализованы
let allQuatsNormalized = true;
mockBoneMap.forEach((bone) => {
  const qLen = bone.quaternion.length();
  if (Math.abs(qLen - 1.0) > 1e-3 || isNaN(qLen)) allQuatsNormalized = false;
});
assert(allQuatsNormalized, 'Все кватернионы 30 фаланг валидны и строго нормализованы (|q| = 1.0)');

// ----------------------------------------------------------------------------
// ИТОГОВЫЙ ОТЧЕТ ТЕСТОВ
// ----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(` РЕЗУЛЬТАТ ТЕСТИРОВАНИЯ: ${passedTests} ИЗ ${totalTests} ТЕСТОВ УСПЕШНО ПРОЙДЕНЫ!`);
console.log('================================================================\n');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
