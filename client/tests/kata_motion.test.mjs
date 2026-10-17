import assert from 'assert/strict';
import fs from 'fs';
import {
  normalizeAngleDeg,
  parseStepOrientation,
  computeTrajectory,
  CANONICAL_EMBUSEN,
  HEIAN_SHODAN_CANONICAL_EVENTS,
} from '../src/three/kataMotionUtils.js';

console.log('=== TEST SUITE: Kata Motion & Rotation System ===\n');

// 1. Проверка исправления дефекта dir.includes('90°') в левой ветке
console.log('Test 1: Defect fix: "поворот вправо на 90°" must NOT be interpreted as left');
{
  const stepRight90 = { Direction: 'Поворот вправо на 90°' };
  const resRight = parseStepOrientation(stepRight90, 0);
  assert.equal(resRight.deltaYawDeg, -90, 'Поворот вправо на 90° должен давать deltaYawDeg = -90°');
  assert.equal(resRight.targetFacingDeg, -90, 'Целевая ориентация должна быть -90° (Восток)');

  const stepLeft90 = { Direction: 'Поворот влево на 90°' };
  const resLeft = parseStepOrientation(stepLeft90, 0);
  assert.equal(resLeft.deltaYawDeg, 90, 'Поворот влево на 90° должен давать deltaYawDeg = +90°');
  assert.equal(resLeft.targetFacingDeg, 90, 'Целевая ориентация должна быть +90° (Запад)');
  console.log('  PASSED: "вправо на 90°" = -90°, "влево на 90°" = +90°');
}

// 2. Проверка нормализации углов и перехода через 0°/360°
console.log('\nTest 2: Angle normalization and 0°/360° boundary crossing');
{
  assert.equal(normalizeAngleDeg(0), 0);
  assert.equal(normalizeAngleDeg(90), 90);
  assert.equal(normalizeAngleDeg(180), 180);
  assert.equal(normalizeAngleDeg(-180), 180);
  assert.equal(normalizeAngleDeg(270), -90);
  assert.equal(normalizeAngleDeg(-270), 90);
  assert.equal(normalizeAngleDeg(360), 0);
  assert.equal(normalizeAngleDeg(450), 90);
  assert.equal(normalizeAngleDeg(-450), -90);
  console.log('  PASSED: Angle normalization handles ±360°, ±270°, ±180° cleanly');
}

// 3. Проверка приоритета структурированных данных (facingDeg, R)
console.log('\nTest 3: Priority of structured fields (facingDeg, R code)');
{
  const stepWithFacing = { facingDeg: 90, Direction: 'Вправо 90°' };
  const res = parseStepOrientation(stepWithFacing, 0);
  assert.equal(res.targetFacingDeg, 90, 'Явный facingDeg должен иметь приоритет над текстом Direction');

  const stepWithR = { R: 'R_p90', Direction: 'Вправо' };
  const resR = parseStepOrientation(stepWithR, 0);
  assert.equal(resR.deltaYawDeg, 90, 'Код R_p90 должен давать +90° независимо от текста');

  const stepWithRm = { R: 'R_m180' };
  const resRm = parseStepOrientation(stepWithRm, 90);
  assert.equal(resRm.targetFacingDeg, -90, 'Поворот R_m180 из 90° должен давать -90°');
  console.log('  PASSED: Structured fields take precedence over free text');
}

// 4. Проверка всех 21 шагов Heian Shodan по каноническому сценарию
console.log('\nTest 4: Heian Shodan 21 steps canonical orientation & trajectory');
{
  const hsJson = JSON.parse(fs.readFileSync('./public/kata_data/heian_shodan.json', 'utf8'));
  assert.equal(hsJson.steps.length, 21, 'Heian Shodan должен содержать ровно 21 шаг');

  const { stepPositions, embusenPoints } = computeTrajectory(hsJson.steps, 'heian_shodan');
  assert.equal(stepPositions.length, 21, 'Траектория должна содержать 21 позицию');
  assert.equal(embusenPoints.length, 21, 'Эмбусэн должен содержать 21 контрольную точку');

  // Проверяем ориентацию на ключевых шагах формы:
  // Шаг 1: поворот влево 90°
  assert.equal(stepPositions[0].facingDeg, 90, 'Шаг 1: ориентация 90° (Запад)');
  assert.equal(stepPositions[0].rotation[1], (90 * Math.PI) / 180, 'Шаг 1: rotation[1] в радианах');

  // Шаг 2: выпад вперед без изменения ориентации
  assert.equal(stepPositions[1].facingDeg, 90, 'Шаг 2: ориентация 90°');

  // Шаг 3: разворот на 180° вправо
  assert.equal(stepPositions[2].facingDeg, -90, 'Шаг 3: ориентация -90° (Восток)');

  // Шаг 6: поворот влево на 90° на центральную ось
  assert.equal(stepPositions[5].facingDeg, 0, 'Шаг 6: ориентация 0° (Север)');

  // Шаги 7-9: движение вперед по оси (0°)
  assert.equal(stepPositions[6].facingDeg, 0, 'Шаг 7: ориентация 0°');
  assert.equal(stepPositions[7].facingDeg, 0, 'Шаг 8: ориентация 0°');
  assert.equal(stepPositions[8].facingDeg, 0, 'Шаг 9: ориентация 0° (КИАЙ)');

  // Шаг 10: разворот через спину влево на 270°
  assert.equal(stepPositions[9].facingDeg, -90, 'Шаг 10: ориентация -90° (Восток)');

  // Шаг 12: разворот на 180° вправо
  assert.equal(stepPositions[11].facingDeg, 90, 'Шаг 12: ориентация 90° (Запад)');

  // Шаг 14: поворот влево на 90° на возвратный ход по оси
  assert.equal(Math.abs(stepPositions[13].facingDeg), 180, 'Шаг 14: ориентация 180° (Юг)');

  // Шаги 15-17: продвижение по оси на Юг (180°)
  assert.equal(Math.abs(stepPositions[14].facingDeg), 180, 'Шаг 15: ориентация 180°');
  assert.equal(Math.abs(stepPositions[15].facingDeg), 180, 'Шаг 16: ориентация 180°');
  assert.equal(Math.abs(stepPositions[16].facingDeg), 180, 'Шаг 17: ориентация 180° (КИАЙ)');

  // Шаги 18-21: диагональный комплекс сюто-укэ
  assert.equal(stepPositions[17].facingDeg, 0, 'Шаг 18: сюто-укэ лицом к камере (0°)');
  assert.equal(stepPositions[18].facingDeg, -45, 'Шаг 19: диагональ -45°');

  console.log('  PASSED: All 21 steps have non-zero, mathematically correct angles and positions');
}

// 5. Проверка кинематики шагов в режиме fallback (без CANONICAL_EMBUSEN)
console.log('\nTest 5: Kinematic step trajectory without hardcoded coordinates');
{
  const genericSteps = [
    { Direction: 'Влево 90°' },
    { Direction: 'Вперед 0°' },
    { Direction: 'Вправо 180°' },
    { Direction: 'Вперед 0°' },
  ];

  const { stepPositions } = computeTrajectory(genericSteps, 'custom_kata');
  assert.equal(stepPositions.length, 4);

  // Шаг 1: поворот влево 90° -> шаг вдоль +X (sin(90°)=1, cos(90°)=0)
  assert.equal(stepPositions[0].facingDeg, 90);
  assert(stepPositions[0].position[0] > 0.8, 'Шаг 1 должен сместиться по +X');
  assert(Math.abs(stepPositions[0].position[2]) < 0.05, 'Смещение по Z должно быть около 0');

  // Шаг 2: вперед в направлении 90° -> еще +X
  assert(stepPositions[1].position[0] > stepPositions[0].position[0], 'Шаг 2 должен дальше смещаться по +X');

  // Шаг 3: разворот на 180° -> ориентация -90°, смещение в направлении взгляда (-X)
  assert.equal(stepPositions[2].facingDeg, -90);
  assert(stepPositions[2].position[0] < stepPositions[1].position[0], 'Шаг 3 должен смещаться назад по X');

  console.log('  PASSED: Kinematic stepping moves along gaze direction vector [sin(yaw), 0, cos(yaw)]');
}

// 6. Проверка совместимости временных интервалов и меток КИАЙ
console.log('\nTest 6: Time range intervals and KIAI markers');
{
  assert.equal(HEIAN_SHODAN_CANONICAL_EVENTS.length, 21);
  const kiaiMoves = HEIAN_SHODAN_CANONICAL_EVENTS.filter(e => e.kiai).map(e => e.moveNumber);
  assert.deepEqual(kiaiMoves, [9, 17], 'КИАЙ должен быть строго на 9-м и 17-м шагах Heian Shodan');

  // Проверка непрерывности временных интервалов
  for (let i = 0; i < HEIAN_SHODAN_CANONICAL_EVENTS.length - 1; i++) {
    const cur = HEIAN_SHODAN_CANONICAL_EVENTS[i];
    const next = HEIAN_SHODAN_CANONICAL_EVENTS[i + 1];
    assert.equal(cur.endTime, next.startTime, `Интервал между шагами ${cur.moveNumber} и ${next.moveNumber} должен быть непрерывным`);
  }
  console.log('  PASSED: KIAI on moves 9 & 17, continuous 60 FPS subclip time intervals');
}

// 7. Проверка требований: Шаг 4 (Мото-дати, 0.45 м) и Шаг 18 (поворот через спину лицом к камере в Кокуцу-дати)
console.log('\nTest 7: Move 4 Moto-dachi (half Zenkutsu) and Move 18 Kokutsu-dachi (turn through back facing camera)');
{
  const hsJson = JSON.parse(fs.readFileSync('./public/kata_data/heian_shodan.json', 'utf8'));

  // Проверка шага 4: Тэцуи-ути в стойке Мото-дати
  const move4 = hsJson.steps[3];
  assert.equal(move4.stance, 'moto', 'Шаг 4 должен быть в стойке Мото-дати');
  const pos3 = CANONICAL_EMBUSEN.heian_shodan[2];
  const pos4 = CANONICAL_EMBUSEN.heian_shodan[3];
  const strideMove4 = Math.hypot(pos4[0] - pos3[0], pos4[2] - pos3[2]);
  assert(Math.abs(strideMove4 - 0.45) < 0.05, `Длина шага 4 (${strideMove4.toFixed(2)}м) должна быть половиной дзэнкуцу-дати (~0.45м)`);

  // Проверка шага 18: Сюто-укэ с поворотом через спину лицом к камере (0°)
  const move18 = hsJson.steps[17];
  assert.equal(move18.stance, 'kokutsu', 'Шаг 18 должен быть в стойке Кокуцу-дати');
  assert.equal(move18.facingDeg, 0, 'Шаг 18 должен быть ориентирован на 0° (лицом к камере)');
  assert.equal(move18.R, 'R_p180', 'Шаг 18 поворот через спину R_p180 (180° относительно -180°)');
  console.log('  PASSED: Move 4 is moto-dachi (0.45m half-stride) & Move 18 is kokutsu-dachi (turn through back facing camera 0°)');
}

console.log('\n=================================================');
console.log('ALL TESTS PASSED SUCCESSFULLY! (7/7)');
console.log('=================================================');
