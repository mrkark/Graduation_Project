import * as THREE from 'three';

/**
 * Предотвращение проникновения тел аватаров друг в друга (Anti-Penetration Capsule Colliders).
 * 
 * В Бункае аватары движутся навстречу друг другу. Если дистанция (Ма-ай) между ними
 * уменьшается меньше анатомически допустимой (радиус торса ~0.26м, сумма радиусов ~0.52м),
 * тела начинают некрасиво прорезать друг друга.
 *
 * Этот модуль рассчитывает горизонтальную плоскость XZ для коллизий и мягко выталкивает
 * аватаров вдоль вектора разделения, сохраняя заданные высоты и ориентации.
 */

export const AVATAR_CAPSULE = {
  radius: 0.28,         // радиус цилиндра/капсулы торса каратиста (в метрах)
  height: 1.50,         // высота цилиндра
  minDistance: 0.54,    // минимальная безопасная дистанция между центрами (2 * radius - запас)
};

/**
 * Проверяет и корректирует позиции двух аватаров для предотвращения пересечения тел.
 * @param {THREE.Vector3 | number[]} posA - Позиция Тори [x, y, z]
 * @param {THREE.Vector3 | number[]} posB - Позиция Укэ [x, y, z]
 * @param {number} minDistance - Минимальное расстояние между центрами
 * @returns {{ correctedA: number[], correctedB: number[], collided: boolean, actualDistance: number }}
 */
export function resolveAvatarCollision(posA, posB, minDistance = AVATAR_CAPSULE.minDistance) {
  const ax = Array.isArray(posA) ? posA[0] : posA.x;
  const ay = Array.isArray(posA) ? posA[1] : posA.y;
  const az = Array.isArray(posA) ? posA[2] : posA.z;

  const bx = Array.isArray(posB) ? posB[0] : posB.x;
  const by = Array.isArray(posB) ? posB[1] : posB.y;
  const bz = Array.isArray(posB) ? posB[2] : posB.z;

  // Дистанция в плоскости пола (XZ)
  const dx = bx - ax;
  const dz = bz - az;
  const distSq = dx * dx + dz * dz;
  const dist = Math.sqrt(distSq);

  if (dist < 0.0001) {
    // Аватары стоят ровно в одной точке: раздвигаем по оси Z
    const push = minDistance / 2;
    return {
      correctedA: [ax, ay, az - push],
      correctedB: [bx, by, bz + push],
      collided: true,
      actualDistance: minDistance,
    };
  }

  if (dist < minDistance) {
    const penetration = minDistance - dist;
    const nx = dx / dist;
    const nz = dz / dist;

    // Равномерно раздвигаем участников на половину проникновения каждого
    const push = penetration * 0.5;
    return {
      correctedA: [ax - nx * push, ay, az - nz * push],
      correctedB: [bx + nx * push, by, bz + nz * push],
      collided: true,
      actualDistance: minDistance,
    };
  }

  return {
    correctedA: [ax, ay, az],
    correctedB: [bx, by, bz],
    collided: false,
    actualDistance: dist,
  };
}

/**
 * Проверяет коллизии для троих участников (Тори, Укэ 1, Укэ 2)
 */
export function resolveThreeAvatarsCollision(posTori, posUke1, posUke2, minDistance = AVATAR_CAPSULE.minDistance) {
  // Шаг 1: Тори и Укэ 1
  let res1 = resolveAvatarCollision(posTori, posUke1, minDistance);
  let pTori = res1.correctedA;
  let pUke1 = res1.correctedB;
  let anyCollided = res1.collided;

  // Шаг 2: Тори и Укэ 2
  let res2 = resolveAvatarCollision(pTori, posUke2, minDistance);
  pTori = res2.correctedA;
  let pUke2 = res2.correctedB;
  if (res2.collided) anyCollided = true;

  // Шаг 3: Укэ 1 и Укэ 2
  let res3 = resolveAvatarCollision(pUke1, pUke2, minDistance);
  pUke1 = res3.correctedA;
  pUke2 = res3.correctedB;
  if (res3.collided) anyCollided = true;

  return {
    correctedTori: pTori,
    correctedUke1: pUke1,
    correctedUke2: pUke2,
    collided: anyCollided,
  };
}
