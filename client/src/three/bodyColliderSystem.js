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
 *    - Предотвращение столкновения корпусов (минимальный анатомический зазор торса 0.48-0.54м).
 *    - Ограничение глубины ударов: кулак или стопа останавливаются строго на поверхности доги/тела партнёра.
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
  upperArmR: ['UpperArm.R', 'mixamorigRightArm', 'RightArm'],
  foreArmR: ['LowerArm.R', 'mixamorigRightForeArm', 'RightForeArm'],
  handR: ['Hand.R', 'mixamorigRightHand', 'RightHand'],
  upperArmL: ['UpperArm.L', 'mixamorigLeftArm', 'LeftArm'],
  foreArmL: ['LowerArm.L', 'mixamorigLeftForeArm', 'LeftForeArm'],
  handL: ['Hand.L', 'mixamorigLeftHand', 'LeftHand'],
  upperLegR: ['UpperLeg.R', 'mixamorigRightUpLeg', 'RightUpLeg'],
  lowerLegR: ['LowerLeg.R', 'mixamorigRightLeg', 'RightLeg'],
  footR: ['Foot.R', 'mixamorigRightFoot', 'RightFoot'],
  upperLegL: ['UpperLeg.L', 'mixamorigLeftUpLeg', 'LeftUpLeg'],
  lowerLegL: ['LowerLeg.L', 'mixamorigLeftLeg', 'LeftLeg'],
  footL: ['Foot.L', 'mixamorigLeftFoot', 'LeftFoot'],
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
 * Проверяет и разрешает пространственное взаимодействие двух аватаров (Тори и Укэ):
 * 1. Исключает проникновение корпусов сквозь друг друга (Torso-to-Torso separation).
 * 2. Исключает протыкание кулака/стопы сквозь тело партнера (Limb penetration clamping).
 * 3. Фиксирует допустимые контактные точки (удар в корпус, блок предплечьем, захват за рукав/шею).
 * 
 * @param {Object} jointsA - Извлеченные сочленения Участника 1 (Тори)
 * @param {Object} jointsB - Извлеченные сочленения Участника 2 (Укэ)
 * @param {Object} stepOptions - Параметры шага бункая
 * @returns {Object} Результаты проверки: коррекции позиций, статус коллизии, точка контакта
 */
export function resolveBodyInteractions(jointsA, jointsB, stepOptions = {}) {
  const {
    contactType = 'none',
    interactionType = 'body_contact',
    minTorsoDistance = MIN_TORSO_DISTANCE,
    isGroundStep = false,
  } = stepOptions;

  const result = {
    collided: false,
    penetrationPrevented: false,
    validContact: false,
    contactPoint: null,
    contactNormal: new THREE.Vector3(),
    separationDisplacementA: [0, 0, 0],
    separationDisplacementB: [0, 0, 0],
    clampedIkTargetA: null,
    clampedIkTargetB: null,
    actualCombatDistance: 0,
    statusText: '',
  };

  if (!jointsA || !jointsB) return result;

  // 1. Дистанция между центрами торсов в горизонтальной плоскости (XZ)
  const posA = jointsA.chest.y > 0.3 ? jointsA.chest : jointsA.rootPos;
  const posB = jointsB.chest.y > 0.3 ? jointsB.chest : jointsB.rootPos;

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

  // 2. Контроль ударных конечностей и точек контакта
  // Проверяем удары Укэ (нападающего) по Тори
  const chestA = jointsA.chest;
  const headA = jointsA.head;
  const neckA = jointsA.neck;

  // Проверяем удары Тори по Укэ
  const chestB = jointsB.chest;
  const headB = jointsB.head;
  const neckB = jointsB.neck;

  const rTorsoSurface = BODY_COLLIDER_RADIUS.chest + BODY_COLLIDER_RADIUS.hand;
  const rNeckSurface = BODY_COLLIDER_RADIUS.neck + BODY_COLLIDER_RADIUS.hand;

  // Проверка: правый кулак B бьет в корпус A (Ой-цуки / Гяку-цуки)
  const distFistBtoChestA = jointsB.handR.distanceTo(chestA);
  if (distFistBtoChestA < rTorsoSurface + 0.08) {
    result.validContact = true;
    // Направление от центра груди к кулаку
    const dir = new THREE.Vector3().subVectors(jointsB.handR, chestA).normalize();
    if (dir.lengthSq() < 0.001) dir.set(0, 0, 1);

    // Если кулак прошел внутрь корпуса: ограничиваем его строго на поверхности груди (Anti-Penetration Clamp)
    if (distFistBtoChestA < rTorsoSurface) {
      result.penetrationPrevented = true;
      const surfacePos = new THREE.Vector3().copy(chestA).addScaledVector(dir, rTorsoSurface + 0.015);
      result.clampedIkTargetB = surfacePos;
      result.contactPoint = surfacePos.clone();
      result.statusText = 'Контакт кулака на поверхности корпуса (проникновение предотвращено)';
    } else {
      result.contactPoint = jointsB.handR.clone();
      result.statusText = 'Точный контакт удара кулаком в корпус';
    }
    result.contactNormal.copy(dir);
  }

  // Проверка: левый кулак B бьет в корпус A
  const distFistBLtoChestA = jointsB.handL.distanceTo(chestA);
  if (distFistBLtoChestA < rTorsoSurface + 0.08) {
    result.validContact = true;
    const dir = new THREE.Vector3().subVectors(jointsB.handL, chestA).normalize();
    if (distFistBLtoChestA < rTorsoSurface) {
      result.penetrationPrevented = true;
      result.clampedIkTargetB = new THREE.Vector3().copy(chestA).addScaledVector(dir, rTorsoSurface + 0.015);
      result.contactPoint = result.clampedIkTargetB.clone();
    } else {
      result.contactPoint = jointsB.handL.clone();
    }
  }

  // Проверка: удар ногой Маэ-гэри (стопа B или A к корпусу)
  const rFootSurface = BODY_COLLIDER_RADIUS.chest + BODY_COLLIDER_RADIUS.foot;
  const distFootAtoChestB = jointsA.footR.distanceTo(chestB);
  if (distFootAtoChestB < rFootSurface + 0.12) {
    result.validContact = true;
    const dir = new THREE.Vector3().subVectors(jointsA.footR, chestB).normalize();
    if (distFootAtoChestB < rFootSurface) {
      result.penetrationPrevented = true;
      result.clampedIkTargetA = new THREE.Vector3().copy(chestB).addScaledVector(dir, rFootSurface + 0.02);
      result.contactPoint = result.clampedIkTargetA.clone();
      result.statusText = 'Контакт стопы Маэ-гэри с корпусом (без проникновения)';
    } else {
      result.contactPoint = jointsA.footR.clone();
    }
  }

  // Проверка: удар в область горла Сюто-учи (Шаг 12)
  const distShutoToNeck = jointsB.handR.distanceTo(neckA);
  if (distShutoToNeck < rNeckSurface + 0.10) {
    result.validContact = true;
    const dir = new THREE.Vector3().subVectors(jointsB.handR, neckA).normalize();
    if (distShutoToNeck < rNeckSurface) {
      result.penetrationPrevented = true;
      result.clampedIkTargetB = new THREE.Vector3().copy(neckA).addScaledVector(dir, rNeckSurface + 0.01);
      result.contactPoint = result.clampedIkTargetB.clone();
      result.statusText = 'Точечный контакт Сюто-учи в область горла (безопасный ограничитель)';
    } else {
      result.contactPoint = jointsB.handR.clone();
      result.statusText = 'Удар Сюто-учи в область горла';
    }
  }

  // Проверка блоков предплечьем (Гэдан-барай / Агэ-укэ / Хайван-укэ / Сюто-укэ)
  // Контакт предплечья защитника с атакующей рукой или ногой
  const distForearms = jointsA.foreArmL.distanceTo(jointsB.handR);
  if (distForearms < 0.24) {
    result.validContact = true;
    result.contactPoint = new THREE.Vector3().addVectors(jointsA.foreArmL, jointsB.handR).multiplyScalar(0.5);
    result.statusText = 'Блокирование: встреча предплечья с атакующей конечностью';
  }

  // Защита нижнего уровня Гэдан-барай от маэ-гэри (предплечье встречает голень/стопу)
  const distGedanFoot = jointsB.foreArmL.distanceTo(jointsA.footR);
  if (distGedanFoot < 0.28) {
    result.validContact = true;
    result.contactPoint = new THREE.Vector3().addVectors(jointsB.foreArmL, jointsA.footR).multiplyScalar(0.5);
    result.statusText = 'Блок Гэдан-барай сметает траекторию удара ноги Маэ-гэри';
  }

  // Болевой приём на локтевой сустав / плечо (Шаг 7: Кансэцу-вадза / Ваки-гатамэ)
  if (contactType === 'joint_lock' || stepOptions.stepNumber === 7) {
    result.validContact = true;
    // Точка контакта — правый локоть и предплечье Тори, захваченные обеими руками Укэ
    const lockPoint = new THREE.Vector3().copy(jointsA.foreArmR);
    result.contactPoint = lockPoint;
    result.clampedIkTargetB = lockPoint.clone();
    result.statusText = 'Болевой приём: залом и фиксация локтевого сустава (Кансэцу-вадза)';
  }

  // Подсечка и добивание на полу (Шаг 13: Аши-барай + Отоши-дзуки в шико-дати)
  if (contactType === 'sweep_fall' || stepOptions.stepNumber === 13) {
    result.validContact = true;
    // Укэ удерживает выпрямленную правую руку Тори левой рукой
    // Правый кулак Укэ наносит вертикальный удар сверху-вниз, останавливаясь строго над грудью лежащего Тори
    const groundChestPos = new THREE.Vector3(jointsA.rootPos.x, 0.25, jointsA.rootPos.z);
    result.clampedIkTargetB = groundChestPos;
    result.contactPoint = groundChestPos.clone();
    result.statusText = 'Подсечка Аши-барай: падение на татами, контроль руки и добивание Отоши-дзуки';
  }

  return result;
}
