import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { HEIAN_SHODAN_CANONICAL_EVENTS } from './kataMotionUtils';
import { animationRegistry } from './animationRegistry';
import { resolveBunkaiClip, isTechniqueStationary } from './bunkaiScenarioEngine';
import { findRigBone, extractAvatarJointPositions, applyProceduralCombatIK } from './bodyColliderSystem';
import { patchAgeUkeClip, makeClipInPlace } from './modularAnimationEngine.js';

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
  fudo_dachi_right: 'fudo_dachi',
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
  stance_heisoku: 'stance_heisoku',
  heisoku: 'stance_heisoku',

  // Аутентичные техники ударов и блоков каратэ Шотокан (чистые клипы без искажений скелета)
  oi_zuki: 'oi_zuki_right',
  oi_zuki_right: 'oi_zuki_right',
  oi_zuki_left: 'oi_zuki_left',
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
  haivan_uke: 'tech_haishu_uke_left',
  tech_haivan_uke: 'tech_haishu_uke_left',
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
  step_backward_right: 'zenkutsu_dachi_right',
  turn_into_zenkutsu_right: 'turn_into_zenkutsu_right',
  turn_and_enter_zenkutsu: 'zenkutsu_dachi_left',
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
  rotation = [0, 0, 0],
  startRotation = null,
  isStationary = false,
  speed = 1.0,
  isPlaying = true,
  replayTrigger = 0,
  scrubProgress = null,
  timelineTime = null,
  delaySeconds = 0,
  waitingClip = null,
  ikTarget = null,
  ikContactTime = 0.48,
  interactionType = 'body_contact',
  isGround = false,
  isRising = false,
  onMissingClip = null,
  onTrackBones = null,
  onTrackJoints = null,
  phraseRef = null,
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
  const [clipCacheVersion, setClipCacheVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (animations && animations.length > 0) {
        animations.forEach((c) => {
          const patched = makeClipInPlace(patchAgeUkeClip(c, c.name));
          globalClipCache.set(c.name, patched);
        });
        Object.entries(ACTION_ALIASES).forEach(([k, v]) => {
          if (globalClipCache.has(v)) globalClipCache.set(k, globalClipCache.get(v));
        });
      }
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

  // Разрешение имени отдельной техники в отфильтрованный AnimationClip
  const resolveClipByName = useCallback((rawName) => {
    if (!rawName) return null;
    const name = rawName.trim();

    // Канонический подклип ката Хэйан Шодан
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

  const seqIndexRef = useRef(0);
  const clipSequenceKey = useMemo(() => clipSequence.join('__'), [clipSequence]);
  const prevPhraseRef = useRef(0);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const scrubProgressRef = useRef(scrubProgress);
  scrubProgressRef.current = scrubProgress;

  // Запуск конкретного элемента комбо с плавным переходом из предыдущей стойки/удара
  const playSubclipAt = useCallback((idx, prevAct = null) => {
    if (!mixer || !clipSequence[idx]) return;
    const playable = resolveClipByName(clipSequence[idx]);
    if (!playable) {
      if (clipCacheVersion > 0) {
        animationRegistry.reportMissing(clipSequence[idx], {
          role,
          context: `MultiAvatarModel sequence player for role ${role}`,
        });
        if (onMissingClip) onMissingClip(clipSequence[idx]);
      }
      return;
    }

    const curSpeed = speedRef.current;
    const curIsPlaying = isPlayingRef.current;
    const curScrub = scrubProgressRef.current;

    const action = mixer.clipAction(playable);
    const comboMultiplier = clipSequence.length === 2 ? 1.45 : clipSequence.length === 3 ? 1.9 : clipSequence.length >= 4 ? 2.4 : 1.0;

    if (prevAct && prevAct !== action) {
      // Плавный бесшовный переход из предыдущего состояния без дерганий и сброса в bind-pose
      action.reset();
      action.enabled = true;
      action.setEffectiveTimeScale(curSpeed * comboMultiplier);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      const crossSec = idx === 0 ? 0.28 : 0.20;
      prevAct.crossFadeTo(action, crossSec, true);
    } else if (prevAct === action) {
      // Тот же самый клип/стойка: НЕ сбрасываем в кадр 0, чтобы исключить дергания!
      action.enabled = true;
      action.setEffectiveTimeScale(curSpeed * comboMultiplier);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      if (action.time >= (playable.duration - 0.05)) {
        action.time = playable.duration;
        action.paused = true;
      }
    } else {
      action.reset();
      action.enabled = true;
      action.setEffectiveTimeScale(curSpeed * comboMultiplier);
      action.setEffectiveWeight(1.0);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
    }

    if (curScrub !== null) {
      action.time = curScrub * playable.duration;
      action.paused = true;
      mixer.update(0);
    } else {
      action.paused = !curIsPlaying;
    }

    activeActionRef.current = action;
  }, [mixer, clipSequenceKey, resolveClipByName, role, onMissingClip, clipCacheVersion]);

  // Запуск первой техники шага с кроссфейдом из предыдущей стойки или мгновенный повтор
  useEffect(() => {
    seqIndexRef.current = 0;
    finalStanceAppliedRef.current = false;
    playSubclipAt(0, activeActionRef.current);
  }, [clipSequenceKey, playSubclipAt, finalStance, landingMode, replayTrigger]);

  // Реакция на паузу и изменение скорости
  useEffect(() => {
    if (activeActionRef.current) {
      activeActionRef.current.paused = !isPlaying;
      const comboMultiplier = clipSequence.length === 2 ? 1.45 : clipSequence.length === 3 ? 1.9 : clipSequence.length >= 4 ? 2.4 : 1.0;
      activeActionRef.current.setEffectiveTimeScale(speed * comboMultiplier);
    }
  }, [isPlaying, speed, clipSequence.length]);

  // По кадровое обновление положения, позы и предотвращение проникновения
  useFrame((_, delta) => {
    const rawPhrase = scrubProgress !== null ? scrubProgress : (phraseRef ? phraseRef.current : 0);
    const phrase = Math.min(1.0, Math.max(0, rawPhrase));
    const isDefender = (role === 'uke' || role === 'uke1') && !isGround;
    const contactPhase = combatOptions?.ikContactTime || ikContactTime || 0.48;

    // Задержка реакции защищающегося (Укэ):
    // В реальном боевом взаимодействии атакующий (Тори) начинает движение первым.
    // Защищающийся (Укэ) оценивает атаку и реагирует с естественной задержкой реакции (~0.12-0.18 фазы шага).
    const reactionDelay = isDefender ? Math.max(0.12, Math.min(0.20, (delaySeconds || 0.16))) : 0.0;

    // Мгновенный перезапуск анимации при циклировании шага или перемотке в начало (0.00с)
    if (prevPhraseRef.current > 0.70 && phrase < 0.10) {
      seqIndexRef.current = 0;
      finalStanceAppliedRef.current = false;
      playSubclipAt(0, activeActionRef.current);
    }
    prevPhraseRef.current = phrase;

    if (phrase < 0.25) {
      finalStanceAppliedRef.current = false;
    }

    if (groupRef.current) {
      const start = startPosition || position;
      const end = position;

      const clipNames = clipSequence.map((c) => (typeof c === 'string' ? c : c?.name || '')).join(' ').toLowerCase();

      // Точная сценарная ориентация (Yaw) с плавной интерполяцией при поворотах/разворотах
      const startYaw = (startRotation && startRotation[1] !== undefined)
        ? startRotation[1]
        : ((rotation && rotation[1] !== undefined) ? rotation[1] : 0);
      const endYaw = (rotation && rotation[1] !== undefined) ? rotation[1] : startYaw;

      let currentYaw = endYaw;
      const angleDelta = Math.atan2(Math.sin(endYaw - startYaw), Math.cos(endYaw - startYaw));

      if (Math.abs(angleDelta) > 0.005) {
        let rProgress = 0;
        const isTurnTechnique = clipNames.includes('turn') || Math.abs(angleDelta) > 0.75;

        if (scrubProgress !== null) {
          // При перемотке таймлайна (scrubbing) вращение строго следует за положением ползунка
          rProgress = scrubProgress;
        } else if (phrase >= 1.0) {
          rProgress = 1.0;
        } else if (isTurnTechnique) {
          // Для разворотов тела (Маваттэ / поворот на 90°/180°):
          // Модель начинает поворот сразу с первого кадра (0.0 .. 0.75) без задержки!
          const k = Math.min(1.0, Math.max(0, phrase / 0.75));
          rProgress = k * k * (3 - 2 * k);
        } else if (isDefender) {
          // Для защищающегося (Тай-сабаки + блок): поворот тела синхронизируется с шагом ухода
          // и завершается точно к моменту контакта блока (contactPhase ~0.48), чтобы встретить атаку лицом к противнику
          if (phrase <= reactionDelay) {
            rProgress = 0;
          } else if (phrase >= contactPhase) {
            rProgress = 1;
          } else {
            const k = (phrase - reactionDelay) / Math.max(0.01, contactPhase - reactionDelay);
            rProgress = k * k * (3 - 2 * k);
          }
        } else {
          if (phrase <= 0.08) {
            rProgress = 0;
          } else if (phrase >= 0.65) {
            rProgress = 1;
          } else {
            const k = (phrase - 0.08) / 0.57;
            rProgress = k * k * (3 - 2 * k);
          }
        }
        currentYaw = startYaw + angleDelta * rProgress;
      }

      let x, y, z;

      // Если смещение отсутствует (техника на месте, Хэйко-дати, удар/блок на месте):
      // Модель не должна стоять неподвижной статуей! Она должна выполнять полное динамическое
      // движение (выпад центра массы к цели на моменте кимэ и возврат обратно в стойку).
      const isZeroDisp = Math.abs(end[0] - start[0]) < 0.005 && Math.abs(end[2] - start[2]) < 0.005;

      const isKick = clipNames.includes('mae_geri') || clipNames.includes('kick') || clipNames.includes('geri');
      const isStrike = clipNames.includes('zuki') || clipNames.includes('tsuki') || clipNames.includes('punch') ||
        clipNames.includes('strike') || clipNames.includes('tettsui') || clipNames.includes('shuto') ||
        clipNames.includes('empi') || clipNames.includes('uraken') || clipNames.includes('tate');
      const isBlock = clipNames.includes('uke') || clipNames.includes('barai');
      const isMovement = clipNames.includes('step') || clipNames.includes('slide') || clipNames.includes('shift');
      const hasActiveAction = isKick || isStrike || isBlock || isMovement || !isStationary;

      if ((isStationary || isZeroDisp) && !isGround && hasActiveAction) {
        // Полный биомеханический цикл движения (Surge & Return) при совпадении начальной и конечной позиции:
        // Модель выполняет полноценный динамический выпад центра массы к цели с пиком на акценте удара/блока
        // и плавный возврат точно в исходную стойку к концу шага (phrase = 1.0).
        let surgeDist = 0.18;
        if (isKick) {
          surgeDist = 0.32; // Удары ногами (Маэ-гэри с возвратом ноги назад)
        } else if (isStrike) {
          surgeDist = 0.22; // Прямые и реверсивные удары руками
        } else if (isBlock) {
          surgeDist = 0.14; // Блокирующие техники
        }

        let surge = 0;
        const startSurge = isDefender ? reactionDelay : 0.08;
        if (phrase <= startSurge) {
          surge = 0;
        } else if (phrase <= contactPhase) {
          const k = (phrase - startSurge) / Math.max(0.01, contactPhase - startSurge);
          surge = Math.sin(k * Math.PI * 0.5);
        } else if (phrase <= 0.95) {
          const k = (phrase - contactPhase) / Math.max(0.01, 0.95 - contactPhase);
          surge = Math.cos(k * Math.PI * 0.5);
        } else {
          surge = 0;
        }

        const fwdX = Math.sin(currentYaw);
        const fwdZ = Math.cos(currentYaw);

        x = end[0] + fwdX * surgeDist * surge;
        y = end[1];
        z = end[2] + fwdZ * surgeDist * surge;
      } else if (isStationary || isZeroDisp) {
        x = end[0];
        y = end[1];
        z = end[2];
      } else if (isDefender) {
        // Перемещение защищающегося (Тай-сабаки):
        // До момента реакции (phrase <= reactionDelay) Укэ стоит прочно на месте в исходной позиции.
        // Затем плавно уходит с линии атаки и фиксирует стойку точно к моменту контакта (contactPhase ~0.48).
        let s = 0;
        if (scrubProgress !== null) {
          s = scrubProgress;
        } else if (phrase <= reactionDelay) {
          s = 0;
        } else if (phrase >= contactPhase) {
          s = 1;
        } else {
          const k = (phrase - reactionDelay) / (contactPhase - reactionDelay);
          s = k * k * (3 - 2 * k);
        }
        x = start[0] + (end[0] - start[0]) * s;
        y = start[1] + (end[1] - start[1]) * s;
        z = start[2] + (end[2] - start[2]) * s;
      } else {
        // Перемещение атакующего (Тори): начинает выпад после замаха (0.08 .. contactPhase)
        let s = 0;
        if (scrubProgress !== null) {
          s = scrubProgress;
        } else if (phrase <= 0.08) {
          s = 0;
        } else if (phrase >= contactPhase) {
          s = 1;
        } else {
          const k = (phrase - 0.08) / (contactPhase - 0.08);
          s = k * k * (3 - 2 * k);
        }
        x = start[0] + (end[0] - start[0]) * s;
        y = start[1] + (end[1] - start[1]) * s;
        z = start[2] + (end[2] - start[2]) * s;
      }

      // Реальное динамическое анти-проникновение: модели не проходят сквозь друг друга во время движения
      if (rootsRef && rootsRef.current && !isGround) {
        const otherRole = role === 'tori' ? 'uke1' : 'tori';
        const otherPos = rootsRef.current[otherRole];
        if (otherPos && Array.isArray(otherPos)) {
          const odx = x - otherPos[0];
          const odz = z - otherPos[2];
          const liveDist = Math.hypot(odx, odz);
          const isCloseContact = combatOptions?.contactType === 'strike_above_elbow' ||
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

      // Специальная обработка падения (Шаг 13: подсечка Аши-барай и страховка Укэми, Шаг 14: лежа на татами)
      if (isGround && role === 'tori') {
        const isAlreadyFallen = start[1] <= 0.12 && end[1] <= 0.12;
        let fallSmooth = 1.0;
        if (!isAlreadyFallen) {
          const fallProgress = Math.min(1.0, Math.max(0, (phrase - 0.20) / 0.45));
          fallSmooth = fallProgress * fallProgress * (3 - 2 * fallProgress);
        }

        // Высота опускается к уровню татами
        y = THREE.MathUtils.lerp(modelYOffset, 0.08, fallSmooth);

        // Поворот тела на спину/бок для страховки Укэми
        groupRef.current.rotation.x = -Math.PI * 0.45 * fallSmooth;
        groupRef.current.rotation.z = Math.PI * 0.15 * fallSmooth;
      } else if (isRising && role === 'tori') {
        // Подъем с татами (Шаг 15): переход из положения лежа в стойку Дзэнкуцу-дати
        const riseProgress = Math.min(1.0, Math.max(0, phrase / 0.70));
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

      groupRef.current.position.set(x, y, z);
      if (rootsRef) rootsRef.current[role] = [x, y, z];

      if (!isGround || role !== 'tori') {
        groupRef.current.rotation.y = currentYaw;
      }
    }

    // Обновление миксера анимации: плавный непрерывный поток между техниками и стойками
    if (mixer && activeActionRef.current) {
      if (scrubProgress !== null) {
        activeActionRef.current.time = scrubProgress * activeActionRef.current.getClip().duration;
        activeActionRef.current.paused = true;
        mixer.update(0);
      } else if (isPlaying) {
        const curClip = activeActionRef.current.getClip();
        const curClipDuration = curClip?.duration || 1.0;
        const curClipName = (curClip?.name || '').toLowerCase();
        const lastClipInSeq = String(clipSequence[clipSequence.length - 1] || '').toLowerCase();
        const isLastTechnique = seqIndexRef.current >= clipSequence.length - 1;

        // КРИТИЧЕСКОЕ ТРЕБОВАНИЕ: если модель закончила движение ударом или блоком (например, гяку-дзуки),
        // НЕ сбрасывать состояние в нейтральную стойку! Модель должна зафиксировать удар (Кимэ) и остаться в нем.
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

        const isClipFinished = activeActionRef.current.time >= (curClipDuration - 0.002);

        if (isLastTechnique && (isClipFinished || (isStrikeOrBlockAction && activeActionRef.current.time >= curClipDuration * 0.98))) {
          // Действие полностью завершено: надежно удерживаем позу (Kime) без сброса
          activeActionRef.current.time = curClipDuration;
          activeActionRef.current.clampWhenFinished = true;
          activeActionRef.current.paused = true;
          mixer.update(0);
        } else if (isDefender && phrase < reactionDelay && scrubProgress === null) {
          // Задержка реакции защищающегося (Укэ):
          // До наступления reactionDelay защищающийся сохраняет исходную позу без дерганий и преждевременного движения
          activeActionRef.current.paused = true;
          mixer.update(0);
        } else {
          activeActionRef.current.paused = false;
          // Для защищающегося слегка масштабируем скорость блока, чтобы он встретил атаку точно в момент контакта
          const speedMultiplier = (isDefender && seqIndexRef.current === 0) ? 1.25 : 1.0;
          mixer.update(delta * speed * speedMultiplier);
        }

        // Продвижение комбо-серий (Маэ-гэри -> Гяку-дзуки -> Тэтцуи и т.д.):
        if (curClip && clipSequence.length > 1 && seqIndexRef.current < clipSequence.length - 1) {
          const curDur = curClip.duration;
          // При достижении 82% длительности текущей техники начинаем плавный переход к следующей
          if (activeActionRef.current.time >= curDur * 0.82) {
            seqIndexRef.current += 1;
            playSubclipAt(seqIndexRef.current, activeActionRef.current);
          }
        }

        if (phrase >= 0.95 && !finalStanceAppliedRef.current && !isStrikeOrBlockAction && activeActionRef.current) {
          // Только для чистых перемещений или изолированных ударов ногами (без завершающего удара рукой)
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
            const isStepMove = clipSequence.some((c) => typeof c === 'string' && (c.includes('step_backward') || c.includes('step_forward') || c.includes('slide_')));
            if (isStepMove && stance && stance !== 'ready' && stance !== 'heiko') {
              targetStanceName = stance === 'zenkutsu' ? 'zenkutsu_dachi_right' : (ACTION_ALIASES[stance] || stance);
            }
          }

          if (targetStanceName) {
            const targetClip = resolveClipByName(targetStanceName);
            if (targetClip && activeActionRef.current.getClip() !== targetClip) {
              const stanceAction = mixer.clipAction(targetClip);
              stanceAction.reset();
              stanceAction.setEffectiveTimeScale(speed);
              stanceAction.setEffectiveWeight(1.0);
              stanceAction.setLoop(THREE.LoopOnce, 1);
              stanceAction.clampWhenFinished = true;
              activeActionRef.current.crossFadeTo(stanceAction, 0.24, true);
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

    // Поклон (Рэй) в стойке Мусуби-дати (Шаги 2 и 17)
    if (combatOptions?.isBow && bonesRef.current) {
      const bowBone = findRigBone(bonesRef.current, 'spine') || findRigBone(bonesRef.current, 'chest');
      const neckBone = findRigBone(bonesRef.current, 'neck');
      if (bowBone && phrase >= 0.15 && phrase <= 0.85) {
        const k = (phrase - 0.15) / 0.70;
        const bowAngle = Math.sin(k * Math.PI) * 0.38;
        bowBone.rotation.x += bowAngle;
        if (neckBone) neckBone.rotation.x += bowAngle * 0.25;
      }
    }

    // Поза Укэми при падении (Шаг 13-14): страховка левой рукой и правая нога скрестно поверх левой
    if (isGround && role === 'tori' && bonesRef.current) {
      const isAlreadyFallen = startPosition && startPosition[1] <= 0.12 && position[1] <= 0.12;
      const fallFactor = isAlreadyFallen ? 1.0 : Math.min(1.0, Math.max(0, (phrase - 0.20) / 0.45));
      if (fallFactor > 0.05) {
        const legR = findRigBone(bonesRef.current, 'upperLegR');
        const shinR = findRigBone(bonesRef.current, 'lowerLegR');
        const armL = findRigBone(bonesRef.current, 'upperArmL');
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

    // Процедурная боевая IK-подстройка: динамическое изменение углов блоков и контакт конечностей
    if (bonesRef.current && trackedJointsRef && trackedJointsRef.current) {
      const oppRole = (role === 'tori') ? 'uke1' : 'tori';
      const oppJoints = trackedJointsRef.current[oppRole];
      if (oppJoints && oppJoints.isExtracted) {
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
