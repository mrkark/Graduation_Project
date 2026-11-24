import assert from 'assert/strict';
import {
  SHOTOKAN_STANCES,
  BUNKAI_ORIENTATION_MODES,
  BUNKAI_TURN_MECHANICS,
  BUNKAI_ACTION_TYPES,
  validateBunkaiBiomechanics,
  computeAvatarPlacement,
  isTechniqueStationary,
} from '../src/three/bunkaiScenarioEngine.js';

console.log('=== TEST SUITE: Universal Motion Control Panel & Biomechanics ===\n');

// 1. Тест: Выбор левосторонней и правосторонней Дзэнкуцу-дати (Хидари vs Миги)
console.log('Test 1: Explicit selection of Hidari Zenkutsu and Migi Zenkutsu');
{
  const hidari = SHOTOKAN_STANCES['zenkutsu_dachi_left'];
  const migi = SHOTOKAN_STANCES['zenkutsu_dachi_right'];

  assert.ok(hidari, 'Zenkutsu dachi left should exist');
  assert.ok(migi, 'Zenkutsu dachi right should exist');
  assert.equal(hidari.side, 'left', 'Hidari side must be left');
  assert.equal(migi.side, 'right', 'Migi side must be right');
  assert.deepEqual(hidari.weightRatio, [60, 40], 'Zenkutsu weight distribution is 60/40');
  assert.deepEqual(migi.weightRatio, [60, 40], 'Zenkutsu weight distribution is 60/40');
  
  // Зеркальное отражение углов стоп и таза
  assert.equal(hidari.rearFootAngle, 45, 'Hidari rear foot points +45°');
  assert.equal(migi.rearFootAngle, -45, 'Migi rear foot points -45°');
  assert.equal(hidari.hipAngle, 45, 'Hidari hip is Hanmi +45°');
  assert.equal(migi.hipAngle, -45, 'Migi hip is Hanmi -45°');
  console.log('  PASSED: Left & Right Zenkutsu dachi anatomically verified');
}

// 2. Тест: Все 8 стоек Сётокан определены со спецификациями
console.log('\nTest 2: All 8 Shotokan stances configured');
{
  const requiredStances = [
    'heiko_dachi',
    'stance_musubi',
    'zenkutsu_dachi_left',
    'zenkutsu_dachi_right',
    'kokutsu_dachi_left',
    'kokutsu_dachi_right',
    'kiba_dachi',
    'fudo_dachi',
    'stance_heisoku',
    'stance_shiko',
  ];

  for (const st of requiredStances) {
    assert.ok(SHOTOKAN_STANCES[st], `Stance ${st} must be defined`);
    assert.ok(SHOTOKAN_STANCES[st].nameRu, `Stance ${st} must have Russian name`);
    assert.ok(SHOTOKAN_STANCES[st].weightRatio, `Stance ${st} must have weight ratio`);
    assert.ok(SHOTOKAN_STANCES[st].feetDistance > 0 || st === 'stance_heisoku', `Feet distance must be valid`);
  }
  console.log('  PASSED: 8 Shotokan stances fully registered with biomechanics specs');
}

// 3. Тест: 5 Режимов пространственной ориентации
console.log('\nTest 3: 5 Spatial Orientation Modes');
{
  assert.equal(BUNKAI_ORIENTATION_MODES.length, 5, 'Must have exactly 5 orientation modes');
  const modeIds = BUNKAI_ORIENTATION_MODES.map((m) => m.id);
  assert.ok(modeIds.includes('mode1_free'), 'Mode 1 Free exists');
  assert.ok(modeIds.includes('mode2_look_at'), 'Mode 2 Look-At exists');
  assert.ok(modeIds.includes('mode3_relative_angle'), 'Mode 3 Relative Angle exists');
  assert.ok(modeIds.includes('mode4_fixed_direction'), 'Mode 4 Fixed Direction exists');
  assert.ok(modeIds.includes('mode5_track_opponent'), 'Mode 5 Track Opponent exists');
  console.log('  PASSED: All 5 orientation modes present');
}

// 4. Тест: Поворот на 30°, 45°, 90°, 180° с перестроением всего тела
console.log('\nTest 4: Full-body turning at 30°, 45°, 90°, 180° with stance and foot alignment');
{
  const episode = {
    stepNumber: 1,
    optimalDistance: 1.50,
    participants: [
      { role: 'tori', clipName: 'age_uke_left', stance: 'zenkutsu_dachi_left' },
      { role: 'uke1', clipName: 'oi_zuki_right', stance: 'zenkutsu_dachi_left' },
    ],
  };

  const testAngles = [30, 45, 90, 180];
  for (const ang of testAngles) {
    const placement = computeAvatarPlacement({
      episode,
      orientationModeTori: 'mode3_relative_angle',
      relativeAngleDegTori: ang,
      stanceTori: 'zenkutsu_dachi_left',
    });

    const dx = placement.endPosUke1[0] - placement.endPosTori[0];
    const dz = placement.endPosUke1[2] - placement.endPosTori[2];
    const baseLookAt = Math.atan2(dx, dz);
    const expectedYaw = baseLookAt + (ang * Math.PI) / 180;

    assert.ok(
      Math.abs(placement.rotTori[1] - expectedYaw) < 0.001,
      `Tori yaw should match relative angle ${ang}°`
    );

    // Стопы повернуты согласованно со всем телом
    assert.ok(placement.footAnglesTori, 'Foot angles must be computed');
    const leadFootAngle = placement.footAnglesTori.lead;
    const rearFootAngle = placement.footAnglesTori.rear;
    
    // В левой Дзэнкуцу: передняя стопа прямо (0° от корпуса), задняя +45°
    assert.ok(
      Math.abs(leadFootAngle - expectedYaw) < 0.001,
      'Lead foot points along body yaw'
    );
    assert.ok(
      Math.abs(rearFootAngle - (expectedYaw + (45 * Math.PI) / 180)) < 0.001,
      'Rear foot points at +45° relative to body yaw'
    );
  }
  console.log('  PASSED: Body yaw and both foot vectors rotate cohesively at 30°, 45°, 90°, 180°');
}

// 5. Тест: Режим 2 — Непрерывный авто-поворот лицом и телом на противника (0°)
console.log('\nTest 5: Mode 2 Auto Look-At Lock');
{
  const episode = {
    stepNumber: 1,
    optimalDistance: 1.60,
    participants: [
      { role: 'tori', clipName: 'age_uke_left', stance: 'zenkutsu_dachi_left' },
      { role: 'uke1', clipName: 'oi_zuki_right', stance: 'zenkutsu_dachi_left' },
    ],
  };

  // Укэ заходит под углом 35°
  const placement = computeAvatarPlacement({
    episode,
    orientationModeTori: 'mode2_look_at',
    ukeAngleOffsetDeg: 35,
  });

  const dx = placement.endPosUke1[0] - placement.endPosTori[0];
  const dz = placement.endPosUke1[2] - placement.endPosTori[2];
  const directLookAtYaw = Math.atan2(dx, dz);

  assert.ok(
    Math.abs(placement.rotTori[1] - directLookAtYaw) < 0.001,
    'Tori yaw must face Uke directly (0° look-at lock)'
  );
  console.log('  PASSED: Mode 2 accurately locks full body orientation towards opponent');
}

// 6. Тест: Режим 1 — Свободный мировой поворот
console.log('\nTest 6: Mode 1 Free World Angle');
{
  const episode = {
    stepNumber: 1,
    optimalDistance: 1.45,
    participants: [
      { role: 'tori', clipName: 'age_uke_left', stance: 'zenkutsu_dachi_left' },
      { role: 'uke1', clipName: 'oi_zuki_right', stance: 'zenkutsu_dachi_left' },
    ],
  };

  const freeAngleDeg = 120;
  const placement = computeAvatarPlacement({
    episode,
    orientationModeTori: 'mode1_free',
    customToriYawDeg: freeAngleDeg,
  });

  const expectedYaw = (freeAngleDeg * Math.PI) / 180;
  assert.ok(
    Math.abs(placement.rotTori[1] - expectedYaw) < 0.001,
    `Tori yaw should match free world angle ${freeAngleDeg}°`
  );
  console.log('  PASSED: Mode 1 sets absolute world orientation accurately');
}

// 7. Тест: Режим 4 — Сохранение направления
console.log('\nTest 7: Mode 4 Fixed Direction Lock');
{
  const episode = {
    stepNumber: 1,
    optimalDistance: 1.50,
    participants: [
      { role: 'tori', clipName: 'age_uke_left', stance: 'zenkutsu_dachi_left' },
      { role: 'uke1', clipName: 'oi_zuki_right', stance: 'zenkutsu_dachi_left' },
    ],
  };

  const fixedYaw = Math.PI * 0.25;
  const placement = computeAvatarPlacement({
    episode,
    orientationModeTori: 'mode4_fixed_direction',
    fixedDirectionYawTori: fixedYaw,
    ukeAngleOffsetDeg: 45, // Укэ переместился, но Тори держит фиксированный вектор
  });

  assert.equal(placement.rotTori[1], fixedYaw, 'Tori maintains locked fixed direction');
  console.log('  PASSED: Mode 4 maintains fixed vector regardless of opponent movement');
}

// 8. Тест: Механика разворота каратиста
console.log('\nTest 8: Turn Mechanics registry');
{
  assert.equal(BUNKAI_TURN_MECHANICS.length, 6, 'Must have 6 turn mechanics');
  const turnIds = BUNKAI_TURN_MECHANICS.map((t) => t.id);
  assert.ok(turnIds.includes('pivot_support'));
  assert.ok(turnIds.includes('step_lead'));
  assert.ok(turnIds.includes('step_rear'));
  assert.ok(turnIds.includes('step_turn_90'));
  assert.ok(turnIds.includes('step_turn_180'));
  console.log('  PASSED: Turn mechanics fully specified');
}

// 9. Тест: 14 типов действий в Bunkai Explorer
console.log('\nTest 9: 14 Action Types in Universal Motion Panel');
{
  assert.equal(BUNKAI_ACTION_TYPES.length, 14, 'Must have 14 action types');
  const actionIds = BUNKAI_ACTION_TYPES.map((a) => a.id);
  assert.ok(actionIds.includes('stance'));
  assert.ok(actionIds.includes('locomotion'));
  assert.ok(actionIds.includes('turn'));
  assert.ok(actionIds.includes('strike'));
  assert.ok(actionIds.includes('kick'));
  assert.ok(actionIds.includes('block'));
  assert.ok(actionIds.includes('grab'));
  assert.ok(actionIds.includes('hold'));
  assert.ok(actionIds.includes('joint_lock'));
  assert.ok(actionIds.includes('sweep'));
  assert.ok(actionIds.includes('throw'));
  assert.ok(actionIds.includes('fall'));
  assert.ok(actionIds.includes('rise'));
  assert.ok(actionIds.includes('combo'));
  console.log('  PASSED: All 14 action types accounted for');
}

// 10. Тест: Биомеханический валидатор параметров
console.log('\nTest 10: Biomechanical Validation & Warnings');
{
  // 10.1 Корректные параметры
  const validAudit = validateBunkaiBiomechanics({
    stance: 'zenkutsu_dachi_left',
    stanceSide: 'left',
    limbSide: 'right', // Правый удар из левой стойки (Гяку-дзуки) - абсолютно корректно!
    orientationMode: 'mode2_look_at',
    distance: 1.45,
    isStationary: true,
    displacement: [0, 0, 0],
    contactType: 'block_haivan',
    jointAngleDeg: 20,
  });
  assert.equal(validAudit.isValid, true, 'Audit should pass for valid setup');
  assert.equal(validAudit.warnings.length, 0, 'No warnings for valid setup');

  // 10.2 Несоответствие стойки и стороны (выбрана левая стойка, но указана правая сторона)
  const mismatchAudit = validateBunkaiBiomechanics({
    stance: 'zenkutsu_dachi_left',
    stanceSide: 'right',
    distance: 1.45,
  });
  assert.equal(mismatchAudit.isValid, false, 'Should fail on stance-side mismatch');
  assert.ok(mismatchAudit.warnings.some((w) => w.includes('Несоответствие')), 'Warning about stance-side mismatch');

  // 10.3 Опасная дистанция столкновения (< 0.58м)
  const dangerDistAudit = validateBunkaiBiomechanics({
    stance: 'zenkutsu_dachi_left',
    stanceSide: 'left',
    distance: 0.40,
    contactType: 'strike_chudan',
  });
  assert.equal(dangerDistAudit.isValid, false, 'Should fail on dangerous separation');
  assert.ok(dangerDistAudit.warnings.some((w) => w.includes('слишком мала')), 'Warning about torso collision');

  // 10.4 Превышение суставного предела (> 45°)
  const jointLimitAudit = validateBunkaiBiomechanics({
    stance: 'zenkutsu_dachi_left',
    stanceSide: 'left',
    distance: 0.85,
    contactType: 'joint_lock',
    jointAngleDeg: 55,
  });
  assert.equal(jointLimitAudit.isValid, false, 'Should fail when joint angle > 45°');
  assert.ok(jointLimitAudit.warnings.some((w) => w.includes('физиологический предел')), 'Warning about anatomical joint limit');

  console.log('  PASSED: Biomechanical validator detects mismatches and joint limits');
}

console.log('\n======================================================');
console.log('ALL UNIVERSAL MOTION CONTROL PANEL TESTS PASSED (10/10)!');
console.log('======================================================\n');
