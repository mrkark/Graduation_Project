import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { useFBX } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

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

  // Защитные блоки и удары ногами
  age_uke: '/anims/age_uke.json',
  soto_uke: '/anims/soto_uke.json',
  uchi_uke: '/anims/uchi_uke.json',
  gedan_barai: '/anims/gedan_barai.json',
  shuto_uke: '/anims/shuto_uke.json',
  mae_geri: '/anims/mae_geri.json',
  yoko_geri: '/anims/yoko_geri.json',
  mawashi_geri: '/anims/mawashi_geri.json',
  kick: '/anims/kick.json',
  ushiro_geri: '/anims/ushiro_geri.json',
  step: '/anims/step.json',

  // Канонические стойки с живым дыханием
  stance_ready: '/anims/stance_ready.json',
  stance_zenkutsu: '/anims/stance_zenkutsu.json',
  stance_kokutsu: '/anims/stance_kokutsu.json',
  stance_kiba: '/anims/stance_kiba.json',
  stance_fudo: '/anims/stance_fudo.json',
  stance_gankaku: '/anims/stance_gankaku.json',
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
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}) {
  const groupRef = useRef();

  // Загружаем 3D FBX персонажа и текстуру sensei-orig.png (Arawaza длинные рукава до запястья, чистый черный пояс без артефактов, кимоно без нашивок, цвет кожи на груди)
  const fbx = useFBX('/models/sensei.fbx');
  const texture = useLoader(THREE.TextureLoader, '/models/sensei-orig.png?v=arawaza5');

  useMemo(() => {
    if (texture) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = true;
      texture.needsUpdate = true;
    }
  }, [texture]);

  // Клонируем персонажа со скелетом
  const { clonedModel, scale } = useMemo(() => {
    const clone = SkeletonUtils.clone(fbx);

    // Точная калибровка роста до 1.78 м (взрослый мастер каратэ)
    const bbox = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const s = size.y > 0 ? 1.78 / size.y : 0.0182;
    clone.scale.setScalar(s);

    // Подошвы стоп строго на татами Y = 0.00
    clone.position.y = -bbox.min.y * s;

    // Материал хлопкового кимоно (доги) с черным поясом и чистым доги без эмблем
    const giColor = role === 'uke' ? '#dcdde2' : '#ffffff';
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.geometry) {
          if (!child.geometry.userData.sleevesWidened) {
            child.geometry = child.geometry.clone();
            widenKimonoSleeves(child.geometry, child.skeleton);
            slimKimonoSleeves(child.geometry, child.skeleton);
            computeSmoothNormals(child.geometry);
            child.geometry.userData.sleevesWidened = true;
          }
        }
        child.material = new THREE.MeshStandardMaterial({
          map: texture,
          color: new THREE.Color(giColor),
          roughness: 0.85,
          metalness: 0.0,
          side: THREE.DoubleSide,
        });
      }
    });

    return { clonedModel: clone, scale: s };
  }, [fbx, texture, role]);

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
          // Для Choku Zuki сохраняем конечное положение (правая в хикитэ, левая впереди) зафиксированным
          if (activeClip === 'choku_zuki') {
            return;
          }
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
      mixerRef.current.update(safeDelta);
    }
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      <primitive object={clonedModel} />
    </group>
  );
}

useFBX.preload('/models/sensei.fbx');
