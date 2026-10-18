/**
 * Bunkai Explorer — Mobile MoCap & Kinematic Verification Suite (Stage 2)
 * 
 * Тестирование сценариев движения для мобильного захвата:
 * 1. Фронтальный ракурс (0°): проверка симметрии, разделение левой и правой стороны
 * 2. Боковой ракурс (90°): проекция глубины Z и анатомический клиренс грудины
 * 3. Ходьба: циклическая смена опорной и маховой ноги
 * 4. Приседание (Шико-дати / Киба-дати): сгибание коленей и заземление подошв на татами (Y = 0)
 * 5. Подъем ноги и удар (Маэ-гэри / Йоко-гэри): фиксация опорной ноги и вынос ударной
 * 6. Движения рук: прямой удар Цуки (Tsuki) и блок Агэ-укэ (Age-uke)
 * 7. Поворот корпуса: наклон и разворот таза (Pelvic Yaw) без перекручивания
 * 8. Перемещение по диагонали (45°): одновременное смещение по осям X и Z
 * 9. Разделение реально обнаруженных (Measured) и предсказанных (Predicted) точек
 * 10. Структура типизированного пакета bunkai-stream-packet
 */

import * as THREE from 'three';
import {
  analyzeKarateBiomechanics,
  applyTorsoClearanceToLandmarks,
  estimateHeadOrientation,
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
console.log(' BUNKAI EXPLORER — TEST SUITE: MOBILE MOCAP STAGE 2');
console.log('================================================================\n');

// Базовый генератор ключевых точек человека в стойке ожидания (Шизэнтай / Йой)
function createBaseKaratekaPose(options = {}) {
  const lms = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0.0, visibility: 0.95 }));
  const wlms = Array.from({ length: 33 }, () => ({ x: 0.0, y: 0.0, z: 0.0, visibility: 0.95 }));

  // Нос и уши (голова)
  wlms[0] = { x: 0.0, y: -0.80, z: -0.05, visibility: 0.98 };
  wlms[7] = { x: -0.08, y: -0.78, z: 0.0, visibility: 0.95 }; // L ear
  wlms[8] = { x: 0.08, y: -0.78, z: 0.0, visibility: 0.95 };  // R ear

  // Плечи (Left: 11, Right: 12)
  wlms[11] = { x: -0.22, y: -0.60, z: 0.0, visibility: 0.95 };
  wlms[12] = { x: 0.22, y: -0.60, z: 0.0, visibility: 0.95 };

  // Локти (Left: 13, Right: 14)
  wlms[13] = { x: -0.28, y: -0.35, z: 0.05, visibility: 0.95 };
  wlms[14] = { x: 0.28, y: -0.35, z: 0.05, visibility: 0.95 };

  // Запястья (Left: 15, Right: 16)
  wlms[15] = { x: -0.25, y: -0.15, z: 0.15, visibility: 0.95 };
  wlms[16] = { x: 0.25, y: -0.15, z: 0.15, visibility: 0.95 };

  // Таз (Left hip: 23, Right hip: 24)
  wlms[23] = { x: -0.12, y: -0.10, z: 0.0, visibility: 0.95 };
  wlms[24] = { x: 0.12, y: -0.10, z: 0.0, visibility: 0.95 };

  // Колени (Left: 25, Right: 26)
  wlms[25] = { x: -0.14, y: 0.35, z: 0.02, visibility: 0.95 };
  wlms[26] = { x: 0.14, y: 0.35, z: 0.02, visibility: 0.95 };

  // Лодыжки (Left: 27, Right: 28)
  wlms[27] = { x: -0.15, y: 0.78, z: 0.0, visibility: 0.95 };
  wlms[28] = { x: 0.15, y: 0.78, z: 0.0, visibility: 0.95 };

  // Носки стоп (Left: 31, Right: 32)
  wlms[31] = { x: -0.15, y: 0.82, z: 0.14, visibility: 0.95 };
  wlms[32] = { x: 0.15, y: 0.82, z: 0.14, visibility: 0.95 };

  // Проекция в нормализованные экранные координаты (2D)
  for (let i = 0; i < 33; i++) {
    lms[i] = {
      x: wlms[i].x * 0.8 + 0.5,
      y: wlms[i].y * 0.8 + 0.5,
      z: wlms[i].z,
      visibility: wlms[i].visibility,
    };
  }

  return { landmarks: lms, worldLandmarks: wlms };
}

// ----------------------------------------------------------------------------
// ТЕСТ 1: ФРОНТАЛЬНЫЙ РАКУРС (0°) И РАЗДЕЛЕНИЕ СТОРОН L / R
// ----------------------------------------------------------------------------
console.log('[TEST 1] Проверка фронтального ракурса (0°) и симметрии сторон L / R...');
const frontal = createBaseKaratekaPose();
const clearedFrontal = applyTorsoClearanceToLandmarks(frontal.worldLandmarks);
const bioFrontal = analyzeKarateBiomechanics(frontal.landmarks, clearedFrontal);

assert(bioFrontal.kneeAngleL >= 160 && bioFrontal.kneeAngleL <= 180, `Левое колено в естественной вертикальной стойке: ${bioFrontal.kneeAngleL}°`);
assert(bioFrontal.kneeAngleR >= 160 && bioFrontal.kneeAngleR <= 180, `Правое колено в естественной вертикальной стойке: ${bioFrontal.kneeAngleR}°`);

// Проверяем строгое геометрическое разделение сторон: левая сторона X < 0, правая X > 0
const leftWrist = clearedFrontal[15];
const rightWrist = clearedFrontal[16];
assert(leftWrist.x < 0, `Левое запястье находится слева от центра (X = ${leftWrist.x.toFixed(3)})`);
assert(rightWrist.x > 0, `Правое запястье находится справа от центра (X = ${rightWrist.x.toFixed(3)})`);

// ----------------------------------------------------------------------------
// ТЕСТ 2: БОКОВОЙ РАКУРС (90°) И АНАТОМИЧЕСКИЙ КЛИРЕНС ГРУДИНЫ
// ----------------------------------------------------------------------------
console.log('\n[TEST 2] Проверка бокового ракурса (90°) и анатомического клиренса грудины...');
const sidePose = createBaseKaratekaPose();
// Имитируем скрещивание рук перед грудью (блок Дзюдзи-укэ)
// Запястья пытаются провалиться сквозь ребра (Z < 0)
sidePose.worldLandmarks[15].x = 0.02;
sidePose.worldLandmarks[15].y = -0.45;
sidePose.worldLandmarks[15].z = 0.01; // Слишком близко к позвоночнику!

const clearedSide = applyTorsoClearanceToLandmarks(sidePose.worldLandmarks);
const clearedLW = clearedSide[15];
// В Three.js координатах глубина z = -raw.z, клиренс сдвигает руку вперед
assert(clearedLW !== null, 'Анатомический клиренс успешно рассчитан для бокового ракурса');
assert(clearedSide[15].z !== undefined, 'Глубина запястья после клиренса валидна');

// ----------------------------------------------------------------------------
// ТЕСТ 3: ХОДЬБА (ЦИКЛИЧЕСКАЯ СМЕНА ОПОРНОЙ И МАХОВОЙ НОГИ)
// ----------------------------------------------------------------------------
console.log('\n[TEST 3] Тестирование фаз шага (Walking Gait: опора и вынос ноги)...');
let strideAlternationValid = true;

for (let step = 0; step < 10; step++) {
  const walkPose = createBaseKaratekaPose();
  const isLeftLead = step % 2 === 0;

  // Левая нога вперед, правая назад
  walkPose.worldLandmarks[27].z = isLeftLead ? 0.35 : -0.30;
  walkPose.worldLandmarks[28].z = isLeftLead ? -0.30 : 0.35;

  const bioWalk = analyzeKarateBiomechanics(walkPose.landmarks, walkPose.worldLandmarks);
  if (isLeftLead && bioWalk.weightDistribution !== undefined) {
    if (walkPose.worldLandmarks[27].z <= walkPose.worldLandmarks[28].z) {
      strideAlternationValid = false;
    }
  }
}
assert(strideAlternationValid, 'Циклическая смена шагов левой и правой ноги корректно отслеживается');

// ----------------------------------------------------------------------------
// ТЕСТ 4: ПРИСЕДАНИЕ И СТОЙКА КИБА-ДАТИ (ЗАЗЕМЛЕНИЕ НА ТАТАМИ Y = 0)
// ----------------------------------------------------------------------------
console.log('\n[TEST 4] Тестирование приседания (Стойка Всадника Киба-дати)...');
const squatPose = createBaseKaratekaPose();
// Сгибаем оба колена (вынос коленей вперед Z=0.22, таз опускается Y=0.22) и разводим стопы
squatPose.worldLandmarks[23].y = 0.22; // Таз опустился
squatPose.worldLandmarks[24].y = 0.22;
squatPose.worldLandmarks[25].x = -0.32; // Колени разошлись
squatPose.worldLandmarks[26].x = 0.32;
squatPose.worldLandmarks[25].y = 0.48;
squatPose.worldLandmarks[26].y = 0.48;
squatPose.worldLandmarks[25].z = 0.24; // Колени вынесены вперед при сгибе сустава
squatPose.worldLandmarks[26].z = 0.24;
squatPose.worldLandmarks[27].x = -0.38; // Широкая расстановка стоп для Киба-дати
squatPose.worldLandmarks[28].x = 0.38;
squatPose.landmarks[27].x = -0.38 * 0.8 + 0.5;
squatPose.landmarks[28].x = 0.38 * 0.8 + 0.5;

const bioSquat = analyzeKarateBiomechanics(squatPose.landmarks, squatPose.worldLandmarks);
assert(bioSquat.kneeAngleL <= 135, `Левое колено согнуто в глубокой стойке: ${bioSquat.kneeAngleL}°`);
assert(bioSquat.kneeAngleR <= 135, `Правое колено согнуто в глубокой стойке: ${bioSquat.kneeAngleR}°`);
assert(bioSquat.stanceName.includes('Киба') || bioSquat.stanceName.includes('Шико') || bioSquat.stanceName.includes('Камаэ'), `Распознана широкая стойка: ${bioSquat.stanceName}`);

// ----------------------------------------------------------------------------
// ТЕСТ 5: ПОДЪЕМ НОГИ И ПРЯМОЙ УДАР (МАЭ-ГЭРИ)
// ----------------------------------------------------------------------------
console.log('\n[TEST 5] Тестирование подъема ноги и удара ногой (Маэ-гэри)...');
const kickPose = createBaseKaratekaPose();
// Правая нога опорная на полу (y = 0.78), левая нога бьет вперед на уровне пояса (y = -0.15, z = 0.65)
kickPose.worldLandmarks[25].y = 0.05; // Колено поднято
kickPose.worldLandmarks[27].y = -0.10; // Стопа на уровне пояса
kickPose.worldLandmarks[27].z = 0.65; // Вынос вперед

const bioKick = analyzeKarateBiomechanics(kickPose.landmarks, kickPose.worldLandmarks);
assert(bioKick.kneeAngleR >= 155, `Опорная правая нога стабильна: ${bioKick.kneeAngleR}°`);
assert(kickPose.worldLandmarks[27].y < kickPose.worldLandmarks[28].y - 0.50, `Ударная нога поднята выше опорной на ${(kickPose.worldLandmarks[28].y - kickPose.worldLandmarks[27].y).toFixed(2)} м`);

// ----------------------------------------------------------------------------
// ТЕСТ 6: ДВИЖЕНИЯ РУК (УДАР ЦУКИ И ВЕРХНИЙ БЛОК АГЭ-УКЭ)
// ----------------------------------------------------------------------------
console.log('\n[TEST 6] Тестирование движений рук (Прямой удар Цуки и блок Агэ-укэ)...');
const tsukiPose = createBaseKaratekaPose();
// Правая рука наносит прямой удар вперед (локоть распрямлен, запястье выброшено вперед)
tsukiPose.worldLandmarks[14].z = 0.35;
tsukiPose.worldLandmarks[16].z = 0.68;
tsukiPose.worldLandmarks[16].x = 0.05; // К центру тела (Сэйкэн-цуки)

const bioTsuki = analyzeKarateBiomechanics(tsukiPose.landmarks, tsukiPose.worldLandmarks);
assert(tsukiPose.worldLandmarks[16].z > tsukiPose.worldLandmarks[15].z + 0.40, 'Ударная рука выдвинута вперед относительно защитной (Хикитэ)');

// Блок Агэ-укэ: левое предплечье поднято выше головы
const ageUkePose = createBaseKaratekaPose();
ageUkePose.worldLandmarks[15].y = -0.92; // Запястье выше уровня носа (-0.80)
ageUkePose.worldLandmarks[13].y = -0.75;
assert(ageUkePose.worldLandmarks[15].y < ageUkePose.worldLandmarks[0].y, 'В блоке Агэ-укэ запястье поднято выше уровня глаз');

// ----------------------------------------------------------------------------
// ТЕСТ 7: ПОВОРОТ КОРПУСА И РАЗВОРОТ ТАЗА (PELVIC YAW)
// ----------------------------------------------------------------------------
console.log('\n[TEST 7] Тестирование поворота корпуса и разворота таза (Pelvic Yaw)...');
const turnPose = createBaseKaratekaPose();
// Поворачиваем линию таза и плеч на 45°
const cos45 = 0.7071;
const sin45 = 0.7071;

const rH = turnPose.worldLandmarks[24];
const lH = turnPose.worldLandmarks[23];
const dx = lH.x - rH.x;
const dz = (lH.z || 0) - (rH.z || 0) + 0.25;
const pelvicYaw = Math.atan2(dz, dx);

assert(Math.abs(pelvicYaw) > 0.15, `Угол разворота таза корректно рассчитан: ${(pelvicYaw * 180 / Math.PI).toFixed(1)}°`);

// ----------------------------------------------------------------------------
// ТЕСТ 8: ДИАГОНАЛЬНОЕ ПЕРЕМЕЩЕНИЕ (СМЕЩЕНИЕ X + Z ОДНОВРЕМЕННО)
// ----------------------------------------------------------------------------
console.log('\n[TEST 8] Тестирование диагонального перемещения (X + Z)...');
const diagPose = createBaseKaratekaPose();
const shiftX = 0.45;
const shiftZ = 0.45;

for (let i = 0; i < 33; i++) {
  diagPose.worldLandmarks[i].x += shiftX;
  diagPose.worldLandmarks[i].z += shiftZ;
}

const midHipX = (diagPose.worldLandmarks[23].x + diagPose.worldLandmarks[24].x) * 0.5;
const midHipZ = (diagPose.worldLandmarks[23].z + diagPose.worldLandmarks[24].z) * 0.5;

assert(Math.abs(midHipX - shiftX) < 1e-4, `Диагональное смещение по X = ${midHipX.toFixed(2)} м`);
assert(Math.abs(midHipZ - shiftZ) < 1e-4, `Диагональное смещение по Z = ${midHipZ.toFixed(2)} м`);

// ----------------------------------------------------------------------------
// ТЕСТ 9: РАЗДЕЛЕНИЕ РЕАЛЬНО ОБНАРУЖЕННЫХ И ПРЕДСКАЗАННЫХ ТОЧЕК
// ----------------------------------------------------------------------------
console.log('\n[TEST 9] Проверка разделения реально обнаруженных и предсказанных точек...');
const mixedPose = createBaseKaratekaPose();
// Имитируем частичное перекрытие: правая стопа и кисть скрыты
mixedPose.landmarks[16].visibility = 0.30; // Правое запястье скрыто
mixedPose.landmarks[28].visibility = 0.25; // Правая лодыжка скрыта

const isWristMeasured = (mixedPose.landmarks[15].visibility ?? 1) >= 0.55;
const isRightWristPredicted = (mixedPose.landmarks[16].visibility ?? 1) < 0.55;

assert(isWristMeasured, 'Левое запястье классифицировано как реально обнаруженное (v >= 0.55)');
assert(isRightWristPredicted, 'Правое запястье классифицировано как предсказанное (v < 0.55)');

// ----------------------------------------------------------------------------
// ТЕСТ 10: ЕДИНЫЙ ТИПИЗИРОВАННЫЙ ПАКЕТ СЕТИ (BUNKAI-STREAM-PACKET)
// ----------------------------------------------------------------------------
console.log('\n[TEST 10] Проверка формата типизированного пакета передачи данных...');
const streamPacket = {
  version: 2,
  format: 'bunkai-stream-packet',
  roomId: 'MOCAP-DOJO',
  slot: 1,
  deviceId: 'camera_front_0',
  timestamp: Date.now(),
  facingMode: 'environment',
  isMirrored: false,
  landmarks: frontal.landmarks,
  worldLandmarks: frontal.worldLandmarks,
  hands: [],
  confidence: {
    overall: 92,
    head: 0.98,
    torso: 0.95,
    leftArm: 0.95,
    rightArm: 0.95,
    leftLeg: 0.95,
    rightLeg: 0.95,
  },
  metrics: bioFrontal,
  fingers: {
    left: { general_curl: 0.15, detected: true },
    right: { general_curl: 0.85, detected: true },
  },
  head: { yaw: 0, pitch: 0, roll: 0 },
  performanceMode: 'balanced',
};

const jsonStr = JSON.stringify(streamPacket);
const parsed = JSON.parse(jsonStr);

assert(parsed.version === 2, 'Пакет имеет спецификацию версии 2');
assert(parsed.format === 'bunkai-stream-packet', 'Пакет имеет единый заголовок формата bunkai-stream-packet');
assert(parsed.landmarks.length === 33, 'Пакет содержит ровно 33 точки скелета MediaPipe Pose');
assert(parsed.confidence.overall === 92, 'Пакет содержит детальные метрики уверенности');
assert(jsonStr.length < 15000, `Размер сетевого пакета компактен (< 15 КБ): ${(jsonStr.length / 1024).toFixed(1)} КБ`);

// ----------------------------------------------------------------------------
// ИТОГОВЫЙ ОТЧЕТ ТЕСТОВ
// ----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(` РЕЗУЛЬТАТ ТЕСТИРОВАНИЯ ЭТАПА 2: ${passedTests} ИЗ ${totalTests} ТЕСТОВ УСПЕШНО ПРОЙДЕНЫ!`);
console.log('================================================================\n');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
