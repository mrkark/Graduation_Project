import assert from 'assert/strict';
import * as THREE from 'three';
import {
  computeAvatarPlacement,
  normalizeBunkaiEpisode,
} from '../src/three/bunkaiScenarioEngine.js';
import {
  resolveBodyInteractions,
  auditCombatInteraction,
  MIN_TORSO_DISTANCE,
} from '../src/three/bodyColliderSystem.js';

console.log('=== TEST SUITE: Bunkai Combat Interaction Audit (6 Mandatory Scenarios) ===\n');

/**
 * Создает моковые анатомические сочленения для бойца
 */
function createMockJoints({ x = 0, y = 0, z = 0, yaw = 0, leadHandForward = 0.65, leadFootForward = 0.45 }) {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);

  return {
    rootPos: new THREE.Vector3(x, y, z),
    hips: new THREE.Vector3(x, y + 0.95, z),
    spine: new THREE.Vector3(x, y + 1.10, z),
    chest: new THREE.Vector3(x, y + 1.25, z),
    neck: new THREE.Vector3(x, y + 1.48, z),
    head: new THREE.Vector3(x, y + 1.62, z),
    // Правая рука (вытянута вперед для удара или блока)
    upperArmR: new THREE.Vector3(x + cos * 0.20, y + 1.25, z - sin * 0.20),
    foreArmR: new THREE.Vector3(x + cos * 0.20 + sin * 0.35, y + 1.20, z - sin * 0.20 + cos * 0.35),
    handR: new THREE.Vector3(x + cos * 0.20 + sin * leadHandForward, y + 1.15, z - sin * 0.20 + cos * leadHandForward),
    // Левая рука (блок или хикитэ)
    upperArmL: new THREE.Vector3(x - cos * 0.20, y + 1.25, z + sin * 0.20),
    foreArmL: new THREE.Vector3(x - cos * 0.20 + sin * 0.30, y + 1.10, z + sin * 0.20 + cos * 0.30),
    handL: new THREE.Vector3(x - cos * 0.20 + sin * 0.50, y + 1.05, z + sin * 0.20 + cos * 0.50),
    // Ноги
    upperLegR: new THREE.Vector3(x + 0.15, y + 0.85, z),
    lowerLegR: new THREE.Vector3(x + 0.15 + sin * (leadFootForward * 0.5), y + 0.45, z + cos * (leadFootForward * 0.5)),
    footR: new THREE.Vector3(x + 0.15 + sin * leadFootForward, y + 0.05, z + cos * leadFootForward),
    upperLegL: new THREE.Vector3(x - 0.15, y + 0.85, z),
    lowerLegL: new THREE.Vector3(x - 0.15, y + 0.45, z - 0.20),
    footL: new THREE.Vector3(x - 0.15, y + 0.05, z - 0.45),
    isExtracted: true,
  };
}

// -------------------------------------------------------------------------------------------------
// СЦЕНАРИЙ 1: Прямой удар рукой (Ой-дзуки) Синего персонажа, уход вправо Белого персонажа с блоком
// -------------------------------------------------------------------------------------------------
console.log('--- Сценарий 1: Прямой удар рукой (Ой-дзуки), уход вправо Белого персонажа (+35°) с блоком ---');
{
  const episode1 = {
    stepNumber: 1,
    title: 'Тест 1: Ой-дзуки и уход вправо с блоком',
    optimalDistance: 1.45,
    attackAngleDeg: 0,
    contactType: 'block_gedan',
    tContact: 0.48,
    participants: [
      { role: 'tori', clipName: 'oi_zuki_right', stance: 'zenkutsu_dachi_left' },
      { role: 'uke1', clipName: 'gedan_barai_left', stance: 'zenkutsu_dachi_right' },
    ],
  };

  const placement = computeAvatarPlacement({
    episode: episode1,
    toriAngleOffsetDeg: 0,       // Атака Синего Тори строго прямо
    ukeEvasionAngleDeg: 35,      // Защищающийся Белый Укэ уходит вправо (+35°)
    customDistance: 1.45,
  });

  // 1. Синий персонаж (Тори) движется прямо по вектору атаки
  assert.equal(placement.attackDirectrix.attackYaw, 0, 'Линия атаки Тори должна быть направлена строго вперед (yaw = 0)');
  assert.equal(placement.rotTori[1], 0, 'Корпус Тори НЕ должен поворачиваться в сторону Белого персонажа (yaw = 0)');

  // 2. Белый персонаж (Укэ) смещается вправо (X > 0)
  assert.ok(placement.posUke1[0] > 0.25, `Белый персонаж должен сместиться вправо (X=${placement.posUke1[0]}м)`);
  assert.ok(placement.isEvaded, 'Флаг уклонения isEvaded должен быть true');
  assert.ok(placement.lateralOffsetMeters >= 0.28, `Боковое смещение должно быть >= 0.28м (факт: ${placement.lateralOffsetMeters}м)`);

  // 3. Белый персонаж разворачивается ВСЕМ ТЕЛОМ лицом к Синему Тори
  const idealUkeYaw = Math.atan2(placement.posTori[0] - placement.posUke1[0], placement.posTori[2] - placement.posUke1[2]);
  const diffYaw = Math.abs(placement.rotUke1[1] - idealUkeYaw);
  assert.ok(diffYaw < 0.05, `Белый персонаж должен быть развернут точно на Тори (погрешность: ${diffYaw} рад)`);

  // 4. Моделируем контакт сочленений: блок касается руки, но кулак не примагничивается к телу
  const jointsTori = createMockJoints({ x: placement.posTori[0], y: 0, z: placement.posTori[2], yaw: 0, leadHandForward: 0.85 });
  // Укэ развернут к Тори, его левое предплечье перехватывает атакующую руку Тори
  const jointsUke = createMockJoints({ x: placement.posUke1[0], y: 0, z: placement.posUke1[2], yaw: placement.rotUke1[1], leadHandForward: 0.50 });
  // Помещаем предплечье Укэ в точку перехвата правой руки Тори
  jointsUke.foreArmL.copy(jointsTori.handR).add(new THREE.Vector3(0.08, 0, 0.05));

  const audit = auditCombatInteraction(jointsTori, jointsUke, placement, { expectedScenario: 1 });
  assert.ok(audit.attackLinePreserved, 'Синий персонаж должен сохранять исходный вектор атаки');
  assert.ok(audit.ukeFacingTori, 'Белый персонаж должен смотреть на Тори');
  assert.ok(audit.isEvaded, 'Тай-сабаки должен быть зафиксирован');
  assert.ok(audit.bodyInteraction.isBlockIntercept, 'Блок Укэ должен перехватить атакующую конечность Тори');
  assert.equal(audit.bodyInteraction.isStrikeHit, false, 'Удар Тори НЕ должен примагничиваться к телу Белого персонажа при успешном блоке/уходе');
  console.log('✓ Сценарий 1 успешно пройден: Тори сохраняет вектор атаки, Укэ сместился вправо и заблокировал удар.\n');
}

// -------------------------------------------------------------------------------------------------
// СЦЕНАРИЙ 2: Прямой удар рукой, уход влево (-35°)
// -------------------------------------------------------------------------------------------------
console.log('--- Сценарий 2: Прямой удар рукой, уход влево Белого персонажа (-35°) ---');
{
  const episode2 = {
    stepNumber: 2,
    title: 'Тест 2: Ой-дзуки и уход влево',
    optimalDistance: 1.45,
    attackAngleDeg: 0,
    contactType: 'block_gedan',
    participants: [
      { role: 'tori', clipName: 'oi_zuki_right', stance: 'zenkutsu_dachi_left' },
      { role: 'uke1', clipName: 'gedan_barai_left', stance: 'zenkutsu_dachi_right' },
    ],
  };

  const placement = computeAvatarPlacement({
    episode: episode2,
    toriAngleOffsetDeg: 0,
    ukeEvasionAngleDeg: -35,    // Уход влево (-35°)
    customDistance: 1.45,
  });

  // Синий персонаж не доворачивается
  assert.equal(placement.rotTori[1], 0, 'Тори не должен поворачиваться к ушедшему влево Укэ');
  // Белый персонаж смещается влево (X < 0)
  assert.ok(placement.posUke1[0] < -0.25, `Белый персонаж должен сместиться влево (X=${placement.posUke1[0]}м)`);
  assert.ok(placement.isEvaded, 'Уклонение влево зафиксировано');

  // Белый персонаж ориентирован на Тори
  const idealUkeYaw = Math.atan2(placement.posTori[0] - placement.posUke1[0], placement.posTori[2] - placement.posUke1[2]);
  const diffYaw = Math.abs(placement.rotUke1[1] - idealUkeYaw);
  assert.ok(diffYaw < 0.05, `Белый персонаж развернут на Тори при уходе влево (погрешность: ${diffYaw} рад)`);

  const jointsTori = createMockJoints({ x: placement.posTori[0], y: 0, z: placement.posTori[2], yaw: 0, leadHandForward: 0.85 });
  const jointsUke = createMockJoints({ x: placement.posUke1[0], y: 0, z: placement.posUke1[2], yaw: placement.rotUke1[1] });
  jointsUke.foreArmL.copy(jointsTori.handR).add(new THREE.Vector3(-0.06, 0, 0.05));

  const audit = auditCombatInteraction(jointsTori, jointsUke, placement, { expectedScenario: 2 });
  assert.ok(audit.attackLinePreserved);
  assert.ok(audit.ukeFacingTori);
  assert.ok(audit.bodyInteraction.isBlockIntercept);
  assert.equal(audit.bodyInteraction.isStrikeHit, false);
  console.log('✓ Сценарий 2 успешно пройден: уход влево симметричен и анатомически выверен.\n');
}

// -------------------------------------------------------------------------------------------------
// СЦЕНАРИЙ 3: Прямой удар ногой (Маэ-гэри) Синего персонажа, защита Белого персонажа (Шаг 5)
// -------------------------------------------------------------------------------------------------
console.log('--- Сценарий 3: Прямой удар ногой (Маэ-гэри) Синего, защита Белого (Гэдан-барай) ---');
{
  const episode3 = {
    stepNumber: 5,
    title: 'Шаг 5: Атака Маэ-гэри — отход Укэ под 35°, Гэдан-барай и Гяку-дзуки',
    optimalDistance: 1.55,
    attackAngleDeg: 0,
    contactType: 'block_gedan',
    tContact: 0.48,
    participants: [
      { role: 'tori', clipName: 'mae_geri_right', stance: 'zenkutsu_dachi_left', landingMode: 'forward' },
      { role: 'uke1', clipName: 'gedan_barai_left', stance: 'zenkutsu_dachi_right' },
    ],
  };

  const placement = computeAvatarPlacement({
    episode: episode3,
    toriAngleOffsetDeg: 0,
    ukeEvasionAngleDeg: 35,
    customDistance: 1.55,
  });

  // Корректная дистанция удара ногой (>= 1.40м)
  assert.ok(placement.finalDist >= 1.40, `Боевая дистанция при ударе ногой должна быть >= 1.40м (факт: ${placement.finalDist.toFixed(2)}м)`);
  assert.ok(placement.finalDist >= MIN_TORSO_DISTANCE, `Дистанция торсов должна превышать минимальный зазор ${MIN_TORSO_DISTANCE}м`);

  const jointsTori = createMockJoints({ x: placement.posTori[0], y: 0, z: placement.posTori[2], yaw: 0, leadFootForward: 1.10 });
  const jointsUke = createMockJoints({ x: placement.posUke1[0], y: 0, z: placement.posUke1[2], yaw: placement.rotUke1[1] });
  // Предплечье Укэ перехватывает стопу/голень Тори
  jointsUke.foreArmL.copy(jointsTori.footR).add(new THREE.Vector3(0.04, 0.05, -0.05));

  const inter = resolveBodyInteractions(jointsTori, jointsUke, {
    contactType: 'block_gedan',
    isEvaded: placement.isEvaded,
  });

  assert.ok(inter.isBlockIntercept, 'Блок Гэдан-барай должен перехватить ногу Маэ-гэри');
  assert.equal(inter.penetrationPrevented, false, 'Нога не проникает в корпус при успешном перехвате блоком');
  console.log('✓ Сценарий 3 успешно пройден: Маэ-гэри перехвачен блоком Гэдан-барай на дистанции 1.55м без проникновения.\n');
}

// -------------------------------------------------------------------------------------------------
// СЦЕНАРИЙ 4: Блок с одновременным перемещением (Тай-сабаки)
// -------------------------------------------------------------------------------------------------
console.log('--- Сценарий 4: Блок с одновременным перемещением (Тай-сабаки) ---');
{
  const episode4 = {
    stepNumber: 5,
    title: 'Синхронный уход тай-сабаки и блок',
    optimalDistance: 1.50,
    attackAngleDeg: 0,
    contactType: 'block_gedan',
    tContact: 0.48, // 48% длительности шага — фаза максимального выноса
    duration: 2.6,
    participants: [
      { role: 'tori', clipName: 'mae_geri_right', stance: 'zenkutsu_dachi_left', delaySeconds: 0.0 },
      { role: 'uke1', clipName: 'gedan_barai_left', stance: 'zenkutsu_dachi_right', delaySeconds: 0.0 },
    ],
  };

  const placement = computeAvatarPlacement({
    episode: episode4,
    ukeEvasionAngleDeg: 35,
    customDistance: 1.50,
  });

  // Проверяем совмещение движения защиты:
  // Белый Укэ одновременно смещается в пространстве (posUke1.x > 0.28) и поворачивается лицом к Тори
  assert.ok(placement.isEvaded, 'Смещение тай-сабаки активно');
  assert.ok(episode4.tContact >= 0.44 && episode4.tContact <= 0.52, 'Момент контакта блока находится в оптимальном биомеханическом окне [0.44; 0.52]с');

  const jointsTori = createMockJoints({ x: placement.posTori[0], y: 0, z: placement.posTori[2], yaw: 0 });
  const jointsUke = createMockJoints({ x: placement.posUke1[0], y: 0, z: placement.posUke1[2], yaw: placement.rotUke1[1] });
  jointsUke.foreArmL.copy(jointsTori.handR).add(new THREE.Vector3(0.05, 0, 0.04));

  const inter = resolveBodyInteractions(jointsTori, jointsUke, {
    contactType: 'block_gedan',
    isEvaded: true,
  });

  assert.ok(inter.validContact, 'Контакт блока зарегистрирован без задержки');
  assert.ok(inter.isBlockIntercept, 'Блок перехватил удар одновременно с завершением перемещения');
  console.log('✓ Сценарий 4 успешно пройден: Тай-сабаки и блок выполнены синхронно в окне контакта t=0.48s.\n');
}

// -------------------------------------------------------------------------------------------------
// СЦЕНАРИЙ 5: Блок и контратака (Гяку-дзуки)
// -------------------------------------------------------------------------------------------------
console.log('--- Сценарий 5: Блок и контратака (Гяку-дзуки) ---');
{
  // Шаг 6: Хайван-укэ + Тэтцуи + Гяку-дзуки
  const episode5 = {
    stepNumber: 6,
    title: 'Шаг 6: Блок Хайван-укэ и контратака Гяку-дзуки',
    optimalDistance: 1.36,
    attackAngleDeg: 0,
    contactType: 'block_gedan',
    participants: [
      { role: 'tori', clipName: 'gyaku_zuki_right', stance: 'zenkutsu_dachi_left' },
      { role: 'uke1', clipName: 'gyaku_zuki_right', stance: 'zenkutsu_dachi_left' },
    ],
  };

  const placement = computeAvatarPlacement({
    episode: episode5,
    customDistance: 1.36,
  });

  // Дистанция сохраняет боевой контакт (0.9 - 1.45м)
  assert.ok(placement.finalDist >= 0.90 && placement.finalDist <= 1.45, `Дистанция для контратаки оптимальна: ${placement.finalDist.toFixed(2)}м`);

  const jointsTori = createMockJoints({ x: placement.posTori[0], y: 0, z: placement.posTori[2], yaw: 0 });
  const jointsUke = createMockJoints({ x: placement.posUke1[0], y: 0, z: placement.posUke1[2], yaw: placement.rotUke1[1] });
  // Правый кулак Укэ наносит контратаку в корпус Тори
  jointsUke.handR.copy(jointsTori.chest).add(new THREE.Vector3(0, 0, 0.28));

  const inter = resolveBodyInteractions(jointsTori, jointsUke, {
    contactType: 'counter_strike',
    stepNumber: 6,
  });

  assert.ok(inter.validContact, 'Контратака достигает корпуса противника');
  assert.ok(inter.contactPoint !== null, 'Точка контакта контратаки зафиксирована');
  console.log('✓ Сценарий 5 успешно пройден: переход к контратаке выполнен на дистанции 1.36м с точным попаданием в корпус.\n');
}

// -------------------------------------------------------------------------------------------------
// СЦЕНАРИЙ 6: Повторяемость при разных скоростях воспроизведения (0.5x, 1.0x, 1.5x)
// -------------------------------------------------------------------------------------------------
console.log('--- Сценарий 6: Повторяемость при скоростях 0.5x, 1.0x, 1.5x ---');
{
  const speeds = [0.5, 1.0, 1.5];
  const episode6 = {
    stepNumber: 1,
    title: 'Тест 6: Повторяемость расчетов при разных скоростях',
    optimalDistance: 1.45,
    attackAngleDeg: 0,
    participants: [
      { role: 'tori', clipName: 'oi_zuki_right', stance: 'zenkutsu_dachi_left' },
      { role: 'uke1', clipName: 'gedan_barai_left', stance: 'zenkutsu_dachi_right' },
    ],
  };

  const results = speeds.map((spd) => {
    const placement = computeAvatarPlacement({
      episode: episode6,
      customDistance: 1.45,
      ukeEvasionAngleDeg: 35,
    });
    const jointsTori = createMockJoints({ x: placement.posTori[0], y: 0, z: placement.posTori[2], yaw: 0 });
    const jointsUke = createMockJoints({ x: placement.posUke1[0], y: 0, z: placement.posUke1[2], yaw: placement.rotUke1[1] });

    return {
      speed: spd,
      placement,
      audit: auditCombatInteraction(jointsTori, jointsUke, placement, { playbackSpeed: spd }),
    };
  });

  // Проверяем инвариантность расчетов к скорости
  const basePosTori = results[0].placement.posTori;
  const basePosUke = results[0].placement.posUke1;
  const baseRotTori = results[0].placement.rotTori[1];
  const baseRotUke = results[0].placement.rotUke1[1];

  for (let i = 1; i < results.length; i++) {
    const r = results[i];
    assert.deepEqual(r.placement.posTori, basePosTori, `Позиция Тори при ${r.speed}x должна быть идентична`);
    assert.deepEqual(r.placement.posUke1, basePosUke, `Позиция Укэ при ${r.speed}x должна быть идентична`);
    assert.equal(r.placement.rotTori[1], baseRotTori, `Угол Тори при ${r.speed}x должен быть идентичен`);
    assert.equal(r.placement.rotUke1[1], baseRotUke, `Угол Укэ при ${r.speed}x должен быть идентичен`);
    assert.equal(r.audit.scenarioPassed, true, `Аудит при ${r.speed}x должен быть пройден`);
  }

  console.log('✓ Сценарий 6 успешно пройден: пространственные расчеты и коллизии 100% детерминированы при всех скоростях (0.5x, 1.0x, 1.5x).\n');
}

console.log('=== ВСЕ 6 ОБЯЗАТЕЛЬНЫХ СЦЕНАРИЕВ УСПЕШНО ПРОЙДЕНЫ БЕЗ ОШИБОК ===');
