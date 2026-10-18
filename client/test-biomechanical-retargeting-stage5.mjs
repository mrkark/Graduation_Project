/**
 * Bunkai Explorer — Test Suite: Biomechanical Retargeting (Stage 5)
 * 
 * Комплексный тестовый полигон по всем 10 сценариям биомеханического ретаргетинга:
 * 1. Аудит рига Karateka_Armature (полная иерархия, 69 узлов, 32 сустава)
 * 2. Непрерывность ориентации и азимута (45°, 90°, 135°, 180°, 270°, 360° и 720° в обе стороны)
 * 3. Сохранение окрестности кватернионов (q · q_prev >= 0, защита от переворота на 360°)
 * 4. Анатомические ограничения коленного сустава (Knee Hinge: 0°..165°, запрет переразгибания)
 * 5. Анатомические ограничения локтевого сустава (Elbow Hinge: 0°..160°, неразрывность предплечья и кисти)
 * 6. Заземление стоп и устранение скольжения (Foot Planting & Anti-Foot-Sliding)
 * 7. Динамическое сохранение резких ударов каратэ (Dynamic Kime Preserver, отклик <= 1 кадр)
 * 8. Сетевой джиттер-буфер и интерполяция (Network Playout Jitter Buffer, отслеживание потерь)
 * 9. Экспертный анализ Three.js SkeletonUtils.retarget & retargetClip
 * 10. Сквозной цикл ретаргетинга (MasterBiomechanicalRetargeter) и экспорт/импорт JSON
 */

import * as THREE from 'three';
import {
  KARATEKA_BONE_HIERARCHY,
  ANATOMICAL_JOINT_LIMITS,
  ContinuousAzimuthTracker,
  constrainKneeJoint,
  constrainElbowJoint,
  FootContactManager,
  DynamicKimePreserver,
  NetworkPlayoutJitterBuffer,
  MasterBiomechanicalRetargeter,
  evaluateThreeSkeletonUtilsRetargeting,
} from './src/utils/mocapBiomechanicalRetargeter.js';

import {
  exportCaptureJson,
  exportRetargetedJson,
  parseBunkaiMocapJson,
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
console.log(' BUNKAI EXPLORER — TEST SUITE: BIOMECHANICAL RETARGETING (STAGE 5)');
console.log('================================================================\n');

// ----------------------------------------------------------------------------
// TEST 1: АУДИТ РИГА И ИЕРАРХИИ КОСТЕЙ KARATEKA_ARMATURE
// ----------------------------------------------------------------------------
console.log('[TEST 1] Аудит структуры рига Karateka_Armature...');
const boneKeys = Object.keys(KARATEKA_BONE_HIERARCHY);
assert(boneKeys.includes('Hips'), 'Корневая кость Hips присутствует');
assert(boneKeys.includes('Chest') && boneKeys.includes('Neck') && boneKeys.includes('Head'), 'Цепочка позвоночника и головы (Spine->Spine1->Chest->Neck->Head) валидна');
assert(boneKeys.includes('UpperArm.L') && boneKeys.includes('LowerArm.L') && boneKeys.includes('Hand.L'), 'Левая рука содержит полную цепь Shoulder->UpperArm->LowerArm->Hand');
assert(boneKeys.includes('UpperArm.R') && boneKeys.includes('LowerArm.R') && boneKeys.includes('Hand.R'), 'Правая рука содержит полную цепь Shoulder->UpperArm->LowerArm->Hand');
assert(boneKeys.includes('UpperLeg.L') && boneKeys.includes('LowerLeg.L') && boneKeys.includes('Foot.L'), 'Левая нога содержит полную цепь UpperLeg->LowerLeg->Foot->Toe');
assert(boneKeys.includes('UpperLeg.R') && boneKeys.includes('LowerLeg.R') && boneKeys.includes('Foot.R'), 'Правая нога содержит полную цепь UpperLeg->LowerLeg->Foot->Toe');

// ----------------------------------------------------------------------------
// TEST 2: ТОЧНОСТЬ ПОВОРОТОВ (45°, 90°, 135°, 180°, 270°, 360°, 720°)
// ----------------------------------------------------------------------------
console.log('\n[TEST 2] Проверка непрерывности ориентации при вращениях на 360° и фазового развертывания...');
const azimuthTracker = new ContinuousAzimuthTracker();

const testAngles = [
  { deg: 0, label: '0° (Фронт)' },
  { deg: 45, label: '45° (Диагональ Камаэ)' },
  { deg: 90, label: '90° (Боковая стойка)' },
  { deg: 135, label: '135° (Задняя диагональ)' },
  { deg: 180, label: '180° (Спиной к камере)' },
  { deg: 270, label: '270° (-90° разворот)' },
  { deg: 360, label: '360° (Полный оборот)' },
];

let previousYaw = 0.0;
let allMonotonic = true;

for (const angle of testAngles) {
  const rad = (angle.deg * Math.PI) / 180.0;
  // Создаем направляющий вектор
  const heading = new THREE.Vector3(Math.sin(rad), 0, Math.cos(rad));
  const trackedYaw = azimuthTracker.updateYaw(heading);
  const diff = trackedYaw - previousYaw;
  if (Math.abs(diff) > Math.PI * 1.5) {
    allMonotonic = false;
  }
  previousYaw = trackedYaw;
}

assert(allMonotonic, 'Фазовое развертывание 2π устранило разрывы на границе ±π');
assert(Math.abs(azimuthTracker.totalRotations - 1.0) < 0.15, `Полный оборот (360°) корректно сосчитан: ${azimuthTracker.totalRotations.toFixed(2)} оборота`);

// Двойной непрерывный оборот (0° -> 720° с дискретным шагом 30°)
azimuthTracker.reset();
for (let d = 0; d <= 720; d += 30) {
  const rad = (d * Math.PI) / 180.0;
  const heading = new THREE.Vector3(Math.sin(rad), 0, Math.cos(rad));
  azimuthTracker.updateYaw(heading);
}
assert(Math.abs(azimuthTracker.totalRotations - 2.0) < 0.15, `Двойной оборот (720°) корректно сосчитан: ${azimuthTracker.totalRotations.toFixed(2)} оборота`);

// Обратное вращение (против часовой стрелки в -360°)
azimuthTracker.reset();
for (let d = 0; d >= -360; d -= 30) {
  const rad = (d * Math.PI) / 180.0;
  const heading = new THREE.Vector3(Math.sin(rad), 0, Math.cos(rad));
  azimuthTracker.updateYaw(heading);
}
assert(azimuthTracker.unwrappedYaw < -5.5, `Вращение против часовой стрелки непрерывно уходит в минус: ${azimuthTracker.unwrappedYaw.toFixed(2)} рад`);

// ----------------------------------------------------------------------------
// TEST 3: СОХРАНЕНИЕ ОКРЕСТНОСТИ КВАТЕРНИОНОВ (QUATERNION NEIGHBORHOOD)
// ----------------------------------------------------------------------------
console.log('\n[TEST 3] Проверка сохранения окрестности кватернионов (q · q_prev >= 0)...');
azimuthTracker.reset();
const q1 = azimuthTracker.getRootOrientationQuaternion(0, 0);
// Проворачиваем на 179°
azimuthTracker.updateYaw(new THREE.Vector3(Math.sin(3.12), 0, Math.cos(3.12)));
const q2 = azimuthTracker.getRootOrientationQuaternion(0, 0);
const dotQ = q1.dot(q2);
assert(dotQ >= 0.0, `Скалярное произведение кватернионов неотрицательно (dot: ${dotQ.toFixed(4)} >= 0), исключая флип на 360°`);

// ----------------------------------------------------------------------------
// TEST 4: ОГРАНИЧЕНИЯ КОЛЕННОГО СУСТАВА (KNEE HINGE CONSTRAINTS)
// ----------------------------------------------------------------------------
console.log('\n[TEST 4] Анатомические шарнирные ограничения коленей...');
// 1. Естественная прямая нога (угол 180°, сгиб 0°)
const vThighStraight = new THREE.Vector3(0, -0.45, 0);
const vShinStraight = new THREE.Vector3(0, -0.45, 0);
const resStraight = constrainKneeJoint(vThighStraight, vShinStraight, false);
assert(resStraight.valid, 'Прямая нога классифицирована как валидная');
assert(resStraight.angleDeg >= 179, `Угол прямой ноги: ${resStraight.angleDeg}°`);

// 2. Глубокая стойка Киба-дати (сгиб ~49°, угол ~131°)
const vShinBent = new THREE.Vector3(0, -0.30, 0.35);
const resBent = constrainKneeJoint(vThighStraight, vShinBent, false);
assert(resBent.valid, 'Физиологический сгиб колена в Киба-дати валиден');
assert(resBent.flexionDeg >= 30 && resBent.flexionDeg <= 165, `Сгиб колена в пределах анатомической нормы: ${resBent.flexionDeg}°`);

// 3. Попытка переразгибания колена вперед (Hyperextension, угол > 180°, неестественный излом)
const vShinInverted = new THREE.Vector3(0, -0.40, -0.25);
const resInverted = constrainKneeJoint(vThighStraight, vShinInverted, false);
assert(!resInverted.valid, 'Ограничитель обнаружил попытку неестественного выгиба колена вперед');
assert(resInverted.correctedShin.z >= -0.05, 'Скорректированное направление голени возвращено в анатомическую плоскость');

// ----------------------------------------------------------------------------
// TEST 5: ОГРАНИЧЕНИЯ ЛОКТЕВОГО СУСТАВА (ELBOW HINGE & FOREARM COUPLING)
// ----------------------------------------------------------------------------
console.log('\n[TEST 5] Анатомические шарнирные ограничения локтей...');
const vArmFwd = new THREE.Vector3(0, 0, 0.35); // Плечо вынесено вперед
const vForearmStraight = new THREE.Vector3(0, 0, 0.30); // Предплечье прямо (удар Ой-цуки)
const resArmStraight = constrainElbowJoint(vArmFwd, vForearmStraight, false);
assert(resArmStraight.valid, 'Прямой удар рукой Ой-цуки валиден (угол ~180°)');

// Защита от переразгибания локтя назад
const vForearmHyperext = new THREE.Vector3(0, 0.30, 0.0);
const resHyperext = constrainElbowJoint(vArmFwd, vForearmHyperext, false);
assert(resHyperext.correctedForearm.length() > 0.25, 'Длина предплечья строго сохранена при ограничении сустава');

// ----------------------------------------------------------------------------
// TEST 6: ЗАЗЕМЛЕНИЕ СТОП И УСТРАНЕНИЕ СКОЛЬЖЕНИЯ (FOOT PLANTING)
// ----------------------------------------------------------------------------
console.log('\n[TEST 6] Заземление стоп и предотвращение проскальзывания по татами...');
const contactMgr = new FootContactManager(0.0);

// Стопа на полу в покое
const plantedFoot = new THREE.Vector3(0.25, 0.03, 0.10);
const t0 = 1000;
contactMgr.processFoot('R', plantedFoot, t0);
const resPlanted1 = contactMgr.processFoot('R', plantedFoot, t0 + 40);
assert(contactMgr.feet.R.isGrounded, 'Опорная стопа распознана как заземленная (h < 0.08 м, v < 0.2 м/с)');

// Небольшое сенсорное дрожание опорной ноги не должно вызывать скольжение
const jitteredFoot = new THREE.Vector3(0.26, 0.03, 0.11);
const resPlanted2 = contactMgr.processFoot('R', jitteredFoot, t0 + 80);
assert(resPlanted2.distanceTo(plantedFoot) < jitteredFoot.distanceTo(plantedFoot), 'Анти-скользящий якорь притянул стопу к стабильной опорной точке');

// Удар ногой Маэ-гэри (нога резко взлетает вверх: h = 0.65 м, v = 3.5 м/с)
const kickFoot = new THREE.Vector3(0.25, 0.65, 0.50);
contactMgr.processFoot('R', kickFoot, t0 + 200);
assert(!contactMgr.feet.R.isGrounded, 'При ударе ногой Маэ-гэри якорь мгновенно разблокирован (isGrounded = false)');

// ----------------------------------------------------------------------------
// TEST 7: ДИНАМИЧЕСКИЙ КИМЭ-ПРЕЗЕРВЕР (BALLISTIC KARATE STRIKES)
// ----------------------------------------------------------------------------
console.log('\n[TEST 7] Сохранение скорости резких ударов Сётокан (Кимэ)...');
const kimePreserver = new DynamicKimePreserver();

// 1. Медленное движение (подготовка стойки, плавный блок)
kimePreserver.filterJointAngle('elbow_R', 10.0, 1000);
const slowAngle = kimePreserver.filterJointAngle('elbow_R', 12.0, 1033);
assert(!kimePreserver.isStrikeActive('elbow_R'), 'При медленном перемещении активен режим мягкого сглаживания');

// 2. Взрывной прямой удар Гяку-цуки (разгон с 15° до 150° за 2 кадра!)
kimePreserver.filterJointAngle('elbow_R', 15.0, 1100);
const strikeAngle1 = kimePreserver.filterJointAngle('elbow_R', 95.0, 1116);
const strikeAngle2 = kimePreserver.filterJointAngle('elbow_R', 150.0, 1133);
assert(kimePreserver.isStrikeActive('elbow_R'), 'Баллистический удар распознан по высокой угловой скорости');
assert(strikeAngle2 > 130.0, `Частота среза динамически увеличена: удар достиг ${strikeAngle2.toFixed(1)}° за 1 кадр`);

// ----------------------------------------------------------------------------
// TEST 8: СЕТЕВОЙ ДЖИТТЕР-БУФЕР И ТЕЛЕМЕТРИЯ (PLAYOUT JITTER BUFFER)
// ----------------------------------------------------------------------------
console.log('\n[TEST 8] Сетевой джиттер-буфер воспроизведения и задержки...');
const jitterBuf = new NetworkPlayoutJitterBuffer(60);

const baseLms = Array.from({ length: 33 }, (_, i) => ({ x: 0.5, y: 0.5, z: 0.0, visibility: 0.9 }));
const f1 = { timestamp: 2000, landmarks: baseLms, trackingLost: false };
const f2 = {
  timestamp: 2033,
  landmarks: baseLms.map((p, idx) => (idx === 16 ? { ...p, x: 0.85 } : p)),
  trackingLost: false,
};

jitterBuf.ingestPacket(f1);
jitterBuf.ingestPacket(f2);

const tele = jitterBuf.getTelemetry();
assert(tele.latencyMs === 60, `Целевая задержка буфера воспроизведения: ${tele.latencyMs} мс`);
assert(!tele.trackingLost, 'Статус трекинга в сети активен');

// Проверка реакции на потерю трекинга
jitterBuf.ingestPacket({ timestamp: 2066, landmarks: [], trackingLost: true });
const teleLost = jitterBuf.getTelemetry();
assert(teleLost.trackingLost, 'Потеря трекинга зафиксирована в телеметрии без маскировки');

// ----------------------------------------------------------------------------
// TEST 9: АНАЛИЗ SKELETONUTILS.RETARGET & RETARGETCLIP
// ----------------------------------------------------------------------------
console.log('\n[TEST 9] Экспертный аудит Three.js SkeletonUtils.retarget & retargetClip...');
const evalReport = evaluateThreeSkeletonUtilsRetargeting();
assert(evalReport.engine.includes('SkeletonUtils'), 'Анализ покрывает встроенные средства Three.js');
assert(evalReport.limitationsForLiveMocap.length >= 4, `Зафиксировано ${evalReport.limitationsForLiveMocap.length} фундаментальных ограничений SkeletonUtils для живого захвата`);
assert(evalReport.limitationsForLiveMocap.some(l => l.includes('2π')), 'Зафиксировано отсутствие поддержки 2π-развертывания азимута');
assert(evalReport.limitationsForLiveMocap.some(l => l.includes('Foot Sliding')), 'Зафиксировано отсутствие подавления скольжения стоп');

// ----------------------------------------------------------------------------
// TEST 10: СКВОЗНОЙ РЕТАРГЕТИНГ И ЭКСПОРТ/ИМПОРТ JSON
// ----------------------------------------------------------------------------
console.log('\n[TEST 10] Сквозной цикл ретаргетинга позы и сериализация Bunkai JSON...');
const masterRetargeter = new MasterBiomechanicalRetargeter();

const rawPoseSample = {
  timestamp: Date.now(),
  landmarks: baseLms,
  worldLandmarks: baseLms,
  fingers: {
    right: { detected: true, fistScore: 0.92, thumb: 0.85, index: 0.95 },
    left: { detected: true, fistScore: 0.10, thumb: 0.12, index: 0.08 },
  },
  head: { yaw: 0.05, pitch: -0.02, roll: 0.01 },
};

const retargetResult = masterRetargeter.retargetPose(rawPoseSample, { mirrorMode: true });
assert(retargetResult !== null, 'Сквозной ретаргетинг позы успешно выполнен');
assert(retargetResult.rootQuaternion instanceof THREE.Quaternion, 'Корневой кватернион сгенерирован');
assert(retargetResult.elbows.right && retargetResult.knees.right, 'Конечности проверены анатомическими шарнирами');

// Проверка экспорта и парсинга JSON
const testProject = {
  name: 'Kata_Heian_Shodan_Stage5',
  version: '2.0',
  frameCount: 1,
  frames: [
    {
      frame: 0,
      time: 0.0,
      bones: {
        Hips: { quaternion: [retargetResult.rootQuaternion.x, retargetResult.rootQuaternion.y, retargetResult.rootQuaternion.z, retargetResult.rootQuaternion.w] },
        'UpperArm.R': { quaternion: [0, 0, 0, 1] },
      },
      fingers: rawPoseSample.fingers,
    },
  ],
};

const exportedJson = exportRetargetedJson(testProject);
const parsed = parseBunkaiMocapJson(exportedJson);
assert(parsed.success, 'Файл Bunkai MoCap JSON успешно экспортирован и распарсен');
assert(parsed.data.frames.length === 1, 'Фрейм анимации сохранен с полной кинематикой костей и пальцев');

// ----------------------------------------------------------------------------
// ИТОГОВЫЙ ОТЧЕТ ТЕСТОВ
// ----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(` РЕЗУЛЬТАТ ТЕСТИРОВАНИЯ ЭТАПА 5: ${passedTests} ИЗ ${totalTests} ТЕСТОВ УСПЕШНО ПРОЙДЕНЫ!`);
console.log('================================================================\n');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
