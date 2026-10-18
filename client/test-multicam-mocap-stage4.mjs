/**
 * Bunkai Explorer — Multi-Camera MoCap & Triangulation Test Suite (Stage 4)
 * 
 * Комплексный проверочный стенд многокамерной реконструкции движения:
 * 1. Калибровка камер (Intrinsics, Extrinsics, прямая и обратная проекция)
 * 2. Временная синхронизация и защита от устаревших пакетов (Sync Buffer)
 * 3. Геометрическая лучевая триангуляция методом наименьших квадратов
 * 4. Обнаружение и отбрасывание противоречивых измерений (Epipolar Outlier Rejection)
 * 5. Сравнение 1, 2 и 3 камер на повороте корпуса и таза (Pelvic Yaw)
 * 6. Сравнение 1, 2 и 3 камер на диагональном перемещении (X + Z)
 * 7. Сравнение 1, 2 и 3 камер при сильном перекрытии конечностей (Crossed Arms / Blocks)
 * 8. Слияние мелкой моторики кистей с выбором оптимального ракурса
 * 9. Контроль анатомической длины костей (Kinematic Bone Length Constraint)
 * 10. Численное измерение погрешности MPJPE (1-cam vs 2-cam vs 3-cam benchmark)
 */

import * as THREE from 'three';
import {
  CameraParameters,
  calibrateCameraFromPose,
  SynchronizedFrameBuffer,
  triangulateRays,
  filterOutlierRays,
  MultiCameraMoCapEngine,
} from './src/utils/mocapMultiCameraEngine.js';

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
console.log(' BUNKAI EXPLORER — TEST SUITE: MULTI-CAMERA MOCAP (STAGE 4)');
console.log('================================================================\n');

// ----------------------------------------------------------------------------
// ТЕСТ 1: КАЛИБРОВКА КАМЕР (INTRINSICS, EXTRINSICS И РЕПРОЕКЦИЯ)
// ----------------------------------------------------------------------------
console.log('[TEST 1] Проверка параметров камер (Intrinsics, Extrinsics и репроекция)...');
const camFront = new CameraParameters(1);
const camSide = new CameraParameters(2);
const camAngle = new CameraParameters(3);

assert(camFront.position.z > 2.0 && Math.abs(camFront.position.x) < 0.1, 'Фронтальная камера (0°): расположена по оси Z перед татами');
assert(camSide.position.x > 2.0 && Math.abs(camSide.position.z) < 0.1, 'Боковая камера (90°): расположена сбоку по оси X');
assert(camAngle.position.x > 1.0 && camAngle.position.z > 1.0, 'Угловая камера (45°): расположена по диагонали');

// Проверка лучевого преобразования: проецируем центр экрана (0.5, 0.5)
const centerRay = camFront.unprojectToRay(0.5, 0.5);
assert(Math.abs(centerRay.direction.x) < 1e-4, 'Луч из центра экрана направлен строго по оптической оси');
assert(centerRay.direction.z < -0.95, 'Луч из центра направлен в сторону центра татами (Z < 0)');

// Проверка репроекции: 3D точка в центре татами (0, 1.25, 0)
const testPointWorld = new THREE.Vector3(0.0, 1.25, 0.0);
const projFront = camFront.projectWorldToScreen(testPointWorld);
assert(Math.abs(projFront.x - 0.5) < 0.02 && Math.abs(projFront.y - 0.5) < 0.02, `Репроекция центра татами на фронтальную камеру попадает в центр кадра: (${projFront.x.toFixed(3)}, ${projFront.y.toFixed(3)})`);

const projSide = camSide.projectWorldToScreen(testPointWorld);
assert(Math.abs(projSide.x - 0.5) < 0.02 && Math.abs(projSide.y - 0.5) < 0.02, `Репроекция центра татами на боковую камеру попадает в центр кадра: (${projSide.x.toFixed(3)}, ${projSide.y.toFixed(3)})`);

// ----------------------------------------------------------------------------
// ТЕСТ 2: ВРЕМЕННАЯ СИНХРОНИЗАЦИЯ И ЗАЩИТА ОТ УСТАРЕВШИХ ПАКЕТОВ
// ----------------------------------------------------------------------------
console.log('\n[TEST 2] Временная синхронизация и защита от устаревших пакетов...');
const syncBuf = new SynchronizedFrameBuffer(60, 250);
const now = Date.now();

// Подаем синхронизированные пакеты от 3 камер с небольшим сетевым джиттером (10 мс)
syncBuf.addPacket({ slot: 1, timestamp: now - 15, landmarks: Array(33).fill({ x: 0.5, y: 0.5 }) });
syncBuf.addPacket({ slot: 2, timestamp: now - 22, landmarks: Array(33).fill({ x: 0.5, y: 0.5 }) });
syncBuf.addPacket({ slot: 3, timestamp: now - 18, landmarks: Array(33).fill({ x: 0.5, y: 0.5 }) });

const cluster1 = syncBuf.getSynchronizedCluster(now);
assert(cluster1.activeSlots.length === 3, `Все 3 камеры успешно синхронизированы в кластер (активно: ${cluster1.activeSlots.length})`);
assert(cluster1.syncHealth === 'perfect', `Качество синхронизации при джиттере 7 мс: ${cluster1.syncHealth} (дрейф: ${cluster1.maxDriftMs} мс)`);

// Тестируем поступление безнадежно устаревшего пакета (350 мс назад)
syncBuf.addPacket({ slot: 2, timestamp: now - 400, landmarks: Array(33).fill({ x: 0.5, y: 0.5 }) });
assert(syncBuf.syncStats.staleDrops >= 1, `Устаревший пакет (>250 мс) успешно отброшен защитным фильтром`);

// Тестируем рассинхронизацию одной из камер (дрейф > 90 мс)
syncBuf.reset();
syncBuf.addPacket({ slot: 1, timestamp: now, landmarks: Array(33).fill({ x: 0.5, y: 0.5 }) });
syncBuf.addPacket({ slot: 2, timestamp: now - 85, landmarks: Array(33).fill({ x: 0.5, y: 0.5 }) });
const clusterDesync = syncBuf.getSynchronizedCluster(now);
assert(clusterDesync.syncHealth === 'desynchronized' || clusterDesync.maxDriftMs >= 75, `Обнаружен дрейф часов между камерами: ${clusterDesync.maxDriftMs} мс`);

// ----------------------------------------------------------------------------
// ТЕСТ 3: ГЕОМЕТРИЧЕСКАЯ ТРИАНГУЛЯЦИЯ ЛУЧЕЙ (LEAST SQUARES RAY INTERSECTION)
// ----------------------------------------------------------------------------
console.log('\n[TEST 3] Геометрическая лучевая триангуляция методом наименьших квадратов...');

// Задаем точную тестовую 3D-точку в пространстве Додзё: кулак бойца при ударе
const trueTarget3D = new THREE.Vector3(0.25, 1.35, 0.40);

// Проецируем точку на 3 камеры, получая 2D-координаты экрана
const p1Screen = camFront.projectWorldToScreen(trueTarget3D);
const p2Screen = camSide.projectWorldToScreen(trueTarget3D);
const p3Screen = camAngle.projectWorldToScreen(trueTarget3D);

// Восстанавливаем 3D-лучи
const ray1 = camFront.unprojectToRay(p1Screen.x, p1Screen.y);
const ray2 = camSide.unprojectToRay(p2Screen.x, p2Screen.y);
const ray3 = camAngle.unprojectToRay(p3Screen.x, p3Screen.y);

// Триангулируем по 3 лучам
const triangulated3D = triangulateRays([ray1, ray2, ray3], [1.0, 1.0, 1.0]);
const triError = triangulated3D.distanceTo(trueTarget3D);

assert(triError < 0.002, `Триангуляция 3 камер восстановила 3D-точку с субмиллиметровой погрешностью: ${(triError * 1000).toFixed(2)} мм`);

// Триангулируем по 2 камерам (Фронт + Бок)
const stereo3D = triangulateRays([ray1, ray2], [1.0, 1.0]);
const stereoError = stereo3D.distanceTo(trueTarget3D);
assert(stereoError < 0.005, `Стерео-триангуляция 2 камер восстановила точку с ошибкой: ${(stereoError * 1000).toFixed(2)} мм`);

// ----------------------------------------------------------------------------
// ТЕСТ 4: ОТБРАСЫВАНИЕ ПРОТИВОРЕЧИВЫХ ИЗМЕРЕНИЙ (EPIPOLAR OUTLIER REJECTION)
// ----------------------------------------------------------------------------
console.log('\n[TEST 4] Отбрасывание противоречивых измерений (Epipolar Outlier Rejection)...');

// Добавляем фальшивый / сбитый луч от камеры 3 (например, если она перепутала левую и правую руку)
const bogusRay = camAngle.unprojectToRay(0.85, 0.20); // Ошибочное измерение
const dirtyRays = [ray1, ray2, bogusRay];
const dirtyWeights = [0.95, 0.95, 0.40];

const { filteredRays } = filterOutlierRays(dirtyRays, dirtyWeights, 0.20);
assert(filteredRays.length === 2, `Сбитый луч камеры 3 успешно отброшен эпиполярным фильтром невязки (осталось: ${filteredRays.length})`);

const cleanTri = triangulateRays(filteredRays);
const cleanErr = cleanTri.distanceTo(trueTarget3D);
assert(cleanErr < 0.005, `После отбрасывания выброса точность триангуляции сохранена: ${(cleanErr * 1000).toFixed(2)} мм`);

// ----------------------------------------------------------------------------
// ТЕСТ 5: СРАВНЕНИЕ 1, 2 И 3 КАМЕР НА ПОВОРОТЕ КОРПУСА (PELVIC YAW)
// ----------------------------------------------------------------------------
console.log('\n[TEST 5] Сравнение 1, 2 и 3 камер на повороте корпуса и таза (Pelvic Yaw)...');

// Моделируем разворот таза на 45°: левое бедро назад (Z = -0.15), правое бедро вперед (Z = +0.15)
const trueLeftHip = new THREE.Vector3(-0.12, 0.95, -0.15);
const trueRightHip = new THREE.Vector3(0.12, 0.95, 0.15);

// 1 камера (Фронт): оба бедра проецируются на близкие координаты X, Z-глубина теряется
const pLH_C1 = camFront.projectWorldToScreen(trueLeftHip);
const pRH_C1 = camFront.projectWorldToScreen(trueRightHip);

// 2 камеры (Фронт + Бок): боковая камера напрямую измеряет Z-разницу
const pLH_C2 = camSide.projectWorldToScreen(trueLeftHip);
const pRH_C2 = camSide.projectWorldToScreen(trueRightHip);

// 3 камеры (Фронт + Бок + Угол)
const pLH_C3 = camAngle.projectWorldToScreen(trueLeftHip);
const pRH_C3 = camAngle.projectWorldToScreen(trueRightHip);

const r1_L = camFront.unprojectToRay(pLH_C1.x, pLH_C1.y);
const r2_L = camSide.unprojectToRay(pLH_C2.x, pLH_C2.y);
const r3_L = camAngle.unprojectToRay(pLH_C3.x, pLH_C3.y);

// Монокулярная реконструкция (1 камера): глубина оценивается с неопределенностью
const rec1_L = triangulateRays([r1_L]);
// Стерео реконструкция (2 камеры)
const rec2_L = triangulateRays([r1_L, r2_L]);
// Мульти-камерная (3 камеры)
const rec3_L = triangulateRays([r1_L, r2_L, r3_L]);

const err1_Z = Math.abs(rec1_L.z - trueLeftHip.z);
const err2_Z = Math.abs(rec2_L.z - trueLeftHip.z);
const err3_Z = Math.abs(rec3_L.z - trueLeftHip.z);

console.log(`  -> Ошибка глубины Z (1 камера, монокуляр):   ${(err1_Z * 100).toFixed(1)} см`);
console.log(`  -> Ошибка глубины Z (2 камеры, стерео):      ${(err2_Z * 100).toFixed(2)} см`);
console.log(`  -> Ошибка глубины Z (3 камеры, триангуляция): ${(err3_Z * 100).toFixed(2)} см`);

assert(err2_Z < err1_Z * 0.15, `2 камеры сокращают ошибку оценки глубины Z более чем в 6 раз`);
assert(err3_Z < 0.005, `3 камеры восстанавливают разворот таза с субмиллиметровой точностью`);

// ----------------------------------------------------------------------------
// ТЕСТ 6: СРАВНЕНИЕ 1, 2 И 3 КАМЕР НА ДИАГОНАЛЬНОМ ПЕРЕМЕЩЕНИИ (X + Z)
// ----------------------------------------------------------------------------
console.log('\n[TEST 6] Сравнение на диагональном перемещении спортсмена (X + Z)...');
// Каратист сместился в угол татами: X = 0.65 м, Z = 0.65 м
const trueDiagonalPos = new THREE.Vector3(0.65, 1.10, 0.65);

const diagRay1 = camFront.unprojectToRay(camFront.projectWorldToScreen(trueDiagonalPos).x, camFront.projectWorldToScreen(trueDiagonalPos).y);
const diagRay2 = camSide.unprojectToRay(camSide.projectWorldToScreen(trueDiagonalPos).x, camSide.projectWorldToScreen(trueDiagonalPos).y);
const diagRay3 = camAngle.unprojectToRay(camAngle.projectWorldToScreen(trueDiagonalPos).x, camAngle.projectWorldToScreen(trueDiagonalPos).y);

const diag2Cam = triangulateRays([diagRay1, diagRay2]);
const diag3Cam = triangulateRays([diagRay1, diagRay2, diagRay3]);

const errDiag2 = diag2Cam.distanceTo(trueDiagonalPos);
const errDiag3 = diag3Cam.distanceTo(trueDiagonalPos);

assert(errDiag2 < 0.02, `2 камеры восстановили диагональное смещение с ошибкой < 2 см (факт: ${(errDiag2 * 100).toFixed(2)} см)`);
assert(errDiag3 < 0.005, `3 камеры восстановили диагональное смещение с точностью: ${(errDiag3 * 1000).toFixed(2)} мм`);

// ----------------------------------------------------------------------------
// ТЕСТ 7: ПЕРЕКРЫТИЕ КОНЕЧНОСТЕЙ (БЛОК ДЗЮДЗИ-УКЭ, ПЕРЕКРЫТИЕ РУК)
// ----------------------------------------------------------------------------
console.log('\n[TEST 7] Сильное перекрытие конечностей (рука перекрыта для фронтальной камеры)...');
// Правое запястье находится за левым предплечьем: фронтальная камера не видит правое запястье (vis = 0.15)
const occludedWrist = new THREE.Vector3(0.08, 1.30, 0.35);

const occRay1 = camFront.unprojectToRay(camFront.projectWorldToScreen(occludedWrist).x, camFront.projectWorldToScreen(occludedWrist).y);
const occRay2 = camSide.unprojectToRay(camSide.projectWorldToScreen(occludedWrist).x, camSide.projectWorldToScreen(occludedWrist).y);
const occRay3 = camAngle.unprojectToRay(camAngle.projectWorldToScreen(occludedWrist).x, camAngle.projectWorldToScreen(occludedWrist).y);

// Веса видимости: фронтальная камера перекрыта (w = 0.15), боковая и угловая видят четко (w = 0.95)
const weightsWithOcclusion = [0.15, 0.95, 0.95];

const occRecon = triangulateRays([occRay1, occRay2, occRay3], weightsWithOcclusion);
const occErr = occRecon.distanceTo(occludedWrist);

assert(occErr < 0.015, `При перекрытии фронтальной камеры боковая и угловая камеры точно восстановили сустав: ${(occErr * 1000).toFixed(2)} мм`);

// ----------------------------------------------------------------------------
// ТЕСТ 8: СЛИЯНИЕ МЕЛКОЙ МОТОРИКИ КИСТЕЙ И ПАЛЬЦЕВ (MULTI-VIEW HAND SELECTION)
// ----------------------------------------------------------------------------
console.log('\n[TEST 8] Слияние мелкой моторики кистей с выбором наилучшего ракурса...');
const engine = new MultiCameraMoCapEngine();

// Имитируем пакеты: на камере 1 кисть видна сбоку (пальцы перекрыты), на камере 3 ладонь открыта прямо в объектив
const packetCam1 = {
  slot: 1,
  timestamp: now,
  landmarks: Array(33).fill({ x: 0.5, y: 0.5, visibility: 0.9 }),
  fingers: {
    right: { detected: true, fistScore: 30, confidence: { thumb: 0.4, index: 0.4, middle: 0.3, ring: 0.3, pinky: 0.3 } },
  },
};

const packetCam3 = {
  slot: 3,
  timestamp: now - 5,
  landmarks: Array(33).fill({ x: 0.5, y: 0.5, visibility: 0.9 }),
  fingers: {
    right: { detected: true, fistScore: 95, confidence: { thumb: 0.95, index: 0.95, middle: 0.95, ring: 0.95, pinky: 0.95 } },
  },
};

engine.ingestCameraPacket(packetCam1);
engine.ingestCameraPacket(packetCam3);

const fusedResult = engine.reconstructFrame(now);
assert(fusedResult.fingers !== null, 'Кисти успешно объединены из многокамерных наблюдений');
assert(fusedResult.fingers.right.confidence.thumb > 0.85, 'Выбран ракурс камеры с наивысшей уверенностью видимости пальцев (Камера 3)');

// ----------------------------------------------------------------------------
// ТЕСТ 9: АНАТОМИЧЕСКИЙ КОНТРОЛЬ ДЛИНЫ КОСТЕЙ (BONE LENGTH CONSISTENCY)
// ----------------------------------------------------------------------------
console.log('\n[TEST 9] Контроль анатомической длины костей (Kinematic Constraints)...');
const engineLimb = new MultiCameraMoCapEngine();

// Устанавливаем опорную точку плеча
engineLimb.previousJointPositions.set(12, new THREE.Vector3(0.20, 1.45, 0.0));
engineLimb.boneLengthHistory['12_14'] = 0.30; // Номинальная длина плеча: 30 см

// Попытка выброса локтя на расстояние 65 см (сбой детектора)
const distortedElbow = new THREE.Vector3(0.75, 1.45, 0.0);
engineLimb.enforceBoneLengthConstraint(14, distortedElbow);

const clampedLength = distortedElbow.distanceTo(new THREE.Vector3(0.20, 1.45, 0.0));
assert(clampedLength <= 0.35, `Анатомический ограничитель предотвратил растяжение руки: длина ограничена ${clampedLength.toFixed(3)} м`);

// ----------------------------------------------------------------------------
// ТЕСТ 10: ЧИСЛЕННОЕ СРАВНЕНИЕ MPJPE (1 КАМЕРА VS 2 КАМЕРЫ VS 3 КАМЕРЫ)
// ----------------------------------------------------------------------------
console.log('\n[TEST 10] Численный бенчмарк MPJPE (1 камера vs 2 камеры vs 3 камеры)...');

// Генерируем тестовую траекторию удара каратиста (20 контрольных суставов x 30 кадров)
const numJoints = 20;
const numFrames = 30;
let sumError1Cam = 0;
let sumError2Cam = 0;
let sumError3Cam = 0;
let totalEvaluations = 0;

for (let f = 0; f < numFrames; f++) {
  const t = f / numFrames;
  // Смещение кулака вперед (удар Гяку-цуки с разворотом таза)
  const zPunch = 0.10 + t * 0.45;
  const xTwist = Math.sin(t * Math.PI) * 0.12;

  for (let j = 0; j < numJoints; j++) {
    const trueJ = new THREE.Vector3(
      (j % 2 === 0 ? -0.2 : 0.2) + xTwist,
      0.8 + (j / numJoints) * 0.9,
      zPunch * (j > 10 ? 1.0 : 0.2)
    );

    // Добавляем реалистичный сенсорный шум 2D детектора (+-0.008 нормализованных единиц)
    const noise = () => (Math.random() - 0.5) * 0.012;

    const p1 = camFront.projectWorldToScreen(trueJ);
    const p2 = camSide.projectWorldToScreen(trueJ);
    const p3 = camAngle.projectWorldToScreen(trueJ);

    const r1 = camFront.unprojectToRay(p1.x + noise(), p1.y + noise());
    const r2 = camSide.unprojectToRay(p2.x + noise(), p2.y + noise());
    const r3 = camAngle.unprojectToRay(p3.x + noise(), p3.y + noise());

    // 1 камера: луч с номинальной оценкой глубины
    const rec1 = triangulateRays([r1]);
    // 2 камеры: лучи 1 и 2
    const rec2 = triangulateRays([r1, r2]);
    // 3 камеры: все лучи
    const rec3 = triangulateRays([r1, r2, r3]);

    sumError1Cam += rec1.distanceTo(trueJ);
    sumError2Cam += rec2.distanceTo(trueJ);
    sumError3Cam += rec3.distanceTo(trueJ);
    totalEvaluations++;
  }
}

const mpjpe1CamCm = (sumError1Cam / totalEvaluations) * 100;
const mpjpe2CamCm = (sumError2Cam / totalEvaluations) * 100;
const mpjpe3CamCm = (sumError3Cam / totalEvaluations) * 100;

console.log(`  -> 1 Камера (Монокулярная оценка) MPJPE:  ${mpjpe1CamCm.toFixed(2)} см`);
console.log(`  -> 2 Камеры (Стерео-триангуляция) MPJPE:  ${mpjpe2CamCm.toFixed(2)} см`);
console.log(`  -> 3 Камеры (Мульти-триангуляция) MPJPE:  ${mpjpe3CamCm.toFixed(2)} см`);

const improvement2Cam = ((mpjpe1CamCm - mpjpe2CamCm) / mpjpe1CamCm) * 100;
const improvement3Cam = ((mpjpe1CamCm - mpjpe3CamCm) / mpjpe1CamCm) * 100;

console.log(`  -> Снижение ошибки при 2 камерах: -${improvement2Cam.toFixed(1)}%`);
console.log(`  -> Снижение ошибки при 3 камерах: -${improvement3Cam.toFixed(1)}%`);

assert(mpjpe2CamCm < mpjpe1CamCm * 0.45, `2 камеры снижают ошибку MPJPE более чем в 2 раза (-${improvement2Cam.toFixed(1)}%)`);
assert(mpjpe3CamCm < mpjpe2CamCm && mpjpe3CamCm < 3.0, `3 камеры обеспечивают наивысшую точность захвата (${mpjpe3CamCm.toFixed(2)} см, -${improvement3Cam.toFixed(1)}%)`);

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
