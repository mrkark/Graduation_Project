import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { useFBX } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { addForearmTwistBones, updateForearmTwist } from './twistBones';

/**
 * Словарь клипов анимаций: каноническая техника каратэ Шотокан и стойки
 */
const CLIP_FILES = {
  // Динамические приемы каратэ: удары руками (цуки и учи)
  choku_zuki: '/anims/choku_zuki.json',
  oi_zuki: '/anims/oi_zuki.json',
  gyaku_zuki: '/anims/gyaku_zuki.json',
  kizami_zuki: '/anims/kizami_zuki.json',
  ren_zuki: '/anims/ren_zuki.json',
  uraken_uchi: '/anims/uraken_uchi.json',
  tetsui_uchi: '/anims/tetsui_uchi.json',
  empi_uchi: '/anims/empi_uchi.json',
  shuto_uchi: '/anims/shuto_uchi.json',
  morote_zuki: '/anims/morote_zuki.json',
  hook: '/anims/hook.json',
  sanbon_zuki: '/anims/sanbon_zuki.json',

  // Защитные блоки и удары ногами
  age_uke: '/anims/age_uke.json',
  soto_uke: '/anims/soto_uke.json',
  uchi_uke: '/anims/uchi_uke.json',
  gedan_barai: '/anims/gedan_barai.json',
  shuto_uke: '/anims/shuto_uke.json',
  manji_uke: '/anims/manji_uke.json',
  mae_geri: '/anims/mae_geri.json',
  yoko_geri: '/anims/yoko_geri.json',
  mawashi_geri: '/anims/mawashi_geri.json',
  kick: '/anims/kick.json',
  ushiro_geri: '/anims/ushiro_geri.json',
  step: '/anims/step.json',

  // Боевые комбинации и техники ката
  mae_geri_gyaku_zuki: '/anims/mae_geri_gyaku_zuki.json',
  age_uke_gyaku_zuki: '/anims/age_uke_gyaku_zuki.json',
  gankaku_shuto: '/anims/gankaku_shuto.json',

  // Канонические стойки с живым дыханием
  stance_ready: '/anims/stance_ready.json',
  stance_zenkutsu: '/anims/stance_zenkutsu.json',
  stance_kokutsu: '/anims/stance_kokutsu.json',
  stance_kiba: '/anims/stance_kiba.json',
  stance_fudo: '/anims/stance_fudo.json',
  stance_gankaku: '/anims/stance_gankaku.json',

  // Ката целиком (один клип на всю форму, со смещением по полу в дорожке Hips)
  heian_shodan: '/anims/heian_shodan.json',
};

/**
 * Сопоставление имени стойки с соответствующим файлом стойки
 */
function getStanceClipName(stanceName) {
  switch (stanceName) {
    case 'ready':
      return 'stance_ready';
    case 'kokutsu':
      return 'stance_kokutsu';
    case 'kiba':
      return 'stance_kiba';
    case 'fudo':
      return 'stance_fudo';
    case 'gankaku':
      return 'stance_gankaku';
    case 'zenkutsu':
      return 'stance_zenkutsu';
    case 'gedan_barai':
    case 'age_uke':
      return 'stance_zenkutsu';
    default:
      return 'stance_ready';
  }
}

/**
 * Высотные оффсеты таза (не нужны для новых процедурных клипов Шотокан)
 */
const MOCAP_DY_OFFSETS = {};

/**
 * Вычисление взвешенных по углам сглаженных нормалей (Smooth Angle-Weighted Normals)
 * с объединением совпадающих пространственных вершин для полного устранения ребристости / фасетирования
 */
function computeSmoothNormals(geom) {
  const pos = geom.attributes.position;
  if (!pos) return;
  const count = pos.count;
  const pA = new THREE.Vector3(), pB = new THREE.Vector3(), pC = new THREE.Vector3();
  const vBA = new THREE.Vector3(), vCA = new THREE.Vector3(), vCB = new THREE.Vector3();
  const faceNorm = new THREE.Vector3();

  // Хеширование совпадающих вершин по позициям (0.1 мм)
  const posMap = new Map();
  for (let i = 0; i < count; i++) {
    const key = (Math.round(pos.getX(i) * 100) / 100) + '_' + (Math.round(pos.getY(i) * 100) / 100) + '_' + (Math.round(pos.getZ(i) * 100) / 100);
    if (!posMap.has(key)) posMap.set(key, []);
    posMap.get(key).push(i);
  }

  const accum = new Array(count).fill(null).map(() => new THREE.Vector3());

  for (let i = 0; i < count; i += 3) {
    pA.fromBufferAttribute(pos, i);
    pB.fromBufferAttribute(pos, i + 1);
    pC.fromBufferAttribute(pos, i + 2);

    vBA.subVectors(pB, pA);
    vCA.subVectors(pC, pA);
    faceNorm.crossVectors(vBA, vCA);
    if (faceNorm.lengthSq() < 1e-12) continue;
    faceNorm.normalize();

    const aA = vBA.angleTo(vCA);
    vCB.subVectors(pC, pB);
    const vAB = vBA.clone().negate();
    const aB = vAB.angleTo(vCB);
    const aC = Math.max(0, Math.PI - aA - aB);

    [ {idx: i, a: aA}, {idx: i+1, a: aB}, {idx: i+2, a: aC} ].forEach(item => {
      const key = (Math.round(pos.getX(item.idx) * 100) / 100) + '_' + (Math.round(pos.getY(item.idx) * 100) / 100) + '_' + (Math.round(pos.getZ(item.idx) * 100) / 100);
      const shared = posMap.get(key);
      if (shared) {
        shared.forEach(sIdx => {
          accum[sIdx].addScaledVector(faceNorm, Math.max(0, item.a));
        });
      }
    });
  }

  const normAttr = geom.attributes.normal;
  for (let i = 0; i < count; i++) {
    accum[i].normalize();
    normAttr.setXYZ(i, accum[i].x, accum[i].y, accum[i].z);
  }
  normAttr.needsUpdate = true;
}

// Моделирование свободного силуэта рукавов кимоно (стиль Arawaza)
// Устраняет обтягивающий эффект "термокофты", придавая рукавам естественную ширину хлопкового доги
function widenKimonoSleeves(geometry, skeleton) {
  if (!geometry || !geometry.attributes.position) return;
  const pos = geometry.attributes.position;
  const skinIndex = geometry.attributes.skinIndex;
  const skinWeight = geometry.attributes.skinWeight;
  const boneNames = skeleton ? skeleton.bones.map(b => b.name) : [];

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const ax = Math.abs(x);
    // Зона предплечья от края короткого рукава (27.0) до манжеты у запястья (36.8)
    if (ax >= 27.0 && ax <= 36.8) {
      let isForearm = false;
      if (skinIndex && skinWeight) {
        for (let w = 0; w < 4; w++) {
          const bIdx = skinIndex.getComponent(i, w);
          const weight = skinWeight.getComponent(i, w);
          if (weight > 0.2 && boneNames[bIdx] && boneNames[bIdx].includes('ForeArm')) {
            isForearm = true;
            break;
          }
        }
      } else {
        isForearm = true;
      }

      if (isForearm) {
        const y = pos.getY(i);
        const z = pos.getZ(i);
        // Продольная ось руки
        const y0 = 74.75;
        const z0 = -4.5 + (ax - 25.0) * 0.08;
        const dy = y - y0;
        const dz = z - z0;
        const r = Math.sqrt(dy * dy + dz * dz);

        // Целевой радиус свободного кимоно Arawaza:
        // Плавный переход от широкого верхнего рукава (r ~ 4.75) к свободной манжете (r ~ 4.35)
        const t = Math.min(1, Math.max(0, (ax - 27.0) / (36.2 - 27.0)));
        let rTarget = 4.75 * (1 - t) + 4.35 * t;
        if (ax > 36.2) {
          const tEnd = (ax - 36.2) / (36.8 - 36.2);
          rTarget = 4.35 * (1 - tEnd) + Math.max(r, 3.0) * tEnd;
        }

        if (r > 0.1 && r < rTarget) {
          const scale = rTarget / r;
          pos.setXYZ(i, x, y0 + dy * scale, z0 + dz * scale);
        }
      }
    }
  }
  pos.needsUpdate = true;
}

// Утончение рукавов доги (SLEEVE_SLIM < 1). Рукава исходной модели имеют радиус ~5 ед. при полуширине
// корпуса ~11 ед., поэтому рука физически не могла пройти вдоль тела (хикитэ, прямой удар) без
// проникновения в корпус. Сечение рукава радиально сжимается к оси руки; плечевой узел не трогаем.
// Значение 1.0 отключает утончение. Оси руки заданы в системе координат меша (Y вверх).
const SLEEVE_SLIM = 0.75;
function slimKimonoSleeves(geometry, skeleton, K = SLEEVE_SLIM) {
  if (!geometry || !geometry.attributes.position || !skeleton || K >= 1) return;
  const pos = geometry.attributes.position;
  const si = geometry.attributes.skinIndex;
  const sw = geometry.attributes.skinWeight;
  const isArmBone = skeleton.bones.map(b => /mixamorig(Left|Right)(Arm|ForeArm)$/.test(b.name));
  const S = [12.90, 75.643, -4.206], E = [22.95, 74.243, -4.376], Wr = [37.48, 75.143, -3.696];
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let i = 0; i < pos.count; i++) {
    let w = 0;
    for (let k = 0; k < 4; k++) if (isArmBone[si.getComponent(i, k)]) w += sw.getComponent(i, k);
    if (w <= 0) continue;
    const x = pos.getX(i), ax = Math.abs(x);
    if (ax < 13) continue;
    const seg = ax < E[0];
    const A = seg ? S : E, Bp = seg ? E : Wr;
    const t = Math.min(1, Math.max(0, seg ? (ax - S[0]) / (E[0] - S[0]) : (ax - E[0]) / (Wr[0] - E[0])));
    const cy = A[1] + (Bp[1] - A[1]) * t, cz = A[2] + (Bp[2] - A[2]) * t;
    const f = 1 - (1 - K) * w * smooth(13.5, 19, ax);
    pos.setXYZ(i, x, cy + (pos.getY(i) - cy) * f, cz + (pos.getZ(i) - cz) * f);
  }
  pos.needsUpdate = true;
}

// Новая UV-развёртка кимоно (атлас sensei-atlas.jpg). Данные — Float32 в base64, по одной паре (u,v) на вершину.
// Развёртка привязана к порядку вершин исходного FBX; при несовпадении числа вершин остаются исходные UV.
let atlasUVCache = null;
function applyAtlasUV(geometry, json) {
  if (!geometry || !json) return;
  if (!atlasUVCache) {
    const data = JSON.parse(json);
    const bin = atob(data.uv);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    atlasUVCache = new Float32Array(bytes.buffer);
  }
  const pos = geometry.attributes.position;
  if (!pos || atlasUVCache.length !== pos.count * 2) return;
  geometry.setAttribute('uv', new THREE.BufferAttribute(atlasUVCache.slice(), 2));
}

/**
 * Анатомическое улучшение лица мастера (Subdivision 1->4) и удаление 3D-бороды/усов
 * 1. Исключает накладные 3D-карточки бороды, усов и спадающих челок
 * 2. Сглаживает контур подбородка и закрывает щель рта (сосредоточенное выражение камаэ)
 * 3. Выполняет подразделение полигонов лица 1->4 (PN-triangles midpoint curvature)
 * 4. Сохраняет корректные веса скиннинга (skinIndex / skinWeight) для плавной скелетной анимации
 */
function refineHeadAndFace(geometry, skeleton) {
  if (!geometry || !geometry.attributes.position) return geometry;
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const si = geometry.attributes.skinIndex;
  const sw = geometry.attributes.skinWeight;
  const totalTris = Math.floor(pos.count / 3);

  const isHeadBone = skeleton ? skeleton.bones.map(b => b.name.includes('Head') || b.name.includes('Neck')) : [];

  // 1. Выделение треугольников головы
  const headTris = [];
  const bodyTris = [];

  for (let ti = 0; ti < totalTris; ti++) {
    const i0 = ti * 3, i1 = i0 + 1, i2 = i0 + 2;
    const cy = (pos.getY(i0) + pos.getY(i1) + pos.getY(i2)) / 3;
    const cz = (pos.getZ(i0) + pos.getZ(i1) + pos.getZ(i2)) / 3;
    let hasHead = false;
    if (si && sw && isHeadBone.length > 0) {
      for (let k = 0; k < 3; k++) {
        const vi = i0 + k;
        for (let w = 0; w < 4; w++) {
          if (sw.getComponent(vi, w) > 0.1 && isHeadBone[si.getComponent(vi, w)]) {
            hasHead = true; break;
          }
        }
        if (hasHead) break;
      }
    } else {
      hasHead = (cy > 80.5) || (cy > 78.5 && cz > 1.0);
    }

    if ((hasHead && cy > 80.5) || cy > 81.0) {
      headTris.push(ti);
    } else {
      bodyTris.push(ti);
    }
  }

  // 2. Коррекция подбородка и смыкание губ
  for (const ti of headTris) {
    for (let k = 0; k < 3; k++) {
      const vi = ti * 3 + k;
      const x = pos.getX(vi);
      const y = pos.getY(vi);
      const z = pos.getZ(vi);
      // Смыкание щели рта
      if (Math.abs(x) <= 1.8 && y >= 83.2 && y <= 84.2 && z >= 4.8) {
        pos.setY(vi, 84.75 - (Math.abs(x) / 1.8) * 0.15);
        pos.setZ(vi, z + 0.05);
      }
      // Анатомическое скругление подбородка вместо выступающей бороды
      if (y < 84.5 && z > 4.5) {
        pos.setZ(vi, 4.5 + (z - 4.5) * 0.3);
      }
    }
  }

// 164 накладные 3D-карточки челки, усов и бороды из Component 1 (Mixamo hair layer),
// закрывавшие лицо и создававшие эффект выступающей бороды
const DROPPED_HAIR_CARDS = new Set([
  336, 832, 2663, 2664, 2665, 2666, 2667, 2668, 2669, 2670, 2885, 2886, 2887, 2888, 2890, 2891, 2892, 2893,
  2894, 2895, 2896, 2897, 2898, 2899, 2900, 2901, 2902, 2903, 2904, 2905, 2906, 2907, 2908, 2909, 2910, 2911,
  2912, 2913, 2914, 2915, 2916, 2917, 2918, 2919, 2920, 2921, 2922, 2923, 2924, 2925, 2926, 2939, 2940, 2943,
  2944, 2945, 2946, 2972, 3017, 3018, 3019, 3020, 3021, 3022, 3023, 3024, 3025, 3026, 3027, 3028, 3029, 3030,
  3053, 3054, 3055, 3056, 3057, 3058, 3067, 3068, 3069, 3070, 3347, 3348, 6897, 6898, 6899, 6900, 6901, 6902,
  6903, 6904, 6905, 6906, 6907, 6908, 7057, 7058, 7059, 7060, 7067, 7068, 7069, 7070, 7071, 7072, 7079, 7080,
  7085, 7086, 7087, 7088, 7101, 7102, 7103, 7104, 7105, 7106, 7107, 7108, 7109, 7110, 7111, 7112, 7113, 7114,
  7115, 7116, 7117, 7118, 7129, 7130, 7131, 7132, 7153, 7154, 7155, 7156, 7157, 7158, 7159, 7160, 7161, 7162,
  7164, 7165, 7166, 7168, 7169, 7170, 7171, 7172, 7173, 7174, 7177, 7178, 7179, 7180, 7181, 7182, 7183, 7184,
  7375, 7376
]);

  // 3. Классификация: фильтрация накладных карточек волос и отбор полигонов лица
  const keptTris = [];
  const faceTris = [];

  for (const ti of headTris) {
    // Исключаем только карточки бороды, усов и накладной челки
    if (DROPPED_HAIR_CARDS.has(ti)) continue;

    const i0 = ti * 3;
    const cy = (pos.getY(i0) + pos.getY(i0 + 1) + pos.getY(i0 + 2)) / 3;
    const cz = (pos.getZ(i0) + pos.getZ(i0 + 1) + pos.getZ(i0 + 2)) / 3;

    // Лицевые полигоны для 4-кратного подразделения (щеки, нос, подбородок, губы, лоб)
    if (cz > -1.0 && cy >= 79.5 && cy <= 97.0) {
      faceTris.push(ti);
    } else {
      keptTris.push(ti);
    }
  }

  // 4. Нормали граней для кривизны PN-triangles
  const fnX = new Float32Array(faceTris.length);
  const fnY = new Float32Array(faceTris.length);
  const fnZ = new Float32Array(faceTris.length);
  for (let fIdx = 0; fIdx < faceTris.length; fIdx++) {
    const ti = faceTris[fIdx];
    const i0 = ti * 3, i1 = i0 + 1, i2 = i0 + 2;
    const ax = pos.getX(i0), ay = pos.getY(i0), az = pos.getZ(i0);
    const bx = pos.getX(i1), by = pos.getY(i1), bz = pos.getZ(i1);
    const cx = pos.getX(i2), cy = pos.getY(i2), cz = pos.getZ(i2);
    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const acx = cx - ax, acy = cy - ay, acz = cz - az;
    let nx = aby * acz - abz * acy;
    let ny = abz * acx - abx * acz;
    let nz = abx * acy - aby * acx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    fnX[fIdx] = nx / len; fnY[fIdx] = ny / len; fnZ[fIdx] = nz / len;
  }

  // 5. Выделение буферов для новой высокополигональной геометрии
  const totalNewVerts = (bodyTris.length + keptTris.length) * 3 + faceTris.length * 12;
  const newPos = new Float32Array(totalNewVerts * 3);
  const newUV = new Float32Array(totalNewVerts * 2);
  const newNorm = new Float32Array(totalNewVerts * 3);
  const newSI = si ? new si.array.constructor(totalNewVerts * 4) : null;
  const newSW = sw ? new Float32Array(totalNewVerts * 4) : null;

  let vOut = 0;

  function copyTri(ti) {
    for (let k = 0; k < 3; k++) {
      const vi = ti * 3 + k;
      const idx3 = vOut * 3;
      const idx2 = vOut * 2;
      const idx4 = vOut * 4;
      newPos[idx3] = pos.getX(vi); newPos[idx3 + 1] = pos.getY(vi); newPos[idx3 + 2] = pos.getZ(vi);
      if (uv) { newUV[idx2] = uv.getX(vi); newUV[idx2 + 1] = uv.getY(vi); }
      if (si && sw && newSI && newSW) {
        for (let w = 0; w < 4; w++) {
          newSI[idx4 + w] = si.getComponent(vi, w);
          newSW[idx4 + w] = sw.getComponent(vi, w);
        }
      }
      vOut++;
    }
  }

  for (const ti of bodyTris) copyTri(ti);
  for (const ti of keptTris) copyTri(ti);

  function addVertex(px, py, pz, uVal, vVal, siArr, swArr) {
    const idx3 = vOut * 3, idx2 = vOut * 2, idx4 = vOut * 4;
    newPos[idx3] = px; newPos[idx3 + 1] = py; newPos[idx3 + 2] = pz;
    newUV[idx2] = uVal; newUV[idx2 + 1] = vVal;
    if (newSI && newSW && siArr && swArr) {
      for (let w = 0; w < 4; w++) {
        newSI[idx4 + w] = siArr[w];
        newSW[idx4 + w] = swArr[w];
      }
    }
    vOut++;
  }

  // Подразделение полигонов лица 1 -> 4
  for (let fIdx = 0; fIdx < faceTris.length; fIdx++) {
    const ti = faceTris[fIdx];
    const i0 = ti * 3, i1 = i0 + 1, i2 = i0 + 2;
    const ax = pos.getX(i0), ay = pos.getY(i0), az = pos.getZ(i0);
    const bx = pos.getX(i1), by = pos.getY(i1), bz = pos.getZ(i1);
    const cx = pos.getX(i2), cy = pos.getY(i2), cz = pos.getZ(i2);

    const uA = uv ? uv.getX(i0) : 0, vA = uv ? uv.getY(i0) : 0;
    const uB = uv ? uv.getX(i1) : 0, vB = uv ? uv.getY(i1) : 0;
    const uC = uv ? uv.getX(i2) : 0, vC = uv ? uv.getY(i2) : 0;

    const siA = si ? [si.getComponent(i0, 0), si.getComponent(i0, 1), si.getComponent(i0, 2), si.getComponent(i0, 3)] : [0, 0, 0, 0];
    const swA = sw ? [sw.getComponent(i0, 0), sw.getComponent(i0, 1), sw.getComponent(i0, 2), sw.getComponent(i0, 3)] : [1, 0, 0, 0];
    const siB = si ? [si.getComponent(i1, 0), si.getComponent(i1, 1), si.getComponent(i1, 2), si.getComponent(i1, 3)] : [0, 0, 0, 0];
    const swB = sw ? [sw.getComponent(i1, 0), sw.getComponent(i1, 1), sw.getComponent(i1, 2), sw.getComponent(i1, 3)] : [1, 0, 0, 0];
    const siC = si ? [si.getComponent(i2, 0), si.getComponent(i2, 1), si.getComponent(i2, 2), si.getComponent(i2, 3)] : [0, 0, 0, 0];
    const swC = sw ? [sw.getComponent(i2, 0), sw.getComponent(i2, 1), sw.getComponent(i2, 2), sw.getComponent(i2, 3)] : [1, 0, 0, 0];

    const fnx = fnX[fIdx], fny = fnY[fIdx], fnz = fnZ[fIdx];
    const edgeLenAB = Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay) + (bz - az) * (bz - az));
    const edgeLenBC = Math.sqrt((cx - bx) * (cx - bx) + (cy - by) * (cy - by) + (cz - bz) * (cz - bz));
    const edgeLenCA = Math.sqrt((ax - cx) * (ax - cx) + (ay - cy) * (ay - cy) + (az - cz) * (az - cz));
    const disp = 0.04;

    const mABx = (ax + bx) * 0.5 + fnx * edgeLenAB * disp;
    const mABy = (ay + by) * 0.5 + fny * edgeLenAB * disp;
    const mABz = (az + bz) * 0.5 + fnz * edgeLenAB * disp;
    const uAB = (uA + uB) * 0.5, vAB = (vA + vB) * 0.5;

    const mBCx = (bx + cx) * 0.5 + fnx * edgeLenBC * disp;
    const mBCy = (by + cy) * 0.5 + fny * edgeLenBC * disp;
    const mBCz = (bz + cz) * 0.5 + fnz * edgeLenBC * disp;
    const uBC = (uB + uC) * 0.5, vBC = (vB + vC) * 0.5;

    const mCAx = (cx + ax) * 0.5 + fnx * edgeLenCA * disp;
    const mCAy = (cy + ay) * 0.5 + fny * edgeLenCA * disp;
    const mCAz = (cz + az) * 0.5 + fnz * edgeLenCA * disp;
    const uCA = (uC + uA) * 0.5, vCA = (vC + vA) * 0.5;

    const swAB = [0.5 * (swA[0] + swB[0]), 0.5 * (swA[1] + swB[1]), 0.5 * (swA[2] + swB[2]), 0.5 * (swA[3] + swB[3])];
    const swBC = [0.5 * (swB[0] + swC[0]), 0.5 * (swB[1] + swC[1]), 0.5 * (swB[2] + swC[2]), 0.5 * (swB[3] + swC[3])];
    const swCA = [0.5 * (swC[0] + swA[0]), 0.5 * (swC[1] + swA[1]), 0.5 * (swC[2] + swA[2]), 0.5 * (swC[3] + swA[3])];

    // Подтреугольник 1: A, mAB, mCA
    addVertex(ax, ay, az, uA, vA, siA, swA);
    addVertex(mABx, mABy, mABz, uAB, vAB, siA, swAB);
    addVertex(mCAx, mCAy, mCAz, uCA, vCA, siA, swCA);

    // Подтреугольник 2: mAB, B, mBC
    addVertex(mABx, mABy, mABz, uAB, vAB, siB, swAB);
    addVertex(bx, by, bz, uB, vB, siB, swB);
    addVertex(mBCx, mBCy, mBCz, uBC, vBC, siB, swBC);

    // Подтреугольник 3: mCA, mBC, C
    addVertex(mCAx, mCAy, mCAz, uCA, vCA, siC, swCA);
    addVertex(mBCx, mBCy, mBCz, uBC, vBC, siC, swBC);
    addVertex(cx, cy, cz, uC, vC, siC, swC);

    // Подтреугольник 4: mAB, mBC, mCA
    addVertex(mABx, mABy, mABz, uAB, vAB, siA, swAB);
    addVertex(mBCx, mBCy, mBCz, uBC, vBC, siB, swBC);
    addVertex(mCAx, mCAy, mCAz, uCA, vCA, siC, swCA);
  }

  const newGeom = new THREE.BufferGeometry();
  newGeom.setAttribute('position', new THREE.BufferAttribute(newPos, 3));
  newGeom.setAttribute('normal', new THREE.BufferAttribute(newNorm, 3));
  newGeom.setAttribute('uv', new THREE.BufferAttribute(newUV, 2));
  if (newSI) newGeom.setAttribute('skinIndex', new THREE.BufferAttribute(newSI, 4));
  if (newSW) newGeom.setAttribute('skinWeight', new THREE.BufferAttribute(newSW, 4));

  return newGeom;
}

// Глобальный кэш распарсенных AnimationClip, чтобы исключить дублирование сетевых запросов и парсинга JSON
const globalClipCache = new Map();
let globalClipPromise = null;

async function getCachedClips() {
  if (globalClipPromise) return globalClipPromise;

  globalClipPromise = (async () => {
    await Promise.all(
      Object.entries(CLIP_FILES).map(async ([name, url]) => {
        if (globalClipCache.has(name)) return;
        try {
          const res = await fetch(url);
          if (!res.ok) return;
          const json = await res.json();
          const clip = THREE.AnimationClip.parse(json);
          globalClipCache.set(name, clip);
        } catch {
          // ignore error
        }
      })
    );
    return globalClipCache;
  })();

  return globalClipPromise;
}

export default function RealisticSenseiModel({
  role = 'tori',
  stance = 'ready',
  activeClip = null,
  speed = 1.0,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}) {
  const groupRef = useRef();

  // Загружаем 3D FBX персонажа и текстуру sensei-orig.png (Arawaza длинные рукава до запястья, чистый черный пояс без артефактов, кимоно без нашивок, цвет кожи на груди)
  const fbx = useFBX('/models/sensei.fbx');
  // Атлас 2048×2048: слева-сверху оригинальная текстура (лицо, руки, ступни), остальное — новая развёртка
  // кимоно (куртка, рукава, штаны, пояс). UV-координаты кимоно лежат в sensei-uv.json (см. applyAtlasUV).
  const [texture, bumpTexture] = useLoader(THREE.TextureLoader, [
    '/models/sensei-atlas.jpg?v=uv1',
    '/models/sensei-atlas-bump.jpg?v=uv1',
  ]);
  const uvJson = useLoader(THREE.FileLoader, '/models/sensei-uv.json?v=uv1');

  useMemo(() => {
    if (texture) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = true;
      texture.anisotropy = 8;
      texture.needsUpdate = true;
    }
    if (bumpTexture) {
      bumpTexture.flipY = true;
      bumpTexture.anisotropy = 8;
      bumpTexture.needsUpdate = true;
    }
  }, [texture, bumpTexture]);

  // Клонируем персонажа со скелетом
  const { clonedModel, scale, twist } = useMemo(() => {
    const clone = SkeletonUtils.clone(fbx);

    // Точная калибровка роста до 1.78 м (взрослый мастер каратэ)
    const bbox = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const s = size.y > 0 ? 1.78 / size.y : 0.0182;
    clone.scale.setScalar(s);

    // Подошвы стоп строго на татами Y = 0.00
    clone.position.y = -bbox.min.y * s;

    // Материал хлопкового кимоно (доги) с соревновательными цветами
    let giColor = '#ffffff';
    if (role === 'uke') {
      giColor = '#3a4a5e'; // Традиционное темно-синее доги цвета индиго для нападающего Укэ
    } else if (role === 'uke2') {
      giColor = '#423737'; // Графитовое доги для второго атакующего
    }
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.geometry) {
          if (!child.geometry.userData.sleevesWidened) {
            child.geometry = child.geometry.clone();
            widenKimonoSleeves(child.geometry, child.skeleton);
            slimKimonoSleeves(child.geometry, child.skeleton);
            applyAtlasUV(child.geometry, uvJson);
            const refined = refineHeadAndFace(child.geometry, child.skeleton);
            if (refined && refined !== child.geometry) {
              child.geometry.dispose();
              child.geometry = refined;
              child.bind(child.skeleton, child.bindMatrix);
            }
            computeSmoothNormals(child.geometry);
            child.geometry.userData.sleevesWidened = true;
          }
        }
        child.material = new THREE.MeshStandardMaterial({
          map: texture,
          bumpMap: bumpTexture,
          bumpScale: 0.6,
          color: new THREE.Color(giColor),
          roughness: 0.85,
          metalness: 0.0,
          side: THREE.DoubleSide,
        });
      }
    });

    // Твист-кости предплечья: рукав не «схлопывается» на локте при вращении кулака (пронация)
    clone.updateMatrixWorld(true);
    const twistList = addForearmTwistBones(clone);

    return { clonedModel: clone, scale: s, twist: twistList };
  }, [fbx, texture, bumpTexture, uvJson, role]);
  const twistRef = useRef(null);
  twistRef.current = twist;

  // Управление аниматором через AnimationMixer
  const mixerRef = useRef();
  const actionsRef = useRef({});
  const currentStanceActionRef = useRef(null);
  const currentTechActionRef = useRef(null);
  const [clipsReady, setClipsReady] = useState(false);

  // Быстрая загрузка клипов из общего кэша (0 дублирующих сетевых запросов)
  useEffect(() => {
    const mixer = new THREE.AnimationMixer(clonedModel);
    mixerRef.current = mixer;

    let cancelled = false;

    getCachedClips().then((cachedClips) => {
      if (cancelled) return;
      cachedClips.forEach((clip, name) => {
        const action = mixer.clipAction(clip);
        actionsRef.current[name] = action;
      });
      setClipsReady(true);
    });

    return () => {
      cancelled = true;
      mixer.stopAllAction();
    };
  }, [clonedModel]);

  // Переключение стойки (stance)
  useEffect(() => {
    if (!clipsReady || !mixerRef.current) return;

    // Если сейчас играет разовый динамический прием, стойка применится после него
    const targetClipName = getStanceClipName(stance);
    const targetAction = actionsRef.current[targetClipName];
    if (!targetAction) return;

    targetAction.reset();
    targetAction.setLoop(THREE.LoopRepeat);
    targetAction.clampWhenFinished = false;

    if (!currentTechActionRef.current || !currentTechActionRef.current.isRunning()) {
      targetAction.fadeIn(0.22).play();
      if (currentStanceActionRef.current && currentStanceActionRef.current !== targetAction) {
        currentStanceActionRef.current.fadeOut(0.22);
      }
    }
    currentStanceActionRef.current = targetAction;
  }, [stance, clipsReady]);

  // Запуск динамического приема (activeClip: choku_zuki, oi_zuki, mae_geri, etc.)
  useEffect(() => {
    if (!clipsReady || !mixerRef.current) return;

    if (!activeClip) {
      if (currentTechActionRef.current) {
        currentTechActionRef.current.fadeOut(0.18);
        currentTechActionRef.current = null;
        if (currentStanceActionRef.current) {
          currentStanceActionRef.current.reset().fadeIn(0.18).play();
        }
      }
      return;
    }

    if (activeClip && actionsRef.current[activeClip]) {
      const techAction = actionsRef.current[activeClip];

      techAction.reset();
      techAction.setLoop(THREE.LoopOnce, 1);
      techAction.clampWhenFinished = true;
      techAction.fadeIn(0.12).play();

      if (currentStanceActionRef.current) {
        currentStanceActionRef.current.fadeOut(0.12);
      }

      const onFinished = (e) => {
        if (e.action === techAction) {
          techAction.fadeOut(0.18);
          currentTechActionRef.current = null;
          if (currentStanceActionRef.current) {
            currentStanceActionRef.current.reset().fadeIn(0.18).play();
          }
        }
      };

      mixerRef.current.addEventListener('finished', onFinished);
      currentTechActionRef.current = techAction;

      return () => {
        if (mixerRef.current) {
          mixerRef.current.removeEventListener('finished', onFinished);
        }
      };
    }
  }, [activeClip, clipsReady]);

  // Покадровое обновление аниматора с защитой от спайков дельты (плавные 60 FPS)
  useFrame((_, delta) => {
    if (mixerRef.current) {
      const safeDelta = Math.min(delta, 0.033);
      mixerRef.current.update(safeDelta * speed);
      updateForearmTwist(twistRef.current);
    }
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      <primitive object={clonedModel} />
    </group>
  );
}

useFBX.preload('/models/sensei.fbx');
