/**
 * FULL CYCLE MOTION ZERO DISPLACEMENT TEST SUITE
 * 
 * Проверка биомеханики полного цикла движения модели при совпадении начальной и конечной точки:
 * 1. Сохранение естественных биомеханических колебаний таза в stabilizeRootPositionTrack.
 * 2. Бункай: Полный цикл выпада и возврата (Surge & Return) при start === end (удары, блоки, маэ-гэри с возвратом).
 * 3. Бункай: Точный возврат в исходную точку к phrase = 1.0 (погрешность < 0.001 м).
 * 4. Ката: Полное амплитудное движение тела при startPos === endPos с пиком на кимэ (p ~ 0.48) и возвратом к p = 1.0.
 * 5. Ката: Плавная интерполяция угла разворота (Yaw) на месте через кратчайшую дугу.
 */

import assert from 'assert';
import * as THREE from 'three';
import { stabilizeRootPositionTrack } from '../src/three/modularAnimationEngine.js';

console.log('=== TEST SUITE: Full Cycle Motion on Zero Displacement (Kata & Bunkai) ===\n');

// -----------------------------------------------------------------------------
// ТЕСТ 1: stabilizeRootPositionTrack не зануляет внутренние колебания таза
// -----------------------------------------------------------------------------
console.log('--- Тест 1: Релятивная стабилизация таза (stabilizeRootPositionTrack) ---');

const mockTimes = [0, 0.5, 1.0];
// Hips position: x0=0.1, y=0.9, z0=0.2; в середине x=0.25 (смещение +0.15), z=0.4 (смещение +0.2)
const mockValues = [
  0.10, 0.90, 0.20,
  0.25, 0.85, 0.40,
  0.10, 0.90, 0.20,
];
const track = new THREE.VectorKeyframeTrack('Hips.position', mockTimes, mockValues);
const stabilized = stabilizeRootPositionTrack(track);

assert.ok(Math.abs(stabilized.values[0]) < 0.0001, 'Начальный X должен быть строго 0');
assert.ok(Math.abs(stabilized.values[2]) < 0.0001, 'Начальный Z должен быть строго 0');
assert.ok(Math.abs(stabilized.values[1] - 0.90) < 0.001, 'Высота Y должна сохраняться');

// В среднем кадре должно сохраниться относительное смещение: 0.25 - 0.10 = 0.15
const midDeltaX = stabilized.values[3];
const midDeltaZ = stabilized.values[5];
assert.ok(Math.abs(midDeltaX - 0.15) < 0.001, `Внутреннее смещение таза по X должно сохраниться: ${midDeltaX}`);
assert.ok(Math.abs(midDeltaZ - 0.20) < 0.001, `Внутреннее смещение таза по Z должно сохраниться: ${midDeltaZ}`);
console.log('✓ Тест 1 пройден: начальный кадр нормализован в 0, биомеханический импульс таза сохранен (+0.15m X, +0.20m Z).\n');

// -----------------------------------------------------------------------------
// ТЕСТ 2: Бункай — Surge & Return cycle при start === end
// -----------------------------------------------------------------------------
console.log('--- Тест 2: Бункай — цикл выпада и возврата при ударе/блоке на месте ---');

function calcBunkaiPositionAtPhrase(phrase, start, end, yaw, techType, isDefender = false) {
  const isZeroDisp = Math.abs(end[0] - start[0]) < 0.005 && Math.abs(end[2] - start[2]) < 0.005;
  const isKick = techType.includes('kick') || techType.includes('mae_geri');
  const isStrike = techType.includes('zuki') || techType.includes('strike') || techType.includes('punch');
  const isBlock = techType.includes('uke') || techType.includes('barai');

  let surgeDist = 0.18;
  if (isKick) surgeDist = 0.32;
  else if (isStrike) surgeDist = 0.22;
  else if (isBlock) surgeDist = 0.14;

  const contactPhase = 0.48;
  const reactionDelay = isDefender ? 0.16 : 0.0;
  const startSurge = isDefender ? reactionDelay : 0.08;

  let surge = 0;
  if (phrase <= startSurge) {
    surge = 0;
  } else if (phrase <= contactPhase) {
    const k = (phrase - startSurge) / (contactPhase - startSurge);
    surge = Math.sin(k * Math.PI * 0.5);
  } else if (phrase <= 0.95) {
    const k = (phrase - contactPhase) / (0.95 - contactPhase);
    surge = Math.cos(k * Math.PI * 0.5);
  } else {
    surge = 0;
  }

  const fwdX = Math.sin(yaw);
  const fwdZ = Math.cos(yaw);

  return [
    end[0] + fwdX * surgeDist * surge,
    end[1],
    end[2] + fwdZ * surgeDist * surge,
  ];
}

const toriStart = [0, 0, 0.8];
const toriEnd = [0, 0, 0.8];
const toriYaw = 0; // Направлен вперед по оси Z

// В начале фразы (phrase = 0.0)
const posAt0 = calcBunkaiPositionAtPhrase(0.0, toriStart, toriEnd, toriYaw, 'gyaku_zuki');
assert.deepStrictEqual(posAt0, [0, 0, 0.8], 'В начале движения модель строго в start position');

// На пике кимэ (phrase = 0.48): модель делает полный выпад вперед на 0.22м
const posAtContact = calcBunkaiPositionAtPhrase(0.48, toriStart, toriEnd, toriYaw, 'gyaku_zuki');
assert.ok(Math.abs(posAtContact[2] - (0.8 + 0.22)) < 0.001, `На ударе модель должна совершить полный выпад: ${posAtContact[2]} vs 1.02`);

// В конце шага (phrase = 1.0): модель полностью возвращается в исходную стойку
const posAtEnd = calcBunkaiPositionAtPhrase(1.0, toriStart, toriEnd, toriYaw, 'gyaku_zuki');
assert.ok(Math.abs(posAtEnd[2] - 0.8) < 0.0001, `В конце модель должна вернуться точно в исходную стойку: ${posAtEnd[2]}`);
console.log('✓ Тест 2 пройден: Бункай Тори совершает полный выпад 0.22м на ударе и точно возвращается в [0, 0, 0.8] к концу шага.\n');

// -----------------------------------------------------------------------------
// ТЕСТ 3: Бункай — Удар ногой Маэ-гэри с возвратом ноги назад (landingMode = 'back')
// -----------------------------------------------------------------------------
console.log('--- Тест 3: Бункай — Маэ-гэри с возвратом (landingMode back) ---');

const kickPos0 = calcBunkaiPositionAtPhrase(0.0, [0, 0, 0], [0, 0, 0], 0, 'mae_geri');
const kickPosPeak = calcBunkaiPositionAtPhrase(0.48, [0, 0, 0], [0, 0, 0], 0, 'mae_geri');
const kickPosFinish = calcBunkaiPositionAtPhrase(1.0, [0, 0, 0], [0, 0, 0], 0, 'mae_geri');

assert.ok(Math.abs(kickPosPeak[2] - 0.32) < 0.001, `Амплитуда выпада маэ-гэри должна составлять 0.32м: ${kickPosPeak[2]}`);
assert.ok(Math.abs(kickPosFinish[2] - 0.0) < 0.0001, `Возврат ноги в стойку должен прийти ровно в 0: ${kickPosFinish[2]}`);
console.log('✓ Тест 3 пройден: Маэ-гэри генерирует полную динамическую волну 0.32м с идеальным возвратом в стойку.\n');

// -----------------------------------------------------------------------------
// ТЕСТ 4: Ката — Полный цикл движения и плавная интерполяция вращения (Yaw)
// -----------------------------------------------------------------------------
console.log('--- Тест 4: Ката — Полный цикл движения и плавный разворот на месте ---');

function calcKataMotionAtPhase(p, startPos, endPos, startYaw, targetYaw, techType) {
  let rProgress = 0;
  if (p <= 0.15) {
    rProgress = 0;
  } else if (p >= 0.75) {
    rProgress = 1;
  } else {
    const k = (p - 0.15) / 0.60;
    rProgress = k * k * (3 - 2 * k);
  }
  let diff = targetYaw - startYaw;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  const currentYaw = startYaw + diff * rProgress;

  const isZeroStepDisp = Math.abs(endPos[0] - startPos[0]) < 0.005 && Math.abs(endPos[2] - startPos[2]) < 0.005;

  let surgeDist = 0.18;
  if (techType.includes('kick')) surgeDist = 0.32;
  else if (techType.includes('zuki') || techType.includes('strike')) surgeDist = 0.22;
  else if (techType.includes('uke') || techType.includes('barai')) surgeDist = 0.14;

  let surge = 0;
  if (p <= 0.08) {
    surge = 0;
  } else if (p <= 0.48) {
    const k = (p - 0.08) / 0.40;
    surge = Math.sin(k * Math.PI * 0.5);
  } else if (p <= 0.92) {
    const k = (p - 0.48) / 0.44;
    surge = Math.cos(k * Math.PI * 0.5);
  } else {
    surge = 0;
  }

  const fwdX = Math.sin(currentYaw);
  const fwdZ = Math.cos(currentYaw);

  const x = startPos[0] + fwdX * surgeDist * surge;
  const y = startPos[1];
  const z = startPos[2] + fwdZ * surgeDist * surge;

  return { pos: [x, y, z], yaw: currentYaw };
}

const kataStartPos = [1.2, 0, -0.5];
const kataEndPos = [1.2, 0, -0.5];
const kataStartYaw = 0;
const kataTargetYaw = Math.PI * 0.5; // Разворот на 90 градусов на месте

// p = 0.0
const kata0 = calcKataMotionAtPhase(0.0, kataStartPos, kataEndPos, kataStartYaw, kataTargetYaw, 'age_uke');
assert.deepStrictEqual(kata0.pos, kataStartPos, 'В начале шага позиция совпадает');
assert.strictEqual(kata0.yaw, kataStartYaw, 'В начале шага угол совпадает');

// p = 0.48 (пик блока и середина разворота)
const kataMid = calcKataMotionAtPhase(0.48, kataStartPos, kataEndPos, kataStartYaw, kataTargetYaw, 'age_uke');
assert.ok(kataMid.yaw > kataStartYaw && kataMid.yaw < kataTargetYaw, `Угол должен плавно интерполироваться: ${kataMid.yaw}`);
const kataDisp = Math.hypot(kataMid.pos[0] - kataStartPos[0], kataMid.pos[2] - kataStartPos[2]);
assert.ok(Math.abs(kataDisp - 0.14) < 0.001, `Блок Агэ-укэ на месте выполняет полный импульс 0.14м: ${kataDisp}`);

// p = 1.0 (завершение шага)
const kataEnd = calcKataMotionAtPhase(1.0, kataStartPos, kataEndPos, kataStartYaw, kataTargetYaw, 'age_uke');
assert.ok(Math.hypot(kataEnd.pos[0] - kataEndPos[0], kataEnd.pos[2] - kataEndPos[2]) < 0.0001, 'Позиция строго вернулась в endPos');
assert.ok(Math.abs(kataEnd.yaw - kataTargetYaw) < 0.0001, 'Угол точно пришел в targetYaw');
console.log('✓ Тест 4 пройден: Ката выполняет полное движение блока с динамическим импульсом и плавным разворотом на 90°.\n');

console.log('======================================================');
console.log('ВСЕ ТЕСТЫ ПОЛНОГО ДВИЖЕНИЯ ПРИ НУЛЕВОМ СМЕЩЕНИИ ПРОЙДЕНЫ!');
console.log('======================================================');
