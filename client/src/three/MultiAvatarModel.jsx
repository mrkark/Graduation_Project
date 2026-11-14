import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { HEIAN_SHODAN_CANONICAL_EVENTS } from './kataMotionUtils';
import { animationRegistry } from './animationRegistry';
import { resolveBunkaiClip } from './bunkaiScenarioEngine';
import { findRigBone, extractAvatarJointPositions } from './bodyColliderSystem';

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
  fudo: 'fudo_dachi',
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
    subclipCache.set(key, sub);
    return sub;
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
          const clip = THREE.AnimationClip.parse(json);
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
  position = [0, 0, 0],
  startPosition = null,
  rotation = [0, 0, 0],
  startRotation = null,
  isStationary = false,
  speed = 1.0,
  isPlaying = true,
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

    let giColor = '#faf9f6'; // Белоснежное доги Тори (атакующий)
    let beltColor = '#141414'; // Черный пояс 5-й Дан

    if (role === 'uke' || role === 'uke1') {
      giColor = '#243346'; // Традиционное индиго доги Укэ (защищающийся)
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
  const [clipCacheVersion, setClipCacheVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (animations && animations.length > 0) {
        animations.forEach((c) => globalClipCache.set(c.name, c));
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

    const action = mixer.clipAction(playable);
    action.reset();
    action.enabled = true;

    // Для комбо-серий ускоряем выполнение техник, чтобы связка уложилась в длительность шага
    const comboMultiplier = clipSequence.length === 2 ? 1.45 : clipSequence.length >= 3 ? 1.85 : 1.0;
    action.setEffectiveTimeScale(speed * comboMultiplier);
    action.setEffectiveWeight(1.0);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;

    if (prevAct && prevAct !== action) {
      action.reset();
      action.setEffectiveTimeScale(speed * comboMultiplier);
      action.setEffectiveWeight(1.0);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.crossFadeFrom(prevAct, 0.25, true);
      action.play();
    } else {
      action.reset();
      action.setEffectiveTimeScale(speed * comboMultiplier);
      action.setEffectiveWeight(1.0);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
    }

    if (scrubProgress !== null) {
      action.time = scrubProgress * playable.duration;
      action.paused = true;
      mixer.update(0);
    } else {
      action.paused = !isPlaying;
    }

    activeActionRef.current = action;
  }, [mixer, clipSequence, resolveClipByName, speed, isPlaying, scrubProgress, role, onMissingClip, clipCacheVersion]);

  // Запуск первой техники шага с кроссфейдом из предыдущей стойки
  useEffect(() => {
    seqIndexRef.current = 0;
    playSubclipAt(0, activeActionRef.current);
  }, [clipSequenceKey, playSubclipAt]);

  // Реакция на паузу и изменение скорости
  useEffect(() => {
    if (activeActionRef.current) {
      activeActionRef.current.paused = !isPlaying;
      const comboMultiplier = clipSequence.length === 2 ? 1.45 : clipSequence.length >= 3 ? 1.85 : 1.0;
      activeActionRef.current.setEffectiveTimeScale(speed * comboMultiplier);
    }
  }, [isPlaying, speed, clipSequence.length]);

  // По кадровое обновление положения, позы и предотвращение проникновения
  useFrame((_, delta) => {
    const phrase = phraseRef ? phraseRef.current : 0;

    if (groupRef.current) {
      const start = startPosition || position;
      const end = position;

      let x, y, z;

      // Если техника выполняется на месте (Хэйко-дати, Мусуби-дати, удар на месте)
      // или смещение отсутствует: фиксируем точную позицию БЕЗ интерполяции по полу
      const isZeroDisp = Math.abs(end[0] - start[0]) < 0.005 && Math.abs(end[2] - start[2]) < 0.005;
      if (isStationary || isZeroDisp) {
        x = end[0];
        y = end[1];
        z = end[2];
      } else {
        // Фазово-синхронизированное перемещение шага:
        // 0.00 .. 0.18: Подготовка / замах — стопы жестко прижаты к татами (0% смещения)
        // 0.18 .. 0.72: Перенос ноги и перемещение центра тяжести (кубическая кривая эрмита)
        // 0.72 .. 1.00: Фиксация стойки (кимэ) — модель жестко зафиксирована в конечной точке (100%)
        let s = 0;
        if (phrase <= 0.18) {
          s = 0;
        } else if (phrase >= 0.72) {
          s = 1;
        } else {
          const k = (phrase - 0.18) / 0.54;
          s = k * k * (3 - 2 * k);
        }
        x = start[0] + (end[0] - start[0]) * s;
        y = start[1] + (end[1] - start[1]) * s;
        z = start[2] + (end[2] - start[2]) * s;
      }

      // Экспорт текущей опорной координаты для мониторинга дистанции
      if (rootsRef && rootsRef.current) {
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

      // Точная сценарная ориентация (Yaw) с плавной интерполяцией при поворотах/разворотах
      if (!isGround || role !== 'tori') {
        const startYaw = (startRotation && startRotation[1] !== undefined)
          ? startRotation[1]
          : ((rotation && rotation[1] !== undefined) ? rotation[1] : 0);
        const endYaw = (rotation && rotation[1] !== undefined) ? rotation[1] : startYaw;

        let currentYaw = endYaw;
        if (Math.abs(endYaw - startYaw) > 0.01) {
          let rProgress = 0;
          if (phrase <= 0.18) {
            rProgress = 0;
          } else if (phrase >= 0.72) {
            rProgress = 1;
          } else {
            const k = (phrase - 0.18) / 0.54;
            rProgress = k * k * (3 - 2 * k);
          }
          let diff = endYaw - startYaw;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          currentYaw = startYaw + diff * rProgress;
        }
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
        activeActionRef.current.paused = false;
        mixer.update(delta * speed);

        // Продвижение комбо-серий (Маэ-гэри -> Гяку-дзуки -> Тэтцуи и т.д.):
        const curClip = activeActionRef.current.getClip();
        if (curClip && clipSequence.length > 1 && seqIndexRef.current < clipSequence.length - 1) {
          const curDur = curClip.duration;
          // При достижении 82% длительности текущей техники начинаем плавный переход к следующей
          if (activeActionRef.current.time >= curDur * 0.82) {
            seqIndexRef.current += 1;
            playSubclipAt(seqIndexRef.current, activeActionRef.current);
          }
        }
      } else {
        activeActionRef.current.paused = true;
      }
    }

    // Экспорт сочленений для анатомической системы BodyColliderSystem
    if (onTrackJoints && bonesRef.current && groupRef.current) {
      try {
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
