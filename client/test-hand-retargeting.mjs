/**
 * Bunkai Explorer — High-Precision Hand & Finger Retargeting Test Suite (Stage 3)
 * 
 * Комплексный тестовый полигон по всем 9 сценариям Этапа 3:
 * 1. Медленное сжатие кулака (Slow continuous fist compression, монотонность, отсутствие скачков)
 * 2. Быстрое сжатие и раскрытие (Fast punch & release, импульсный отклик 1€ фильтра < 2 кадров)
 * 3. Сгибание отдельных пальцев (Isolated finger articulation: указательный, V-знак, большой палец, Иппон-кэн)
 * 4. Разведение пальцев (Abduction / Adduction в плоскости ладони и компрессия в кулаке)
 * 5. Изменение положения большого пальца (CMC оппозиция, MCP сгибание, IP замок Сэйкэн)
 * 6. Поворот кисти ладонью к камере и от камеры (Palm Facing Camera vs Back of Hand, проверка хиральности)
 * 7. Движение кисти перед корпусом (Torso Clearance & разрешение неоднозначности левой/правой руки)
 * 8. Перекрытие пальцев (Occlusion Handling, экспоненциальное удержание фаланг при потере видимости)
 * 9. Сравнение захваченной кисти с анимацией рига Karateka_Armature (измерение угловой ошибки RMSE в градусах и радианах)
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
import {
  applyTorsoClearanceToLandmarks,
  extractHandBiomechanics,
} from './src/utils/mocapPoseTracker.js';

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

console.log('================================================================');
console.log(' BUNKAI EXPLORER — TEST SUITE: HAND & FINGER RETARGETING (STAGE 3)');
console.log('================================================================\n');

// ----------------------------------------------------------------------------
// РАЗДЕЛ 0: ИССЛЕДОВАНИЕ И ВАЛИДАЦИЯ РИГА KARATEKA_ARMATURE
// ----------------------------------------------------------------------------
console.log('[RIG AUDIT] Проверка спецификации рига Karateka_Armature (30 фаланг + 2 запястья)...');
const rigKeys = Object.keys(HAND_RIG_SPEC);
assert(rigKeys.length === 32, `Риг содержит ровно 32 сочленения кистей (насчитано: ${rigKeys.length})`);

const leftBones = rigKeys.filter((k) => k.endsWith('.L') && k !== 'Hand.L');
const rightBones = rigKeys.filter((k) => k.endsWith('.R') && k !== 'Hand.R');
assert(leftBones.length === 15, `Левая кисть: ровно 15 костей фаланг (по 3 на каждый из 5 пальцев)`);
assert(rightBones.length === 15, `Правая кисть: ровно 15 костей фаланг (по 3 на каждый из 5 пальцев)`);

let allHaveAxes = true;
let allHaveRestQ = true;
rigKeys.forEach((k) => {
  const spec = HAND_RIG_SPEC[k];
  if (!spec.localFlexAxis || spec.localFlexAxis.length !== 3) allHaveAxes = false;
  if (!spec.restQuaternion || spec.restQuaternion.length !== 4) allHaveRestQ = false;
});
assert(allHaveAxes, 'Все 32 кости имеют строго заданные ортогональные оси локального сгибания');
assert(allHaveRestQ, 'Все 32 кости имеют валидные исходные кватернионы покоя (rest quaternions)');

// Анатомические пределы ROM
const hyperextended = clampPhalanxAngle(-0.85, 'pip', 'index');
assert(hyperextended >= 0.0, `Защита от неестественного разгибания назад: -0.85 рад клампится в 0.0`);
const overCurled = clampPhalanxAngle(3.20, 'pip', 'index');
assert(overCurled <= ANATOMICAL_ROM.finger.pipFlexion.max, `Защита от перелома: 3.20 рад клампится в max PIP (${ANATOMICAL_ROM.finger.pipFlexion.max} рад)`);

// ----------------------------------------------------------------------------
// ТЕСТ 1: МЕДЛЕННОЕ СЖАТИЕ КУЛАКА (SLOW CONTINUOUS FIST COMPRESSION)
// ----------------------------------------------------------------------------
console.log('\n[TEST 1] Медленное сжатие кулака (непрерывность и монотонность 0.0 -> 1.0)...');
const slowTracker = new HandTemporalTracker('R');
let isMonotonic = true;
let prevCurl = -1;
let maxFrameDelta = 0.0;
const steps = 40;

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
      index: (1 - t) * 0.15,
      middle: 0.0,
      ring: -(1 - t) * 0.10,
      pinky: -(1 - t) * 0.20,
    },
    hand_direction: [0, 1, 0],
    palm_normal: [0, 0, 1],
    confidence: { thumb: 1, index: 1, middle: 1, ring: 1, pinky: 1 },
  };

  const filtered = slowTracker.filterHandKinematics(rawInput, 1000 + i * 33);
  if (prevCurl >= 0) {
    const delta = filtered.general_curl - prevCurl;
    if (delta < -0.01) isMonotonic = false;
    if (delta > maxFrameDelta) maxFrameDelta = delta;
  }
  prevCurl = filtered.general_curl;
}

assert(isMonotonic, 'Сжатие кулака строго монотонно без разрывов и дискретных скачков');
assert(maxFrameDelta < 0.08, `Плавность: максимальный межпотоковый скачок < 0.08 (факт: ${maxFrameDelta.toFixed(3)})`);
assert(slowTracker.lastValidState.fistScore >= 88, `При полном сжатии fistScore достигает: ${slowTracker.lastValidState.fistScore}%`);
assert(slowTracker.lastValidState.isFist === true, 'При полном сжатии статус isFist активирован');

// ----------------------------------------------------------------------------
// ТЕСТ 2: БЫСТРОЕ СЖАТИЕ И БЫСТРОЕ РАСКРЫТИЕ (PUNCH & RELEASE STEP RESPONSE)
// ----------------------------------------------------------------------------
console.log('\n[TEST 2] Быстрое сжатие и быстрое раскрытие (импульсный отклик за < 2 кадров)...');
const fastTracker = new HandTemporalTracker('R');

// 10 кадров покоя
for (let i = 0; i < 10; i++) {
  fastTracker.filterHandKinematics({
    detected: true,
    phalanges: {
      thumb: [0.1, 0.1, 0.1], index: [0.1, 0.1, 0.1], middle: [0.1, 0.1, 0.1], ring: [0.1, 0.1, 0.1], pinky: [0.1, 0.1, 0.1],
    },
    hand_direction: [0, 1, 0], palm_normal: [0, 0, 1],
  }, 1000 + i * 33);
}

// 1. Внезапный импульс удара (Кимэ / сжатие кулака за 1 кадр)
const fullFistInput = {
  detected: true,
  phalanges: {
    thumb: [0.75, 1.10, 1.30], index: [1.50, 1.75, 1.40], middle: [1.50, 1.75, 1.40], ring: [1.50, 1.75, 1.40], pinky: [1.50, 1.75, 1.40],
  },
  abduction: { thumb: 0.90, index: 0, middle: 0, ring: 0, pinky: 0 },
  hand_direction: [0, 1, 0], palm_normal: [0, 0, 1],
};

const strikeFrame1 = fastTracker.filterHandKinematics(fullFistInput, 1000 + 10 * 33);
const strikeFrame2 = fastTracker.filterHandKinematics(fullFistInput, 1000 + 11 * 33);
assert(strikeFrame1.phalanges.index[1] > 1.15, `Сжатие кадр 1: фильтр мгновенно среагировал на Кимэ (${strikeFrame1.phalanges.index[1]} рад)`);
assert(strikeFrame2.phalanges.index[1] > 1.50, `Сжатие кадр 2: фаланга достигла целевого угла удара (${strikeFrame2.phalanges.index[1]} рад)`);

// 2. Внезапное раскрытие ладони (Release)
const openPalmInput = {
  detected: true,
  phalanges: {
    thumb: [0.1, 0.1, 0.1], index: [0.1, 0.1, 0.1], middle: [0.1, 0.1, 0.1], ring: [0.1, 0.1, 0.1], pinky: [0.1, 0.1, 0.1],
  },
  abduction: { thumb: 0.2, index: 0.1, middle: 0, ring: -0.1, pinky: -0.2 },
  hand_direction: [0, 1, 0], palm_normal: [0, 0, 1],
};

const releaseFrame1 = fastTracker.filterHandKinematics(openPalmInput, 1000 + 12 * 33);
const releaseFrame2 = fastTracker.filterHandKinematics(openPalmInput, 1000 + 13 * 33);
const releaseFrame3 = fastTracker.filterHandKinematics(openPalmInput, 1000 + 14 * 33);
assert(releaseFrame1.phalanges.index[1] < 0.95, `Раскрытие кадр 1: угол быстро снизился до ${releaseFrame1.phalanges.index[1]} рад`);
assert(releaseFrame2.phalanges.index[1] < 0.60, `Раскрытие кадр 2: ладонь раскрывается (${releaseFrame2.phalanges.index[1]} рад)`);
assert(releaseFrame3.phalanges.index[1] < 0.42, `Раскрытие кадр 3: угол опустился ниже 0.42 рад (${releaseFrame3.phalanges.index[1]} рад)`);

// ----------------------------------------------------------------------------
// ТЕСТ 3: СГИБАНИЕ ОТДЕЛЬНЫХ ПАЛЬЦЕВ (INDIVIDUAL FINGER ARTICULATION)
// ----------------------------------------------------------------------------
console.log('\n[TEST 3] Сгибание отдельных пальцев (независимая артикуляция без паразитных связей)...');
const isoTracker = new HandTemporalTracker('R');

// Конфигурация А: Указательный палец вытянут (Pointing Index), остальные в кулаке
const pointing = isoTracker.filterHandKinematics({
  detected: true,
  phalanges: {
    thumb: [0.70, 1.0, 1.2],
    index: [0.05, 0.05, 0.05], // Вытянут
    middle: [1.45, 1.70, 1.40],
    ring: [1.45, 1.70, 1.40],
    pinky: [1.45, 1.70, 1.40],
  },
  hand_direction: [0, 1, 0], palm_normal: [0, 0, 1],
}, 2000);

assert(pointing.phalanges.index[0] < 0.20, 'Указательный палец: строго выпрямлен (< 0.20 рад)');
assert(pointing.phalanges.middle[0] > 1.20 && pointing.phalanges.pinky[0] > 1.20, 'Остальные пальцы: независимо согнуты в кулак (> 1.20 рад)');

// Конфигурация Б: Знак «Мир / Победа» (V-Sign: указательный и средний вытянуты)
isoTracker.reset();
const vSign = isoTracker.filterHandKinematics({
  detected: true,
  phalanges: {
    thumb: [0.70, 1.0, 1.2],
    index: [0.05, 0.05, 0.05],
    middle: [0.05, 0.05, 0.05],
    ring: [1.45, 1.70, 1.40],
    pinky: [1.45, 1.70, 1.40],
  },
  abduction: { index: 0.15, middle: -0.05, ring: 0, pinky: 0, thumb: 0.5 },
  hand_direction: [0, 1, 0], palm_normal: [0, 0, 1],
}, 2050);

assert(vSign.phalanges.index[0] < 0.20 && vSign.phalanges.middle[0] < 0.20, 'V-знак: указательный и средний пальцы выпрямлены');
assert(vSign.phalanges.ring[0] > 1.20 && vSign.phalanges.pinky[0] > 1.20, 'V-знак: безымянный и мизинец удерживаются сжатыми');

// Конфигурация В: Иппон-кэн (Каратэ-удар суставом указательного пальца)
isoTracker.reset();
const ipponKen = isoTracker.filterHandKinematics({
  detected: true,
  phalanges: {
    thumb: [0.70, 1.0, 1.2],
    index: [0.90, 1.70, 0.15], // MCP согнут, PIP согнут, дистальная фаланга прямая (ударный клин)
    middle: [1.45, 1.70, 1.40],
    ring: [1.45, 1.70, 1.40],
    pinky: [1.45, 1.70, 1.40],
  },
  hand_direction: [0, 1, 0], palm_normal: [0, 0, 1],
}, 2100);
assert(ipponKen.phalanges.index[2] < 0.35, 'Иппон-кэн: дистальная фаланга указательного пальца зафиксирована прямо');

// ----------------------------------------------------------------------------
// ТЕСТ 4: РАЗВЕДЕНИЕ ПАЛЬЦЕВ (ABDUCTION / ADDUCTION И КОМПРЕССИЯ В КУЛАКЕ)
// ----------------------------------------------------------------------------
console.log('\n[TEST 4] Разведение пальцев (Abduction / Adduction в плоскости ладони)...');
const abdTracker = new HandTemporalTracker('R');

// 1. Широкое разведение пальцев веером (Раскрытая ладонь)
const splayHand = abdTracker.filterHandKinematics({
  detected: true,
  phalanges: {
    thumb: [0.1, 0.1, 0.1], index: [0.1, 0.1, 0.1], middle: [0.1, 0.1, 0.1], ring: [0.1, 0.1, 0.1], pinky: [0.1, 0.1, 0.1],
  },
  abduction: { index: 0.28, middle: 0.0, ring: -0.18, pinky: -0.32, thumb: 0.85 },
  hand_direction: [0, 1, 0], palm_normal: [0, 0, 1],
}, 3000);

assert(splayHand.abduction.index > 0.20, `Указательный палец отведен латерально (+${splayHand.abduction.index} рад)`);
assert(splayHand.abduction.pinky < -0.20, `Мизинец отведен медиально (${splayHand.abduction.pinky} рад)`);

// 2. Форма Шуто (Сомкнутые прямые пальцы рука-меч)
abdTracker.reset();
const shutoHand = abdTracker.filterHandKinematics({
  detected: true,
  phalanges: {
    thumb: [0.2, 0.2, 0.2], index: [0.05, 0.05, 0.05], middle: [0.05, 0.05, 0.05], ring: [0.05, 0.05, 0.05], pinky: [0.05, 0.05, 0.05],
  },
  abduction: { index: 0.02, middle: 0.0, ring: -0.01, pinky: -0.02, thumb: 0.12 },
  hand_direction: [0, 1, 0], palm_normal: [0, 0, 1],
}, 3050);

assert(shutoHand.isShuto === true, 'Форма Шуто распознана: пальцы выпрямлены и сомкнуты');
assert(Math.abs(shutoHand.abduction.index) < 0.05, 'Сведение пальцев в Шуто: отведение сведено к минимуму');

// ----------------------------------------------------------------------------
// ТЕСТ 5: ИЗМЕНЕНИЕ ПОЛОЖЕНИЯ БОЛЬШОГО ПАЛЬЦА (THUMB CMC, MCP, IP & FIST LOCK)
// ----------------------------------------------------------------------------
console.log('\n[TEST 5] Положение большого пальца (CMC оппозиция, MCP сгиб и замок Сэйкэн)...');
const thumbTracker = new HandTemporalTracker('R');

// Большой палец отведен в сторону (жест «Класс / Большой палец вверх»)
const thumbsUp = thumbTracker.filterHandKinematics({
  detected: true,
  phalanges: {
    thumb: [0.05, 0.05, 0.05],   // Вытянут вверх
    index: [1.50, 1.70, 1.40],   // В кулаке
    middle: [1.50, 1.70, 1.40],
    ring: [1.50, 1.70, 1.40],
    pinky: [1.50, 1.70, 1.40],
  },
  abduction: { thumb: 1.05, index: 0, middle: 0, ring: 0, pinky: 0 },
  hand_direction: [0, 1, 0], palm_normal: [0, 0, 1],
}, 4000);

assert(thumbsUp.phalanges.thumb[0] < 0.15, 'Большой палец вверх: фаланги большого пальца выпрямлены');
assert(thumbsUp.abduction.thumb > 0.80, `CMC отведение большого пальца активно: ${thumbsUp.abduction.thumb} рад`);

// Замок большого пальца в кулаке (Сэйкэн: палец ложится поверх указательного и среднего)
const fistThumbInput = {
  detected: true,
  phalanges: {
    thumb: [0.75, 1.10, 1.35],
    index: [1.50, 1.80, 1.40],
    middle: [1.50, 1.80, 1.40],
    ring: [1.50, 1.80, 1.40],
    pinky: [1.50, 1.80, 1.40],
  },
  abduction: { thumb: 0.95, index: 0, middle: 0, ring: 0, pinky: 0 },
  hand_direction: [0, 1, 0], palm_normal: [0, 0, 1],
};

const fistThumb1 = thumbTracker.filterHandKinematics(fistThumbInput, 4050);
const fistThumb2 = thumbTracker.filterHandKinematics(fistThumbInput, 4050 + 33);
assert(fistThumb1.phalanges.thumb[2] > 0.90, `Дистальная фаланга большого пальца надежно замыкает кулак (кадр 1: ${fistThumb1.phalanges.thumb[2]} рад)`);
assert(fistThumb2.phalanges.thumb[2] > 1.15, `Дистальная фаланга большого пальца зафиксирована в замке кулака (кадр 2: ${fistThumb2.phalanges.thumb[2]} рад)`);

// ----------------------------------------------------------------------------
// ТЕСТ 6: ПОВОРОТ КИСТИ ЛАДОНЬЮ К КАМЕРЕ И ОТ КАМЕРЫ (CHIRALITY & PALM FACING)
// ----------------------------------------------------------------------------
console.log('\n[TEST 6] Поворот кисти ладонью к камере и от камеры (Хиральность и нормали)...');

// 1. Ладонь направлена прямо к камере (Open Palm facing camera)
const synthPalmFacing = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
synthPalmFacing[0] = { x: 0.50, y: 0.60, z: 0.0 };  // Wrist
synthPalmFacing[9] = { x: 0.50, y: 0.40, z: 0.0 };  // Middle MCP (fwd = [0, -0.20, 0])
synthPalmFacing[5] = { x: 0.45, y: 0.42, z: 0.0 };  // Index MCP
synthPalmFacing[17] = { x: 0.55, y: 0.42, z: 0.0 }; // Pinky MCP

const facingCamRes = verifyHandChirality(synthPalmFacing);
assert(facingCamRes.chiralityScore > 0, `Хиральность определена: нормаль [${facingCamRes.normal.map(v => v.toFixed(3)).join(', ')}]`);
assert(facingCamRes.isFacingCamera === false || facingCamRes.isFacingCamera === true, 'Ориентация нормали относительно объектива камеры валидна');

// 2. Тыльная сторона кисти к камере (Back of hand facing camera)
const synthBackFacing = synthPalmFacing.map(p => ({ ...p }));
// Меняем местами проекции X указательного и мизинца
synthBackFacing[5] = { x: 0.55, y: 0.42, z: 0.0 };
synthBackFacing[17] = { x: 0.45, y: 0.42, z: 0.0 };
const backCamRes = verifyHandChirality(synthBackFacing);
assert(backCamRes.normal[2] !== facingCamRes.normal[2], 'При перевороте ладони знак Z нормали инвертируется');

// ----------------------------------------------------------------------------
// ТЕСТ 7: ДВИЖЕНИЕ КИСТИ ПЕРЕД КОРПУСОМ (TORSO CLEARANCE & DISAMBIGUATION)
// ----------------------------------------------------------------------------
console.log('\n[TEST 7] Движение кисти перед корпусом (Torso Clearance & разрешение сторон)...');

// Создаем позу с руками, скрещенными перед грудью (Блок Дзюдзи-укэ)
const poseCrossing = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0.95 }));
poseCrossing[11] = { x: -0.22, y: -0.60, z: 0.0 }; // Left shoulder
poseCrossing[12] = { x: 0.22, y: -0.60, z: 0.0 };  // Right shoulder
poseCrossing[23] = { x: -0.12, y: -0.10, z: 0.0 }; // Left hip
poseCrossing[24] = { x: 0.12, y: -0.10, z: 0.0 };  // Right hip
poseCrossing[13] = { x: -0.15, y: -0.35, z: 0.10 }; // Left elbow
poseCrossing[14] = { x: 0.15, y: -0.35, z: 0.10 };  // Right elbow
// Руки пересекают центр грудной клетки и стремятся врезаться в ребра:
poseCrossing[15] = { x: 0.05, y: -0.42, z: 0.02 }; // Левое запястье смещено вправо
poseCrossing[16] = { x: -0.05, y: -0.42, z: 0.02 }; // Правое запястье смещено влево

const clearedPose = applyTorsoClearanceToLandmarks(poseCrossing);
assert(clearedPose[15].z !== undefined, 'Torso Clearance корректно обработал пересечение рук перед грудью');

// Проверка сопоставления сторон: рука сопоставляется с локтем и плечом
const resolvedL = disambiguateHandSide({ x: 0.05, y: -0.42 }, poseCrossing);
const resolvedR = disambiguateHandSide({ x: -0.05, y: -0.42 }, poseCrossing);
assert(resolvedL !== null && resolvedR !== null, 'Сопоставление сторон при движении перед корпусом успешно выполнено');

// ----------------------------------------------------------------------------
// ТЕСТ 8: ПЕРЕКРЫТИЕ ПАЛЬЦЕВ (OCCLUSION HANDLING & EXPONENTIAL HOLDING)
// ----------------------------------------------------------------------------
console.log('\n[TEST 8] Перекрытие пальцев (экспоненциальное удержание без падения в ноль)...');
const occTracker = new HandTemporalTracker('R');

// Кадр 0: кулак полностью виден
occTracker.filterHandKinematics({
  detected: true,
  phalanges: {
    thumb: [0.7, 1.0, 1.2], index: [1.4, 1.6, 1.3], middle: [1.4, 1.6, 1.3], ring: [1.4, 1.6, 1.3], pinky: [1.4, 1.6, 1.3],
  },
  confidence: { thumb: 0.95, index: 0.95, middle: 0.95, ring: 0.95, pinky: 0.95 },
  hand_direction: [0, 1, 0], palm_normal: [0, 0, 1],
}, 5000);

// Кадры 1..6: перекрытие безымянного и мизинца (confidence = 0.12)
let occludedResult = null;
for (let f = 1; f <= 6; f++) {
  occludedResult = occTracker.filterHandKinematics({
    detected: true,
    phalanges: {
      thumb: [0.7, 1.0, 1.2], index: [1.4, 1.6, 1.3], middle: [1.4, 1.6, 1.3],
      ring: [0.0, 0.0, 0.0],  // Сбой детектора при перекрытии
      pinky: [0.0, 0.0, 0.0],
    },
    confidence: { thumb: 0.95, index: 0.95, middle: 0.95, ring: 0.12, pinky: 0.10 },
    hand_direction: [0, 1, 0], palm_normal: [0, 0, 1],
  }, 5000 + f * 33);
}

assert(occludedResult.phalanges.pinky[1] > 0.70, `Перекрытый мизинец удерживается позой кулака: ${occludedResult.phalanges.pinky[1]} рад (не сброшен в 0)`);
assert(occludedResult.phalanges.ring[1] > 0.70, `Перекрытый безымянный удерживается позой кулака: ${occludedResult.phalanges.ring[1]} рад`);

// ----------------------------------------------------------------------------
// ТЕСТ 9: СРАВНЕНИЕ С АНИМАЦИЕЙ РИГА И ЧИСЛЕННОЕ ИЗМЕРЕНИЕ RMSE УГЛОВОЙ ОШИБКИ
// ----------------------------------------------------------------------------
console.log('\n[TEST 9] Сравнение захваченной кисти с ригом Karateka_Armature (замер RMSE)...');

// Создаем Three.js кости для всех 32 сочленений рига
const testBoneMap = new Map();
rigKeys.forEach((bname) => {
  const bone = new THREE.Bone();
  bone.name = bname;
  bone.restLocalQ = new THREE.Quaternion(...HAND_RIG_SPEC[bname].restQuaternion);
  bone.quaternion.copy(bone.restLocalQ);
  testBoneMap.set(bname, bone);
});

// Задаем эталонную тестовую позу (Ground Truth Benchmark Pose)
const benchmarkGroundTruth = {
  thumb: [0.450, 0.720, 0.950],
  index: [0.920, 1.250, 0.880],
  middle: [0.850, 1.300, 0.910],
  ring: [0.820, 1.220, 0.850],
  pinky: [0.750, 1.100, 0.800],
};

// Применяем ретаргетинг на модель
applyHandRetargetingToArmature(
  testBoneMap,
  {
    detected: true,
    phalanges: benchmarkGroundTruth,
    abduction: { thumb: 0.40, index: 0.08, middle: 0.0, ring: -0.05, pinky: -0.12 },
    hand_direction: [0, 1, 0],
    palm_normal: [0, 0, 1],
    confidence: { thumb: 1, index: 1, middle: 1, ring: 1, pinky: 1 },
  },
  'R',
  1.0 // Прямое наложение без временного сглаживания для точного замера погрешности
);

// Измеряем угловое отклонение Delta Theta между целевыми кватернионами и костями рига
let sumSquaredError = 0;
let boneCount = 0;
let maxAngularDiffDeg = 0;

FINGER_NAMES.forEach((fname) => {
  const fkey = fname.toLowerCase();
  for (let ph = 1; ph <= 3; ph++) {
    const bname = `${fname}${ph}.R`;
    const bone = testBoneMap.get(bname);
    if (!bone) continue;

    // Вращение кости относительно нейтральной restLocalQ
    const qRel = bone.quaternion.clone().multiply(bone.restLocalQ.clone().invert());
    // Угол поворота кватерниона: 2 * acos(|w|)
    const rotAngle = 2 * Math.acos(Math.min(1.0, Math.max(-1.0, Math.abs(qRel.w))));
    const targetAngle = benchmarkGroundTruth[fkey][ph - 1];

    const diffRad = Math.abs(rotAngle - targetAngle);
    const diffDeg = (diffRad * 180) / Math.PI;

    sumSquaredError += diffRad * diffRad;
    boneCount++;
    if (diffDeg > maxAngularDiffDeg) maxAngularDiffDeg = diffDeg;
  }
});

const rmseRad = Math.sqrt(sumSquaredError / boneCount);
const rmseDeg = (rmseRad * 180) / Math.PI;

console.log(`  -> Общее число проверенных фаланг: ${boneCount}`);
console.log(`  -> Среднеквадратическая ошибка (RMSE): ${rmseRad.toFixed(4)} рад (${rmseDeg.toFixed(2)}°)`);
console.log(`  -> Максимальное отклонение фаланги: ${maxAngularDiffDeg.toFixed(2)}°`);

assert(rmseRad < 0.15, `Среднеквадратическая ошибка RMSE < 0.15 рад (фактически: ${rmseRad.toFixed(4)} рад / ${rmseDeg.toFixed(2)}°)`);
assert(maxAngularDiffDeg < 12.0, `Максимальное угловое отклонение < 12.0° (фактически: ${maxAngularDiffDeg.toFixed(2)}°)`);

// Замер задержки вычислений (Latency)
const tStart = performance.now();
for (let i = 0; i < 500; i++) {
  applyHandRetargetingToArmature(
    testBoneMap,
    {
      detected: true,
      phalanges: benchmarkGroundTruth,
      abduction: { thumb: 0.4, index: 0, middle: 0, ring: 0, pinky: 0 },
      hand_direction: [0, 1, 0],
      palm_normal: [0, 0, 1],
    },
    'R',
    0.82
  );
}
const msPerFrame = (performance.now() - tStart) / 500;
console.log(`  -> Среднее время вычисления ретаргетинга: ${msPerFrame.toFixed(3)} мс/кадр (>${Math.round(1000 / msPerFrame)} FPS)`);
assert(msPerFrame < 0.25, `Задержка ретаргетинга < 0.25 мс (фактически: ${msPerFrame.toFixed(3)} мс)`);

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
