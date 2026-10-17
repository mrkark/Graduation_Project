import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { solveTwoBoneIK, getContactIKWeight } from './ikSolver';
import { animationRegistry } from './animationRegistry';
import { resolveBunkaiClip } from './bunkaiScenarioEngine';

/**
 * Аутентичный 3D-аватар каратиста Шотокан для многопользовательских симуляций Бункая.
 * Поддерживает роли:
 * - 'tori'  (белое доги Arawaza, черный пояс 5 Дан)
 * - 'uke' / 'uke1' (традиционное индиго доги)
 * - 'uke2' (графитовое доги для флангового нападающего)
 *
 * Интегрирован с:
 * - Единой библиотекой техник каратэ Шотокан v4 (/models/karateka_techniques_v4.glb, 213 клипов).
 * - Аналитическим 2-Bone IK для точной доводки рук при изменении боевой дистанции.
 * - Синхронизацией времени мастер-шкалы (timelineTime) и задержкой старта (delaySeconds).
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
  scrubProgress = null, // 0.0 .. 1.0 для покадровой синхронизации
  timelineTime = null,  // текущее время мастер-шкалы в секундах
  delaySeconds = 0,     // задержка вступления участника в бой
  waitingClip = null,   // клип стойки во время ожидания
  ikTarget = null,      // THREE.Vector3 мировой таргет контакта
  ikContactTime = 0.45,
  interactionType = 'non_contact',
  onMissingClip = null,
  onTrackBones = null,  // callback с позициями костей для таргетинга соседей
}) {
  const groupRef = useRef();
  const bonesRef = useRef({});

  // Загружаем единую библиотеку техник каратэ Шотокан v4 (213 клипов)
  const { scene, animations } = useGLTF('/models/karateka_techniques_v4.glb');

  // Клонируем SkinnedMesh через SkeletonUtils для независимых мешей участников
  const { clonedModel, modelScale, modelYOffset, sceneNames } = useMemo(() => {
    const clone = SkeletonUtils.clone(scene);
    const bbox = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    bbox.getSize(size);

    const s = size.y > 0 ? 1.78 / size.y : 1.0;
    const yOffset = -bbox.min.y * s;

    let giColor = '#faf9f6'; // Белоснежное доги мастера Тори
    let beltColor = '#141414'; // Черный пояс 5-й Дан

    if (role === 'uke' || role === 'uke1') {
      giColor = '#243346'; // Традиционное индиго доги главного нападающего
      beltColor = '#181818';
    } else if (role === 'uke2') {
      giColor = '#342b2b'; // Графитовое доги флангового нападающего
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

  // Кэшируем ссылки на кости для IK и трекинга коллизий
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

  // Инициализация пула 213 анимаций
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

  // Определение актуального клипа для воспроизведения (с учетом ожидания delaySeconds)
  const isWaiting = timelineTime !== null && timelineTime < delaySeconds;

  const effectiveClipName = useMemo(() => {
    if (isWaiting) {
      if (waitingClip) return waitingClip;
      if (stance === 'kokutsu') return 'kokutsu_dachi_left';
      if (stance === 'zenkutsu') return 'zenkutsu_dachi_left';
      if (stance === 'kiba') return 'kiba_dachi';
      return 'idle_shizentai';
    }

    if (clipName) {
      const resolved = resolveBunkaiClip(clipName);
      if (resolved && resolved.clipName) return resolved.clipName;
      return clipName;
    }
    if (stance) {
      if (ACTION_ALIASES[stance]) return ACTION_ALIASES[stance];
      return stance;
    }
    return 'idle_shizentai';
  }, [isWaiting, waitingClip, clipName, stance]);

  // Поиск AnimationClip в кэше с проверкой всех алиасов
  const targetClip = useMemo(() => {
    if (globalClipCache.has(effectiveClipName)) return globalClipCache.get(effectiveClipName);
    if (ACTION_ALIASES[effectiveClipName] && globalClipCache.has(ACTION_ALIASES[effectiveClipName])) {
      return globalClipCache.get(ACTION_ALIASES[effectiveClipName]);
    }
    const resolved = resolveBunkaiClip(effectiveClipName);
    if (resolved && globalClipCache.has(resolved.clipName)) {
      return globalClipCache.get(resolved.clipName);
    }
    return null;
  }, [effectiveClipName]);

  // Запуск клипа
  useEffect(() => {
    if (!mixer) return;

    if (!targetClip) {
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

    if (scrubProgress !== null || timelineTime !== null) {
      // Режим ручного скраббера или мастер-шкалы: время управляется вручную
      action.paused = true;
      if (scrubProgress !== null) {
        action.time = scrubProgress * filtered.duration;
      } else if (timelineTime !== null) {
        const localTime = Math.max(0, timelineTime - delaySeconds);
        action.time = Math.min(filtered.duration, localTime);
      }
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
  }, [targetClip, effectiveClipName, mixer, sceneNames, speed, isPlaying, scrubProgress, timelineTime, delaySeconds, role, onMissingClip]);

  // Обновление состояния в кадре и применение 2-Bone IK
  useFrame((_, delta) => {
    if (mixer && activeActionRef.current) {
      if (scrubProgress !== null) {
        activeActionRef.current.time = scrubProgress * activeActionRef.current.getClip().duration;
        mixer.update(0);
      } else if (timelineTime !== null) {
        const localTime = Math.max(0, timelineTime - delaySeconds);
        const dur = activeActionRef.current.getClip().duration;
        activeActionRef.current.time = Math.min(dur, localTime);
        mixer.update(0);
      } else if (isPlaying) {
        mixer.update(delta);
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
        const ikWeight = getContactIKWeight(curTime, ikContactTime, 0.22);

        if (ikWeight > 0.01) {
          // Вектор сгиба локтя наружу
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
      const hand = bonesRef.current['mixamorigRightHand'] || bonesRef.current['mixamorigLeftHand'];
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

useGLTF.preload('/models/karateka_techniques_v4.glb');
