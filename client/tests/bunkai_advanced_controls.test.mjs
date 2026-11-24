import assert from 'assert/strict';
import {
  computeAvatarPlacement,
  isTechniqueStationary,
} from '../src/three/bunkaiScenarioEngine.js';

console.log('=== TEST SUITE: Bunkai Advanced Controls & Anti-Penetration ===\n');

// 1. Проверка определения стационарных техник (устранение скольжения)
console.log('Test 1: isTechniqueStationary detects blocks and stationary kicks');
{
  assert.equal(isTechniqueStationary('gedan_barai_left', 'auto'), true);
  assert.equal(isTechniqueStationary('age_uke_left', 'auto'), true);
  assert.equal(isTechniqueStationary('shuto_uke', 'auto'), true);
  assert.equal(isTechniqueStationary('choku_zuki', 'auto'), true);
  assert.equal(isTechniqueStationary('gyaku_zuki_right', 'auto'), true);
  assert.equal(isTechniqueStationary('mae_geri_right', 'back'), true);
  assert.equal(isTechniqueStationary('mae_geri_right', 'retract'), true);
  assert.equal(isTechniqueStationary('mae_geri_right', 'forward'), false);
  assert.equal(isTechniqueStationary('mae_geri_right', 'step_forward'), false);
  assert.equal(isTechniqueStationary('oi_zuki_right', 'auto'), false);
  console.log('  PASSED: isTechniqueStationary correctly identifies stationary moves');
}

// 2. Проверка настройки дистанции боя (Ma-ai)
console.log('\nTest 2: Combat Distance dynamic adjustment');
{
  const episode = {
    stepNumber: 1,
    combatDistance: 1.45,
    attackAngleDeg: 0,
    toriEvasionAngleDeg: 0,
    participants: [
      { role: 'tori', clipName: 'age_uke_left', stance: 'zenkutsu_dachi_left' },
      { role: 'uke1', clipName: 'oi_zuki_right', stance: 'zenkutsu_dachi_left' },
    ],
  };

  const placement1 = computeAvatarPlacement({ episode, customDistance: 2.20 });
  const dist1 = Math.hypot(
    placement1.endPosUke1[0] - placement1.endPosTori[0],
    placement1.endPosUke1[2] - placement1.endPosTori[2]
  );
  assert.ok(Math.abs(dist1 - 2.20) < 0.1, `Distance should be ~2.20, got ${dist1}`);

  const placement2 = computeAvatarPlacement({ episode, customDistance: 1.10 });
  const dist2 = Math.hypot(
    placement2.endPosUke1[0] - placement2.endPosTori[0],
    placement2.endPosUke1[2] - placement2.endPosTori[2]
  );
  assert.ok(Math.abs(dist2 - 1.10) < 0.1, `Distance should be ~1.10, got ${dist2}`);
  console.log('  PASSED: Distance changes dynamically with user setting');
}

// 3. Проверка угла атаки Укэ и угла ухода Тори с доворотом взгляда на противника
console.log('\nTest 3: Attack angle & Tori Evasion Angle with Look-At Lock');
{
  const episode = {
    stepNumber: 1,
    combatDistance: 1.50,
    participants: [
      { role: 'tori', clipName: 'age_uke_left', stance: 'zenkutsu_dachi_left' },
      { role: 'uke1', clipName: 'oi_zuki_right', stance: 'zenkutsu_dachi_left' },
    ],
  };

  // Уход Тори под 45 градусов
  const placement = computeAvatarPlacement({
    episode,
    ukeAngleOffsetDeg: 15,
    toriEvasionAngleDeg: 45,
  });

  // Тори сместился вбок
  assert.notEqual(placement.endPosTori[0], 0, 'Tori should have X displacement');
  
  // Тори смотрит прямо на Укэ (rotTori[1] совпадает с вектором на Укэ)
  const dx = placement.endPosUke1[0] - placement.endPosTori[0];
  const dz = placement.endPosUke1[2] - placement.endPosTori[2];
  const expectedLookAtYaw = Math.atan2(dx, dz);
  assert.ok(
    Math.abs(placement.rotTori[1] - expectedLookAtYaw) < 0.001,
    'Tori endYaw must face Uke directly'
  );
  console.log('  PASSED: Tori evasion moves off-line and locks look-at gaze onto Uke');
}

// 4. Проверка предотвращения скольжения для неподвижных техник
console.log('\nTest 4: Elimination of foot sliding on stationary moves');
{
  const episode = {
    stepNumber: 1,
    combatDistance: 1.50,
    participants: [
      { role: 'tori', clipName: 'age_uke_left', stance: 'zenkutsu_dachi_left' },
      { role: 'uke1', clipName: 'oi_zuki_right', stance: 'zenkutsu_dachi_left' },
    ],
  };

  const placement = computeAvatarPlacement({
    episode,
    customToriClip: 'age_uke_left', // Стационарный блок
    toriEvasionAngleDeg: 0,
  });

  assert.deepEqual(placement.startPosTori, placement.endPosTori, 'Stationary block must have start === end to prevent sliding');
  console.log('  PASSED: Stationary moves have start === end, preventing foot sliding');
}

// 5. Проверка защиты от прохождения сквозь друг друга (Anti-Penetration minSafeDist)
console.log('\nTest 5: Anti-penetration minimum safe separation');
{
  const episode = {
    stepNumber: 1,
    combatDistance: 0.50, // Слишком близко
    participants: [
      { role: 'tori', clipName: 'age_uke_left', stance: 'zenkutsu_dachi_left' },
      { role: 'uke1', clipName: 'oi_zuki_right', stance: 'zenkutsu_dachi_left' },
    ],
  };

  const placement = computeAvatarPlacement({ episode, customDistance: 0.40 });
  const finalDist = Math.hypot(
    placement.endPosUke1[0] - placement.endPosTori[0],
    placement.endPosUke1[2] - placement.endPosTori[2]
  );
  assert.ok(finalDist >= 0.55, `Final distance must be >= minSafeDist (0.58m), got ${finalDist}`);
  console.log(`  PASSED: Models are clamped to safe clearance distance (${finalDist.toFixed(2)}m >= 0.58m)`);
}

console.log('\n=================================================');
console.log('ALL ADVANCED BUNKAI MOTION TESTS PASSED!');
console.log('=================================================');
