import * as THREE from 'three';

/**
 * Промежуточные «твист-кости» предплечья.
 *
 * Проблема: при ударе кулак поворачивается ладонью вниз (пронация, ~180°). Если весь этот поворот
 * лежит между двумя костями (ForeArm → Hand) с резкой границей весов, то рукав «закручивается как
 * конфета» и на локте/запястье теряет объём (рукав становится уже, чем на остальной руке).
 *
 * Решение: между ForeArm и Hand добавляется кость ForeArmTwist1..3, которые повторяют долю
 * скручивания кисти, а веса рукава плавно перераспределяются вдоль предплечья:
 *   локоть → 0%, далее 25% / 50% / 75%, запястье → 100% скручивания.
 * Функция вызывается один раз после создания клона модели (и после правок геометрии рукавов),
 * updateForearmTwist() — каждый кадр после mixer.update().
 */
const TWIST_SEGMENTS = 4;

export function addForearmTwistBones(root) {
  const meshes = [];
  root.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
  const result = [];
  root.updateMatrixWorld(true);

  for (const mesh of meshes) {
    const oldSk = mesh.skeleton;
    const bones = oldSk.bones.slice();
    const inverses = oldSk.boneInverses.map((m) => m.clone());
    const geo = mesh.geometry;
    const si = geo.attributes.skinIndex;
    const sw = geo.attributes.skinWeight;
    oldSk.update();

    // мировые координаты вершин в позе покоя (bind)
    const vpos = [];
    const tmp = new THREE.Vector3();
    for (let i = 0; i < si.count; i++) {
      mesh.getVertexPosition(i, tmp);
      vpos.push(tmp.clone().applyMatrix4(mesh.matrixWorld));
    }

    for (const side of ['Left', 'Right']) {
      const iF = bones.findIndex((b) => b.name === `mixamorig${side}ForeArm`);
      const iH = bones.findIndex((b) => b.name === `mixamorig${side}Hand`);
      if (iF < 0 || iH < 0) continue;
      const fore = bones[iF], hand = bones[iH];

      // N промежуточных костей на равных интервалах между локтем и запястьем
      const N = TWIST_SEGMENTS - 1;
      const knots = [iF];
      const tbs = [];
      const localFull = hand.position.clone();
      for (let j = 1; j <= N; j++) {
        const frac = j / TWIST_SEGMENTS;
        const tb = new THREE.Bone();
        tb.name = `mixamorig${side}ForeArmTwist${j}`;
        const local = localFull.clone().multiplyScalar(frac);
        tb.position.copy(local);
        fore.add(tb);
        tb.updateMatrixWorld(true);
        knots.push(bones.length);
        bones.push(tb);
        inverses.push(new THREE.Matrix4().makeTranslation(-local.x, -local.y, -local.z).multiply(inverses[iF]));
        tbs.push({ tb, frac });
      }
      knots.push(iH);

      // перераспределение весов вдоль предплечья (линейно между соседними узлами)
      const F = fore.getWorldPosition(new THREE.Vector3());
      const H = hand.getWorldPosition(new THREE.Vector3());
      const axis = H.clone().sub(F);
      const len2 = axis.lengthSq();
      for (let v = 0; v < si.count; v++) {
        let m = 0;
        const w = {};
        for (let k = 0; k < 4; k++) {
          const b = si.getComponent(v, k), wt = sw.getComponent(v, k);
          if (wt <= 0) continue;
          w[b] = (w[b] || 0) + wt;
          if (b === iF || b === iH) m += wt;
        }
        if (m <= 0) continue;
        const t = Math.min(1, Math.max(0, vpos[v].clone().sub(F).dot(axis) / len2));
        delete w[iF]; delete w[iH];
        const x = t * TWIST_SEGMENTS;
        const j = Math.min(TWIST_SEGMENTS - 1, Math.floor(x));
        const f = x - j;
        w[knots[j]] = (w[knots[j]] || 0) + m * (1 - f);
        w[knots[j + 1]] = (w[knots[j + 1]] || 0) + m * f;
        const list = Object.entries(w).filter((e) => e[1] > 1e-4).map(([b, x2]) => [Number(b), x2]).sort((p, q) => q[1] - p[1]).slice(0, 4);
        const sum = list.reduce((acc, e) => acc + e[1], 0) || 1;
        for (let k = 0; k < 4; k++) {
          const e = list[k];
          si.setComponent(v, k, e ? e[0] : 0);
          sw.setComponent(v, k, e ? e[1] / sum : 0);
        }
      }
      result.push({ hand, tbs, axis: localFull.clone().normalize() });
    }

    si.needsUpdate = true;
    sw.needsUpdate = true;
    const skeleton = new THREE.Skeleton(bones, inverses);
    mesh.bind(skeleton, mesh.bindMatrix);
  }
  return result;
}

const _q = new THREE.Quaternion();
const _id = new THREE.Quaternion();
const _v = new THREE.Vector3();

/** Половина скручивания кисти вокруг оси предплечья передаётся твист-кости. */
export function updateForearmTwist(list) {
  if (!list) return;
  for (const { hand, tbs, axis } of list) {
    const q = hand.quaternion;
    const d = q.x * axis.x + q.y * axis.y + q.z * axis.z;
    _v.copy(axis).multiplyScalar(d);
    _q.set(_v.x, _v.y, _v.z, q.w);
    const ok = _q.lengthSq() > 1e-12;
    if (ok) _q.normalize();
    for (const { tb, frac } of tbs) {
      if (!ok) tb.quaternion.identity();
      else tb.quaternion.copy(_id.identity().slerp(_q, frac));
    }
  }
}
