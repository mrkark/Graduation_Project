import assert from 'node:assert';
import {
  BUNKAI_COORDINATE_SYSTEM,
  computeAvatarPlacement,
  HEIAN_SHODAN_BUNKAI_18_STEPS,
} from '../src/three/bunkaiScenarioEngine.js';

console.log('=== TEST SUITE: Bunkai Coordinate System & Evasion Facing Rotations ===\n');

// -----------------------------------------------------------------------------
// ТЕСТ 1: Проверка спецификации системы координат Бункай (Bunkai Coordinate System)
// -----------------------------------------------------------------------------
console.log('--- Тест 1: Спецификация 3D-системы координат (Оси X, Y, Z, уровни и азимуты) ---');
assert.ok(BUNKAI_COORDINATE_SYSTEM, 'BUNKAI_COORDINATE_SYSTEM должна быть экспортирована');
assert.strictEqual(BUNKAI_COORDINATE_SYSTEM.axes.X.color, '#ef4444', 'Ось X должна быть красной (#ef4444)');
assert.strictEqual(BUNKAI_COORDINATE_SYSTEM.axes.Y.color, '#22c55e', 'Ось Y должна быть зеленой (#22c55e)');
assert.strictEqual(BUNKAI_COORDINATE_SYSTEM.axes.Z.color, '#3b82f6', 'Ось Z должна быть синей (#3b82f6)');

assert.ok(BUNKAI_COORDINATE_SYSTEM.axes.Y.levels.gedan, 'Уровень Гэдан должен быть определен');
assert.ok(BUNKAI_COORDINATE_SYSTEM.axes.Y.levels.chudan, 'Уровень Тюдан должен быть определен');
assert.ok(BUNKAI_COORDINATE_SYSTEM.axes.Y.levels.jodan, 'Уровень Дзёдан должен быть определен');

const compass35 = BUNKAI_COORDINATE_SYSTEM.orientation.compassPoints.find((p) => p.angleDeg === 35);
assert.ok(compass35, 'Должна быть метка канонического ухода Тай-сабаки +35°');
console.log('✓ Тест 1 пройден: спецификация декартовых осей X/Y/Z и боевых уровней проверена.\n');

// -----------------------------------------------------------------------------
// ТЕСТ 2: Полная пространственная телеметрия координат и направлений
// -----------------------------------------------------------------------------
console.log('--- Тест 2: Вычисление пространственных координат [X, Y, Z] и вектора взгляда ---');
const ep1 = HEIAN_SHODAN_BUNKAI_18_STEPS[0];
const p1 = computeAvatarPlacement({ episode: ep1 });

assert.ok(p1.coordinates, 'Результат computeAvatarPlacement должен содержать объект coordinates');
assert.ok(p1.coordinates.tori, 'coordinates должен содержать блок tori');
assert.ok(p1.coordinates.uke1, 'coordinates должен содержать блок uke1');
assert.ok(p1.coordinates.relative, 'coordinates должен содержать блок relative');

assert.strictEqual(typeof p1.coordinates.tori.x, 'number', 'tori.x должен быть числом');
assert.strictEqual(typeof p1.coordinates.tori.z, 'number', 'tori.z должен быть числом');
assert.strictEqual(typeof p1.coordinates.tori.yawDeg, 'number', 'tori.yawDeg должен быть числом в градусах');
assert.ok(Array.isArray(p1.coordinates.tori.directionVector), 'tori.directionVector должен быть вектором из 3 чисел');

console.log(`  Тори: X=${p1.coordinates.tori.x.toFixed(2)}м, Y=${p1.coordinates.tori.y.toFixed(2)}м, Z=${p1.coordinates.tori.z.toFixed(2)}м, Yaw=${p1.coordinates.tori.yawDeg}°`);
console.log(`  Укэ:  X=${p1.coordinates.uke1.x.toFixed(2)}м, Y=${p1.coordinates.uke1.y.toFixed(2)}м, Z=${p1.coordinates.uke1.z.toFixed(2)}м, Yaw=${p1.coordinates.uke1.yawDeg}°`);
console.log(`  Дистанция боя (Ма-ай): ${p1.coordinates.relative.maaiDistance.toFixed(2)}м`);
console.log('✓ Тест 2 пройден: координаты по осям и векторы направлений рассчитываются корректно.\n');

// -----------------------------------------------------------------------------
// ТЕСТ 3: Блок с уходом вправо (+35°) при сохранении разворота лицом к противнику
// -----------------------------------------------------------------------------
console.log('--- Тест 3: Блок с уходом вправо (+35°) и авто-поворот лицом к атакующему ---');
const pRightEvade = computeAvatarPlacement({
  episode: {
    stepNumber: 5,
    title: 'Атака и блок с уходом вправо',
    optimalDistance: 1.45,
    attackAngleDeg: 0,
    contactType: 'block_gedan',
    toriTrajectory: { start: [0, 0, -0.45], end: [0, 0, 0.15], startYaw: 0, endYaw: 0 },
    ukeTrajectory: { start: [0, 0, 1.00], end: [0.35, 0, 1.30], startYaw: Math.PI, endYaw: -2.85 },
    participants: [
      { role: 'tori', clipName: 'kick_mae_geri_right' },
      { role: 'uke1', clipName: 'tech_gedan_barai_left' },
    ],
  },
  ukeEvasionAngleDeg: 35,
});

assert.ok(pRightEvade.posUke1[0] > 0.25, `Укэ должен сместиться вправо по оси X (>0.25м), факт: ${pRightEvade.posUke1[0]}м`);
assert.ok(pRightEvade.isEvaded, 'Флаг уклонения isEvaded должен быть true');

// Идеальный угол поворота на Тори
const expectedRightYaw = Math.atan2(
  pRightEvade.posTori[0] - pRightEvade.posUke1[0],
  pRightEvade.posTori[2] - pRightEvade.posUke1[2]
);
const diffRight = Math.abs(pRightEvade.rotUke1[1] - expectedRightYaw);
assert.ok(diffRight < 0.05, `Укэ должен быть развернут строго на Тори (погрешность: ${diffRight.toFixed(4)} рад)`);
assert.ok(pRightEvade.coordinates.uke1.isFacingOpponent, 'Флаг isFacingOpponent должен быть true');
assert.ok(pRightEvade.coordinates.uke1.facingAngleToOpponentDeg <= 2.0, `Угол отклонения взгляда должен быть <= 2° (факт: ${pRightEvade.coordinates.uke1.facingAngleToOpponentDeg}°)`);

console.log(`  Позиция Укэ после ухода: [X: +${pRightEvade.posUke1[0].toFixed(2)}м, Z: ${pRightEvade.posUke1[2].toFixed(2)}м]`);
console.log(`  Угол поворота Укэ: ${pRightEvade.coordinates.uke1.yawDeg}° (${pRightEvade.rotUke1[1].toFixed(2)} rad)`);
console.log(`  Соосность с противником: ${pRightEvade.coordinates.uke1.facingAngleToOpponentDeg}° (isFacingOpponent: ${pRightEvade.coordinates.uke1.isFacingOpponent})`);
console.log('✓ Тест 3 пройден: при уходе вправо с блоком Укэ развернут точно к Тори.\n');

// -----------------------------------------------------------------------------
// ТЕСТ 4: Блок с уходом влево (-35°) при сохранении разворота лицом к противнику
// -----------------------------------------------------------------------------
console.log('--- Тест 4: Блок с уходом влево (-35°) и авто-поворот лицом к атакующему ---');
const pLeftEvade = computeAvatarPlacement({
  episode: {
    stepNumber: 5,
    title: 'Атака и блок с уходом влево',
    optimalDistance: 1.45,
    attackAngleDeg: 0,
    contactType: 'block_jodan',
    toriTrajectory: { start: [0, 0, -0.45], end: [0, 0, 0.15], startYaw: 0, endYaw: 0 },
    ukeTrajectory: { start: [0, 0, 1.00], end: [-0.35, 0, 1.30], startYaw: Math.PI, endYaw: 2.85 },
    participants: [
      { role: 'tori', clipName: 'tech_oi_zuki_right' },
      { role: 'uke1', clipName: 'tech_age_uke_left' },
    ],
  },
  ukeEvasionAngleDeg: -35,
});

assert.ok(pLeftEvade.posUke1[0] < -0.25, `Укэ должен сместиться влево по оси X (<-0.25м), факт: ${pLeftEvade.posUke1[0]}м`);
assert.ok(pLeftEvade.isEvaded, 'Флаг уклонения isEvaded должен быть true');

const expectedLeftYaw = Math.atan2(
  pLeftEvade.posTori[0] - pLeftEvade.posUke1[0],
  pLeftEvade.posTori[2] - pLeftEvade.posUke1[2]
);
const diffLeft = Math.abs(pLeftEvade.rotUke1[1] - expectedLeftYaw);
assert.ok(diffLeft < 0.05, `Укэ должен быть развернут строго на Тори (погрешность: ${diffLeft.toFixed(4)} рад)`);
assert.ok(pLeftEvade.coordinates.uke1.isFacingOpponent, 'Флаг isFacingOpponent должен быть true');

console.log(`  Позиция Укэ после ухода: [X: ${pLeftEvade.posUke1[0].toFixed(2)}м, Z: ${pLeftEvade.posUke1[2].toFixed(2)}м]`);
console.log(`  Угол поворота Укэ: ${pLeftEvade.coordinates.uke1.yawDeg}° (${pLeftEvade.rotUke1[1].toFixed(2)} rad)`);
console.log(`  Соосность с противником: ${pLeftEvade.coordinates.uke1.facingAngleToOpponentDeg}° (isFacingOpponent: ${pLeftEvade.coordinates.uke1.isFacingOpponent})`);
console.log('✓ Тест 4 пройден: при уходе влево с блоком Укэ развернут точно к Тори.\n');

// -----------------------------------------------------------------------------
// ТЕСТ 5: Проверка канонического шага Маэ-гэри vs отход 35° и Гэдан-барай (Шаг 3 / исх. 5.1)
// -----------------------------------------------------------------------------
console.log('--- Тест 5: Канонический Шаг 3 (Маэ-гэри vs отход 35° и Гэдан-барай) ---');
const step5 = HEIAN_SHODAN_BUNKAI_18_STEPS[2];
assert.strictEqual(step5.stepNumber, 3, 'Шаг 3 должен иметь stepNumber = 3');

const pStep5 = computeAvatarPlacement({ episode: step5 });
assert.ok(pStep5.posUke1[0] > 0.20, `Укэ на шаге 5 должен быть смещен вправо (X=${pStep5.posUke1[0]}м)`);

const diffStep5 = Math.abs(
  pStep5.rotUke1[1] -
  Math.atan2(pStep5.posTori[0] - pStep5.posUke1[0], pStep5.posTori[2] - pStep5.posUke1[2])
);
assert.ok(diffStep5 < 0.05, `На шаге 5 Укэ должен смотреть точно на Тори (погрешность: ${diffStep5.toFixed(4)} рад)`);
assert.ok(pStep5.coordinates.uke1.isFacingOpponent, 'Укэ должен быть помечен как смотрящий на противника');
console.log(`  Шаг 5: Тори pos=[${pStep5.posTori.join(', ')}], Укэ pos=[${pStep5.posUke1.join(', ')}], Yaw Укэ=${pStep5.coordinates.uke1.yawDeg}°`);
console.log('✓ Тест 5 пройден: канонический шаг 5 ориентирует Укэ строго на Тори.\n');

// -----------------------------------------------------------------------------
// ТЕСТ 6: Прямое задание координат через customPosX / customPosZ
// -----------------------------------------------------------------------------
console.log('--- Тест 6: Прямое позиционирование через customPosX и customPosZ ---');
const pCustomPos = computeAvatarPlacement({
  episode: ep1,
  customToriPosX: -0.50,
  customToriPosZ: 0.10,
  customUkePosX: 0.40,
  customUkePosZ: 1.50,
});

assert.strictEqual(pCustomPos.posTori[0], -0.50, 'customToriPosX должен быть -0.50м');
assert.strictEqual(pCustomPos.posTori[2], 0.10, 'customToriPosZ должен быть 0.10м');
assert.strictEqual(pCustomPos.posUke1[0], 0.40, 'customUkePosX должен быть 0.40м');
assert.strictEqual(pCustomPos.posUke1[2], 1.50, 'customUkePosZ должен быть 1.50м');

// При прямом смещении Укэ вправо на 0.40м, Укэ разворачивается к Тори
assert.ok(pCustomPos.coordinates.uke1.isFacingOpponent, 'При ручном смещении Укэ должен повернуться к Тори');
console.log(`  Ручные координаты: Тори=[${pCustomPos.posTori.join(', ')}], Укэ=[${pCustomPos.posUke1.join(', ')}]`);
console.log(`  Угол поворота Укэ: ${pCustomPos.coordinates.uke1.yawDeg}° (направлен прямо на Тори)`);
console.log('✓ Тест 6 пройден: ручное задание координат через оси X и Z работает безупречно.\n');

console.log('========================================================================');
console.log('ВСЕ ТЕСТЫ СИСТЕМЫ КООРДИНАТ И РАЗВОРОТОВ МОДЕЛЕЙ ПРИ БЛОКЕ С УХОДОМ ПРОЙДЕНЫ!');
console.log('========================================================================');
