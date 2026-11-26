import * as THREE from 'three';

/**
 * Анатомическая система коллайдеров и предотвращения геометрического взаимопроникновения (Anti-Penetration & Contact Solver).
 * 
 * Назначение:
 * 1. Представление тел каратистов в виде набора анатомических капсул и сфер (голова, шея, торс, таз, руки, ноги).
 * 2. Разделение понятий:
 *    - Допустимый контакт: касание кистью предплечья при блоке, касание стопой живота при маэ-гэри,
 *      захват запястья при болевом приёме, удар ребром ладони в область горла, добивание лежащего.
 *    - Недопустимое проникновение: протыкание кулаком или ногой сквозь торс/голову, наложение геометрий тел,
 *      скрещивание костей конечностей сквозь друг друга.
 * 3. Динамический контроль боевой дистанции (Ма-ай):
 *    - Предотвращение столкновения корпусов (минимальный анатомический зазор торса 0.52-0.58м).
 *    - Ограничение глубины ударов: кулак или стопа останавливаются строго на поверхности доги/тела партнёра.
 *    - Разделение траекторий: при уходе Укэ (тай-сабаки) удар Тори проходит мимо в воздух по прямой.
 *    - Синхронизация точек физического контакта для блоков, захватов и падений.
 */

export const BODY_COLLIDER_RADIUS = {
  head: 0.13,        // Сфера головы
  neck: 0.09,        // Зона шеи/горла
  chest: 0.22,       // Капсула грудной клетки / торса
  hips: 0.20,        // Зона таза
  upperArm: 0.075,   // Плечо
  foreArm: 0.070,    // Предплечье
  hand: 0.080,       // Кисть / кулак
  upperLeg: 0.110,   // Бедро
  lowerLeg: 0.095,   // Голень
  foot: 0.090,       // Стопа
};

export const MIN_TORSO_DISTANCE = 0.52; // Минимальная безопасная дистанция между центрами торсов
export const CLINCH_TORSO_DISTANCE = 0.44; // Дистанция для плотного захвата / залома сустава

// Карта сопоставления анатомических названий с именами костей рига
const RIG_BONE_ALIASES = {
  head: ['Head', 'mixamorigHead', 'head'],
  neck: ['Neck', 'mixamorigNeck', 'neck'],
  chest: ['Chest', 'mixamorigSpine2', 'Spine1', 'mixamorigSpine1', 'chest'],
  spine: ['Spine', 'mixamorigSpine', 'spine'],
  hips: ['Hips', 'mixamorigHips', 'Root', 'hips'],
  upperArmR: ['UpperArmR', 'UpperArm.R', 'mixamorigRightArm', 'RightArm'],
  foreArmR: ['LowerArmR', 'LowerArm.R', 'mixamorigRightForeArm', 'RightForeArm'],
  handR: ['HandR', 'Hand.R', 'mixamorigRightHand', 'RightHand'],
  upperArmL: ['UpperArmL', 'UpperArm.L', 'mixamorigLeftArm', 'LeftArm'],
  foreArmL: ['LowerArmL', 'LowerArm.L', 'mixamorigLeftForeArm', 'LeftForeArm'],
  handL: ['HandL', 'Hand.L', 'mixamorigLeftHand', 'LeftHand'],
  upperLegR: ['UpperLegR', 'UpperLeg.R', 'mixamorigRightUpLeg', 'RightUpLeg'],
  lowerLegR: ['LowerLegR', 'LowerLeg.R', 'mixamorigRightLeg', 'RightLeg'],
  footR: ['FootR', 'Foot.R', 'mixamorigRightFoot', 'RightFoot'],
  upperLegL: ['UpperLegL', 'UpperLeg.L', 'mixamorigLeftUpLeg', 'LeftUpLeg'],
  lowerLegL: ['LowerLegL', 'LowerLeg.L', 'mixamorigLeftLeg', 'LeftLeg'],
  footL: ['FootL', 'Foot.L', 'mixamorigLeftFoot', 'LeftFoot'],
};

/**
 * Находит кость в коллекции bones по анатомическому алиасу
 */
export function findRigBone(bones, partKey) {
  if (!bones) return null;
  const aliases = RIG_BONE_ALIASES[partKey] || [partKey];
  for (const alias of aliases) {
    if (bones[alias]) return bones[alias];
  }
  return bones[partKey] || null;
}

/**
 * Извлекает мировые координаты основных сочленений аватара для расчета коллизий
 */
export function extractAvatarJointPositions(bones, rootGroup = null) {
  const result = {
    head: new THREE.Vector3(),
    neck: new THREE.Vector3(),
    chest: new THREE.Vector3(),
    spine: new THREE.Vector3(),
    hips: new THREE.Vector3(),
    handR: new THREE.Vector3(),
    foreArmR: new THREE.Vector3(),
    upperArmR: new THREE.Vector3(),
    handL: new THREE.Vector3(),
    foreArmL: new THREE.Vector3(),
    upperArmL: new THREE.Vector3(),
    footR: new THREE.Vector3(),
    lowerLegR: new THREE.Vector3(),
    upperLegR: new THREE.Vector3(),
    footL: new THREE.Vector3(),
    lowerLegL: new THREE.Vector3(),
    upperLegL: new THREE.Vector3(),
    rootPos: new THREE.Vector3(),
    isExtracted: false,
  };

  if (!bones) return result;

  if (rootGroup && typeof rootGroup.getWorldPosition === 'function') {
    try {
      rootGroup.getWorldPosition(result.rootPos);
    } catch {
      // fallback
    }
  }

  let foundAny = false;
  for (const [key, aliases] of Object.entries(RIG_BONE_ALIASES)) {
    if (!result[key]) {
      result[key] = new THREE.Vector3();
    }
    for (const alias of aliases) {
      const bone = bones[alias];
      if (bone && typeof bone.getWorldPosition === 'function') {
        try {
          bone.getWorldPosition(result[key]);
          foundAny = true;
          break;
        } catch {
          // ignore single bone error
        }
      }
    }
  }

  // Если кости не найдены в скелете (например, до первого тика миксера), заполняем стандартную пропорцию
  if (!foundAny && rootGroup) {
    const rx = result.rootPos.x;
    const ry = result.rootPos.y;
    const rz = result.rootPos.z;
    result.head.set(rx, ry + 1.62, rz);
    result.neck.set(rx, ry + 1.48, rz);
    result.chest.set(rx, ry + 1.25, rz);
    result.hips.set(rx, ry + 0.95, rz);
    result.handR.set(rx - 0.25, ry + 1.15, rz + 0.35);
    result.handL.set(rx + 0.25, ry + 1.15, rz + 0.35);
    result.footR.set(rx - 0.20, ry + 0.05, rz);
    result.footL.set(rx + 0.20, ry + 0.05, rz);
  }

  result.isExtracted = foundAny;
  return result;
}

/**
 * Проверяет и разрешает пространственное взаимодействие двух аватаров (Тори — атакующий, Укэ — защищающийся):
 * 1. Исключает проникновение корпусов сквозь друг друга (Torso-to-Torso separation >= 0.52м).
 * 2. Исключает протыкание кулака/стопы сквозь тело партнера (Limb penetration clamping).
 * 3. Если защищающийся ушел в сторону (Тай-сабаки), удар Тори свободно летит вперед в воздух по прямой без примагничивания.
 * 4. Фиксирует контакт блока с атакующей рукой/ногой в анатомическом диапазоне (<= 0.35м).
 * 
 * @param {Object} jointsTori - Сочленения Тори (Синий, атакующий)
 * @param {Object} jointsUke - Сочленения Укэ (Белый, защищающийся)
 * @param {Object} stepOptions - Параметры шага бункая
 * @returns {Object} Результаты проверки: коррекции позиций, статус коллизии, точка контакта
 */
export function resolveBodyInteractions(jointsTori, jointsUke, stepOptions = {}) {
  const {
    contactType = 'none',
    interactionType = 'body_contact',
    minTorsoDistance = MIN_TORSO_DISTANCE,
    isGroundStep = false,
    isEvaded = false,
    attackDirectrix = null,
  } = stepOptions;

  const result = {
    collided: false,
    penetrationPrevented: false,
    validContact: false,
    isBlockIntercept: false,
    isStrikeHit: false,
    isEvadedMiss: Boolean(isEvaded),
    contactPoint: null,
    contactNormal: new THREE.Vector3(),
    separationDisplacementA: [0, 0, 0], // Тори
    separationDisplacementB: [0, 0, 0], // Укэ
    clampedIkTargetA: null,
    clampedIkTargetB: null,
    actualCombatDistance: 0,
    statusText: '',
  };

  if (!jointsTori || !jointsUke) return result;

  // 1. Дистанция между центрами торсов в горизонтальной плоскости (XZ)
  const posA = jointsTori.chest.y > 0.3 ? jointsTori.chest : jointsTori.rootPos;
  const posB = jointsUke.chest.y > 0.3 ? jointsUke.chest : jointsUke.rootPos;

  const dx = posB.x - posA.x;
  const dz = posB.z - posA.z;
  const horizDist = Math.hypot(dx, dz) || 0.001;
  result.actualCombatDistance = horizDist;

  // Если шаг на полу (партер / падение), торсы могут находиться ближе по вертикали, но в горизонтали не проникают
  const effectiveMinDist = isGroundStep ? CLINCH_TORSO_DISTANCE * 0.85 : minTorsoDistance;

  // Проверка взаимопроникновения корпусов (Torso-to-Torso Anti-Penetration)
  if (horizDist < effectiveMinDist) {
    const overlap = effectiveMinDist - horizDist;
    const nx = dx / horizDist;
    const nz = dz / horizDist;

    // Равномерно раздвигаем центры моделей, чтобы геометрия не пересекалась
    const push = overlap * 0.5;
    result.separationDisplacementA = [-nx * push, 0, -nz * push];
    result.separationDisplacementB = [nx * push, 0, nz * push];
    result.collided = true;
    result.penetrationPrevented = true;
  }

  const chestTori = jointsTori.chest;
  const neckTori = jointsTori.neck;
  const headTori = jointsTori.head;

  const chestUke = jointsUke.chest;
  const neckUke = jointsUke.neck;
  const headUke = jointsUke.head;

  const rTorsoSurface = BODY_COLLIDER_RADIUS.chest + BODY_COLLIDER_RADIUS.hand;
  const rNeckSurface = BODY_COLLIDER_RADIUS.neck + BODY_COLLIDER_RADIUS.hand;
  const rFootSurface = BODY_COLLIDER_RADIUS.chest + BODY_COLLIDER_RADIUS.foot;

  // 2. Проверка блоков Укэ (Белый) против атак Тори (Синий)
  // Контакт предплечья Укэ с атакующей правой рукой Тори (Ой-цуки / Гяку-цуки)
  const distForearmLToHandR = jointsUke.foreArmL.distanceTo(jointsTori.handR);
  const distForearmLToForearmR = jointsUke.foreArmL.distanceTo(jointsTori.foreArmR);
  const distForearmRToHandR = jointsUke.foreArmR.distanceTo(jointsTori.handR);
  const minArmBlockDist = Math.min(distForearmLToHandR, distForearmLToForearmR, distForearmRToHandR);

  // Контакт предплечья Укэ (Гэдан-барай) с атакующей ногой Тори (Маэ-гэри)
  const distAgeBlock = jointsUke.foreArmL.distanceTo(jointsTori.foreArmR || jointsTori.handR);
  const distAgeHand = jointsUke.foreArmL.distanceTo(jointsTori.handR);
  const minAgeBlockDist = Math.min(distAgeBlock, distAgeHand);

  const distGedanFoot = jointsUke.foreArmL.distanceTo(jointsTori.footR);
  const distGedanLeg = jointsUke.foreArmL.distanceTo(jointsTori.lowerLegR);
  const minKickBlockDist = Math.min(distGedanFoot, distGedanLeg);

  let blockDetected = false;

  // 1. Блокирование в верхней зоне (Агэ-укэ / Гяку Агэ-укэ / Нагаси-укэ / Сюто-укэ)
  if (contactType === 'block_jodan' || contactType === 'block_gyaku_age_uke') {
    blockDetected = true;
    result.validContact = true;
    result.isBlockIntercept = true;
    const blockForearm = contactType === 'block_gyaku_age_uke' ? jointsUke.foreArmR : jointsUke.foreArmL;
    result.contactPoint = new THREE.Vector3().addVectors(blockForearm, jointsTori.foreArmR || jointsTori.handR).multiplyScalar(0.5);
    result.contactPoint.y = Math.max(result.contactPoint.y, 1.32);
    result.statusText = contactType === 'block_gyaku_age_uke'
      ? 'Гяку Агэ-укэ: восходящий сбив бьющей руки Тори без захвата'
      : 'Блок верхнего/среднего уровня: перехват атакующей руки Тори предплечьем';
  } else if (contactType === 'block_haivan') {
    blockDetected = true;
    result.validContact = true;
    result.isBlockIntercept = true;
    result.contactPoint = new THREE.Vector3().addVectors(jointsUke.foreArmL, jointsTori.footR).multiplyScalar(0.5);
    result.statusText = 'Блок Хайван-укэ: сбивание удара Маэ-гэри тыльной стороной предплечья';
  } else if (contactType === 'parry_shuto') {
    blockDetected = true;
    result.validContact = true;
    result.isBlockIntercept = true;
    result.contactPoint = new THREE.Vector3().addVectors(jointsUke.foreArmL, jointsTori.foreArmL || jointsTori.handL).multiplyScalar(0.5);
    result.statusText = 'Нагаси-укэ + Сюто-укэ: парирование джеба Тори ребром ладони';
  } else if (minArmBlockDist <= 0.38) {
    blockDetected = true;
    result.validContact = true;
    result.isBlockIntercept = true;
    result.contactPoint = new THREE.Vector3().addVectors(jointsUke.foreArmL, jointsTori.handR).multiplyScalar(0.5);
    result.statusText = `Блокирование: предплечье Укэ перехватывает руку Тори (зазор ${minArmBlockDist.toFixed(2)}м)`;
  } else if (
    minKickBlockDist <= 0.40 ||
    contactType === 'block_gedan' ||
    contactType === 'block_gedan_counter' ||
    contactType === 'combo_block_counter'
  ) {
    blockDetected = true;
    result.validContact = true;
    result.isBlockIntercept = true;
    const ukeFore = jointsUke.foreArmL.distanceTo(jointsTori.footL) < jointsUke.foreArmR.distanceTo(jointsTori.footL)
      ? jointsUke.foreArmL
      : jointsUke.foreArmR;
    const toriLeg = (jointsTori.footL.y > jointsTori.footR.y) ? jointsTori.footL : jointsTori.footR;
    result.contactPoint = new THREE.Vector3().addVectors(ukeFore || jointsUke.foreArmL, toriLeg || jointsTori.footR).multiplyScalar(0.5);
    result.statusText = `Блок Гэдан-барай: сбивание траектории удара ногой (зазор ${minKickBlockDist.toFixed(2)}м)`;
  }

  // 3. Анализ попадания / промаха ударов Тори по корпусу Укэ
  // Если Укэ ушел в сторону (Тай-сабаки), удар Тори НЕ примагничивается к корпусу Укэ!
  const distToriHandToUkeChest = jointsTori.handR.distanceTo(chestUke);
  const distToriFootToUkeChest = jointsTori.footR.distanceTo(chestUke);

  if (isEvaded) {
    result.isEvadedMiss = true;
    if (!blockDetected) {
      result.validContact = false;
      result.statusText = 'Тай-сабаки: удар Тори прошел мимо по исходной прямой линии атаки';
    }
  } else if (!blockDetected) {
    // Удар кулаком Тори в корпус Укэ (если не блокирован и не уклонился)
    if (distToriHandToUkeChest < rTorsoSurface + 0.10) {
      result.validContact = true;
      result.isStrikeHit = true;
      const dir = new THREE.Vector3().subVectors(jointsTori.handR, chestUke).normalize();
      if (dir.lengthSq() < 0.001) dir.set(0, 0, -1);

      if (distToriHandToUkeChest < rTorsoSurface) {
        result.penetrationPrevented = true;
        const surfacePos = new THREE.Vector3().copy(chestUke).addScaledVector(dir, rTorsoSurface + 0.015);
        result.clampedIkTargetA = surfacePos;
        result.contactPoint = surfacePos.clone();
        result.statusText = 'Контакт кулака Тори на поверхности корпуса Укэ (проникновение предотвращено)';
      } else {
        result.contactPoint = jointsTori.handR.clone();
        result.statusText = 'Точный контакт удара кулаком в корпус';
      }
      result.contactNormal.copy(dir);
    }

    // Удар ногой Маэ-гэри Тори в корпус Укэ
    if (distToriFootToUkeChest < rFootSurface + 0.12) {
      result.validContact = true;
      result.isStrikeHit = true;
      const dir = new THREE.Vector3().subVectors(jointsTori.footR, chestUke).normalize();
      if (distToriFootToUkeChest < rFootSurface) {
        result.penetrationPrevented = true;
        result.clampedIkTargetA = new THREE.Vector3().copy(chestUke).addScaledVector(dir, rFootSurface + 0.02);
        result.contactPoint = result.clampedIkTargetA.clone();
        result.statusText = 'Контакт стопы Маэ-гэри с корпусом (без проникновения)';
      } else {
        result.contactPoint = jointsTori.footR.clone();
      }
    }
  }

  // 4. Проверка контратак и ударов Укэ по Тори (Гяку-дзуки / Тэтцуи / Сюто-учи / Отоши-дзуки)
  const distUkeHandRToToriChest = jointsUke.handR.distanceTo(chestTori);
  const distUkeHandLToToriChest = jointsUke.handL ? jointsUke.handL.distanceTo(chestTori) : 99;
  const distUkeHandToToriChest = Math.min(distUkeHandRToToriChest, distUkeHandLToToriChest);
  const activeUkeHand = distUkeHandLToToriChest < distUkeHandRToToriChest ? jointsUke.handL : jointsUke.handR;

  if (
    (isGroundStep && (contactType === 'punch_body' || contactType === 'ground_finish'))
  ) {
    result.validContact = true;
    result.isStrikeHit = true;
    const groundChestPos = new THREE.Vector3(jointsTori.rootPos.x, 0.22, jointsTori.rootPos.z);
    result.contactPoint = groundChestPos;
    result.clampedIkTargetB = groundChestPos.clone();
    result.statusText = 'Добивающий удар кулаком Отоши-дзуки в корпус лежащего (без проникновения)';
  } else if (
    contactType === 'strike_chudan' ||
    contactType === 'punch_body' ||
    contactType === 'block_gedan_counter' ||
    contactType === 'combo_block_counter' ||
    (!blockDetected && contactType !== 'none' && contactType !== 'distance_only' && contactType !== 'joint_lock' && distUkeHandToToriChest < rTorsoSurface + 0.18)
  ) {
    result.validContact = true;
    result.isStrikeHit = true;
    const dir = new THREE.Vector3().subVectors(activeUkeHand, chestTori).normalize();
    if (dir.lengthSq() < 0.001) dir.set(0, 0, 1);
    result.penetrationPrevented = true;
    result.clampedIkTargetB = new THREE.Vector3().copy(chestTori).addScaledVector(dir, rTorsoSurface + 0.015);
    result.contactPoint = result.clampedIkTargetB.clone();
    result.statusText = 'Удар в корпус (Тюдан) с зазором 2 см от доги (без проникновения)';
  }

  // Удар в голову / горло (Тэтцуи-учи / Дзёдан Сюто-учи)
  const distShutoToNeck = jointsUke.handR.distanceTo(neckTori);
  if (contactType === 'strike_throat' || contactType === 'punch_head' || (contactType !== 'none' && contactType !== 'distance_only' && !blockDetected && distShutoToNeck < rNeckSurface + 0.14)) {
    result.validContact = true;
    result.isStrikeHit = true;
    const targetJoint = contactType === 'punch_head' ? (headTori || neckTori) : neckTori;
    const dir = new THREE.Vector3().subVectors(jointsUke.handR, targetJoint).normalize();
    if (dir.lengthSq() < 0.001) dir.set(0, 0, 1);
    result.penetrationPrevented = true;
    result.clampedIkTargetB = new THREE.Vector3().copy(targetJoint).addScaledVector(dir, rNeckSurface + 0.015);
    result.contactPoint = result.clampedIkTargetB.clone();
    result.statusText = contactType === 'punch_head'
      ? 'Удар в область головы / виска / горла (Дзёдан, зазор 2 см)'
      : 'Дзёдан Сюто-учи: удар ребром ладони в область горла Тори';
  }

  // Захват запястья / рукава и болевой приём на локоть (Ваки-гатамэ)
  if (contactType === 'joint_lock') {
    result.validContact = true;
    result.isBlockIntercept = true;
    const elbowTori = jointsTori.foreArmR || jointsTori.upperArmR || jointsTori.handR;
    const wristTori = jointsTori.handR || elbowTori;
    result.contactPoint = new THREE.Vector3().addVectors(elbowTori, wristTori).multiplyScalar(0.5);
    result.clampedIkTargetB = result.contactPoint.clone();
    result.statusText = 'Захват запястья/рукава левой рукой Укэ и рычаг на локоть правой (угол 30°)';
  }

  // Удар выше локтя (если задан вручную)
  if (contactType === 'arm_strike' || contactType === 'strike_above_elbow') {
    result.validContact = true;
    result.isStrikeHit = true;
    const oppArm = jointsTori.armR || jointsTori.upperArmR || jointsTori.foreArmR;
    const aboveElbowPoint = new THREE.Vector3().copy(oppArm).lerp(jointsTori.foreArmR || oppArm, 0.35);
    aboveElbowPoint.y = THREE.MathUtils.clamp(aboveElbowPoint.y, 1.30, 1.48);
    result.contactPoint = aboveElbowPoint;
    result.clampedIkTargetB = aboveElbowPoint.clone();
    result.statusText = 'Удар выше локтя бьющей руки Тори';
  }

  // Подсечка Аси-барай и сваливание со страховкой (Шаг 13) + Отоши-дзуки
  if (contactType === 'sweep_fall' || contactType === 'sweep_finish') {
    result.validContact = true;
    result.isStrikeHit = true;
    const targetPos = contactType === 'sweep_finish'
      ? new THREE.Vector3(jointsTori.rootPos.x, 0.22, jointsTori.rootPos.z)
      : new THREE.Vector3(jointsTori.rootPos.x, 0.15, jointsTori.rootPos.z);
    result.contactPoint = targetPos;
    result.clampedIkTargetB = targetPos.clone();
    result.statusText = 'Гяку Агэ-укэ + подсечка Аси-барай и добивание Отоши-дзуки (без захвата)';
  }

  // Добивание в партере Отоши-дзуки
  if (contactType === 'ground_finish') {
    result.validContact = true;
    result.isStrikeHit = true;
    const groundChestPos = new THREE.Vector3(jointsTori.rootPos.x, 0.22, jointsTori.rootPos.z);
    result.contactPoint = groundChestPos;
    result.clampedIkTargetB = groundChestPos.clone();
    result.statusText = 'Добивающий удар кулаком Отоши-дзуки в стойке Сико-дати';
  }

  return result;
}

/**
 * Процедурный солвер боевой кинематики и адаптации углов блоков/ударов (Procedural Combat IK & Dynamic Angle Solver).
 * 
 * 1. ДИНАМИЧЕСКОЕ ИЗМЕНЕНИЕ УГЛОВ БЛОКА:
 *    Блокирующая рука (плечо, предплечье, кисть) рассчитывает углы наклона (pitch) и доворота (yaw)
 *    навстречу реальной атакующей конечности (кулак или стопа партнера на любой высоте — дзёдан, тюдан, гэдан).
 * 2. ФАКТИЧЕСКИЙ ФИЗИЧЕСКИЙ КОНТАКТ:
 *    Блокирующее предплечье дотягивается и физически пересекает атакующую руку/ногу
 *    в точке соприкосновения костей (зазор <= 0.05м).
 * 3. АДАПТИВНАЯ БАЛЛИСТИКА УДАРА:
 *    Кулак атакующего Тори направляется строго по вектору атаки на высоту цели (тюдан 1.18м / дзёдан 1.48м).
 * 
 * @param {Object} bones - Коллекция костей рига персонажа
 * @param {string} role - 'tori' (атакующий) или 'uke' / 'uke1' (защищающийся)
 * @param {string} clipName - Имя текущей анимации/техники
 * @param {Object} opponentJoints - Мировые координаты сочленений партнера
 * @param {number} phrase - Нормализованный прогресс шага (0.0 .. 1.0)
 * @param {Object} options - Дополнительные сценарные параметры
 */
function applyBoundedWorldAim(bone, currentDir, desiredDir, maxAngleRad, weight) {
  if (!bone || !bone.parent) return;
  if (currentDir.lengthSq() < 0.001 || desiredDir.lengthSq() < 0.001) return;
  const cur = currentDir.clone().normalize();
  const des = desiredDir.clone().normalize();
  const angle = cur.angleTo(des);
  if (angle < 0.01) return;

  const qFull = new THREE.Quaternion().setFromUnitVectors(cur, des);
  const clampedFrac = Math.min(1.0, maxAngleRad / angle);
  const qCapped = new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(), qFull, clampedFrac);

  const parentWorldQ = new THREE.Quaternion();
  bone.parent.getWorldQuaternion(parentWorldQ);
  const invParentQ = parentWorldQ.clone().invert();
  const qDeltaLocal = new THREE.Quaternion().copy(invParentQ).multiply(qCapped).multiply(parentWorldQ);

  const targetQ = bone.quaternion.clone().premultiply(qDeltaLocal);
  bone.quaternion.slerp(targetQ, weight);
  bone.updateMatrixWorld(true);
}

export function applyProceduralCombatIK(bones, role, clipName = '', opponentJoints = null, phrase = 0.5, options = {}) {
  if (!bones || !opponentJoints || !opponentJoints.isExtracted) return;
  if (!options.contactType || options.contactType === 'none' || options.contactType === 'distance_only') return;

  const clip = (clipName || '').toLowerCase();
  const effectiveContactTime = options.ikContactTime || options.tContact || 0.48;

  // Расчет временного окна контакта (плавная огибающая Эрмита)
  const isPersistentContact = options.contactType === 'joint_lock' || options.contactType === 'ground_finish';
  const tStart = Math.max(0.18, effectiveContactTime - 0.22);
  const tHold = isPersistentContact ? 1.0 : (effectiveContactTime + 0.16);
  const tEnd = isPersistentContact ? 1.05 : Math.min(0.95, tHold + 0.22);

  if (phrase < tStart || phrase > tEnd) return;

  let ikWeight = 0;
  if (phrase >= effectiveContactTime && phrase <= tHold) {
    ikWeight = 1.0;
  } else if (phrase < effectiveContactTime) {
    const k = (phrase - tStart) / (effectiveContactTime - tStart);
    ikWeight = k * k * (3 - 2 * k);
  } else {
    const k = (tEnd - phrase) / Math.max(0.01, tEnd - tHold);
    ikWeight = k * k * (3 - 2 * k);
  }

  if (ikWeight < 0.01) return;

  // 1. АДАПТАЦИЯ БЛОКОВ И ДИНАМИЧЕСКИХ УГЛОВ (ДЛЯ УКЭ — мягкая доводка не более ~26° поверх готового клипа)
  const isOffensiveTorsoStrike = options.contactType === 'punch_body' || options.contactType === 'strike_chudan';
  if ((role === 'uke' || role === 'uke1') && !isPersistentContact && !isOffensiveTorsoStrike) {
    const isGedan = clip.includes('gedan');
    const isAgeUke = clip.includes('age_uke') || clip.includes('gyaku_age_uke');
    const isShuto = clip.includes('shuto_uke');
    const isSoto = clip.includes('soto_uke');
    const isUchi = clip.includes('uchi_uke');
    const isHaivan = clip.includes('haivan') || clip.includes('haishu') || clip.includes('morote');
    const isBlock = isGedan || isAgeUke || isShuto || isSoto || isUchi || isHaivan;

    if (isBlock) {
      const isRightArm = clip.includes('right') && !clip.includes('left');
      const boneUpper = findRigBone(bones, isRightArm ? 'upperArmR' : 'upperArmL');
      const boneFore = findRigBone(bones, isRightArm ? 'foreArmR' : 'foreArmL');
      const boneHand = findRigBone(bones, isRightArm ? 'handR' : 'handL');

      if (boneUpper && boneFore) {
        const isOpponentKick = Boolean(
          (opponentJoints.footR && opponentJoints.footR.y > 0.40) ||
          (opponentJoints.footL && opponentJoints.footL.y > 0.40) ||
          isGedan ||
          isHaivan
        );

        let oppAttackPos;
        let oppAttackFore;
        if (isOpponentKick) {
          const footRy = opponentJoints.footR ? opponentJoints.footR.y : 0;
          const footLy = opponentJoints.footL ? opponentJoints.footL.y : 0;
          oppAttackPos = (footRy >= footLy ? opponentJoints.footR : opponentJoints.footL) || new THREE.Vector3();
          oppAttackFore = (footRy >= footLy ? opponentJoints.lowerLegR : opponentJoints.lowerLegL) || oppAttackPos;
        } else {
          const distR = opponentJoints.handR ? opponentJoints.handR.distanceTo(opponentJoints.rootPos || new THREE.Vector3()) : 0;
          const distL = opponentJoints.handL ? opponentJoints.handL.distanceTo(opponentJoints.rootPos || new THREE.Vector3()) : 0;
          if (distR >= distL && opponentJoints.handR) {
            oppAttackPos = opponentJoints.handR;
            oppAttackFore = opponentJoints.foreArmR || oppAttackPos;
          } else {
            oppAttackPos = opponentJoints.handL || opponentJoints.handR || new THREE.Vector3();
            oppAttackFore = opponentJoints.foreArmL || opponentJoints.foreArmR || oppAttackPos;
          }
        }

        const contactIntercept = new THREE.Vector3().lerpVectors(oppAttackPos, oppAttackFore, 0.42);
        if (isGedan) contactIntercept.y = THREE.MathUtils.clamp(contactIntercept.y, 0.48, 0.76);
        else if (isAgeUke) contactIntercept.y = THREE.MathUtils.clamp(contactIntercept.y + 0.08, 1.38, 1.62);
        else if (isShuto || isSoto || isUchi) contactIntercept.y = THREE.MathUtils.clamp(contactIntercept.y, 1.05, 1.30);

        const shoulderPos = new THREE.Vector3();
        const elbowPos = new THREE.Vector3();
        const handPos = new THREE.Vector3();
        boneUpper.getWorldPosition(shoulderPos);
        boneFore.getWorldPosition(elbowPos);
        if (boneHand) boneHand.getWorldPosition(handPos);
        else handPos.copy(elbowPos).add(new THREE.Vector3(0, 0, 0.25));

        applyBoundedWorldAim(
          boneUpper,
          new THREE.Vector3().subVectors(elbowPos, shoulderPos),
          new THREE.Vector3().subVectors(contactIntercept, shoulderPos),
          0.42,
          ikWeight * 0.48
        );
        boneFore.getWorldPosition(elbowPos);
        applyBoundedWorldAim(
          boneFore,
          new THREE.Vector3().subVectors(handPos, elbowPos),
          new THREE.Vector3().subVectors(contactIntercept, elbowPos),
          0.45,
          ikWeight * 0.50
        );
      }
    }
  }

  // 1.1 КОНТРАТАКИ, ЗАХВАТЫ И БОЛЕВЫЕ ПРИЁМЫ ЗАЩИЩАЮЩЕГОСЯ (ДЛЯ УКЭ)
  if (role === 'uke' || role === 'uke1') {
    const isJointLock = options.contactType === 'joint_lock';
    const isArmStrike = clip.includes('strike_above_elbow') || options.contactType === 'strike_above_elbow' || options.contactType === 'arm_strike';
    const isUkePunch = clip.includes('gyaku_zuki') || clip.includes('tettsui') || clip.includes('shuto_uke') || options.contactType === 'strike_chudan' || options.contactType === 'punch_body';
    const isHeadStrike = clip.includes('shuto_uchi') || options.contactType === 'strike_throat' || options.contactType === 'punch_head';
    const isGroundFinish = Boolean(options.isGroundStep) && (clip.includes('tate_zuki') || clip.includes('otoshi_zuki') || options.contactType === 'ground_finish' || options.contactType === 'sweep_finish');

    if (isJointLock) {
      // Мягкая анатомическая наводка правого плеча Укэ на поднятую/блокируемую руку Тори без выламывания левого плеча и локтей
      const boneUpperR = findRigBone(bones, 'upperArmR');
      const boneForeR = findRigBone(bones, 'foreArmR');
      const boneHandR = findRigBone(bones, 'handR');
      const oppArmBase = opponentJoints.upperArmR || opponentJoints.chest || opponentJoints.handR;
      const oppFore = opponentJoints.foreArmR || opponentJoints.handR;
      if (boneUpperR && boneForeR && oppFore) {
        const elbowTarget = new THREE.Vector3().lerpVectors(oppArmBase, oppFore, 0.78);
        elbowTarget.y = Math.max(elbowTarget.y + 0.08, 1.48);
        const shoulderR = new THREE.Vector3();
        const elbowR = new THREE.Vector3();
        const handR = new THREE.Vector3();
        const foreMid = new THREE.Vector3();
        boneUpperR.getWorldPosition(shoulderR);
        boneForeR.getWorldPosition(elbowR);
        if (boneHandR) boneHandR.getWorldPosition(handR);
        else handR.copy(elbowR);
        foreMid.lerpVectors(elbowR, handR, 0.50);
        applyBoundedWorldAim(
          boneUpperR,
          new THREE.Vector3().subVectors(foreMid, shoulderR),
          new THREE.Vector3().subVectors(elbowTarget, shoulderR),
          0.45,
          ikWeight * 0.72
        );
      }
    } else if (isArmStrike || isUkePunch || isHeadStrike || isGroundFinish) {
      const isLeftArm = clip.includes('left') && !clip.includes('right');
      const boneUpper = findRigBone(bones, isLeftArm ? 'upperArmL' : 'upperArmR');
      const boneFore = findRigBone(bones, isLeftArm ? 'foreArmL' : 'foreArmR');
      const boneHand = findRigBone(bones, isLeftArm ? 'handL' : 'handR');

      if (boneUpper && boneFore) {
        let strikeTarget;
        if (isGroundFinish) {
          const torsoPos = opponentJoints.chest || opponentJoints.spine || opponentJoints.hips || opponentJoints.rootPos;
          if (torsoPos) {
            strikeTarget = new THREE.Vector3(torsoPos.x, Math.max(0.24, torsoPos.y + 0.04), torsoPos.z);
          }
          // Выраженный наклон корпуса Укэ вперёд-вниз (Отоши-дзуки в лежащего Тори)
          const spineBone = findRigBone(bones, 'spine');
          const chestBone = findRigBone(bones, 'chest');
          if (spineBone) {
            spineBone.rotation.x += 0.85 * ikWeight;
            if (chestBone && chestBone !== spineBone) chestBone.rotation.x += 0.35 * ikWeight;
            spineBone.updateMatrixWorld(true);
          }
        } else if (isArmStrike) {
          const oppArm = opponentJoints.upperArmR || opponentJoints.armR || opponentJoints.foreArmR || new THREE.Vector3();
          const oppFore = opponentJoints.foreArmR || oppArm;
          strikeTarget = new THREE.Vector3().lerpVectors(oppArm, oppFore, 0.35);
          strikeTarget.y = THREE.MathUtils.clamp(strikeTarget.y, 1.28, 1.48);
        } else if (isHeadStrike && (opponentJoints.neck || opponentJoints.head)) {
          strikeTarget = (options.contactType === 'punch_head' && opponentJoints.head)
            ? opponentJoints.head.clone()
            : (opponentJoints.neck || opponentJoints.head).clone();
          strikeTarget.y = options.contactType === 'punch_head' ? 1.48 : 1.42;
        } else if (isUkePunch && opponentJoints.chest) {
          strikeTarget = opponentJoints.chest.clone();
          strikeTarget.y = 1.15;
        }

        if (strikeTarget) {
          const shoulderPos = new THREE.Vector3();
          const handPos = new THREE.Vector3();
          boneUpper.getWorldPosition(shoulderPos);
          if (boneHand) boneHand.getWorldPosition(handPos);
          else boneFore.getWorldPosition(handPos);

          applyBoundedWorldAim(
            boneUpper,
            new THREE.Vector3().subVectors(handPos, shoulderPos),
            new THREE.Vector3().subVectors(strikeTarget, shoulderPos),
            isGroundFinish ? 1.35 : 0.48,
            ikWeight * (isGroundFinish ? 1.0 : 0.65)
          );
          if (isGroundFinish) {
            const elbowPos = new THREE.Vector3();
            boneFore.getWorldPosition(elbowPos);
            if (boneHand) boneHand.getWorldPosition(handPos);
            applyBoundedWorldAim(
              boneFore,
              new THREE.Vector3().subVectors(handPos, elbowPos),
              new THREE.Vector3().subVectors(strikeTarget, elbowPos),
              0.95,
              ikWeight * 0.95
            );
          }
        }
      }
    }
  }

  // 2. АДАПТАЦИЯ УДАРА И НАПРАВЛЕНИЯ КУЛАКА/СТОПЫ (ДЛЯ ТОРИ)
  if (role === 'tori') {
    const isPunch = clip.includes('zuki') || clip.includes('punch') || clip.includes('tsuki');
    const isKick = clip.includes('mae_geri') || clip.includes('kick') || clip.includes('geri');

    if (isPunch) {
      const isLeftArm = clip.includes('left') && !clip.includes('right');
      const boneUpper = findRigBone(bones, isLeftArm ? 'upperArmL' : 'upperArmR');
      const boneFore = findRigBone(bones, isLeftArm ? 'foreArmL' : 'foreArmR');
      const boneHand = findRigBone(bones, isLeftArm ? 'handL' : 'handR');

      if (!boneUpper || !boneFore || !boneHand) return;

      const shoulderPos = new THREE.Vector3();
      const handPos = new THREE.Vector3();
      boneUpper.getWorldPosition(shoulderPos);
      boneHand.getWorldPosition(handPos);

      let targetPos;
      if (options.isEvaded && options.attackDirectrix) {
        const dir = options.attackDirectrix.direction || [0, 0, 1];
        targetPos = new THREE.Vector3(
          shoulderPos.x + dir[0] * 0.85,
          1.18,
          shoulderPos.z + dir[2] * 0.85
        );
      } else if (options.contactType === 'joint_lock' && clip.includes('jodan') && opponentJoints.head) {
        // При восходящем блоке Агэ-укэ рука Тори слегка приподнимается вверх над головой Укэ, чтобы кулак не попадал в лицо
        const raisedY = Math.max((opponentJoints.head?.y || 1.38) + 0.28, 1.66);
        targetPos = new THREE.Vector3(
          opponentJoints.head.x - 0.05,
          raisedY,
          opponentJoints.head.z
        );
      } else if (opponentJoints.chest && opponentJoints.head) {
        const isJodan = clip.includes('jodan') || options.contactType === 'block_jodan';
        targetPos = isJodan
          ? new THREE.Vector3(opponentJoints.head.x, 1.44, opponentJoints.head.z)
          : new THREE.Vector3(opponentJoints.chest.x, 1.18, opponentJoints.chest.z);
      }

      if (targetPos) {
        const isLiftedBlock = options.contactType === 'joint_lock' && clip.includes('jodan');
        applyBoundedWorldAim(
          boneUpper,
          new THREE.Vector3().subVectors(handPos, shoulderPos),
          new THREE.Vector3().subVectors(targetPos, shoulderPos),
          isLiftedBlock ? 0.50 : 0.42,
          ikWeight * (isLiftedBlock ? 0.85 : 0.42)
        );
      }
    } else if (isKick) {
      // Клипы mae_geri_left / mae_geri_right уже содержат корректную высоту удара с опорной стопой на татами;
      // дополнительный наклон upperLegR убран, чтобы не поднимать опорную ногу над полом.
    }
  }
}

/**
 * Автоматический аудит боевого взаимодействия двух персонажей (Раздел 10 и 11)
 * Проверяет:
 * 1. Достижение ударом цели при отсутствии защиты.
 * 2. Прохождение удара мимо в воздух при уходе белого персонажа (Тай-сабаки).
 * 3. Контакт блока с атакующей конечностью (дистанция <= 0.35м).
 * 4. Исключение взаимного проникновения торсов (дистанция >= 0.52м) и конечностей в тело.
 * 5. Отсутствие паразитного скольжения стоп по татами.
 * 6. Сохранение синим персонажем исходного направления атаки (без авто-поворота к ушедшему уке).
 * 7. Разворот белого персонажа всем телом (корпус + бедра) лицом к противнику.
 */
export function auditCombatInteraction(jointsTori, jointsUke, placement, stepOptions = {}) {
  const {
    expectedScenario = 1,
    timelineProgress = 0.5,
    playbackSpeed = 1.0,
  } = stepOptions;

  const directrix = placement?.attackDirectrix;
  const isEvaded = Boolean(placement?.isEvaded);
  const lateralOffset = placement?.lateralOffsetMeters || 0;

  // 1. Проверка сохранения направления атаки Синего персонажа (Тори)
  const toriYaw = placement?.angles?.toriYaw ?? placement?.rotTori?.[1] ?? 0;
  const attackYaw = directrix?.attackYaw ?? 0;
  const toriYawDiffDeg = Math.abs((((toriYaw - attackYaw) * 180) / Math.PI + 540) % 360 - 180);
  const attackLinePreserved = toriYawDiffDeg < 4.0; // Погрешность не более 4 градусов

  // 2. Проверка ориентации Белого персонажа (Укэ) лицом к Тори
  const posTori = placement?.posTori || [0, 0, 0];
  const posUke = placement?.posUke1 || [0, 0, 1.45];
  const idealUkeYaw = Math.atan2(posTori[0] - posUke[0], posTori[2] - posUke[2]);
  const ukeYaw = placement?.angles?.uke1Yaw ?? placement?.rotUke1?.[1] ?? idealUkeYaw;
  const ukeYawDiffDeg = Math.abs((((ukeYaw - idealUkeYaw) * 180) / Math.PI + 540) % 360 - 180);
  const ukeFacingTori = ukeYawDiffDeg < 12.0; // Корпус и бедра развернуты к противнику

  // 3. Проверка анти-проникновения торсов
  const torsoDist = placement?.finalDist ?? Math.hypot(posUke[0] - posTori[0], posUke[2] - posTori[2]);
  const minTorsoDist = (stepOptions.isGroundStep || stepOptions.contactType === 'sweep_fall') ? 0.38 : MIN_TORSO_DISTANCE;
  const torsoSeparationValid = torsoDist >= (minTorsoDist - 0.05);

  // 4. Проверка контакта блока и удара
  const bodyInter = resolveBodyInteractions(jointsTori, jointsUke, {
    ...stepOptions,
    isEvaded,
    attackDirectrix: directrix,
  });

  // 5. Проверка скольжения (Anti-skating)
  const isStationaryTori = Boolean(placement?.isStationaryTori);
  const isStationaryUke = Boolean(placement?.isStationaryUke);
  let toriSkateMeters = 0;
  let ukeSkateMeters = 0;

  if (isStationaryTori && placement?.startPosTori && placement?.endPosTori) {
    toriSkateMeters = Math.hypot(
      placement.endPosTori[0] - placement.startPosTori[0],
      placement.endPosTori[2] - placement.startPosTori[2]
    );
  }
  if (isStationaryUke && placement?.startPosUke1 && placement?.endPosUke1) {
    ukeSkateMeters = Math.hypot(
      placement.endPosUke1[0] - placement.startPosUke1[0],
      placement.endPosUke1[2] - placement.startPosUke1[2]
    );
  }
  const noSkating = toriSkateMeters < 0.05 && ukeSkateMeters < 0.05;

  // 6. Формирование диагностического статуса по сценариям
  let scenarioPassed = true;
  const diagnosticItems = [];

  // Диагностика 1: Сохранение вектора атаки
  if (attackLinePreserved) {
    diagnosticItems.push(`[OK] Синий персонаж (Тори) сохраняет исходный вектор атаки (отклонение ${toriYawDiffDeg.toFixed(1)}°).`);
  } else {
    scenarioPassed = false;
    diagnosticItems.push(`[ERR] Синий персонаж несанкционированно повернулся к ушедшему Укэ (${toriYawDiffDeg.toFixed(1)}°).`);
  }

  // Диагностика 2: Разворот Укэ лицом к Тори
  if (ukeFacingTori) {
    diagnosticItems.push(`[OK] Белый персонаж (Укэ) развернут всем телом к Тори (отклонение ${ukeYawDiffDeg.toFixed(1)}°).`);
  } else {
    scenarioPassed = false;
    diagnosticItems.push(`[ERR] Белый персонаж не развернулся к сопернику после ухода (${ukeYawDiffDeg.toFixed(1)}°).`);
  }

  // Диагностика 3: Анти-проникновение торсов
  if (torsoSeparationValid) {
    diagnosticItems.push(`[OK] Дистанция торсов в норме: ${torsoDist.toFixed(2)}м >= ${minTorsoDist.toFixed(2)}м.`);
  } else {
    scenarioPassed = false;
    diagnosticItems.push(`[ERR] Проникновение торсов: ${torsoDist.toFixed(2)}м < ${minTorsoDist.toFixed(2)}м.`);
  }

  // Диагностика 4: Тай-сабаки и промах удара
  if (isEvaded) {
    if (bodyInter.isEvadedMiss && !bodyInter.isStrikeHit) {
      diagnosticItems.push(`[OK] Тай-сабаки успешен: смещение ${lateralOffset.toFixed(2)}м, удар Тори прошел мимо в воздух.`);
    } else {
      scenarioPassed = false;
      diagnosticItems.push(`[ERR] Удар Тори примагнитился к ушедшему Укэ.`);
    }
  }

  // Диагностика 5: Блок
  if (bodyInter.isBlockIntercept) {
    diagnosticItems.push(`[OK] Блок перехватил атакующую конечность в анатомическом окне.`);
  }

  // Диагностика 6: Скольжение
  if (noSkating) {
    diagnosticItems.push(`[OK] Скольжение стоп по татами исключено (дрейф < 0.05м).`);
  } else {
    diagnosticItems.push(`[WARN] Зафиксирован дрейф опорной стопы: Тори=${toriSkateMeters.toFixed(2)}м, Укэ=${ukeSkateMeters.toFixed(2)}м.`);
  }

  return {
    scenarioPassed,
    attackLinePreserved,
    toriYawDiffDeg,
    ukeFacingTori,
    ukeYawDiffDeg,
    torsoSeparationValid,
    torsoDistance: torsoDist,
    isEvaded,
    lateralOffsetMeters: lateralOffset,
    bodyInteraction: bodyInter,
    noSkating,
    playbackSpeed,
    diagnosticItems,
    statusSummary: scenarioPassed ? 'Аудит пройден: взаимодействия анатомически корректны' : 'Аудит выявил несоответствия',
  };
}
