import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { solveTwoBoneIK, getContactIKWeight } from './ikSolver';
import { animationRegistry } from './animationRegistry';

/**
 * Аутентичный 3D-аватар каратиста Шотокан для многопользовательских симуляций Бункая.
 * Поддерживает роли:
 * - 'tori'  (белое доги Arawaza, черный пояс 5 Дан)
 * - 'uke' / 'uke1' (традиционное индиго доги)
 * - 'uke2' (графитовое доги для флангового нападающего)
 *
 * Интегрирован с аналитическим 2-Bone IK для точной доводки рук при изменении боевой дистанции.
 */

// Глобальный кэш распарсенных AnimationClip
const globalClipCache = new Map();
let globalClipPromise = null;

const CLIP_FILES = {
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
  mae_geri_gyaku_zuki: '/anims/mae_geri_gyaku_zuki.json',
  age_uke_gyaku_zuki: '/anims/age_uke_gyaku_zuki.json',
  gankaku_shuto: '/anims/gankaku_shuto.json',
  stance_ready: '/anims/stance_ready.json',
  stance_zenkutsu: '/anims/stance_zenkutsu.json',
  stance_kokutsu: '/anims/stance_kokutsu.json',
  stance_kiba: '/anims/stance_kiba.json',
  stance_fudo: '/anims/stance_fudo.json',
  stance_gankaku: '/anims/stance_gankaku.json',
  heian_shodan: '/anims/heian_shodan.json',
};

const ACTION_ALIASES = {
  choku_zuki: 'chudan_zuki_right',
  oi_zuki: 'oi_zuki_right',
  gyaku_zuki: 'gyaku_zuki_right',
  jodan_zuki: 'jodan_zuki_right',
  chudan_zuki: 'chudan_zuki_right',
  gedan_barai: 'gedan_barai_left',
  age_uke: 'age_uke_left',
  mae_geri: 'mae_geri_right',
  step: 'step_forward',
  ready: 'idle_shizentai',
  shizentai: 'idle_shizentai',
  zenkutsu: 'zenkutsu_dachi_left',
  kokutsu: 'kokutsu_dachi_left',
  heiko: 'heiko_dachi',
  fudo: 'fudo_dachi',
};

function filterClipToScene(clip, sceneNames) {
  const validTracks = clip.tracks.filter((track) => {
    try {
      const parsed = THREE.PropertyBinding.parseTrackName(track.name);
      const nodeName = parsed.nodeName ?? '';
      return nodeName === '' || sceneNames.has(nodeName);
    } catch {
      return false;
    }
  });
  return new THREE.AnimationClip(clip.name, clip.duration, validTracks);
}

async function ensureClipsCached() {
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
          // ignore
        }
      })
    );
    return globalClipCache;
  })();
  return globalClipPromise;
}

export default function MultiAvatarModel({
  role = 'tori',
  clipName = null,
  stance = 'ready',
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  speed = 1.0,
  isPlaying = true,
  scrubProgress = null, // 0.0 .. 1.0 для покадровой синхронизации фаз
  ikTarget = null,     // THREE.Vector3 мировой таргет контакта (например кулак в торс/блок)
  ikContactTime = 0.45,
  interactionType = 'non_contact',
  onMissingClip = null,
  onTrackBones = null, // callback с позициями костей груди и рук для соседних бойцов
}) {
  const groupRef = useRef();
  const bonesRef = useRef({});

  const { scene, animations } = useGLTF('/models/karateka_lowpoly.glb');

  // Клонируем SkinnedMesh через SkeletonUtils
  const { clonedModel, modelScale, modelYOffset, sceneNames } = useMemo(() => {
    const clone = SkeletonUtils.clone(scene);
    const bbox = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    bbox.getSize(size);

    const s = size.y > 0 ? 1.78 / size.y : 1.0;
    const yOffset = -bbox.min.y * s;

    let giColor = '#faf9f6';
    let beltColor = '#141414';

    if (role === 'uke' || role === 'uke1') {
      giColor = '#243346';
      beltColor = '#181818';
    } else if (role === 'uke2') {
      giColor = '#342b2b';
      beltColor = '#3a1212';
    }

    clone.traverse((child) => {
      if (child.isMesh && child.material) {
        child.frustumCulled = false;
        child.castShadow = true;
        child.receiveShadow = true;
        const matName = child.material.name || '';
        const meshName = child.name || '';
        const newMat = child.material.clone();
        newMat.side = THREE.DoubleSide;
        newMat.shadowSide = THREE.DoubleSide;

        if (matName.includes('Skin') || meshName.includes('Mesh')) {
          newMat.color = new THREE.Color(0xffffff);
          newMat.roughness = 0.65;
          newMat.metalness = 0.02;
        } else if (matName.includes('Belt') || meshName.includes('Belt')) {
          newMat.color = new THREE.Color(beltColor);
          newMat.roughness = 0.75;
          newMat.metalness = 0.05;
        } else if (matName.includes('Gi') || meshName.includes('Jacket') || meshName.includes('Pants')) {
          newMat.color = new THREE.Color(giColor);
          newMat.roughness = 0.85;
          newMat.metalness = 0.02;
        }
        child.material = newMat;
      }
    });

    const sceneNamesSet = new Set();
    clone.traverse((o) => {
      if (o.name) sceneNamesSet.add(o.name);
    });

    return { clonedModel: clone, modelScale: s, modelYOffset: yOffset, sceneNames: sceneNamesSet };
  }, [scene, role]);

  // Кэшируем ссылки на важные кости для IK и трекинга коллизий
  useEffect(() => {
    const b = {};
    clonedModel.traverse((obj) => {
      if (obj.isBone) {
        b[obj.name] = obj;
      }
    });
    bonesRef.current = b;
  }, [clonedModel]);

  // AnimationMixer
  const mixer = useMemo(() => new THREE.AnimationMixer(clonedModel), [clonedModel]);
  const activeActionRef = useRef(null);

  // Инициализация пула анимаций
  useEffect(() => {
    if (animations && animations.length > 0) {
      animations.forEach((c) => globalClipCache.set(c.name, c));
      Object.entries(ACTION_ALIASES).forEach(([k, v]) => {
        if (globalClipCache.has(v)) globalClipCache.set(k, globalClipCache.get(v));
      });
    }
    ensureClipsCached();
    animationRegistry.init();
  }, [animations]);

  // Определение актуального клипа для воспроизведения
  const effectiveClipName = useMemo(() => {
    if (clipName) return clipName;
    if (stance) {
      if (ACTION_ALIASES[stance]) return ACTION_ALIASES[stance];
      return stance;
    }
    return 'idle_shizentai';
  }, [clipName, stance]);

  // Запуск клипа
  useEffect(() => {
    if (!mixer) return;

    let targetClip = globalClipCache.get(effectiveClipName);
    if (!targetClip && ACTION_ALIASES[effectiveClipName]) {
      targetClip = globalClipCache.get(ACTION_ALIASES[effectiveClipName]);
    }

    if (!targetClip) {
      // ЗАПРЕЩЕНА скрытая замена на idle: фиксируем отсутствие в реестре и оповещаем плеер
      animationRegistry.reportMissing(effectiveClipName, {
        role,
        context: `MultiAvatarModel runtime player for role ${role}`,
      });
      if (onMissingClip) onMissingClip(effectiveClipName);
      return;
    }

    const filtered = filterClipToScene(targetClip, sceneNames);
    if (!filtered || filtered.tracks.length === 0) return;

    const action = mixer.clipAction(filtered);
    action.reset();
    action.timeScale = speed;

    if (scrubProgress !== null) {
      // Режим ручного скраббера: фиксируем время
      action.paused = true;
      action.time = scrubProgress * filtered.duration;
      action.play();
    } else {
      action.paused = !isPlaying;
      action.setLoop(THREE.LoopRepeat);
      if (activeActionRef.current && activeActionRef.current !== action) {
        action.crossFadeFrom(activeActionRef.current, 0.25, true);
      }
      action.play();
    }

    activeActionRef.current = action;
  }, [effectiveClipName, mixer, sceneNames, speed, isPlaying, scrubProgress, role, onMissingClip]);

  // Обновление состояния в кадре и применение 2-Bone IK
  useFrame((_, delta) => {
    if (mixer) {
      if (scrubProgress === null && isPlaying) {
        mixer.update(delta);
      } else if (activeActionRef.current && scrubProgress !== null) {
        activeActionRef.current.time = scrubProgress * activeActionRef.current.getClip().duration;
        mixer.update(0);
      }
    }

    // Применение аналитического 2-Bone IK в контактном окне боевого действия
    if (interactionType === 'local_contact' && ikTarget && activeActionRef.current) {
      const b = bonesRef.current;
      const rootArm = b['mixamorigRightArm'] || b['mixamorigLeftArm'];
      const foreArm = b['mixamorigRightForeArm'] || b['mixamorigLeftForeArm'];
      const hand = b['mixamorigRightHand'] || b['mixamorigLeftHand'];

      if (rootArm && foreArm && hand) {
        const curTime = activeActionRef.current.time;
        const ikWeight = getContactIKWeight(curTime, ikContactTime, 0.20);

        if (ikWeight > 0.01) {
          // Вектор сгиба локтя наружу и немного вниз
          const polePos = new THREE.Vector3();
          rootArm.getWorldPosition(polePos);
          polePos.x += (role === 'tori' ? 0.35 : -0.35);
          polePos.y -= 0.15;

          solveTwoBoneIK(rootArm, foreArm, hand, ikTarget, polePos, ikWeight);
        }
      }
    }

    // Экспорт позиций суставов для коллизий и таргетинга соседей
    if (onTrackBones && bonesRef.current) {
      const chest = bonesRef.current['mixamorigSpine2'] || bonesRef.current['mixamorigHips'];
      const hand = bonesRef.current['mixamorigRightHand'];
      if (chest) {
        const chestPos = new THREE.Vector3();
        chest.getWorldPosition(chestPos);
        const handPos = new THREE.Vector3();
        if (hand) hand.getWorldPosition(handPos);
        onTrackBones(role, { chest: chestPos, hand: handPos });
      }
    }
  });

  return (
    <group
      ref={groupRef}
      position={[position[0], position[1] + modelYOffset, position[2]]}
      rotation={rotation}
      scale={[modelScale, modelScale, modelScale]}
    >
      <primitive object={clonedModel} />
    </group>
  );
}

useGLTF.preload('/models/karateka_lowpoly.glb');
