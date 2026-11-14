import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { solveTwoBoneIK } from './ikSolver';
import { extractHandBiomechanics, estimateHeadOrientation } from '../utils/mocapPoseTracker';
import { applyHandRetargetingToArmature } from '../utils/mocapHandRetargeter';
import {
  MasterBiomechanicalRetargeter,
  constrainKneeJoint,
  constrainElbowJoint,
} from '../utils/mocapBiomechanicalRetargeter';

/**
 * MocapPuppetAvatar — 3D-аватар мастера каратэ Шотокан (Karateka lowpoly).
 * 
 * Точный кинематический движок из Karate Motion Studio:
 * 1. Иерархическое выравнивание костей (alignBone) с защитой от сингулярностей (Gimbal flip)
 * 2. Динамическая протракция и депрессия ключиц (alignShoulder) для естественной посадки плеча
 * 3. Ориентация стоп на татами (alignFoot) с сохранением угла атаки и разворота носка
 * 4. Полный анатомический контроль 30 костей фаланг пальцев (Thumb1..3, Index1..3, Middle1..3, Ring1..3, Pinky1..3)
 *    с поддержкой перехода Сэйкэн (кулак) <-> Шуто (открытая ладонь)
 * 5. Ориентация взгляда и головы Мэцукэ (Head + Neck)
 * 6. Многосегментный позвоночник (Spine 45%, Spine1 75%, Chest 100%) и наклон таза (Pelvic Tilt 35%)
 * 7. Физическое заземление подошв на Y = 0 (Tatami floor): присед опускает корень строго синхронно с компрессией ног,
 *    исключая подтягивание ног к себе и проваливание под пол!
 * 8. Поддержка ролей Тори (Белое ги) и Укэ (Индиго ги) для парного режима Бункай и Кумитэ.
 */

function makeBasisQ(x, y, z) {
  const m = new THREE.Matrix4().makeBasis(x, y, z);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

function alignArm(bUpper, bLower, vArm, vForearm, torsoFwd, shoulderLateral, sideKey = 'R', alpha = 0.85) {
  if (!bUpper || !vArm || vArm.lengthSq() < 1e-4) return;
  const isLeft = (sideKey === 'L');
  const uArm = vArm.clone().normalize();

  let hNat = isLeft
    ? new THREE.Vector3().crossVectors(torsoFwd, uArm)
    : new THREE.Vector3().crossVectors(torsoFwd, uArm).negate();
  if (hNat.lengthSq() < 1e-4) {
    hNat.set(0, 1, 0);
  } else {
    hNat.normalize();
  }

  const hasForearm = (bLower && vForearm && vForearm.lengthSq() > 1e-4);
  let zHinge = hNat.clone();
  let flexAngle = 0.0;

  if (hasForearm) {
    const uForearm = vForearm.clone().normalize();
    const dotCollinear = Math.max(-1.0, Math.min(1.0, uArm.dot(uForearm)));
    flexAngle = Math.acos(dotCollinear);
    flexAngle = Math.max(0.0, Math.min(Math.PI * 0.86, flexAngle));

    if (flexAngle > 0.08) {
      const nBend = isLeft
        ? new THREE.Vector3().crossVectors(vForearm, vArm)
        : new THREE.Vector3().crossVectors(vArm, vForearm);
      if (nBend.lengthSq() > 1e-4) {
        nBend.normalize();
        if (nBend.dot(hNat) < 0) nBend.negate();
        const blendW = Math.min(1.0, (flexAngle - 0.08) / 0.25);
        zHinge.lerp(nBend, blendW).normalize();
      }
    }
  }

  let zUpper = zHinge.clone().sub(uArm.clone().multiplyScalar(zHinge.dot(uArm)));
  if (zUpper.lengthSq() < 1e-4) {
    zUpper.copy(hNat);
  } else {
    zUpper.normalize();
  }

  const xUpper = new THREE.Vector3().crossVectors(uArm, zUpper).normalize();
  zUpper.crossVectors(xUpper, uArm).normalize();

  const qUpperWorld = makeBasisQ(xUpper, uArm, zUpper);
  const pQUpper = new THREE.Quaternion();
  if (bUpper.parent) bUpper.parent.getWorldQuaternion(pQUpper);
  const targetLocalUpper = pQUpper.clone().invert().multiply(qUpperWorld);
  bUpper.quaternion.slerp(targetLocalUpper, alpha);
  bUpper.updateMatrixWorld(true);

  if (hasForearm && bLower) {
    const bendAxis = isLeft ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 0, 1);
    const qLowerLocal = new THREE.Quaternion().setFromAxisAngle(bendAxis, flexAngle);
    bLower.quaternion.slerp(qLowerLocal, alpha);
    bLower.updateMatrixWorld(true);
  }
}

function alignLeg(bUpper, bLower, vThigh, vShin, torsoFwd, pelvisLateral, sideKey = 'R', alpha = 0.85) {
  if (!bUpper || !vThigh || vThigh.lengthSq() < 1e-4) return;
  const isLeft = (sideKey === 'L');
  const uThigh = vThigh.clone().normalize();

  let xLat = pelvisLateral ? pelvisLateral.clone() : new THREE.Vector3(1, 0, 0);
  if (xLat.lengthSq() < 1e-4) xLat.set(1, 0, 0);
  else xLat.normalize();

  let xUpper = xLat.clone().sub(uThigh.clone().multiplyScalar(xLat.dot(uThigh)));
  if (xUpper.lengthSq() < 1e-4) {
    xUpper.copy(xLat);
  } else {
    xUpper.normalize();
  }

  const zUpper = new THREE.Vector3().crossVectors(xUpper, uThigh).normalize();
  xUpper.crossVectors(uThigh, zUpper).normalize();

  const qUpperWorld = makeBasisQ(xUpper, uThigh, zUpper);
  const pQUpper = new THREE.Quaternion();
  if (bUpper.parent) bUpper.parent.getWorldQuaternion(pQUpper);
  const targetLocalUpper = pQUpper.clone().invert().multiply(qUpperWorld);
  bUpper.quaternion.slerp(targetLocalUpper, alpha);
  bUpper.updateMatrixWorld(true);

  const hasShin = (bLower && vShin && vShin.lengthSq() > 1e-4);
  if (hasShin && bLower) {
    let uShin = vShin.clone().normalize();
    let dotCollinear = Math.max(-1.0, Math.min(1.0, uThigh.dot(uShin)));

    // 2D Projection Collinearity on the Camera Plane:
    const lenThighXY = Math.hypot(vThigh.x, vThigh.y);
    const lenShinXY = Math.hypot(vShin.x, vShin.y);
    const dot2D = (lenThighXY > 1e-4 && lenShinXY > 1e-4)
      ? (vThigh.x * vShin.x + vThigh.y * vShin.y) / (lenThighXY * lenShinXY)
      : dotCollinear;

    // KNEE EXTENSION & KICK LOCKOUT ASSIST:
    // When a person extends their leg (clearly collinear in 3D: dotCollinear > 0.50 OR in 2D: dot2D > 0.75):
    // Lock knee flexion directly to 0° (fully straight leg)!
    let kneeFlex = Math.acos(Math.max(-1.0, Math.min(1.0, dotCollinear)));
    const isExtended = (dotCollinear > 0.50 || dot2D > 0.75);
    if (isExtended) {
      const t3D = Math.max(0.0, Math.min(1.0, (dotCollinear - 0.50) / 0.35));
      const t2D = Math.max(0.0, Math.min(1.0, (dot2D - 0.75) / 0.18));
      const tExt = Math.max(t3D, t2D);
      const easeExt = tExt * tExt * (3.0 - 2.0 * tExt);
      kneeFlex *= (1.0 - easeExt);
    }
    kneeFlex = Math.max(0.0, Math.min(Math.PI * 0.86, kneeFlex));

    const qLowerLocal = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), kneeFlex);
    bLower.quaternion.slerp(qLowerLocal, alpha);
    bLower.updateMatrixWorld(true);
  }
}

function alignBone(bone, targetDir, alpha = 0.85) {
  if (!bone || !bone.restWorldDir || !targetDir || targetDir.lengthSq() < 1e-5) return;
  const vFrom = bone.restWorldDir;
  let vTo = targetDir.clone().normalize();
  const dot = vFrom.dot(vTo);
  if (dot < -0.92) {
    vTo.z = Math.max(vTo.z, 0.35);
    vTo.normalize();
  }
  const rotWorld = new THREE.Quaternion().setFromUnitVectors(vFrom, vTo);
  const targetWorldQ = rotWorld.clone().multiply(bone.restWorldQ);
  const parentWorldQ = new THREE.Quaternion();
  if (bone.parent) bone.parent.getWorldQuaternion(parentWorldQ);
  const targetLocalQ = parentWorldQ.clone().invert().multiply(targetWorldQ);
  bone.quaternion.slerp(targetLocalQ, alpha);
  bone.updateMatrixWorld(true);
}

function alignShoulder(bone, vArm, sideKey = 'R', alpha = 0.70) {
  if (!bone || !vArm || vArm.lengthSq() < 1e-4) return;
  const uArm = vArm.clone().normalize();
  const fwdReach = Math.max(0, uArm.z);
  const backReach = Math.min(0, uArm.z); // Scapular Retraction for HIKITE!
  const elevate = Math.max(0, uArm.y);
  const depress = Math.min(0, uArm.y);
  let vClavicle = null;

  if (sideKey === 'R') {
    const crossReach = Math.max(0, uArm.x);
    const yOffset = elevate > 0 ? elevate * 0.25 : depress * 0.20;
    vClavicle = new THREE.Vector3(-1.0 + crossReach * 0.35, yOffset, fwdReach * 0.35 + backReach * 0.22).normalize();
  } else {
    const crossReach = Math.max(0, -uArm.x);
    const yOffset = elevate > 0 ? elevate * 0.25 : depress * 0.20;
    vClavicle = new THREE.Vector3(1.0 - crossReach * 0.35, yOffset, fwdReach * 0.35 + backReach * 0.22).normalize();
  }
  alignBone(bone, vClavicle, alpha);
}

const footOrientMemory = {
  R: { yaw: null, pitch: null },
  L: { yaw: null, pitch: null },
};

function alignFoot(bFoot, vFoot, bLowerLeg, pelvisLateral, sideKey = 'R', alphaTarget = 0.75) {
  if (!bFoot || !vFoot || vFoot.lengthSq() < 1e-4) return;
  const mem = footOrientMemory[sideKey] || footOrientMemory.R;

  let curYaw = Math.atan2(vFoot.x, vFoot.z);
  const lenXZ = Math.hypot(vFoot.x, vFoot.z);
  let curPitch = Math.atan2(vFoot.y, Math.max(0.04, lenXZ));
  curPitch = Math.max(-0.85, Math.min(0.25, curPitch));

  if (mem.yaw === null) {
    mem.yaw = curYaw;
    mem.pitch = curPitch;
  } else {
    let diffYaw = curYaw - mem.yaw;
    while (diffYaw > Math.PI) diffYaw -= 2 * Math.PI;
    while (diffYaw < -Math.PI) diffYaw += 2 * Math.PI;

    const maxDiff = Math.max(Math.abs(diffYaw), Math.abs(curPitch - mem.pitch));
    const alpha = maxDiff > 0.20 ? 0.75 : (maxDiff > 0.05 ? 0.40 : 0.20);
    mem.yaw += diffYaw * alpha;
    mem.pitch = mem.pitch * (1 - alpha) + curPitch * alpha;
  }

  const cosP = Math.cos(mem.pitch);
  const sinP = Math.sin(mem.pitch);
  const sinY = Math.sin(mem.yaw);
  const cosY = Math.cos(mem.yaw);

  const yFoot = new THREE.Vector3(sinY * cosP, sinP, cosY * cosP).normalize();

  let xLat = pelvisLateral ? pelvisLateral.clone() : new THREE.Vector3(1, 0, 0);
  let xFoot = xLat.clone().sub(yFoot.clone().multiplyScalar(xLat.dot(yFoot)));
  if (xFoot.lengthSq() < 1e-4) xFoot.set(1, 0, 0);
  else xFoot.normalize();

  const zFoot = new THREE.Vector3().crossVectors(xFoot, yFoot).normalize();
  xFoot.crossVectors(yFoot, zFoot).normalize();

  const mFoot = new THREE.Matrix4().makeBasis(xFoot, yFoot, zFoot);
  const targetWorldQ = new THREE.Quaternion().setFromRotationMatrix(mFoot);

  const parentWorldQ = new THREE.Quaternion();
  if (bFoot.parent) bFoot.parent.getWorldQuaternion(parentWorldQ);
  const targetLocalQ = parentWorldQ.clone().invert().multiply(targetWorldQ);

  bFoot.quaternion.slerp(targetLocalQ, alphaTarget);
  bFoot.updateMatrixWorld(true);
}

const handOrientMemory = {
  R: { fwd: null, norm: null },
  L: { fwd: null, norm: null },
};

function alignHand(bone, targetFwd, targetNorm, sideKey = 'R', alphaTarget = 0.70) {
  if (!bone || !targetFwd || !targetNorm) return;
  const mem = handOrientMemory[sideKey] || handOrientMemory.R;

  let curFwd = targetFwd.clone().normalize();
  let curNorm = targetNorm.clone().normalize();
  if (curFwd.lengthSq() < 1e-4 || curNorm.lengthSq() < 1e-4) return;

  if (!mem.fwd) {
    mem.fwd = curFwd.clone();
    mem.norm = curNorm.clone();
  } else {
    const angFwd = mem.fwd.angleTo(curFwd);
    const angNorm = mem.norm.angleTo(curNorm);
    const maxAng = Math.max(angFwd, angNorm);
    const alpha = maxAng > 0.18 ? 0.70 : (maxAng > 0.06 ? 0.35 : 0.18);
    mem.fwd.lerp(curFwd, alpha).normalize();
    mem.norm.lerp(curNorm, alpha).normalize();
  }

  const uy = mem.fwd.clone();
  const dorsal = mem.norm.clone().negate().normalize();
  const dot = dorsal.dot(uy);
  const uz = dorsal.clone().sub(uy.clone().multiplyScalar(dot)).normalize();
  if (uz.lengthSq() < 1e-4) return;

  const ux = new THREE.Vector3().crossVectors(uy, uz).normalize();
  if (ux.lengthSq() < 1e-4) return;

  const basisMat = new THREE.Matrix4().makeBasis(ux, uy, uz);
  const targetWorldQ = new THREE.Quaternion().setFromRotationMatrix(basisMat);

  const parentWorldQ = new THREE.Quaternion();
  if (bone.parent) bone.parent.getWorldQuaternion(parentWorldQ);
  const targetLocalQ = parentWorldQ.clone().invert().multiply(targetWorldQ);

  bone.quaternion.slerp(targetLocalQ, alphaTarget);
  bone.updateMatrixWorld(true);
}

const FINGER_TYPES = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];

/**
 * Анатомический перенос движений пальцев на фаланги Karateka_Armature (30 костей)
 * Точный алгоритм из Karate Motion Studio:
 * - Большой палец: оппозиция CMC в плоскости ладони + сгибание MCP и IP
 * - 4 пальца: MCP разведение (abduction) + фаланговое сгибание вокруг -X
 */
function applyFingersToArmature(boneMap, fData, sideKey = 'R', alpha = 0.80) {
  if (!boneMap || !fData) return;
  const isLeft = sideKey === 'L';
  const hasPhalanges = fData.phalanges && fData.detected;

  FINGER_TYPES.forEach((ftype) => {
    const fKey = ftype.toLowerCase();
    const curl = typeof fData[fKey] === 'number' ? fData[fKey] : (fData.general_curl ?? 0.15);
    const phalanges = fData.phalanges?.[fKey];
    const abd = fData.abduction?.[fKey] || 0.0;

    for (let ph = 1; ph <= 3; ph++) {
      const bname = `${ftype}${ph}.${sideKey}`;
      const bone = boneMap.get(bname);
      if (!bone || !bone.restLocalQ) continue;

      if (ftype === 'Thumb') {
        const zSign = isLeft ? 1.0 : -1.0;
        const flexVal = phalanges?.[ph - 1] !== undefined ? phalanges[ph - 1] : curl * 1.2;
        let rotVec;
        if (ph === 1) {
          // Trapeziometacarpal / CMC: оппозиция поперек ладони и сгибание
          const oppVal = hasPhalanges ? Math.max(0.0, abd) : curl;
          rotVec = new THREE.Vector3(-0.35 * flexVal, 0.0, 0.80 * oppVal * zSign);
        } else if (ph === 2) {
          // MCP: сгибание
          rotVec = new THREE.Vector3(-0.80 * flexVal, 0.0, 0.35 * curl * zSign);
        } else {
          // IP: дистальное сгибание
          rotVec = new THREE.Vector3(-0.95 * flexVal, 0.0, 0.15 * zSign);
        }
        const len = rotVec.length();
        if (len > 1e-4) {
          const flexQ = new THREE.Quaternion().setFromAxisAngle(rotVec.clone().normalize(), len);
          const qTarget = bone.restLocalQ.clone().multiply(flexQ);
          bone.quaternion.slerp(qTarget, alpha);
        } else {
          bone.quaternion.slerp(bone.restLocalQ, alpha);
        }
      } else {
        // 4 пальца: индивидуальное сгибание вокруг локальной оси -X
        const flexAng = phalanges?.[ph - 1] !== undefined ? phalanges[ph - 1] : curl * 1.4;
        const flexQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(-1, 0, 0), flexAng);

        if (ph === 1) {
          // MCP: разведение пальцев в плоскости ладони (abduction) вокруг оси Z
          const sideSign = isLeft ? 1.0 : -1.0;
          let abdDir = 0.0;
          if (ftype === 'Index') abdDir = 1.0 * sideSign;
          else if (ftype === 'Pinky') abdDir = -1.2 * sideSign;
          else if (ftype === 'Ring') abdDir = -0.4 * sideSign;

          const abdAng = abd * abdDir * 0.45;
          const abdQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), abdAng);
          const qTarget = bone.restLocalQ.clone().multiply(abdQ).multiply(flexQ);
          bone.quaternion.slerp(qTarget, alpha);
        } else {
          const qTarget = bone.restLocalQ.clone().multiply(flexQ);
          bone.quaternion.slerp(qTarget, alpha);
        }
      }
    }
  });
}


export default function MocapPuppetAvatar({
  boneRotations = null,
  poseLandmarks = null,
  worldLandmarks = null,
  poseDataRef = null,
  mirrorMode = true,
  detectedStance = 'ready',
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1.0,
  xrayMode = false,
  role = 'tori', // 'tori' (белое ги) | 'uke' (индиго ги)
}) {
  const groupRef = useRef();
  // Загружаем классическую легковесную модель мастера из Karate Motion Studio
  const { scene } = useGLTF('/models/karateka_lowpoly.glb');

  const { clonedModel, boneMap, modelScale, modelYOffset } = useMemo(() => {
    const clone = SkeletonUtils.clone(scene);
    const map = new Map();

    const bbox = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    bbox.getSize(size);

    // Нормализация роста до 1.78 м
    const s = size.y > 0 ? 1.78 / size.y : 1.0;
    const yOff = -bbox.min.y * s;

    clone.updateMatrixWorld(true);
    clone.traverse((child) => {
      if (child.isBone) {
        const raw = child.name;
        map.set(raw, child);
        map.set(raw.replace(/\./g, ''), child);
        if (raw.endsWith('L') && !raw.includes('.')) {
          map.set(raw.slice(0, -1) + '.L', child);
        } else if (raw.endsWith('R') && !raw.includes('.')) {
          map.set(raw.slice(0, -1) + '.R', child);
        } else if (raw.includes('.')) {
          map.set(raw.replace('.', '_'), child);
        }

        child.restLocalQ = child.quaternion.clone();
        child.restWorldQ = new THREE.Quaternion();
        child.getWorldQuaternion(child.restWorldQ);
        child.restWorldDir = new THREE.Vector3(0, 1, 0).applyQuaternion(child.restWorldQ).normalize();
        child.restPosition = child.position.clone();
      }
      if (child.isMesh) {
        child.frustumCulled = false;
        child.castShadow = !xrayMode;
        child.receiveShadow = true;

        if (child.material) {
          const mat = child.material.clone();
          mat.side = THREE.DoubleSide;
          const name = child.name || '';
          if (name.includes('Belt') || name.includes('Obi')) {
            mat.color = new THREE.Color(role === 'uke' ? '#2d1808' : '#141414');
            if (xrayMode) {
              mat.transparent = true;
              mat.opacity = 0.7;
            }
          } else if (name.includes('Gi') || name.includes('Jacket') || name.includes('Pants') || name.includes('Mesh')) {
            mat.color = new THREE.Color(role === 'uke' ? '#1b2c45' : '#faf9f6');
            if (xrayMode) {
              mat.transparent = true;
              mat.opacity = 0.45;
              mat.roughness = 0.5;
            }
          }
          child.material = mat;
        }
      }
    });

    return { clonedModel: clone, boneMap: map, modelScale: s, modelYOffset: yOff };
  }, [scene, xrayMode, role]);

  const masterRetargeterRef = useRef(null);
  if (!masterRetargeterRef.current) {
    masterRetargeterRef.current = new MasterBiomechanicalRetargeter({ groundY: 0.0 });
  }

  useEffect(() => {
    clonedModel.updateMatrixWorld(true);
    boneMap.forEach((node) => {
      if (!node.restWorldQ) {
        node.restLocalQ = node.quaternion.clone();
        node.restWorldQ = new THREE.Quaternion();
        node.getWorldQuaternion(node.restWorldQ);
        node.restWorldDir = new THREE.Vector3(0, 1, 0).applyQuaternion(node.restWorldQ).normalize();
        node.restPosition = node.position.clone();
      }
    });
    masterRetargeterRef.current.registerRestArmature(boneMap);
  }, [boneMap, clonedModel]);

  const nominalLegLenRef = useRef(0.82);
  const smoothRootYRef = useRef(0.0);
  const smoothRootZRef = useRef(0.0);

  useFrame((_, delta) => {
    const lerpFactor = Math.min(1.0, delta * 16);

    const activePose = poseDataRef?.current || (
      (worldLandmarks || poseLandmarks) ? { worldLandmarks, landmarks: poseLandmarks } : null
    );

    const ptsRaw = activePose?.worldLandmarks || activePose?.landmarks;

    if (ptsRaw && ptsRaw.length >= 33) {
      try {
        const toVec = (idx) => {
          const p = ptsRaw[idx];
          if (!p) return null;
          const px = typeof p.x === 'number' ? p.x : (Array.isArray(p) ? p[0] : undefined);
          const py = typeof p.y === 'number' ? p.y : (Array.isArray(p) ? p[1] : undefined);
          const pz = typeof p.z === 'number' ? p.z : (Array.isArray(p) ? p[2] : 0);
          if (px === undefined || py === undefined) return null;
          if (activePose.worldLandmarks) {
            return new THREE.Vector3(px, -py, -pz);
          }
          return new THREE.Vector3((px - 0.5) * 1.5, -(py - 0.5) * 1.8, -(pz * 1.5));
        };

      const pLSh = toVec(11);
      const pRSh = toVec(12);
      const pLEl = toVec(13);
      const pREl = toVec(14);
      const pLWr = toVec(15);
      const pRWr = toVec(16);
      const pLPinky = toVec(17);
      const pRPinky = toVec(18);
      const pLIdx = toVec(19);
      const pRIdx = toVec(20);
      const pLHp = toVec(23);
      const pRHp = toVec(24);
      const pLKn = toVec(25);
      const pRKn = toVec(26);
      const pLAn = toVec(27);
      const pRAn = toVec(28);
      const pLHeel = toVec(29) || pLAn;
      const pRHeel = toVec(30) || pRAn;
      const pLToe = toVec(31) || pLAn;
      const pRToe = toVec(32) || pRAn;

      // Маппинг костей: Зеркальный режим vs Прямой
      const bHips = boneMap.get('Hips');
      const bSpine = boneMap.get('Spine');
      const bSpine1 = boneMap.get('Spine1');
      const bChest = boneMap.get('Chest');

      const armR_Upper = mirrorMode ? boneMap.get('UpperArm.L') : boneMap.get('UpperArm.R');
      const armR_Lower = mirrorMode ? boneMap.get('LowerArm.L') : boneMap.get('LowerArm.R');
      const armR_Hand = mirrorMode ? boneMap.get('Hand.L') : boneMap.get('Hand.R');
      const armR_Shoulder = mirrorMode ? boneMap.get('Shoulder.L') : boneMap.get('Shoulder.R');

      const armL_Upper = mirrorMode ? boneMap.get('UpperArm.R') : boneMap.get('UpperArm.L');
      const armL_Lower = mirrorMode ? boneMap.get('LowerArm.R') : boneMap.get('LowerArm.L');
      const armL_Hand = mirrorMode ? boneMap.get('Hand.R') : boneMap.get('Hand.L');
      const armL_Shoulder = mirrorMode ? boneMap.get('Shoulder.R') : boneMap.get('Shoulder.L');

      const legR_Upper = mirrorMode ? boneMap.get('UpperLeg.L') : boneMap.get('UpperLeg.R');
      const legR_Lower = mirrorMode ? boneMap.get('LowerLeg.L') : boneMap.get('LowerLeg.R');
      const legR_Foot = mirrorMode ? boneMap.get('Foot.L') : boneMap.get('Foot.R');

      const legL_Upper = mirrorMode ? boneMap.get('UpperLeg.R') : boneMap.get('UpperLeg.L');
      const legL_Lower = mirrorMode ? boneMap.get('LowerLeg.R') : boneMap.get('LowerLeg.L');
      const legL_Foot = mirrorMode ? boneMap.get('Foot.R') : boneMap.get('Foot.L');

      let torsoFwdZ = 0.0;
      let torsoFwdNormal = new THREE.Vector3(0, 0, 1);
      let pelvisLateral = new THREE.Vector3(1, 0, 0);
      let shoulderLateral = new THREE.Vector3(1, 0, 0);

      // ======================================================================
      // 1. КОРНЕВАЯ ОРИЕНТАЦИЯ ТАЗА И ТОРСА (FORWARD KINEMATICS: HIPS & SPINE)
      // ======================================================================
      if (pLHp && pRHp && pLSh && pRSh) {
        const midHip = pLHp.clone().add(pRHp).multiplyScalar(0.5);
        const midSh = pLSh.clone().add(pRSh).multiplyScalar(0.5);
        const vSpine = midSh.clone().sub(midHip);
        if (mirrorMode) vSpine.x = -vSpine.x;

        torsoFwdZ = vSpine.z;

        if (bHips && bHips.restWorldQ) {
          const vHipsLat = pLHp.clone().sub(pRHp);
          if (mirrorMode) vHipsLat.x = -vHipsLat.x;

          if (vHipsLat.lengthSq() > 1e-4) {
            pelvisLateral.copy(vHipsLat).normalize();
            const rawHipYaw = Math.atan2(vHipsLat.z, vHipsLat.x);
            masterRetargeterRef.current.azimuthTracker.updateContinuousYaw(rawHipYaw);

            const trunkForwardPitch = Math.atan2(vSpine.z, Math.max(0.08, vSpine.y));
            const pelvicTilt = trunkForwardPitch * 0.35;
            const pelvicRoll = Math.atan2(vHipsLat.y, Math.hypot(vHipsLat.x, vHipsLat.z));

            const qRotContinuous = masterRetargeterRef.current.azimuthTracker.getRootOrientationQuaternion(
              -pelvicTilt,
              pelvicRoll
            );
            const targetWorldQHips = qRotContinuous.clone().multiply(bHips.restWorldQ);

            const parentWorldQHips = new THREE.Quaternion();
            if (bHips.parent) bHips.parent.getWorldQuaternion(parentWorldQHips);
            const targetLocalHips = parentWorldQHips.clone().invert().multiply(targetWorldQHips);
            bHips.quaternion.slerp(targetLocalHips, 0.78);
            bHips.updateMatrixWorld(true);
          }
        }

        // Фильтр вертикальной осанки
        const isUprightStance = vSpine.y > 0.45 && Math.abs(vSpine.z) < 0.08;
        if (isUprightStance) {
          vSpine.z *= 0.15;
          if (Math.abs(vSpine.z) < 0.02) vSpine.z = 0.0;
        }

        if (vSpine.lengthSq() > 1e-4) {
          const uy = vSpine.clone().normalize();
          let vLat = pLSh.clone().sub(pRSh);
          if (mirrorMode) vLat.x = -vLat.x;

          if (vLat.lengthSq() > 1e-4) {
            shoulderLateral.copy(vLat).normalize();
            vLat.normalize();
            const dotLat = vLat.dot(uy);
            const ux = vLat.clone().sub(uy.clone().multiplyScalar(dotLat)).normalize();

            if (ux.lengthSq() > 1e-4) {
              const uz = new THREE.Vector3().crossVectors(ux, uy).normalize();
              torsoFwdNormal.copy(uz);
              ux.crossVectors(uy, uz).normalize();

              const basisMat = new THREE.Matrix4().makeBasis(ux, uy, uz);
              const targetChestWorldQ = new THREE.Quaternion().setFromRotationMatrix(basisMat);

              const hipsWorldQ = new THREE.Quaternion();
              if (bHips) bHips.getWorldQuaternion(hipsWorldQ);

              if (bSpine) {
                const qSpineWorld = hipsWorldQ.clone().slerp(targetChestWorldQ, 0.35);
                const parentQ = new THREE.Quaternion();
                if (bSpine.parent) bSpine.parent.getWorldQuaternion(parentQ);
                const targetLocal = parentQ.clone().invert().multiply(qSpineWorld);
                bSpine.quaternion.slerp(targetLocal, 0.75);
                bSpine.updateMatrixWorld(true);
              }

              if (bSpine1) {
                const qSpine1World = hipsWorldQ.clone().slerp(targetChestWorldQ, 0.70);
                const parentQ = new THREE.Quaternion();
                if (bSpine1.parent) bSpine1.parent.getWorldQuaternion(parentQ);
                const targetLocal = parentQ.clone().invert().multiply(qSpine1World);
                bSpine1.quaternion.slerp(targetLocal, 0.75);
                bSpine1.updateMatrixWorld(true);
              }

              if (bChest) {
                const parentQ = new THREE.Quaternion();
                if (bChest.parent) bChest.parent.getWorldQuaternion(parentQ);
                const targetLocal = parentQ.clone().invert().multiply(targetChestWorldQ);
                bChest.quaternion.slerp(targetLocal, 0.78);
                bChest.updateMatrixWorld(true);
              }
            }
          }
        }
      }

      // ======================================================================
      // 2. ВЕРХНИЕ КОНЕЧНОСТИ (ПЛЕЧИ, РУКИ, КИСТИ И 30 ФАЛАНГ ПАЛЬЦЕВ)
      // ======================================================================
      let vArmR = null;
      let vForearmR = null;
      if (pRSh && pREl) {
        vArmR = pREl.clone().sub(pRSh);
        if (mirrorMode) vArmR.x = -vArmR.x;
        if (armR_Shoulder) alignShoulder(armR_Shoulder, vArmR, mirrorMode ? 'L' : 'R');

        if (pREl && pRWr) {
          vForearmR = pRWr.clone().sub(pREl);
          if (mirrorMode) vForearmR.x = -vForearmR.x;
          const uArm = vArmR.clone().normalize();
          const uFore = vForearmR.clone().normalize();
          if (uArm.dot(uFore) > 0.92) {
            vForearmR.lerp(uArm.clone().multiplyScalar(vForearmR.length()), 0.85);
          }
        }
        alignArm(armR_Upper, armR_Lower, vArmR, vForearmR, torsoFwdNormal, shoulderLateral, mirrorMode ? 'L' : 'R', 0.85);
      }

      let vArmL = null;
      let vForearmL = null;
      if (pLSh && pLEl) {
        vArmL = pLEl.clone().sub(pLSh);
        if (mirrorMode) vArmL.x = -vArmL.x;
        if (armL_Shoulder) alignShoulder(armL_Shoulder, vArmL, mirrorMode ? 'R' : 'L');

        if (pLEl && pLWr) {
          vForearmL = pLWr.clone().sub(pLEl);
          if (mirrorMode) vForearmL.x = -vForearmL.x;
          const uArm = vArmL.clone().normalize();
          const uFore = vForearmL.clone().normalize();
          if (uArm.dot(uFore) > 0.92) {
            vForearmL.lerp(uArm.clone().multiplyScalar(vForearmL.length()), 0.85);
          }
        }
        alignArm(armL_Upper, armL_Lower, vArmL, vForearmL, torsoFwdNormal, shoulderLateral, mirrorMode ? 'R' : 'L', 0.85);
      }

      const fingersBio = activePose.fingers || extractHandBiomechanics(ptsRaw);
      const fR = fingersBio?.right;
      const fL = fingersBio?.left;

      if (armR_Hand) {
        const activeHandF = mirrorMode ? fL : fR;
        if (activeHandF?.hand_direction && activeHandF?.palm_normal) {
          const targetFwd = new THREE.Vector3(...activeHandF.hand_direction);
          const targetNorm = new THREE.Vector3(...activeHandF.palm_normal);
          if (mirrorMode) {
            targetFwd.x = -targetFwd.x;
            targetNorm.x = -targetNorm.x;
          }
          alignHand(armR_Hand, targetFwd, targetNorm, mirrorMode ? 'L' : 'R', 0.75);
        } else if (pRIdx || pRPinky) {
          const pKnuckles = (pRIdx && pRPinky)
            ? pRIdx.clone().add(pRPinky).multiplyScalar(0.5)
            : (pRIdx || pRPinky);
          const vHand = pKnuckles.clone().sub(pRWr);
          if (mirrorMode) vHand.x = -vHand.x;
          alignBone(armR_Hand, vHand, 0.75);
        }
      }

      if (armL_Hand) {
        const activeHandF = mirrorMode ? fR : fL;
        if (activeHandF?.hand_direction && activeHandF?.palm_normal) {
          const targetFwd = new THREE.Vector3(...activeHandF.hand_direction);
          const targetNorm = new THREE.Vector3(...activeHandF.palm_normal);
          if (mirrorMode) {
            targetFwd.x = -targetFwd.x;
            targetNorm.x = -targetNorm.x;
          }
          alignHand(armL_Hand, targetFwd, targetNorm, mirrorMode ? 'R' : 'L', 0.75);
        } else if (pLIdx || pLPinky) {
          const pKnuckles = (pLIdx && pLPinky)
            ? pLIdx.clone().add(pLPinky).multiplyScalar(0.5)
            : (pLIdx || pLPinky);
          const vHand = pKnuckles.clone().sub(pLWr);
          if (mirrorMode) vHand.x = -vHand.x;
          alignBone(armL_Hand, vHand, 0.75);
        }
      }

      if (fR) applyHandRetargetingToArmature(boneMap, fR, mirrorMode ? 'L' : 'R', 0.82);
      if (fL) applyHandRetargetingToArmature(boneMap, fL, mirrorMode ? 'R' : 'L', 0.82);

      // ======================================================================
      // 3. НИЖНИЕ КОНЕЧНОСТИ (БЕДРА, ГОЛЕНИ, СТОПЫ И АНТИ-СКОЛЬЗЯЩИЙ ЯКОРЬ)
      // ======================================================================
      const groundLevel = -(nominalLegLenRef.current || 0.82);

      if (pRHp && pRKn) {
        const vThigh = pRKn.clone().sub(pRHp);
        if (mirrorMode) vThigh.x = -vThigh.x;

        let vShin = null;
        if (pRAn) {
          const pRAnGrounded = masterRetargeterRef.current?.footContactManager.processFoot('R', pRAn, null, groundLevel) || pRAn;
          vShin = pRAnGrounded.clone().sub(pRKn);
          if (mirrorMode) vShin.x = -vShin.x;
        }

        alignLeg(legR_Upper, legR_Lower, vThigh, vShin, torsoFwdNormal, pelvisLateral, mirrorMode ? 'L' : 'R', 0.85);

        if (pRToe && pRHeel && legR_Foot) {
          const vFoot = pRToe.clone().sub(pRHeel);
          if (mirrorMode) vFoot.x = -vFoot.x;
          alignFoot(legR_Foot, vFoot, legR_Lower, pelvisLateral, mirrorMode ? 'L' : 'R', 0.85);
        }
      }

      if (pLHp && pLKn) {
        const vThigh = pLKn.clone().sub(pLHp);
        if (mirrorMode) vThigh.x = -vThigh.x;

        let vShin = null;
        if (pLAn) {
          const pLAnGrounded = masterRetargeterRef.current?.footContactManager.processFoot('L', pLAn, null, groundLevel) || pLAn;
          vShin = pLAnGrounded.clone().sub(pLKn);
          if (mirrorMode) vShin.x = -vShin.x;
        }

        alignLeg(legL_Upper, legL_Lower, vThigh, vShin, torsoFwdNormal, pelvisLateral, mirrorMode ? 'R' : 'L', 0.85);

        if (pLToe && pLHeel && legL_Foot) {
          const vFoot = pLToe.clone().sub(pLHeel);
          if (mirrorMode) vFoot.x = -vFoot.x;
          alignFoot(legL_Foot, vFoot, legL_Lower, pelvisLateral, mirrorMode ? 'R' : 'L', 0.85);
        }
      }
      // ======================================================================
      // 4. ОРИЕНТАЦИЯ ГОЛОВЫ И ВЗГЛЯД МЭЦУКЭ
      // ======================================================================
      const bHead = boneMap.get('Head');
      const bNeck = boneMap.get('Neck');
      const headBio = activePose.head || estimateHeadOrientation(ptsRaw);
      if (bHead && bHead.restWorldQ && headBio) {
        const yaw = mirrorMode ? -headBio.yaw : headBio.yaw;
        const pitch = headBio.pitch;
        const roll = mirrorMode ? -headBio.roll : headBio.roll;

        if (bNeck && bNeck.restWorldQ) {
          const eulerNeck = new THREE.Euler(-pitch * 0.35, yaw * 0.35, roll * 0.30, 'YXZ');
          const qNeckDelta = new THREE.Quaternion().setFromEuler(eulerNeck);
          const targetWorldQNeck = qNeckDelta.multiply(bNeck.restWorldQ);
          const parentWorldQNeck = new THREE.Quaternion();
          if (bNeck.parent) bNeck.parent.getWorldQuaternion(parentWorldQNeck);
          const targetLocalQNeck = parentWorldQNeck.clone().invert().multiply(targetWorldQNeck);
          bNeck.quaternion.slerp(targetLocalQNeck, 0.70);
        }

        const eulerHead = new THREE.Euler(-pitch * 0.65, yaw * 0.65, roll * 0.50, 'YXZ');
        const qHeadDelta = new THREE.Quaternion().setFromEuler(eulerHead);
        const targetWorldQHead = qHeadDelta.multiply(bHead.restWorldQ);
        const parentWorldQHead = new THREE.Quaternion();
        if (bHead.parent) bHead.parent.getWorldQuaternion(parentWorldQHead);
        const targetLocalQHead = parentWorldQHead.clone().invert().multiply(targetWorldQHead);
        bHead.quaternion.slerp(targetLocalQHead, 0.75);
      }

      // ======================================================================
      // 5. ФИЗИЧЕСКОЕ ЗАЗЕМЛЕНИЕ ПОДОШВ НА ТАТАМИ И СМЕЩЕНИЕ КОРНЯ (2-BONE IK)
      // ======================================================================
      const hasAnkle = pLAn || pRAn;
      if (hasAnkle && pLHp && pRHp) {
        const hipY = (pLHp.y + pRHp.y) * 0.5;
        const dropL = pLAn ? (hipY - pLAn.y) : 0.0;
        const dropR = pRAn ? (hipY - pRAn.y) : 0.0;
        const maxSupportDrop = Math.max(dropL, dropR);

        if (maxSupportDrop > 0.65 && maxSupportDrop < 1.15) {
          if (maxSupportDrop > nominalLegLenRef.current) {
            nominalLegLenRef.current = nominalLegLenRef.current * 0.90 + maxSupportDrop * 0.10;
          }
        }

        // Поддержка стоек Zenkutsu, Kokutsu, Kiba и ударов ногами (Mae-Geri)
        let stanceDrop = maxSupportDrop;
        const isKick = (dropL > 0 && dropL < 0.35) || (dropR > 0 && dropR < 0.35);
        if (dropL > 0.35 && dropR > 0.35) {
          const minDrop = Math.min(dropL, dropR);
          const maxDrop = Math.max(dropL, dropR);
          if (maxDrop - minDrop > 0.10) {
            // Асимметричная стойка (Zenkutsu-dachi / Kokutsu-dachi): таз опускается по опорной ноге
            stanceDrop = minDrop * 0.70 + maxDrop * 0.30;
          } else {
            // Симметричная стойка (Kiba-dachi / Shizentai)
            stanceDrop = (dropL + dropR) * 0.5;
          }
        } else if (isKick) {
          // При ударе ногой таз удерживается на высоте опорной ноги
          stanceDrop = dropL < 0.35 ? dropR : dropL;
        }

        let targetRootY = 0.0;
        if (stanceDrop > 0.25) {
          const legCompression = stanceDrop - nominalLegLenRef.current;
          if (legCompression < -0.02) {
            targetRootY = Math.max(-0.65, legCompression + 0.02);
          }
        }

        const fwdBendShift = Math.max(0, torsoFwdZ) * 0.22;
        const targetRootZ = targetRootY * 0.25 - fwdBendShift;

        smoothRootYRef.current = smoothRootYRef.current * 0.75 + targetRootY * 0.25;
        smoothRootZRef.current = smoothRootZRef.current * 0.75 + targetRootZ * 0.25;

        if (bHips && bHips.restPosition) {
          const rootX = activePose.rootPosition ? (mirrorMode ? -activePose.rootPosition[0] : activePose.rootPosition[0]) : 0;
          const rootZ = activePose.rootPosition ? activePose.rootPosition[2] : 0;
          bHips.position.x = bHips.restPosition.x + rootX;
          bHips.position.y = bHips.restPosition.y + smoothRootYRef.current;
          bHips.position.z = bHips.restPosition.z + rootZ + smoothRootZRef.current;
          bHips.updateMatrixWorld(true);

          // Active Tatami Floor Grounding & Stance Maintenance:
          // Ensures the avatar actively strives to STAND on the floor at all times:
          // supporting foot (lowest foot) is firmly pinned to the tatami (ankle at TARGET_ANKLE_Y = 0.080)
          const TARGET_ANKLE_Y = 0.080;
          let lowestFootY = Infinity;
          const tmpP = new THREE.Vector3();
          for (const fb of [legR_Foot, legL_Foot]) {
            if (fb) {
              fb.getWorldPosition(tmpP);
              if (tmpP.y < lowestFootY) lowestFootY = tmpP.y;
            }
          }
          if (lowestFootY < 2.0 && lowestFootY > -2.0) {
            bHips.position.y += (TARGET_ANKLE_Y - lowestFootY);
            bHips.updateMatrixWorld(true);
          }
        }

        // Аналитический 2-Bone IK доводчик для заземления стоп на татами
        if (legR_Upper && legR_Lower && legR_Foot && pRAn) {
          const worldTargetR = new THREE.Vector3();
          legR_Foot.getWorldPosition(worldTargetR);
          if (dropR > 0.40) worldTargetR.y = Math.max(0.038, worldTargetR.y);
          const hipPosR = new THREE.Vector3();
          legR_Upper.getWorldPosition(hipPosR);
          const polePosR = hipPosR.clone().add(new THREE.Vector3(0.15, -0.3, 0.4));
          solveTwoBoneIK(legR_Upper, legR_Lower, legR_Foot, worldTargetR, polePosR, 0.85);
        }

        if (legL_Upper && legL_Lower && legL_Foot && pLAn) {
          const worldTargetL = new THREE.Vector3();
          legL_Foot.getWorldPosition(worldTargetL);
          if (dropL > 0.40) worldTargetL.y = Math.max(0.038, worldTargetL.y);
          const hipPosL = new THREE.Vector3();
          legL_Upper.getWorldPosition(hipPosL);
          const polePosL = hipPosL.clone().add(new THREE.Vector3(-0.15, -0.3, 0.4));
          solveTwoBoneIK(legL_Upper, legL_Lower, legL_Foot, worldTargetL, polePosL, 0.85);
        }
      }
    } catch (err) {
      console.warn('Avatar retargeting frame error:', err);
    }
  } else if (boneRotations) {
      // Фолбэк на подготовленный объект boneRotations
      boneMap.forEach((bone, name) => {
        const restQ = bone.restLocalQ;
        if (!restQ) return;

        if (boneRotations[name]) {
          const rot = boneRotations[name];
          if (rot.quaternion || Array.isArray(rot)) {
            const arr = rot.quaternion || rot;
            const q = new THREE.Quaternion(arr[0], arr[1], arr[2], arr[3]);
            bone.quaternion.slerp(q, lerpFactor);
          } else {
            const euler = new THREE.Euler(rot.x || 0, rot.y || 0, rot.z || 0, 'XYZ');
            const targetQ = restQ.clone().multiply(new THREE.Quaternion().setFromEuler(euler));
            bone.quaternion.slerp(targetQ, lerpFactor);
          }

          if (name === 'Hips' && bone.restPosition) {
            const yOff = Math.max(-0.40, Math.min(0.05, rot.yOffset || 0));
            bone.position.y = THREE.MathUtils.lerp(bone.position.y, bone.restPosition.y + yOff, lerpFactor);
          }
        } else {
          bone.quaternion.slerp(restQ, lerpFactor * 0.5);
        }
      });
    } else {
      // Плавный возврат в базовую стойку ожидания (Rest Pose)
      boneMap.forEach((bone) => {
        if (bone.restLocalQ) bone.quaternion.slerp(bone.restLocalQ, lerpFactor * 0.4);
        if (bone.name === 'Hips' && bone.restPosition) {
          bone.position.y = THREE.MathUtils.lerp(bone.position.y, bone.restPosition.y, lerpFactor * 0.4);
        }
      });
    }
  });

  return (
    <group
      ref={groupRef}
      position={[position[0], position[1] + modelYOffset, position[2]]}
      rotation={rotation}
      scale={[scale * modelScale, scale * modelScale, scale * modelScale]}
    >
      <primitive object={clonedModel} />
    </group>
  );
}

// Оптимизация: загрузка модели по требованию при монтировании
