import React, { useMemo, useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { HEIAN_SHODAN_CANONICAL_EVENTS } from './kataMotionUtils';
import { animationRegistry } from './animationRegistry';
import { resolveBunkaiClip, isTechniqueStationary } from './bunkaiScenarioEngine';
import { findRigBone, extractAvatarJointPositions, applyProceduralCombatIK } from './bodyColliderSystem';
import {
  patchAgeUkeClip,
  makeClipInPlace,
  mirrorClipLeftRight,
  trimClipRange,
  synthesizeModularClip,
  synthesizeStanceTransitionClip,
  adaptKickClipToStance,
  synthesizeJodanOiZukiClip,
  synthesizeHoldExtendedPunchClip,
  synthesizeReiBowClip,
} from './modularAnimationEngine.js';

/**
 * Аутентичный 3D-аватар каратиста Шотокан для многопользовательских симуляций Бункая.
 * 
 * Особенности:
 * 1. Роли:
 *    - 'tori'  (белое доги Arawaza, черный пояс 5 Дан)
 *    - 'uke' / 'uke1' (традиционное индиго доги главного нападающего)
 *    - 'uke2' (графитовое доги для флангового соперника)
 * 2. Полная интеграция с анатомической системой коллайдеров и предотвращения геометрического
 *    взаимопроникновения (BodyColliderSystem).
 * 3. Поддержка специальных стоек и положений:
 *    - Падение со страховкой (Укэми) на татами (Шаг 13: скрестно правая нога поверх левой, левая рука хлопает по татами).
 *    - Фиксация на полу и бдительный контроль Дзансин (Шаг 14).
 *    - Плавный контролируемый подъем с татами в Дзэнкуцу-дати (Шаг 15).
 *    - Стойка Сико-дати с добиванием Отоши-дзуки сверху-вниз.
 * 4. Аналитический 2-Bone IK с ограничением проникновения кулака/стопы в корпус партнера.
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
  strike_above_elbow: '/anims/strike_above_elbow.json',
  stance_ready: '/anims/stance_ready.json',
  stance_zenkutsu: '/anims/stance_zenkutsu.json',
  stance_kokutsu: '/anims/stance_kokutsu.json',
  stance_kiba: '/anims/stance_kiba.json',
  stance_fudo: '/anims/stance_fudo.json',
  stance_gankaku: '/anims/stance_gankaku.json',
  heian_shodan: '/anims/heian_shodan.json',
};

const ACTION_ALIASES = {
  heiko_dachi: 'heiko_dachi',
  stance_ready: 'heiko_dachi',
  shizentai: 'idle_shizentai',
  idle_shizentai: 'idle_shizentai',
  ready: 'heiko_dachi',
  heiko: 'heiko_dachi',
  zenkutsu_dachi_left: 'zenkutsu_dachi_left',
  zenkutsu_dachi_right: 'zenkutsu_dachi_right',
  zenkutsu: 'zenkutsu_dachi_left',
  kokutsu_dachi_left: 'kokutsu_dachi_left',
  kokutsu_dachi_right: 'kokutsu_dachi_right',
  kokutsu: 'kokutsu_dachi_left',
  kiba_dachi: 'kiba_dachi',
  kiba: 'kiba_dachi',
  stance_shiko: 'stance_shiko',
  shiko: 'stance_shiko',
  fudo_dachi: 'fudo_dachi',
  fudo_dachi_left: 'fudo_dachi',
  fudo_dachi_right: 'fudo_dachi_right',
  fudo: 'fudo_dachi',
  stance_neko_left: 'stance_neko_left',
  stance_neko_right: 'stance_neko_right',
  neko_left: 'stance_neko_left',
  neko_right: 'stance_neko_right',
  stance_moto_left: 'stance_moto_left',
  stance_moto_right: 'stance_moto_right',
  moto_left: 'stance_moto_left',
  moto_right: 'stance_moto_right',
  stance_sanchin_left: 'stance_sanchin_left',
  stance_sanchin_right: 'stance_sanchin_right',
  stance_hangetsu_left: 'stance_hangetsu_left',
  stance_hangetsu_right: 'stance_hangetsu_right',
  stance_kosa_left: 'stance_kosa_left',
  stance_kosa_right: 'stance_kosa_right',
  stance_musubi: 'stance_musubi',
  musubi: 'stance_musubi',
  rei_bow: 'rei_bow',
  bow_rei: 'rei_bow',
  rei: 'rei_bow',
  stance_heisoku: 'stance_heisoku',
  heisoku: 'stance_heisoku',

  // Аутентичные техники ударов и блоков каратэ Шотокан (чистые клипы без искажений скелета)
  oi_zuki: 'oi_zuki_right',
  oi_zuki_right: 'oi_zuki_right',
  oi_zuki_left: 'oi_zuki_left',
  oi_zuki_jodan: 'oi_zuki_jodan_right',
  oi_zuki_jodan_right: 'oi_zuki_jodan_right',
  oi_zuki_jodan_left: 'oi_zuki_jodan_left',
  jodan_oi_zuki_right: 'oi_zuki_jodan_right',
  jodan_oi_zuki_left: 'oi_zuki_jodan_left',
  tech_oi_zuki_jodan_right: 'oi_zuki_jodan_right',
  tech_oi_zuki_jodan_left: 'oi_zuki_jodan_left',
  tech_oi_zuki: 'oi_zuki_right',
  tech_oi_zuki_right: 'oi_zuki_right',
  tech_oi_zuki_left: 'oi_zuki_left',
  gyaku_zuki: 'gyaku_zuki_left',
  gyaku_zuki_right: 'gyaku_zuki_right',
  gyaku_zuki_left: 'gyaku_zuki_left',
  tech_gyaku_zuki: 'gyaku_zuki_left',
  tech_gyaku_zuki_right: 'gyaku_zuki_right',
  tech_gyaku_zuki_left: 'gyaku_zuki_left',
  kizami_zuki: 'jodan_zuki_left',
  jodan_zuki: 'jodan_zuki_left',
  ren_zuki: 'gyaku_zuki_left',
  mae_geri: 'mae_geri_right',
  mae_geri_right: 'mae_geri_right',
  mae_geri_left: 'mae_geri_left',
  kick_mae_geri: 'mae_geri_right',
  kick_mae_geri_right: 'mae_geri_right',
  kick_mae_geri_left: 'mae_geri_left',
  gedan_barai: 'gedan_barai_left',
  gedan_barai_left: 'gedan_barai_left',
  gedan_barai_right: 'gedan_barai_right',
  tech_gedan_barai: 'gedan_barai_left',
  tech_gedan_barai_left: 'gedan_barai_left',
  tech_gedan_barai_right: 'gedan_barai_right',
  age_uke: 'age_uke_right',
  age_uke_right: 'age_uke_right',
  age_uke_left: 'age_uke_left',
  tech_age_uke: 'age_uke_right',
  tech_age_uke_right: 'age_uke_right',
  tech_age_uke_left: 'age_uke_left',
  gyaku_age_uke: 'tech_age_uke_right',
  gyaku_age_uke_right: 'tech_age_uke_right',
  gyaku_age_uke_left: 'tech_age_uke_left',
  haivan_uke: 'tech_haishu_uke_right',
  haivan_uke_right: 'tech_haishu_uke_right',
  haivan_uke_left: 'tech_haishu_uke_left',
  tech_haivan_uke: 'tech_haishu_uke_right',
  nagashi_uke: 'tech_uchi_uke_right',
  ashi_barai: 'kick_nami_gaeshi_left',
  deashi_harai: 'kick_nami_gaeshi_left',
  otoshi_zuki: 'tech_tate_zuki_left',
  shuto_uke: 'tech_shuto_uke_left',
  shuto_uke_left: 'tech_shuto_uke_left',
  shuto_uke_right: 'tech_shuto_uke_right',
  tech_shuto_uke: 'tech_shuto_uke_left',
  shuto_uchi: 'tech_shuto_uchi_right',
  shuto_uchi_right: 'tech_shuto_uchi_right',
  shuto_uchi_left: 'tech_shuto_uchi_left',
  tech_shuto_uchi: 'tech_shuto_uchi_right',
  tetsui_uchi: 'tech_tettsui_right',
  tech_tettsui: 'tech_tettsui_right',
  empi_uchi: 'tech_tate_zuki_left',
  strike_above_elbow: 'strike_above_elbow',
  tech_strike_above_elbow: 'strike_above_elbow',
  arm_strike: 'strike_above_elbow',
  step_backward_right: 'step_backward_right',
  turn_into_zenkutsu_right: 'turn_into_zenkutsu_right',
  turn_and_enter_zenkutsu: 'turn_and_enter_zenkutsu',
  strike_throat_left: 'tech_shuto_uchi_left',
  step_turn_shiko: 'stance_shiko',
  otoshi_zuki_ground: 'tech_tate_zuki_left',
  standup_to_zenkutsu: 'zenkutsu_dachi_right',
  rise_zenkutsu: 'zenkutsu_dachi_right',
  ippon_seoi_nage: 'turn_and_enter_zenkutsu',
  wrist_lock: 'tech_age_uke_right',
  collar_grab: 'tech_age_uke_right',
  bunkai_shuto_counter_tori: 'tech_oi_zuki_right',
  bunkai_shuto_counter_uke: 'tech_shuto_uke_left',
  bunkai_age_empi_tori: 'tech_oi_zuki_right',
  bunkai_age_empi_uke: 'tech_age_uke_left',
  bunkai_kuzushi_sweep_tori: 'kick_mae_geri_right',
  bunkai_kuzushi_sweep_uke: 'tech_gedan_barai_left',
  bunkai_flank_distraction_uke2: 'tech_oi_zuki_right',
  fallen_ukemi: 'idle_shizentai',
};

// Кэш подклипов ката Heian Shodan
const subclipCache = new Map();

function getSubclipForRange(sourceClip, clipName, startTime, endTime, fps = 60) {
  if (!sourceClip) return null;
  const startFrame = Math.max(0, Math.round(startTime * fps));
  const endFrame = Math.max(startFrame + 1, Math.round(endTime * fps));
  const key = `${sourceClip.uuid || clipName}_sub_${startFrame}_${endFrame}`;
  if (subclipCache.has(key)) return subclipCache.get(key);

  try {
    const sub = THREE.AnimationUtils.subclip(sourceClip, clipName, startFrame, endFrame, fps);
    const patched = patchAgeUkeClip(sub, clipName);
    const inPlace = makeClipInPlace(patched);
    subclipCache.set(key, inPlace);
    return inPlace;
  } catch {
    return null;
  }
}

async function ensureClipsCached() {
  if (globalClipPromise) return globalClipPromise;
  globalClipPromise = (async () => {
    const entries = Object.entries(CLIP_FILES);
    await Promise.all(
      entries.map(async ([key, url]) => {
        try {
          // Если клип уже зарегистрирован из высококачественного GLB-пака Шотокан — не заменяем его
          if (key !== 'heian_shodan' && globalClipCache.has(key)) return;
          const res = await fetch(url);
          if (!res.ok) return;
          const json = await res.json();
          const parsed = THREE.AnimationClip.parse(json);
          const clip = makeClipInPlace(patchAgeUkeClip(parsed, key));
          if (!globalClipCache.has(key) || key === 'heian_shodan') {
            globalClipCache.set(key, clip);
          }
          if (ACTION_ALIASES[key] && !globalClipCache.has(ACTION_ALIASES[key])) {
            globalClipCache.set(ACTION_ALIASES[key], clip);
          }
        } catch {
          // тихо пропускаем отсутствующие файлы
        }
      })
    );
  })();
  return globalClipPromise;
}

function filterClipToScene(clip, sceneNamesSet) {
  if (!clip) return null;
  const validTracks = clip.tracks.filter((track) => {
    try {
      const parsed = THREE.PropertyBinding.parseTrackName(track.name);
      const nodeName = parsed.nodeName ?? '';
      return nodeName === '' || !sceneNamesSet || sceneNamesSet.size === 0 || sceneNamesSet.has(nodeName);
    } catch {
      return false;
    }
  });
  if (validTracks.length === 0) return clip;
  if (validTracks.length === clip.tracks.length) return clip;
  return new THREE.AnimationClip(clip.name, clip.duration, validTracks);
}

export default function MultiAvatarModel({
  role = 'tori',
  clipName = null,
  stance = 'zenkutsu',
  finalStance = null,
  landingMode = 'auto',
  position = [0, 0, 0],
  startPosition = null,
  waypoint = null,
  rotation = [0, 0, 0],
  startRotation = null,
  turnDirection = 0,
  fullTurn = false,
  isStationary = false,
  speed = 1.0,
  stepDuration = 2.2,
  stepKey = 0,
  isPlaying = true,
  replayTrigger = 0,
  scrubProgress = null,
  timelineTime = null,
  delaySeconds = 0,
  waitingClip = null,
  holdPunchClip = null,
  ikTarget = null,
  ikContactTime = 0.48,
  interactionType = 'body_contact',
  isGround = false,
  isRising = false,
  onMissingClip = null,
  onTrackBones = null,
  onTrackJoints = null,
  phraseRef = null,
  phraseStepRef = null,
  rootsRef = null,
  trackedJointsRef = null,
  combatOptions = null,
}) {
  const groupRef = useRef();
  const bonesRef = useRef({});

  // Загружаем единую библиотеку техник каратэ Шотокан v4 (213 клипов)
  const { scene, animations } = useGLTF('/models/karateka_techniques_v4.glb');

  // Клонируем SkinnedMesh через SkeletonUtils
  const { clonedModel, modelScale, modelYOffset, sceneNames } = useMemo(() => {
    const clone = SkeletonUtils.clone(scene);
    const bbox = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    bbox.getSize(size);

    const s = size.y > 0 ? 1.78 / size.y : 1.0;
    const yOffset = -bbox.min.y * s;

    // Назначение цветов согласно канонической спецификации:
    // СИНИЙ персонаж — атакующий (ТОРИ)
    // БЕЛЫЙ персонаж — защищающийся (УКЭ)
    let giColor = '#1e40af'; // Насыщенное синее доги Тори (атакующий)
    let beltColor = '#111827'; // Черный пояс мастера

    if (role === 'uke' || role === 'uke1') {
      giColor = '#faf9f6'; // Белоснежное традиционное доги Укэ (защищающийся)
      beltColor = '#181818';
    } else if (role === 'uke2') {
      giColor = '#475569'; // Графитовое доги дополнительного участника
      beltColor = '#2a1212';
    }

    clone.traverse((child) => {
      if (child.isMesh && child.material) {
        child.frustumCulled = false;
        child.castShadow = true;
        child.receiveShadow = true;
        const matName = child.material.name || '';
        const meshName = child.name || '';
        // Полное независимое клонирование материалов для каждого экземпляра модели
        const newMat = child.material.clone();
        newMat.side = THREE.DoubleSide;
        newMat.shadowSide = THREE.DoubleSide;

        if (matName.includes('Skin') || meshName.includes('Body') || meshName.includes('Head') || meshName.includes('Face')) {
          newMat.color = new THREE.Color(0xfff1e6);
          newMat.roughness = 0.65;
          newMat.metalness = 0.02;
        } else if (matName.includes('Belt') || meshName.includes('Belt') || meshName.includes('Obi')) {
          newMat.color = new THREE.Color(beltColor);
          newMat.roughness = 0.75;
          newMat.metalness = 0.05;
        } else if (matName.includes('Gi') || meshName.includes('Jacket') || meshName.includes('Pants') || meshName.includes('Sleeve') || meshName.includes('Cloth') || meshName.includes('Suit')) {
          newMat.color = new THREE.Color(giColor);
          newMat.roughness = 0.85;
          newMat.metalness = 0.02;
        } else {
          // Гарантированное независимое назначение цвета кимоно для любых элементов формы
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

  // Кэшируем ссылки на все кости скелета
  useEffect(() => {
    const b = {};
    clonedModel.traverse((obj) => {
      if (obj.isBone) {
        b[obj.name] = obj;
      }
    });
    bonesRef.current = b;
  }, [clonedModel]);

  const mixer = useMemo(() => new THREE.AnimationMixer(clonedModel), [clonedModel]);
  const activeActionRef = useRef(null);
  const lastPhraseRef = useRef(0);
  const finalStanceAppliedRef = useRef(false);
  const waitingStanceActiveRef = useRef(false);
  const fadeRemainingRef = useRef(0);
  const repeatSlotRef = useRef(0);
  const initializedPoseRef = useRef(false);
  const catchupOffsetRef = useRef({ active: false, dx: 0, dy: 0, dz: 0, dYaw: 0, elapsed: 0, duration: 0.35 });
  const savedBoneQuatsRef = useRef(new Map());
  const [clipCacheVersion, setClipCacheVersion] = useState(0);

  // Синхронно регистрируем 213 клипов из GLB до запуска первого эффекта воспроизведения
  useMemo(() => {
    if (animations && animations.length > 0) {
      animations.forEach((c) => {
        if (!globalClipCache.has(c.name)) {
          const patched = makeClipInPlace(patchAgeUkeClip(c, c.name));
          globalClipCache.set(c.name, patched);
        }
      });
      // Виртуальные зеркальные стойки и шаги (Миги Фудо-дати, челночные отходы вправо)
      if (globalClipCache.has('fudo_dachi') && !globalClipCache.has('fudo_dachi_right')) {
        globalClipCache.set('fudo_dachi_right', mirrorClipLeftRight(globalClipCache.get('fudo_dachi'), 'fudo_dachi_right'));
      }
      if (globalClipCache.has('slide_backward') && !globalClipCache.has('slide_backward_right')) {
        const sbMirrored = mirrorClipLeftRight(globalClipCache.get('slide_backward'), 'slide_backward_right_raw');
        const heikoUpper = globalClipCache.get('heiko_dachi');
        globalClipCache.set(
          'slide_backward_right',
          heikoUpper
            ? synthesizeModularClip({ lowerClip: sbMirrored, upperClip: heikoUpper, name: 'slide_backward_right', bypassCache: true })
            : sbMirrored
        );
      }
      if (globalClipCache.has('slide_forward') && !globalClipCache.has('slide_forward_right')) {
        const sfMirrored = mirrorClipLeftRight(globalClipCache.get('slide_forward'), 'slide_forward_right_raw');
        const heikoUpper = globalClipCache.get('heiko_dachi');
        globalClipCache.set(
          'slide_forward_right',
          heikoUpper
            ? synthesizeModularClip({ lowerClip: sfMirrored, upperClip: heikoUpper, name: 'slide_forward_right', bypassCache: true })
            : sfMirrored
        );
      }
      // Синтезируем удары в голову (Дзёдан) на основе готовых клипов Ой-дзуки
      if (globalClipCache.has('oi_zuki_right') && !globalClipCache.has('oi_zuki_jodan_right')) {
        const jodanR = synthesizeJodanOiZukiClip(globalClipCache.get('oi_zuki_right'), 'right', 'oi_zuki_jodan_right');
        if (jodanR) globalClipCache.set('oi_zuki_jodan_right', jodanR);
      }
      if (globalClipCache.has('oi_zuki_left') && !globalClipCache.has('oi_zuki_jodan_left')) {
        const jodanL = synthesizeJodanOiZukiClip(globalClipCache.get('oi_zuki_left'), 'left', 'oi_zuki_jodan_left');
        if (jodanL) globalClipCache.set('oi_zuki_jodan_left', jodanL);
      }
      // В Мусуби-дати и Хэйсоку-дати руки опущены вдоль тела, а не подняты перед грудью
      if (globalClipCache.has('stance_musubi') && globalClipCache.has('heiko_dachi')) {
        globalClipCache.set(
          'stance_musubi',
          synthesizeModularClip({
            lowerClip: globalClipCache.get('stance_musubi'),
            upperClip: globalClipCache.get('heiko_dachi'),
            name: 'stance_musubi',
            bypassCache: true,
          })
        );
      }
      if (globalClipCache.has('stance_heisoku') && globalClipCache.has('heiko_dachi')) {
        globalClipCache.set(
          'stance_heisoku',
          synthesizeModularClip({
            lowerClip: globalClipCache.get('stance_heisoku'),
            upperClip: globalClipCache.get('heiko_dachi'),
            name: 'stance_heisoku',
            bypassCache: true,
          })
        );
      }
      if (globalClipCache.has('heiko_dachi') && globalClipCache.has('stance_musubi')) {
        const reiBowClip = synthesizeReiBowClip({
          heikoClip: globalClipCache.get('heiko_dachi'),
          musubiClip: globalClipCache.get('stance_musubi'),
          duration: 3.8,
          name: 'rei_bow',
        });
        if (reiBowClip) globalClipCache.set('rei_bow', reiBowClip);
      }
      Object.entries(ACTION_ALIASES).forEach(([k, v]) => {
        if (!globalClipCache.has(k) && globalClipCache.has(v)) {
          globalClipCache.set(k, globalClipCache.get(v));
        }
      });
    }
  }, [animations]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureClipsCached();
      animationRegistry.init();
      if (!cancelled) setClipCacheVersion((v) => v + 1);
    })();
    return () => { cancelled = true; };
  }, [animations]);

  const isWaiting = timelineTime !== null && timelineTime < delaySeconds;

  // Разбор серии боевых техник для шага (поддержка одиночных техник и комбо вида 'tech_A + tech_B')
  const clipSequence = useMemo(() => {
    if (isWaiting) {
      if (waitingClip) return [waitingClip];
      if (stance === 'kokutsu') return ['kokutsu_dachi_left'];
      if (stance === 'zenkutsu') return ['zenkutsu_dachi_left'];
      if (stance === 'kiba' || stance === 'shiko') return ['stance_shiko'];
      if (stance === 'musubi') return ['stance_musubi'];
      if (stance === 'heisoku') return ['stance_heisoku'];
      return ['heiko_dachi'];
    }

    let list = [];
    if (Array.isArray(clipName)) {
      list = clipName;
    } else if (typeof clipName === 'string') {
      list = clipName.split('+').map((s) => s.trim()).filter(Boolean);
    }
    if (list.length === 0) {
      if (stance) list = [ACTION_ALIASES[stance] || stance];
      else list = ['heiko_dachi'];
    }
    return list;
  }, [isWaiting, waitingClip, clipName, stance]);

  // Нормализация имен стоек и определение ведущей ноги клипа
  const normalizeStanceKey = useCallback((st) => {
    const s = String(st || '').trim().toLowerCase();
    if (!s || s === 'ready' || s === 'heiko') return 'heiko_dachi';
    if (s === 'zenkutsu') return 'zenkutsu_dachi_left';
    if (s === 'kokutsu') return 'kokutsu_dachi_left';
    if (s === 'fudo') return 'fudo_dachi';
    if (s === 'kiba' || s === 'shiko') return 'stance_shiko';
    if (s === 'musubi') return 'stance_musubi';
    if (s === 'heisoku') return 'stance_heisoku';
    if (s === 'fallen_ukemi') return 'idle_shizentai';
    return ACTION_ALIASES[s] || s;
  }, []);

  const getStanceSide = useCallback((stName) => {
    const s = String(stName || '').toLowerCase();
    if (s === 'fudo_dachi' || s.includes('left')) return 'left';
    if (s.includes('right')) return 'right';
    return 'sym';
  }, []);

  const getClipLeadSide = useCallback((clipStr) => {
    const s = String(clipStr || '').toLowerCase();
    if (
      s === 'zenkutsu_dachi_left' || s === 'kokutsu_dachi_left' || s === 'fudo_dachi' ||
      s === 'gedan_barai_left' || s === 'age_uke_left' || s === 'gyaku_zuki_right' ||
      s === 'mae_geri_right' || s === 'kick_mae_geri_right' || s === 'oi_zuki_left' ||
      s === 'oi_zuki_jodan_left' || s === 'jodan_zuki_left' || s === 'kick_nami_gaeshi_right' ||
      s === 'step_backward_left' || s === 'step_forward_right'
    ) return 'left';
    if (
      s === 'zenkutsu_dachi_right' || s === 'kokutsu_dachi_right' || s === 'fudo_dachi_right' ||
      s === 'gedan_barai_right' || s === 'age_uke_right' || s === 'gyaku_zuki_left' ||
      s === 'mae_geri_left' || s === 'kick_mae_geri_left' || s === 'oi_zuki_right' ||
      s === 'oi_zuki_jodan_right' || s === 'jodan_zuki_right' || s === 'kick_nami_gaeshi_left' ||
      s === 'step_backward_right' || s === 'step_forward_left'
    ) return 'right';
    return 'sym';
  }, []);

  // Разрешение сырого имени техники в отфильтрованный AnimationClip (без адаптации стойки)
  const resolveRawClipByName = useCallback((rawName) => {
    if (!rawName) return null;
    const name = rawName.trim();

    if (name.startsWith('heian_shodan_step_') || name.startsWith('kata_step_')) {
      const match = name.match(/(\d+)/);
      if (match) {
        const stepNum = parseInt(match[1], 10);
        const master = globalClipCache.get('heian_shodan');
        if (master) {
          const ev = HEIAN_SHODAN_CANONICAL_EVENTS.find((e) => e.moveNumber === stepNum);
          if (ev) {
            const sub = getSubclipForRange(master, `heian_shodan_step_${stepNum}`, ev.startTime, ev.endTime, 60);
            if (sub) return filterClipToScene(sub, sceneNames);
          }
        }
      }
    }

    let found = null;
    if (globalClipCache.has(name)) {
      found = globalClipCache.get(name);
    } else if (ACTION_ALIASES[name] && globalClipCache.has(ACTION_ALIASES[name])) {
      found = globalClipCache.get(ACTION_ALIASES[name]);
    } else {
      const resolved = resolveBunkaiClip(name);
      if (resolved && globalClipCache.has(resolved.clipName)) {
        found = globalClipCache.get(resolved.clipName);
      }
    }

    if (!found) return null;
    const filtered = filterClipToScene(found, sceneNames);
    return filtered && filtered.tracks.length > 0 ? filtered : found;
  }, [sceneNames, clipCacheVersion]);

  // Примитивный флаг движения назад (без нестабильных массивов в зависимостях хуков)
  const sPosX = startPosition?.[0] ?? position?.[0] ?? 0;
  const sPosZ = startPosition?.[2] ?? position?.[2] ?? 0;
  const ePosX = position?.[0] ?? sPosX;
  const ePosZ = position?.[2] ?? sPosZ;
  const refYawVal = startRotation?.[1] ?? rotation?.[1] ?? 0;
  const isMovingBackFlag = ((ePosX - sPosX) * Math.sin(refYawVal) + (ePosZ - sPosZ) * Math.cos(refYawVal)) < -0.04;

  // Разрешение клипа с автоматическим согласованием начальной и конечной стойки (без переброса ног до удара)
  const resolveClipByName = useCallback((rawName, adaptToStance = true) => {
    const baseClip = resolveRawClipByName(rawName);
    if (!baseClip || !adaptToStance || !rawName) return baseClip;

    const lower = rawName.trim().toLowerCase();
    const startStanceKey = normalizeStanceKey(stance);
    const hasExplicitFinalStance = Boolean(finalStance && String(finalStance).trim());
    const endStanceKey = normalizeStanceKey(hasExplicitFinalStance ? finalStance : stance);

    const isPureStanceClip = (
      lower === 'heiko_dachi' || lower === 'idle_shizentai' ||
      lower.startsWith('zenkutsu_dachi') || lower.startsWith('kokutsu_dachi') ||
      lower.startsWith('fudo_dachi') || lower.startsWith('stance_') ||
      lower === 'kiba_dachi'
    );
    if (isPureStanceClip) {
      if (hasExplicitFinalStance && startStanceKey !== endStanceKey) {
        const fromClip = resolveRawClipByName(startStanceKey);
        const toClip = resolveRawClipByName(endStanceKey);
        if (fromClip && toClip) {
          const trans = synthesizeStanceTransitionClip({
            fromStanceClip: fromClip,
            toStanceClip: toClip,
            upperClip: toClip,
            duration: Math.max(0.9, (stepDurationRef.current || 1.4) * 0.72),
            name: `mod_stance_tr_${startStanceKey}_${endStanceKey}`,
          });
          const filtered = filterClipToScene(trans, sceneNames);
          return filtered && filtered.tracks.length > 0 ? filtered : trans;
        }
      }
      const targetStanceKey = hasExplicitFinalStance ? endStanceKey : (stance ? startStanceKey : lower);
      const overrideClip = resolveRawClipByName(targetStanceKey);
      const chosenStanceClip = overrideClip || baseClip;
      // Если боец на предыдущем шаге бил рукой и сейчас стоит (без смены техники/поклона/партера),
      // удерживаем стойку с вытянутой бьющей рукой (кимэ последнего удара).
      if (holdPunchClip && !isGround && !isRising && chosenStanceClip && targetStanceKey !== 'heiko_dachi' && targetStanceKey !== 'stance_musubi') {
        const punchClip = resolveRawClipByName(holdPunchClip);
        if (punchClip) {
          const holdExtended = synthesizeHoldExtendedPunchClip({
            stanceClip: chosenStanceClip,
            punchClip,
            name: `mod_hold_punch_${targetStanceKey}_${String(holdPunchClip).toLowerCase()}`,
          });
          const filtered = filterClipToScene(holdExtended, sceneNames);
          return filtered && filtered.tracks.length > 0 ? filtered : holdExtended;
        }
      }
      return chosenStanceClip;
    }

    const fromSide = getStanceSide(startStanceKey);
    const toSide = getStanceSide(endStanceKey);
    const clipSide = getClipLeadSide(lower);
    const isMovingBack = isMovingBackFlag;

    let adapted = baseClip;

    if (lower.startsWith('enter_zenkutsu_')) {
      const targetKey = hasExplicitFinalStance ? endStanceKey : lower.replace('enter_zenkutsu_', 'zenkutsu_dachi_');
      if (startStanceKey === 'heiko_dachi' && (targetKey === 'zenkutsu_dachi_left' || targetKey === 'zenkutsu_dachi_right')) {
        adapted = resolveRawClipByName(targetKey.replace('zenkutsu_dachi_', 'enter_zenkutsu_')) || baseClip;
      } else {
        const fromClip = resolveRawClipByName(startStanceKey);
        const toClip = resolveRawClipByName(targetKey);
        if (fromClip && toClip) {
          adapted = synthesizeStanceTransitionClip({
            fromStanceClip: fromClip,
            toStanceClip: toClip,
            upperClip: toClip,
            duration: Math.max(1.0, (stepDurationRef.current || 1.8) * 0.72),
            name: `mod_enter_${startStanceKey}_${targetKey}`,
          });
        }
      }
    } else if (lower.includes('oi_zuki')) {
      if (startStanceKey === endStanceKey) {
        const stanceLower = resolveRawClipByName(startStanceKey);
        if (stanceLower) {
          adapted = synthesizeModularClip({
            lowerClip: stanceLower,
            upperClip: baseClip,
            name: `mod_oi_${lower}_${startStanceKey}`,
          });
        }
      } else if (fromSide === 'right' && toSide === 'left') {
        adapted = resolveRawClipByName(lower.includes('jodan') ? 'oi_zuki_jodan_left' : 'oi_zuki_left') || baseClip;
      } else if (fromSide === 'left' && toSide === 'right') {
        adapted = resolveRawClipByName(lower.includes('jodan') ? 'oi_zuki_jodan_right' : 'oi_zuki_right') || baseClip;
      } else {
        const fromClip = resolveRawClipByName(startStanceKey);
        const toClip = resolveRawClipByName(endStanceKey);
        if (fromClip && toClip) {
          adapted = synthesizeStanceTransitionClip({
            fromStanceClip: fromClip,
            toStanceClip: toClip,
            upperClip: baseClip,
            duration: baseClip.duration,
            name: `mod_oi_tr_${lower}_${startStanceKey}_${endStanceKey}`,
          });
        }
      }
    } else if (lower.startsWith('turn_into_zenkutsu_')) {
      if (startStanceKey === endStanceKey) {
        const stanceUpper = resolveRawClipByName(endStanceKey);
        const stepLower = resolveRawClipByName(
          endStanceKey === 'zenkutsu_dachi_right' ? 'step_forward_right' : 'step_forward_left'
        );
        if (stepLower && stanceUpper) {
          adapted = adaptKickClipToStance({
            kickClip: stepLower,
            startStanceClip: stanceUpper,
            endStanceClip: stanceUpper,
            landingMode: 'back',
            name: `mod_turn_same_${endStanceKey}`,
          });
          adapted = synthesizeModularClip({
            lowerClip: adapted,
            upperClip: stanceUpper,
            name: `mod_turn_same_full_${endStanceKey}`,
          });
        } else {
          adapted = stanceUpper || baseClip;
        }
      } else if (endStanceKey === 'zenkutsu_dachi_left' || endStanceKey === 'zenkutsu_dachi_right') {
        const stepLower = resolveRawClipByName(endStanceKey === 'zenkutsu_dachi_left' ? 'step_forward_left' : 'step_forward_right');
        const stanceUpper = resolveRawClipByName(endStanceKey);
        if (stepLower && stanceUpper) {
          adapted = synthesizeModularClip({
            lowerClip: stepLower,
            upperClip: stanceUpper,
            name: `mod_turn_${startStanceKey}_${endStanceKey}`,
          });
        }
      }
    } else if (lower === 'step_backward' && endStanceKey === 'heiko_dachi' && startStanceKey.startsWith('zenkutsu_dachi_')) {
      adapted = resolveRawClipByName(startStanceKey === 'zenkutsu_dachi_right' ? 'exit_zenkutsu_right' : 'exit_zenkutsu_left') || baseClip;
    } else if (lower === 'step_backward_right' && startStanceKey === 'zenkutsu_dachi_right' && endStanceKey === 'zenkutsu_dachi_right') {
      adapted = resolveRawClipByName('slide_backward_right') || baseClip;
    } else if (lower === 'step_backward_left' && startStanceKey === 'zenkutsu_dachi_left' && endStanceKey === 'zenkutsu_dachi_left') {
      adapted = resolveRawClipByName('slide_backward') || baseClip;
    } else if (lower.startsWith('tech_') && baseClip.duration > 2.2) {
      const trimmedUpper = trimClipRange(baseClip, baseClip.duration * 0.36, baseClip.duration * 0.99, `${baseClip.name}_active`);
      const fromClip = resolveRawClipByName(startStanceKey) || baseClip;
      const toClip = resolveRawClipByName(endStanceKey) || fromClip;
      if (startStanceKey === endStanceKey) {
        adapted = synthesizeModularClip({
          lowerClip: fromClip,
          upperClip: trimmedUpper,
          name: `mod_tech_${lower}_${startStanceKey}`,
        });
      } else {
        adapted = synthesizeStanceTransitionClip({
          fromStanceClip: fromClip,
          toStanceClip: toClip,
          upperClip: trimmedUpper,
          duration: Math.max(1.0, trimmedUpper.duration),
          name: `mod_tech_tr_${lower}_${startStanceKey}_${endStanceKey}`,
        });
      }
    } else if (lower.includes('mae_geri')) {
      const fromClip = resolveRawClipByName(startStanceKey);
      const toClip = resolveRawClipByName(endStanceKey);
      if (landingMode === 'forward' || (fromSide !== 'sym' && clipSide !== 'sym' && fromSide !== clipSide)) {
        adapted = adaptKickClipToStance({
          kickClip: baseClip,
          startStanceClip: fromClip,
          endStanceClip: toClip,
          landingMode,
          name: `mod_kick_${lower}_${startStanceKey}_${endStanceKey}_${landingMode}`,
        });
      }
    } else if (lower.includes('nami_gaeshi')) {
      const activeSweep = baseClip.duration > 2.2
        ? trimClipRange(baseClip, baseClip.duration * 0.37, baseClip.duration * 0.92, `${baseClip.name}_active`)
        : baseClip;
      const fromClip = resolveRawClipByName(startStanceKey);
      const toClip = resolveRawClipByName(endStanceKey);
      adapted = adaptKickClipToStance({
        kickClip: activeSweep,
        startStanceClip: fromClip,
        endStanceClip: toClip,
        landingMode: 'forward',
        name: `mod_sweep_${lower}_${startStanceKey}_${endStanceKey}`,
      });
    } else if (
      lower.includes('gedan_barai') || lower.includes('age_uke') ||
      lower.includes('gyaku_zuki') || lower.includes('jodan_zuki') ||
      lower.includes('oi_zuki_jodan') ||
      lower.includes('soto_uke') || lower.includes('uchi_uke') ||
      lower.includes('choku_zuki') || lower.includes('kizami_zuki')
    ) {
      if (startStanceKey !== endStanceKey && !lower.includes('oi_zuki')) {
        let stepLower = null;
        if (startStanceKey === 'stance_heisoku' && endStanceKey === 'zenkutsu_dachi_right') {
          stepLower = resolveRawClipByName('enter_zenkutsu_right');
        } else if (startStanceKey === 'stance_heisoku' && endStanceKey === 'zenkutsu_dachi_left') {
          stepLower = resolveRawClipByName('enter_zenkutsu_left');
        } else if (fromSide === 'right' && toSide === 'left') {
          stepLower = resolveRawClipByName(isMovingBack ? 'step_backward_right' : 'step_forward_left');
        } else if (fromSide === 'left' && toSide === 'right') {
          stepLower = resolveRawClipByName(isMovingBack ? 'step_backward_left' : 'step_forward_right');
        }
        if (stepLower) {
          adapted = synthesizeModularClip({
            lowerClip: stepLower,
            upperClip: baseClip,
            name: `mod_step_${lower}_${startStanceKey}_${endStanceKey}_${isMovingBack ? 'b' : 'f'}`,
          });
        } else {
          const fromClip = resolveRawClipByName(startStanceKey);
          const toClip = resolveRawClipByName(endStanceKey);
          if (fromClip && toClip) {
            adapted = synthesizeStanceTransitionClip({
              fromStanceClip: fromClip,
              toStanceClip: toClip,
              upperClip: baseClip,
              duration: baseClip.duration,
              name: `mod_tr_${lower}_${startStanceKey}_${endStanceKey}`,
            });
          }
        }
      } else if (
        fromSide === toSide &&
        ((clipSide !== 'sym' && clipSide !== toSide) || !startStanceKey.startsWith('zenkutsu_dachi_'))
      ) {
        const stanceLower = resolveRawClipByName(startStanceKey);
        if (stanceLower) {
          adapted = synthesizeModularClip({
            lowerClip: stanceLower,
            upperClip: baseClip,
            name: `mod_st_${lower}_${startStanceKey}`,
          });
        }
      }
    }

    if (!adapted) return baseClip;
    const filtered = filterClipToScene(adapted, sceneNames);
    return filtered && filtered.tracks.length > 0 ? filtered : adapted;
  }, [resolveRawClipByName, normalizeStanceKey, getStanceSide, getClipLeadSide, stance, finalStance, landingMode, isMovingBackFlag, sceneNames]);

  const seqIndexRef = useRef(0);
  const clipSequenceKey = useMemo(() => clipSequence.join('__'), [clipSequence]);
  const prevPhraseRef = useRef(0);
  const lastLayoutStepKeyRef = useRef(stepKey);
  const prevReplayTriggerRef = useRef(replayTrigger);
  const prevStepKeyRef = useRef(stepKey);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const stepDurationRef = useRef(stepDuration);
  stepDurationRef.current = stepDuration;
  const scrubProgressRef = useRef(scrubProgress);
  scrubProgressRef.current = scrubProgress;

  // Отсечка статичной подготовки (Хэйко-дати / пауза в начале) для мгновенного перехода из конечной позы предыдущего шага
  const getClipStartOffset = useCallback((name, duration) => {
    if (isWaiting || typeof name !== 'string') return 0;
    const lower = name.toLowerCase();
    if (lower.startsWith('mod_') || lower.includes('_active') || lower.includes('_trim_')) {
      return 0;
    }
    if (lower.startsWith('tech_') && duration > 2.2) {
      return duration * 0.36;
    }
    if (lower.includes('nami_gaeshi') && duration > 2.2) {
      return duration * 0.37;
    }
    if (lower.startsWith('turn_into_')) {
      return duration * 0.14;
    }
    return 0;
  }, [isWaiting]);

  // Точка фиксации конечной позы (Кимэ / завершённая стойка) до петлевого отката клипа к 100% исходной позе
  const getClipHoldEndTime = useCallback((name, duration) => {
    if (!duration || duration <= 0.4) return duration || 1.0;
    const lower = String(name || '').toLowerCase();
    if (lower.includes('idle_shizentai') || lower.includes('heiko_dachi')) {
      return duration * 0.90;
    }
    return Math.max(0.25, duration - 0.02);
  }, []);

  const isPureStanceName = useCallback((name) => {
    const s = String(name || '').trim().toLowerCase();
    return (
      s === 'heiko_dachi' ||
      s === 'idle_shizentai' ||
      s === 'fudo_dachi' ||
      s === 'fudo_dachi_right' ||
      s === 'kiba_dachi' ||
      s.startsWith('zenkutsu_dachi') ||
      s.startsWith('kokutsu_dachi') ||
      s.startsWith('stance_')
    );
  }, []);

  // Запуск конкретного элемента комбо с плавным переходом из предыдущей стойки/удара
  const playSubclipAt = useCallback((idx, prevAct = null, forceRestart = false, overrideRawName = null) => {
    const targetName = overrideRawName || clipSequence[idx];
    if (!mixer || !targetName) return;
    let playable = overrideRawName
      ? resolveRawClipByName(overrideRawName)
      : resolveClipByName(targetName, idx === 0);
    if (!playable) {
      if (clipCacheVersion > 0) {
        animationRegistry.reportMissing(targetName, {
          role,
          context: `MultiAvatarModel sequence player for role ${role}`,
        });
        if (onMissingClip) onMissingClip(targetName);
      }
      return;
    }

    const curSpeed = speedRef.current;
    const curIsPlaying = isPlayingRef.current;
    const curScrub = scrubProgressRef.current;
    const isStanceTarget = isPureStanceName(targetName);

    let action = mixer.clipAction(playable);
    // При повторе той же атакующей техники на следующем шаге (напр. два Гяку-дзуки подряд)
    // используем клонированный слот, чтобы crossFadeTo плавно вынес руку заново без обрыва
    if (!overrideRawName && prevAct && prevAct === action && !forceRestart && !isStanceTarget) {
      repeatSlotRef.current = repeatSlotRef.current ^ 1;
      const repKey = `${playable.name}__rep_${repeatSlotRef.current}`;
      let clonedClip = globalClipCache.get(repKey);
      if (!clonedClip) {
        clonedClip = playable.clone();
        clonedClip.name = repKey;
        globalClipCache.set(repKey, clonedClip);
      }
      playable = clonedClip;
      action = mixer.clipAction(playable);
    }

    const trimStart = idx === 0 && !overrideRawName ? getClipStartOffset(playable.name || targetName, playable.duration) : 0;
    const holdEnd = getClipHoldEndTime(playable.name || targetName, playable.duration);
    const activeDur = Math.max(0.35, holdEnd - trimStart);
    const lowerTarget = String(targetName).toLowerCase();
    const isLocomotionClip = lowerTarget.includes('enter_') || lowerTarget.includes('exit_') || lowerTarget.includes('step_') || lowerTarget.includes('slide_') || lowerTarget.includes('turn_');
    const stepDur = stepDurationRef.current || 2.2;
    const explicitDelayFrac = !isGround && !isRising && delaySeconds ? Math.max(0, Math.min(0.45, Number(delaySeconds))) : 0;
    const rawTargetSec = isLocomotionClip
      ? Math.max(0.70, stepDur * 0.77)
      : Math.max(0.85, stepDur * 0.85);
    const targetSec = Math.max(0.55, rawTargetSec - explicitDelayFrac * stepDur * 0.85);
    const clipFitScale = clipSequence.length === 1 && (activeDur > targetSec || (isLocomotionClip && activeDur < targetSec * 0.9))
      ? Math.max(0.55, Math.min(2.4, activeDur / targetSec))
      : 1.0;

    const comboMultiplier = clipSequence.length === 2 ? 1.45 : clipSequence.length === 3 ? 1.9 : clipSequence.length >= 4 ? 2.4 : 1.0;
    const effectiveScale = curSpeed * comboMultiplier * clipFitScale;

    if (prevAct && prevAct !== action && !forceRestart) {
      // Плавный бесшовный переход строго из предыдущей конечной позы без промежуточного состояния
      action.reset();
      action.time = trimStart;
      action.enabled = true;
      action.setEffectiveTimeScale(effectiveScale);
      action.setEffectiveWeight(1.0);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      const crossSec = isStanceTarget ? 0.42 : (idx === 0 ? 0.28 : 0.18);
      fadeRemainingRef.current = crossSec + 0.05;
      prevAct.crossFadeTo(action, crossSec, false);
    } else if (prevAct === action && !forceRestart) {
      // Тот же самый клип/стойка: не сбрасываем, удерживаем текущую позу плавно
      const curPhraseVal = phraseRef ? phraseRef.current : 0;
      action.enabled = true;
      action.setEffectiveTimeScale(effectiveScale);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      if (action.time >= (holdEnd - 0.03)) {
        if (!isStanceTarget && curPhraseVal < 0.15 && curIsPlaying) {
          action.reset();
          action.time = trimStart;
          action.play();
        } else {
          action.time = holdEnd;
          action.paused = true;
        }
      }
    } else {
      action.reset();
      action.time = trimStart;
      action.enabled = true;
      action.setEffectiveTimeScale(effectiveScale);
      action.setEffectiveWeight(1.0);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
    }

    if (curScrub !== null) {
      action.time = trimStart + curScrub * activeDur;
      action.paused = true;
      mixer.update(0);
    } else {
      action.paused = !curIsPlaying;
      mixer.update(0);
    }

    activeActionRef.current = action;
  }, [mixer, clipSequenceKey, resolveClipByName, resolveRawClipByName, getClipStartOffset, getClipHoldEndTime, isPureStanceName, role, onMissingClip, clipCacheVersion]);

  // Плавный переход позиции/ориентации без телепортаций (мгновенная установка только при первом монтировании)
  useLayoutEffect(() => {
    if (lastLayoutStepKeyRef.current !== stepKey) {
      lastLayoutStepKeyRef.current = stepKey;
      prevPhraseRef.current = 0;
    }
    if (!groupRef.current) return;
    const rawPhrase = scrubProgress !== null ? scrubProgress : (phraseRef ? phraseRef.current : 0);
    const phrase = Math.min(1.0, Math.max(0, rawPhrase));
    const start = startPosition || position;
    const end = position;

    const startYaw = (startRotation && startRotation[1] !== undefined)
      ? startRotation[1]
      : ((rotation && rotation[1] !== undefined) ? rotation[1] : 0);
    const endYaw = (rotation && rotation[1] !== undefined) ? rotation[1] : startYaw;
    let angleDelta = Math.atan2(Math.sin(endYaw - startYaw), Math.cos(endYaw - startYaw));
    if (fullTurn) {
      angleDelta += (turnDirection ? Math.sign(turnDirection) : 1) * Math.PI * 2;
    } else if (turnDirection && Math.abs(angleDelta) > 2.5 && Math.sign(angleDelta) !== Math.sign(turnDirection)) {
      angleDelta += Math.sign(turnDirection) * Math.PI * 2;
    }

    const isDefender = (role === 'uke' || role === 'uke1') && !isGround;
    const contactPhase = combatOptions?.ikContactTime || ikContactTime || 0.48;
    const reactionDelay = isGround || isRising
      ? 0.0
      : (delaySeconds !== undefined && delaySeconds !== null
        ? Math.max(0, Math.min(0.45, Number(delaySeconds)))
        : (isDefender ? 0.16 : 0.0));
    const isLocomotionOrTurn = !combatOptions?.contactType || combatOptions.contactType === 'none' || combatOptions.contactType === 'distance_only' || combatOptions.interactionType === 'tai_sabaki';
    const isZeroDisp = Math.abs((end?.[0] || 0) - (start?.[0] || 0)) < 0.005 && Math.abs((end?.[2] || 0) - (start?.[2] || 0)) < 0.005;

    let phaseStart = 0.05;
    let phaseEnd = 0.80;
    if (isLocomotionOrTurn) {
      phaseStart = reactionDelay >= 0.08 ? reactionDelay : 0.05;
      phaseEnd = isZeroDisp ? 0.75 : 0.80;
    } else if (isDefender) {
      phaseStart = reactionDelay;
      phaseEnd = contactPhase;
    } else {
      phaseStart = Math.max(0.08, reactionDelay);
      phaseEnd = Math.max(phaseStart + 0.15, contactPhase);
    }

    let motionProgress = 0;
    if (scrubProgress !== null) {
      motionProgress = scrubProgress;
    } else if (phrase <= phaseStart) {
      motionProgress = 0;
    } else if (phrase >= phaseEnd) {
      motionProgress = 1;
    } else {
      const k = (phrase - phaseStart) / Math.max(0.01, phaseEnd - phaseStart);
      motionProgress = k * k * (3 - 2 * k);
    }

    const initYaw = Math.abs(angleDelta) > 0.005 ? (startYaw + angleDelta * motionProgress) : endYaw;
    const initPos = isZeroDisp
      ? end
      : [
          (start?.[0] || 0) + ((end?.[0] || 0) - (start?.[0] || 0)) * motionProgress,
          (start?.[1] || 0) + ((end?.[1] || 0) - (start?.[1] || 0)) * motionProgress,
          (start?.[2] || 0) + ((end?.[2] || 0) - (start?.[2] || 0)) * motionProgress,
        ];
    let initY = (initPos?.[1] || 0) + modelYOffset;
    let rotX = rotation ? (rotation[0] || 0) : 0;
    let rotZ = rotation ? (rotation[2] || 0) : 0;

    if (isGround && role === 'tori') {
      const isAlreadyFallen = start[1] >= 0.04 && start[1] <= 0.12 && end[1] >= 0.04 && end[1] <= 0.12;
      const fallFactor = isAlreadyFallen ? 1.0 : 0.0;
      initY = THREE.MathUtils.lerp(modelYOffset, 0.08, fallFactor);
      rotX = -Math.PI * 0.45 * fallFactor;
      rotZ = Math.PI * 0.15 * fallFactor;
    } else if (isRising && role === 'tori' && phrase < 0.05) {
      initY = 0.08;
      rotX = -Math.PI * 0.45;
      rotZ = Math.PI * 0.15;
    }

    if (!initializedPoseRef.current || scrubProgress !== null) {
      initializedPoseRef.current = true;
      catchupOffsetRef.current.active = false;
      groupRef.current.position.set(initPos?.[0] || 0, initY, initPos?.[2] || 0);
      groupRef.current.rotation.set(rotX, (!isGround || role !== 'tori') ? initYaw : endYaw, rotZ);
      if (rootsRef) {
        rootsRef.current[role] = [initPos?.[0] || 0, initPos?.[1] || 0, initPos?.[2] || 0];
      }
      return;
    }

    // Если модель уже в сцене и сменился шаг — никогда не телепортируем её;
    // компенсируем разницу текущих координат/угла плавным доведением за 0.35с
    const targetYaw = (!isGround || role !== 'tori') ? initYaw : endYaw;
    const dx = groupRef.current.position.x - (initPos?.[0] || 0);
    const dy = groupRef.current.position.y - initY;
    const dz = groupRef.current.position.z - (initPos?.[2] || 0);
    const dYaw = Math.atan2(Math.sin(groupRef.current.rotation.y - targetYaw), Math.cos(groupRef.current.rotation.y - targetYaw));
    if (Math.hypot(dx, dz) > 0.02 || Math.abs(dy) > 0.02 || Math.abs(dYaw) > 0.02) {
      catchupOffsetRef.current = {
        active: true,
        dx,
        dy,
        dz,
        dYaw,
        elapsed: 0,
        duration: 0.35,
      };
    } else {
      catchupOffsetRef.current.active = false;
    }
  }, [stepKey, replayTrigger, scrubProgress, modelYOffset]);

  // Запуск первой техники шага с кроссфейдом из предыдущей стойки или повтором на том же шаге
  useEffect(() => {
    const isExplicitReplay = prevReplayTriggerRef.current !== replayTrigger;
    prevReplayTriggerRef.current = replayTrigger;
    const isStepChanged = prevStepKeyRef.current !== stepKey;
    prevStepKeyRef.current = stepKey;

    const isDefender = (role === 'uke' || role === 'uke1') && !isGround;
    const reactionDelay = isGround || isRising
      ? 0.0
      : (delaySeconds !== undefined && delaySeconds !== null
        ? Math.max(0, Math.min(0.45, Number(delaySeconds)))
        : (isDefender ? 0.16 : 0.0));
    const curPhrase = scrubProgressRef.current !== null ? scrubProgressRef.current : (phraseRef ? phraseRef.current : 0);

    seqIndexRef.current = 0;
    finalStanceAppliedRef.current = false;

    const shouldHardRestart = isExplicitReplay && !isStepChanged;

    if (reactionDelay >= 0.08 && curPhrase < reactionDelay && !isPureStanceName(clipSequence[0])) {
      waitingStanceActiveRef.current = true;
      const waitStanceClip = normalizeStanceKey(stance);
      playSubclipAt(0, activeActionRef.current, shouldHardRestart, waitStanceClip);
    } else {
      waitingStanceActiveRef.current = false;
      playSubclipAt(0, activeActionRef.current, shouldHardRestart);
    }
  }, [clipSequenceKey, playSubclipAt, finalStance, landingMode, replayTrigger, stepKey, stance, delaySeconds, role, isGround, isRising, normalizeStanceKey, isPureStanceName]);

  // Реакция на паузу и изменение скорости
  useEffect(() => {
    if (activeActionRef.current) {
      const curClip = activeActionRef.current.getClip();
      const cName = curClip?.name || clipSequence[seqIndexRef.current] || clipSequence[0] || '';
      const trimStart = seqIndexRef.current === 0 && curClip && !waitingStanceActiveRef.current
        ? getClipStartOffset(cName, curClip.duration)
        : 0;
      const holdEnd = curClip ? getClipHoldEndTime(cName, curClip.duration) : 1.0;
      if (isPlaying && curClip && activeActionRef.current.time >= holdEnd - 0.03 && (phraseRef?.current || 0) < 0.15) {
        activeActionRef.current.reset();
        activeActionRef.current.time = trimStart;
        activeActionRef.current.play();
      }
      activeActionRef.current.paused = !isPlaying;
      const activeDur = curClip ? Math.max(0.35, holdEnd - trimStart) : 1.0;
      const lowerTarget = String(clipSequence[0] || '').toLowerCase();
      const isLocomotionClip = lowerTarget.includes('enter_') || lowerTarget.includes('exit_') || lowerTarget.includes('step_') || lowerTarget.includes('slide_') || lowerTarget.includes('turn_');
      const stepDur = stepDurationRef.current || 2.2;
      const explicitDelayFrac = !isGround && !isRising && delaySeconds ? Math.max(0, Math.min(0.45, Number(delaySeconds))) : 0;
      const rawTargetSec = isLocomotionClip
        ? Math.max(0.70, stepDur * 0.77)
        : Math.max(0.85, stepDur * 0.85);
      const targetSec = Math.max(0.55, rawTargetSec - explicitDelayFrac * stepDur * 0.85);
      const clipFitScale = clipSequence.length === 1 && curClip && (activeDur > targetSec || (isLocomotionClip && activeDur < targetSec * 0.9))
        ? Math.max(0.55, Math.min(2.4, activeDur / targetSec))
        : 1.0;
      const comboMultiplier = clipSequence.length === 2 ? 1.45 : clipSequence.length === 3 ? 1.9 : clipSequence.length >= 4 ? 2.4 : 1.0;
      activeActionRef.current.setEffectiveTimeScale(speed * comboMultiplier * clipFitScale);
    }
  }, [isPlaying, speed, clipSequence, stepDuration, getClipStartOffset, getClipHoldEndTime, phraseRef]);

  // По кадровое обновление положения, позы и предотвращение проникновения
  useFrame((_, delta) => {
    // 0. Восстанавливаем исходные позы костей до модификаций прошлого кадра (исключает накопление поворотов на паузе/конце шага)
    if (savedBoneQuatsRef.current.size > 0) {
      for (const [bone, quat] of savedBoneQuatsRef.current.entries()) {
        if (bone) bone.quaternion.copy(quat);
      }
      savedBoneQuatsRef.current.clear();
    }

    // Синхронизация R3F <Canvas> и DOM-рендера: не применяем phrase нового шага к пропсам старого шага
    if (phraseStepRef && phraseStepRef.current !== stepKey && scrubProgress === null) {
      return;
    }

    const rawPhrase = scrubProgress !== null ? scrubProgress : (phraseRef ? phraseRef.current : 0);
    const phrase = Math.min(1.0, Math.max(0, rawPhrase));
    const isDefender = (role === 'uke' || role === 'uke1') && !isGround;
    const contactPhase = combatOptions?.ikContactTime || ikContactTime || 0.48;

    // Задержка старта техники (для Укэ или отложенной контратаки/удара Тори)
    const reactionDelay = isGround || isRising
      ? 0.0
      : (delaySeconds !== undefined && delaySeconds !== null
        ? Math.max(0, Math.min(0.45, Number(delaySeconds)))
        : (isDefender ? 0.16 : 0.0));

    // Мгновенный перезапуск анимации только при реальном зацикливании/повторе того же самого шага
    if (
      prevPhraseRef.current > 0.70 &&
      phrase < 0.10 &&
      prevStepKeyRef.current === stepKey &&
      lastLayoutStepKeyRef.current === stepKey
    ) {
      seqIndexRef.current = 0;
      finalStanceAppliedRef.current = false;
      if (reactionDelay >= 0.08 && !isPureStanceName(clipSequence[0])) {
        waitingStanceActiveRef.current = true;
        playSubclipAt(0, activeActionRef.current, true, normalizeStanceKey(stance));
      } else {
        waitingStanceActiveRef.current = false;
        playSubclipAt(0, activeActionRef.current, true);
      }
    }
    prevPhraseRef.current = phrase;

    if (phrase < 0.25) {
      finalStanceAppliedRef.current = false;
    }

    if (waitingStanceActiveRef.current && phrase >= reactionDelay && scrubProgress === null) {
      waitingStanceActiveRef.current = false;
      playSubclipAt(0, activeActionRef.current, false);
    }

    if (groupRef.current) {
      const start = startPosition || position;
      const end = position;

      const clipNames = clipSequence.map((c) => (typeof c === 'string' ? c : c?.name || '')).join(' ').toLowerCase();

      // Единое синхронное окно [phaseStart, phaseEnd] для перемещения И поворота корпуса к противнику:
      // модель всегда поворачивается одновременно с шагом, без раздельного «дошел -> встал -> довернулся».
      const startYaw = (startRotation && startRotation[1] !== undefined)
        ? startRotation[1]
        : ((rotation && rotation[1] !== undefined) ? rotation[1] : 0);
      const endYaw = (rotation && rotation[1] !== undefined) ? rotation[1] : startYaw;

      let currentYaw = endYaw;
      let angleDelta = Math.atan2(Math.sin(endYaw - startYaw), Math.cos(endYaw - startYaw));
      if (fullTurn) {
        angleDelta += (turnDirection ? Math.sign(turnDirection) : 1) * Math.PI * 2;
      } else if (turnDirection && Math.abs(angleDelta) > 2.5 && Math.sign(angleDelta) !== Math.sign(turnDirection)) {
        angleDelta += Math.sign(turnDirection) * Math.PI * 2;
      }

      const isZeroDisp = Math.abs(end[0] - start[0]) < 0.005 && Math.abs(end[2] - start[2]) < 0.005;
      const isLocomotionOrTurn = !combatOptions?.contactType || combatOptions.contactType === 'none' || combatOptions.contactType === 'distance_only' || combatOptions.interactionType === 'tai_sabaki';

      let phaseStart = 0.05;
      let phaseEnd = 0.80;
      if (isLocomotionOrTurn) {
        phaseStart = reactionDelay >= 0.08 ? reactionDelay : 0.05;
        phaseEnd = isZeroDisp ? 0.75 : 0.80;
      } else if (isDefender) {
        phaseStart = reactionDelay;
        phaseEnd = contactPhase;
      } else {
        phaseStart = Math.max(0.08, reactionDelay);
        phaseEnd = Math.max(phaseStart + 0.15, contactPhase);
      }

      let motionProgress = 0;
      if (scrubProgress !== null) {
        motionProgress = scrubProgress;
      } else if (phrase <= phaseStart) {
        motionProgress = 0;
      } else if (phrase >= phaseEnd) {
        motionProgress = 1;
      } else {
        const k = (phrase - phaseStart) / Math.max(0.01, phaseEnd - phaseStart);
        motionProgress = k * k * (3 - 2 * k);
      }

      if (Math.abs(angleDelta) > 0.005) {
        currentYaw = startYaw + angleDelta * motionProgress;
      }

      let x, y, z;

      if (isZeroDisp) {
        x = end[0];
        y = end[1];
        z = end[2];
      } else {
        const s = motionProgress;
        if (waypoint && Array.isArray(waypoint)) {
          const omt = 1 - s;
          x = omt * omt * start[0] + 2 * omt * s * waypoint[0] + s * s * end[0];
          y = omt * omt * start[1] + 2 * omt * s * waypoint[1] + s * s * end[1];
          z = omt * omt * start[2] + 2 * omt * s * waypoint[2] + s * s * end[2];
        } else {
          x = start[0] + (end[0] - start[0]) * s;
          y = start[1] + (end[1] - start[1]) * s;
          z = start[2] + (end[2] - start[2]) * s;
        }
      }

      // Реальное динамическое анти-проникновение: модели не проходят сквозь друг друга во время движения
      if (rootsRef && rootsRef.current && !isGround) {
        const otherRole = role === 'tori' ? 'uke1' : 'tori';
        const otherPos = rootsRef.current[otherRole];
        if (otherPos && Array.isArray(otherPos)) {
          const odx = x - otherPos[0];
          const odz = z - otherPos[2];
          const liveDist = Math.hypot(odx, odz);
          const isCloseContact = Boolean(combatOptions?.isGroundStep) ||
            combatOptions?.contactType === 'strike_above_elbow' ||
            combatOptions?.contactType === 'arm_strike' ||
            combatOptions?.contactType === 'block_gyaku_age_uke' ||
            combatOptions?.contactType === 'joint_lock' ||
            combatOptions?.contactType === 'sweep_fall' ||
            combatOptions?.contactType === 'sweep_finish' ||
            combatOptions?.contactType === 'ground_finish' ||
            combatOptions?.contactType === 'strike_throat';
          const minSeparation = isCloseContact ? 0.35 : 0.52; // Динамический анатомический зазор
          if (liveDist < minSeparation) {
            const push = (minSeparation - Math.max(0.001, liveDist)) * 0.5;
            const dirX = liveDist > 0.001 ? (odx / liveDist) : (role === 'uke1' ? 0.707 : -0.707);
            const dirZ = liveDist > 0.001 ? (odz / liveDist) : (role === 'uke1' ? 0.707 : -0.707);
            x += dirX * push;
            z += dirZ * push;
          }
        }
        rootsRef.current[role] = [x, y, z];
      }

      // Специальная обработка падения (страховка Укэми и фиксация лежа на татами)
      if (isGround && role === 'tori') {
        const isAlreadyFallen = start[1] >= 0.04 && start[1] <= 0.12 && end[1] >= 0.04 && end[1] <= 0.12;
        let fallSmooth = 1.0;
        if (!isAlreadyFallen) {
          const fallStartPhase = Math.max(0.20, Math.min(0.60, Number(delaySeconds) || 0.20));
          const fallProgress = Math.min(1.0, Math.max(0, (phrase - fallStartPhase) / 0.40));
          fallSmooth = fallProgress * fallProgress * (3 - 2 * fallProgress);
        }

        // Высота опускается к уровню татами
        y = THREE.MathUtils.lerp(modelYOffset, 0.08, fallSmooth);

        // Поворот тела на спину/бок для страховки Укэми
        groupRef.current.rotation.x = -Math.PI * 0.45 * fallSmooth;
        groupRef.current.rotation.z = Math.PI * 0.15 * fallSmooth;
      } else if (isRising && role === 'tori') {
        // Подъем с татами (Окиагари): выдержка паузы delaySeconds (напр. 0.30с), затем подъем в стойку Дзэнкуцу-дати
        const riseDelayFrac = Math.min(0.45, Math.max(0, (delaySeconds || 0) / Math.max(1.0, stepDuration || 2.4)));
        const riseProgress = Math.min(1.0, Math.max(0, (phrase - riseDelayFrac) / Math.max(0.2, 0.75 - riseDelayFrac)));
        const riseSmooth = riseProgress * riseProgress * (3 - 2 * riseProgress);

        y = THREE.MathUtils.lerp(0.08, modelYOffset, riseSmooth);
        groupRef.current.rotation.x = -Math.PI * 0.45 * (1.0 - riseSmooth);
        groupRef.current.rotation.z = Math.PI * 0.15 * (1.0 - riseSmooth);
      } else {
        // Стандартное положение стоя
        y += modelYOffset;
        groupRef.current.rotation.x = rotation ? (rotation[0] || 0) : 0;
        groupRef.current.rotation.z = rotation ? (rotation[2] || 0) : 0;
      }

      // Плавное сведение остаточного смещения при скачке между несоседними шагами (исключает телепортацию)
      let cuX = 0;
      let cuY = 0;
      let cuZ = 0;
      let cuYaw = 0;
      if (catchupOffsetRef.current.active && scrubProgress === null) {
        const cu = catchupOffsetRef.current;
        cu.elapsed = Math.min(cu.duration, cu.elapsed + Math.min(Math.max(delta, 0), 0.05));
        const p = cu.elapsed / Math.max(0.01, cu.duration);
        const rem = 1 - (p * p * (3 - 2 * p));
        cuX = cu.dx * rem;
        cuY = cu.dy * rem;
        cuZ = cu.dz * rem;
        cuYaw = cu.dYaw * rem;
        if (p >= 1) cu.active = false;
      }

      groupRef.current.position.set(x + cuX, y + cuY, z + cuZ);
      if (rootsRef) rootsRef.current[role] = [x + cuX, y + cuY, z + cuZ];

      if (!isGround || role !== 'tori') {
        groupRef.current.rotation.y = currentYaw + cuYaw;
      }
    }

    // Обновление миксера анимации: плавный непрерывный поток между техниками и стойками
    if (mixer && activeActionRef.current && prevStepKeyRef.current === stepKey) {
      fadeRemainingRef.current = Math.max(0, fadeRemainingRef.current - delta);
      const isCrossFading = fadeRemainingRef.current > 0;
      const curClip = activeActionRef.current.getClip();
      const curClipDuration = curClip?.duration || 1.0;
      const curClipName = (curClip?.name || '').toLowerCase();
      const activeSeqName = clipSequence[seqIndexRef.current] || clipSequence[0] || curClipName;
      const trimStart = seqIndexRef.current === 0 && curClip && !waitingStanceActiveRef.current
        ? getClipStartOffset(curClipName, curClipDuration)
        : 0;
      const holdEndTime = getClipHoldEndTime(curClipName || activeSeqName, curClipDuration);

      if (scrubProgress !== null) {
        const activeDur = Math.max(0.4, holdEndTime - trimStart);
        activeActionRef.current.time = trimStart + scrubProgress * activeDur;
        activeActionRef.current.paused = true;
        mixer.update(0);
      } else if (phrase >= 1.0) {
        activeActionRef.current.clampWhenFinished = true;
        activeActionRef.current.paused = true;
        mixer.update(isCrossFading ? delta : 0);
      } else if (isPlaying) {
        const lastClipInSeq = String(clipSequence[clipSequence.length - 1] || '').toLowerCase();
        const isLastTechnique = seqIndexRef.current >= clipSequence.length - 1;

        const isStrikeOrBlockAction = (
          curClipName.includes('zuki') ||
          curClipName.includes('tsuki') ||
          curClipName.includes('punch') ||
          curClipName.includes('strike') ||
          curClipName.includes('tettsui') ||
          curClipName.includes('shuto') ||
          curClipName.includes('empi') ||
          curClipName.includes('uraken') ||
          curClipName.includes('tate') ||
          curClipName.includes('uke') ||
          curClipName.includes('barai') ||
          lastClipInSeq.includes('zuki') ||
          lastClipInSeq.includes('tsuki') ||
          lastClipInSeq.includes('punch') ||
          lastClipInSeq.includes('strike') ||
          lastClipInSeq.includes('tettsui') ||
          lastClipInSeq.includes('shuto') ||
          lastClipInSeq.includes('empi')
        );

        const isClipFinished = activeActionRef.current.time >= (holdEndTime - 0.005);
        const alreadyInTargetLowerStance = curClipName === 'rei_bow' || curClipName.startsWith('mod_tech_tr_') || curClipName.startsWith('mod_sweep_') || curClipName.startsWith('mod_kick_') || curClipName.startsWith('mod_tr_') || curClipName.startsWith('mod_step_') || curClipName.startsWith('mod_hold_punch_');
        const needsStanceOverride = !alreadyInTargetLowerStance && (
          finalStance === 'stance_heisoku' ||
          finalStance === 'stance_shiko' ||
          finalStance === 'fudo_dachi' ||
          finalStance === 'fudo_dachi_right'
        );

        if (isLastTechnique && !needsStanceOverride && isClipFinished) {
          activeActionRef.current.time = holdEndTime;
          activeActionRef.current.clampWhenFinished = true;
          activeActionRef.current.paused = true;
          mixer.update(isCrossFading ? delta : 0);
        } else if (waitingStanceActiveRef.current && phrase < reactionDelay) {
          // Пока действует reactionDelay, Укэ плавно удерживает исходную стойку (включая завершение кроссфейда)
          activeActionRef.current.paused = false;
          mixer.update(delta);
        } else {
          activeActionRef.current.paused = false;
          const speedMultiplier = (isDefender && seqIndexRef.current === 0 && curClipName !== 'rei_bow') ? 1.15 : 1.0;
          mixer.update(delta * speed * speedMultiplier);
          if (activeActionRef.current.time > holdEndTime && isLastTechnique && !needsStanceOverride) {
            activeActionRef.current.time = holdEndTime;
            activeActionRef.current.paused = true;
            mixer.update(0);
          }
        }

        // Продвижение комбо-серий
        if (!waitingStanceActiveRef.current && curClip && clipSequence.length > 1 && seqIndexRef.current < clipSequence.length - 1) {
          const curDur = curClip.duration;
          if (activeActionRef.current.time >= curDur * 0.82) {
            seqIndexRef.current += 1;
            playSubclipAt(seqIndexRef.current, activeActionRef.current);
          }
        }

        if (!waitingStanceActiveRef.current && !alreadyInTargetLowerStance && (((isClipFinished || phrase >= 0.90) && !isStrikeOrBlockAction) || (phrase >= 0.85 && needsStanceOverride)) && !finalStanceAppliedRef.current && activeActionRef.current) {
          let targetStanceName = finalStance;
          const isKick = clipSequence.some((c) => typeof c === 'string' && (c.includes('mae_geri') || c.includes('kick') || c.includes('geri')));

          if (!targetStanceName && isKick) {
            if (landingMode === 'forward') {
              targetStanceName = (stance || '').includes('left') ? 'zenkutsu_dachi_right' : 'zenkutsu_dachi_left';
            } else if (landingMode === 'back') {
              targetStanceName = stance || 'zenkutsu_dachi_left';
            }
          }

          if (!targetStanceName) {
            const isStepMove = clipSequence.some((c) => typeof c === 'string' && (c.includes('step_backward') || c.includes('step_forward') || c.includes('slide_') || c.includes('enter_')));
            if (isStepMove && stance && stance !== 'ready' && stance !== 'heiko') {
              targetStanceName = stance === 'zenkutsu' ? 'zenkutsu_dachi_right' : (ACTION_ALIASES[stance] || stance);
            }
          }

          if (targetStanceName) {
            const targetClip = resolveRawClipByName(normalizeStanceKey(targetStanceName)) || resolveClipByName(targetStanceName);
            if (targetClip && activeActionRef.current.getClip() !== targetClip) {
              const stanceAction = mixer.clipAction(targetClip);
              stanceAction.reset();
              stanceAction.setEffectiveTimeScale(speed);
              stanceAction.setEffectiveWeight(1.0);
              stanceAction.setLoop(THREE.LoopOnce, 1);
              stanceAction.clampWhenFinished = true;
              fadeRemainingRef.current = 0.35;
              activeActionRef.current.crossFadeTo(stanceAction, 0.30, false);
              stanceAction.play();
              activeActionRef.current = stanceAction;
              finalStanceAppliedRef.current = true;
            }
          }
        }
      } else {
        activeActionRef.current.paused = true;
      }
    }

    const saveBonePoseOnce = (bone) => {
      if (bone && !savedBoneQuatsRef.current.has(bone)) {
        savedBoneQuatsRef.current.set(bone, bone.quaternion.clone());
      }
    };

    // Поклон (Рэй) 30° в стойке Мусуби-дати (для устаревших шагов без клипа rei_bow)
    const activeClipLowerForBow = String(activeActionRef.current?.getClip()?.name || clipSequence[0] || '').toLowerCase();
    if (combatOptions?.isBow && !isGround && bonesRef.current && !activeClipLowerForBow.includes('rei_bow')) {
      const bowBone = findRigBone(bonesRef.current, 'spine') || findRigBone(bonesRef.current, 'chest');
      const neckBone = findRigBone(bonesRef.current, 'neck');
      if (bowBone && phrase >= 0.15 && phrase <= 0.85) {
        saveBonePoseOnce(bowBone);
        saveBonePoseOnce(neckBone);
        const k = (phrase - 0.15) / 0.70;
        const bowAngle = Math.sin(k * Math.PI) * 0.52;
        bowBone.rotation.x += bowAngle;
        if (neckBone) neckBone.rotation.x += bowAngle * 0.25;
      }
    }

    // Поза Укэми при падении и положении лежа: страховка левой рукой и правая нога скрестно поверх левой
    if (isGround && role === 'tori' && bonesRef.current) {
      const isAlreadyFallen = startPosition && startPosition[1] <= 0.12 && position[1] <= 0.12;
      const fallStartPhase = Math.max(0.20, Math.min(0.60, Number(delaySeconds) || 0.20));
      const fallFactor = isAlreadyFallen ? 1.0 : Math.min(1.0, Math.max(0, (phrase - fallStartPhase) / 0.40));
      if (fallFactor > 0.05) {
        const legR = findRigBone(bonesRef.current, 'upperLegR');
        const shinR = findRigBone(bonesRef.current, 'lowerLegR');
        const armL = findRigBone(bonesRef.current, 'upperArmL');
        saveBonePoseOnce(legR);
        saveBonePoseOnce(shinR);
        saveBonePoseOnce(armL);
        if (legR) {
          legR.rotation.z += 0.28 * fallFactor;
          legR.rotation.x -= 0.35 * fallFactor;
        }
        if (shinR) {
          shinR.rotation.x += 0.55 * fallFactor;
        }
        if (armL) {
          armL.rotation.z -= 0.65 * fallFactor;
        }
      }
    }

    // Ограниченная мягкая IK-подстройка для точной имитации контакта без искажения готовых клипов
    if (bonesRef.current && trackedJointsRef && trackedJointsRef.current && combatOptions?.contactType && combatOptions.contactType !== 'none' && combatOptions.contactType !== 'distance_only') {
      const oppRole = (role === 'tori') ? 'uke1' : 'tori';
      const oppJoints = trackedJointsRef.current[oppRole];
      if (oppJoints && oppJoints.isExtracted) {
        ['upperArmL', 'foreArmL', 'handL', 'upperArmR', 'foreArmR', 'handR', 'spine', 'chest', 'upperLegL', 'lowerLegL', 'footL', 'upperLegR', 'lowerLegR', 'footR'].forEach((k) => {
          saveBonePoseOnce(findRigBone(bonesRef.current, k));
        });
        const curClipName = activeActionRef.current?.getClip()?.name || clipSequence[seqIndexRef.current] || clipSequence[0];
        try {
          applyProceduralCombatIK(
            bonesRef.current,
            role,
            curClipName,
            oppJoints,
            phrase,
            combatOptions || { ikContactTime, interactionType }
          );
        } catch {
          /* ignore ik frame error */
        }
      }
    }

    // Экспорт сочленений для анатомической системы BodyColliderSystem
    if (onTrackJoints && bonesRef.current && groupRef.current) {
      try {
        groupRef.current.updateMatrixWorld(true);
        const joints = extractAvatarJointPositions(bonesRef.current, groupRef.current);
        onTrackJoints(role, joints);
      } catch {
        /* ignore frame tracking error */
      }
    } else if (onTrackBones && bonesRef.current) {
      const chest = findRigBone(bonesRef.current, 'chest') || findRigBone(bonesRef.current, 'hips');
      const hand = findRigBone(bonesRef.current, 'handR') || findRigBone(bonesRef.current, 'handL');
      if (chest && typeof chest.getWorldPosition === 'function') {
        const chestPos = new THREE.Vector3();
        try { chest.getWorldPosition(chestPos); } catch { /* ignore */ }
        const handPos = new THREE.Vector3();
        if (hand && typeof hand.getWorldPosition === 'function') {
          try { hand.getWorldPosition(handPos); } catch { /* ignore */ }
        }
        onTrackBones(role, { chest: chestPos, hand: handPos });
      }
    }
  });

  const stableScale = useMemo(() => [modelScale, modelScale, modelScale], [modelScale]);

  return (
    <group
      ref={groupRef}
      scale={stableScale}
    >
      <primitive object={clonedModel} />
    </group>
  );
}

useGLTF.preload('/models/karateka_techniques_v4.glb');
