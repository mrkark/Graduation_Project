import assert from 'assert/strict';
import {
  BUNKAI_TECHNIQUE_METADATA,
  CANONICAL_BUNKAI_EPISODES,
  normalizeBunkaiEpisode,
  resolveBunkaiClip,
  computeAvatarPlacement,
  evaluateTimelineState,
  chainBunkaiEpisodes,
} from '../src/three/bunkaiScenarioEngine.js';
import { resolveAvatarCollision, resolveThreeAvatarsCollision } from '../src/three/collisionAvoidance.js';

console.log('=== TEST SUITE: Bunkai Multi-Avatar Scenario Engine v5 ===\n');

// 1. Проверка разрешения техник и клипов канонической библиотеки Shotokan
console.log('Test 1: Reusable Shotokan clips resolution for Bunkai');
{
  const clipsToTest = [
    'shuto_uke',
    'oi_zuki_right',
    'gyaku_zuki_right',
    'age_uke_left',
    'gedan_barai_left',
    'mae_geri_right',
    'empi_uchi',
    'tetsui_uchi',
    'uraken_uchi',
    'soto_uke',
    'idle_shizentai',
  ];

  for (const cName of clipsToTest) {
    const res = resolveBunkaiClip(cName);
    assert.ok(res.clipName, `Клип ${cName} должен иметь имя`);
    assert.ok(res.duration > 0, `Клип ${cName} должен иметь длительность > 0`);
    assert.ok(res.optimalDistance > 0, `Клип ${cName} должен иметь оптимальную дистанцию > 0`);
    assert.equal(res.isKnown, true, `Клип ${cName} должен быть в реестре известных`);
  }

  // Проверка алиасов
  const resAlias = resolveBunkaiClip('oi_zuki');
  assert.equal(resAlias.clipName, 'oi_zuki_right');

  const resGedan = resolveBunkaiClip('gedan_barai');
  assert.equal(resGedan.clipName, 'gedan_barai_left');

  console.log('  PASSED: All 11 canonical Shotokan techniques resolved successfully with valid metadata');
}

// 2. Расчет взаимного пространственного расположения и дистанции (2 участника)
console.log('\nTest 2: Spatial layout & distance calculation (Tori and Uke 1)');
{
  const ep = CANONICAL_BUNKAI_EPISODES[0]; // Shuto-uke vs Oi-zuki, optimalDistance = 1.45m
  const layout = computeAvatarPlacement({
    episode: ep,
    distanceOffset: 0,
    angleOffsetDeg: 0,
    showUke2: false,
    baseToriPos: [0, 0, 0],
    targetRole: 'uke1',
  });

  // Тори в центре [0, 0, 0]
  assert.equal(layout.posTori[0], 0);
  assert.equal(layout.posTori[2], 0);

  // Укэ 1 на дистанции 1.45м по оси Z
  assert.equal(layout.posUke1[0], 0);
  assert.ok(Math.abs(layout.posUke1[2] - 1.45) < 0.001, 'Укэ 1 должен быть на расстоянии 1.45м');

  // Проверка анти-проникновения: при сильном уменьшении дистанции сжимается только до капсулы (0.54м)
  const squashedLayout = computeAvatarPlacement({
    episode: ep,
    distanceOffset: -1.20, // 1.45 - 1.20 = 0.25м (опасность прорезания)
    angleOffsetDeg: 0,
    showUke2: false,
    baseToriPos: [0, 0, 0],
  });

  const distSq = (squashedLayout.posUke1[0] - squashedLayout.posTori[0]) ** 2 +
                 (squashedLayout.posUke1[2] - squashedLayout.posTori[2]) ** 2;
  const actualDist = Math.sqrt(distSq);

  assert.ok(actualDist >= 0.539, `Дистанция ${actualDist} не должна быть меньше капсулы (0.54м)`);
  console.log(`  PASSED: Frontal layout verified (1.45m), capsule anti-penetration holds safe clamp (${actualDist.toFixed(2)}m)`);
}

// 3. Расчет взаимной ориентации (Yaw)
console.log('\nTest 3: Relative orientation (Facing angles / Yaw)');
{
  const ep = CANONICAL_BUNKAI_EPISODES[0];
  const layout = computeAvatarPlacement({
    episode: ep,
    distanceOffset: 0,
    angleOffsetDeg: 0,
    showUke2: false,
    baseToriPos: [0, 0, 0],
    targetRole: 'uke1',
  });

  // Тори смотрит на Укэ 1 (+Z направление, yaw = 0)
  assert.ok(Math.abs(layout.angles.toriYaw - 0) < 0.001, 'Тори должен смотреть вдоль оси +Z (yaw = 0)');

  // Укэ 1 смотрит на Тори (-Z направление, yaw = PI или -PI)
  assert.ok(Math.abs(Math.abs(layout.angles.uke1Yaw) - Math.PI) < 0.001, 'Укэ 1 должен смотреть в направлении Тори (yaw = PI)');

  console.log('  PASSED: Tori and Uke 1 face each other along collision normal (Yaw angles 0 and PI)');
}

// 4. Проверка атак под углом (45° и 90°)
console.log('\nTest 4: Angled attacks (45° and 90° flank angles)');
{
  // 45 градусов
  const ep45 = {
    ...CANONICAL_BUNKAI_EPISODES[0],
    attackAngleDeg: 45,
    optimalDistance: 1.40,
  };
  const layout45 = computeAvatarPlacement({
    episode: ep45,
    distanceOffset: 0,
    angleOffsetDeg: 0,
    showUke2: false,
  });

  const expX = Math.sin((45 * Math.PI) / 180) * 1.40;
  const expZ = Math.cos((45 * Math.PI) / 180) * 1.40;

  assert.ok(Math.abs(layout45.posUke1[0] - expX) < 0.01, 'Позиция X при 45° должна соответствовать тригонометрии');
  assert.ok(Math.abs(layout45.posUke1[2] - expZ) < 0.01, 'Позиция Z при 45° должна соответствовать тригонометрии');

  // Угол поворота Тори к Укэ 1 при 45°
  const toriAngleDeg = (layout45.angles.toriYaw * 180) / Math.PI;
  assert.ok(Math.abs(toriAngleDeg - 45) < 0.1, `Тори должен повернуться на 45° (получено ${toriAngleDeg.toFixed(1)}°)`);

  // 90 градусов (прямой боковой удар слева)
  const ep90 = {
    ...CANONICAL_BUNKAI_EPISODES[0],
    attackAngleDeg: 90,
    optimalDistance: 1.50,
  };
  const layout90 = computeAvatarPlacement({
    episode: ep90,
    distanceOffset: 0,
    angleOffsetDeg: 0,
    showUke2: false,
  });

  assert.ok(Math.abs(layout90.posUke1[0] - 1.50) < 0.01, 'X должен быть равен 1.50м при 90°');
  assert.ok(Math.abs(layout90.posUke1[2] - 0) < 0.01, 'Z должен быть равен 0м при 90°');

  const toriAngle90 = (layout90.angles.toriYaw * 180) / Math.PI;
  assert.ok(Math.abs(toriAngle90 - 90) < 0.1, 'Тори должен смотреть на 90° налево');

  console.log('  PASSED: 45° and 90° angled attack positions and defender orientations calculated correctly');
}

// 5. Проверка геометрии для 3 участников и коллизий
console.log('\nTest 5: Three-avatar scenario & collision avoidance');
{
  const ep3 = CANONICAL_BUNKAI_EPISODES[4]; // 3-avatar team bunkai
  const layout3 = computeAvatarPlacement({
    episode: ep3,
    distanceOffset: 0,
    angleOffsetDeg: 0,
    showUke2: true,
    baseToriPos: [0, 0, 0],
    targetRole: 'uke1',
  });

  // Проверка расстояний между всеми 3 парами
  function dist(p1, p2) {
    return Math.sqrt((p1[0] - p2[0]) ** 2 + (p1[2] - p2[2]) ** 2);
  }

  const d1 = dist(layout3.posTori, layout3.posUke1);
  const d2 = dist(layout3.posTori, layout3.posUke2);
  const d3 = dist(layout3.posUke1, layout3.posUke2);

  assert.ok(d1 >= 0.54, `Тори и Укэ 1 не должны пересекаться (дистанция ${d1})`);
  assert.ok(d2 >= 0.54, `Тори и Укэ 2 не должны пересекаться (дистанция ${d2})`);
  assert.ok(d3 >= 0.54, `Укэ 1 и Укэ 2 не должны пересекаться (дистанция ${d3})`);

  console.log(`  PASSED: All 3 participants positioned safely (d(T,U1)=${d1.toFixed(2)}m, d(T,U2)=${d2.toFixed(2)}m, d(U1,U2)=${d3.toFixed(2)}m)`);
}

// 6. Проверка синхронизации времени мастер-шкалы и задержек
console.log('\nTest 6: Master timeline, staggered timing & sequential attacks');
{
  const epSeq = CANONICAL_BUNKAI_EPISODES[4]; // switchTime = 1.35s

  // Момент t = 0.05с: Укэ 1 атакует, Тори реагирует с задержкой 0.15с, Укэ 2 ждет до 1.35с
  const stateEarly = evaluateTimelineState({
    episode: epSeq,
    timelineTime: 0.05,
    speed: 1.0,
  });

  assert.equal(stateEarly.uke1State.isWaiting, false, 'Укэ 1 начинает атаку с t=0');
  assert.equal(stateEarly.toriState.isWaiting, true, 'Тори выжидает задержку реакции 0.15с');
  assert.equal(stateEarly.uke2State.isWaiting, true, 'Укэ 2 ожидает в Камаэ до 1.35с');
  assert.equal(stateEarly.currentTargetRole, 'uke1', 'Тори сосредоточен на Укэ 1');

  // Момент контакта t = 0.45с
  const stateContact = evaluateTimelineState({
    episode: epSeq,
    timelineTime: 0.45,
    speed: 1.0,
  });
  assert.equal(stateContact.isContactWindow, true, 'При t=0.45с должно быть активно окно контакта');

  // Момент разворота ко второму атакующему t = 1.50с
  const stateLate = evaluateTimelineState({
    episode: epSeq,
    timelineTime: 1.50,
    speed: 1.0,
  });
  assert.equal(stateLate.uke2State.isWaiting, false, 'Укэ 2 вступил в бой после 1.35с');
  assert.equal(stateLate.currentTargetRole, 'uke2', 'Тори переключился на второго противника Укэ 2');

  console.log('  PASSED: Delayed reactions, contact window (0.45s) and sequential attacker switch verified');
}

// 7. Проверка непрерывного сохранения состояния между эпизодами
console.log('\nTest 7: Continuous episode state persistence across transitions');
{
  const chainedContinuous = chainBunkaiEpisodes(CANONICAL_BUNKAI_EPISODES, 'continuous');
  assert.equal(chainedContinuous.length, CANONICAL_BUNKAI_EPISODES.length);

  // Эпизод 1 начинается в [0, 0, 0]
  assert.deepEqual(chainedContinuous[0].toriStartPos, [0, 0, 0]);

  // Эпизод 2 должен начинаться с позиции окончания Эпизода 1 (уход назад в Кокуцу-дати)
  assert.notDeepEqual(chainedContinuous[1].toriStartPos, [0, 0, 0]);
  assert.ok(chainedContinuous[1].toriStartPos[2] < 0, 'В Эпизоде 2 Тори начинает с сохраненной позиции после ухода назад');

  // В режиме 'standalone' все эпизоды центрируются в [0, 0, 0]
  const chainedStandalone = chainBunkaiEpisodes(CANONICAL_BUNKAI_EPISODES, 'standalone');
  assert.deepEqual(chainedStandalone[0].toriStartPos, [0, 0, 0]);
  assert.deepEqual(chainedStandalone[1].toriStartPos, [0, 0, 0]);

  console.log('  PASSED: Continuous state persists spatial position across episodes; standalone resets cleanly');
}

// 8. Совместимость форматов данных (PascalCase БД vs camelCase)
console.log('\nTest 8: Data normalization (DB PascalCase & frontend camelCase)');
{
  const dbStep = {
    Step_Number: 1,
    Title: 'DB Episode',
    Combat_Distance_Meters: 1.55,
    Attack_Angle_Degrees: 15,
    Interaction_Type: 'local_contact',
    Participants: [
      { Role: 'tori', Clip_Name: 'shuto_uke', Stance_In: 'kokutsu', Delay_Seconds: 0.1 },
      { Role: 'uke', Clip_Name: 'oi_zuki_right', Stance_In: 'zenkutsu', Delay_Seconds: 0.0 },
    ],
  };

  const norm = normalizeBunkaiEpisode(dbStep);
  assert.equal(norm.stepNumber, 1);
  assert.equal(norm.optimalDistance, 1.55);
  assert.equal(norm.attackAngleDeg, 15);
  assert.equal(norm.participants[0].role, 'tori');
  assert.equal(norm.participants[0].clipName, 'shuto_uke');
  assert.equal(norm.participants[1].role, 'uke1');
  assert.equal(norm.participants[1].clipName, 'oi_zuki_right');

  console.log('  PASSED: PascalCase DB format successfully mapped to unified Bunkai structure');
}

console.log('\n=================================================');
console.log('ALL BUNKAI SCENARIO ENGINE TESTS PASSED! (8/8)');
console.log('=================================================');
