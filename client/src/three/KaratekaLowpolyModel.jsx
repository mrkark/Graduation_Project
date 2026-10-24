import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

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
};

export const ACTION_ALIASES = {
  // Удары руками (Цуки и Учи)
  choku_zuki: 'chudan_zuki_right',
  oi_zuki: 'oi_zuki_right',
  gyaku_zuki: 'gyaku_zuki_right',
  jodan_zuki: 'jodan_zuki_right',
  chudan_zuki: 'chudan_zuki_right',
  kizami_zuki: 'jodan_zuki_right',
  ren_zuki: 'tech_gyaku_zuki_right',
  sanbon_zuki: 'tech_oi_zuki_right',
  uraken_uchi: 'tech_uraken_right',
  tetsui_uchi: 'tech_tettsui_right',
  empi_uchi: 'tech_mae_empi_right',
  shuto_uchi: 'tech_shuto_uchi_right',
  morote_zuki: 'tech_morote_zuki_right',
  hook: 'tech_kagi_zuki_right',

  // Защитные блоки (Укэ)
  gedan_barai: 'gedan_barai_left',
  age_uke: 'age_uke_left',
  soto_uke: 'soto_uke_left',
  uchi_uke: 'tech_uchi_uke_left',
  shuto_uke: 'tech_shuto_uke_left',
  manji_uke: 'tech_manji_uke_left',

  // Удары ногами (Гэри)
  mae_geri: 'kick_mae_geri_right',
  yoko_geri: 'kick_yoko_kekomi_right',
  mawashi_geri: 'kick_mawashi_right',
  ushiro_geri: 'kick_ushiro_right',
  kick: 'kick_mae_geri_right',

  // Шаги и перемещения
  step: 'step_forward',

  // Стойки (Дати)
  ready: 'idle_shizentai',
  shizentai: 'idle_shizentai',
  zenkutsu: 'zenkutsu_dachi_left',
  kokutsu: 'kokutsu_dachi_left',
  heiko: 'heiko_dachi',
  fudo: 'fudo_dachi',
  kiba: 'kiba_dachi',
  moto: 'stance_moto_right',

  // Мастер-ката
  heian_shodan: 'heian_shodan_preview',
};

export function resolveClip(name) {
  if (!name) return null;
  if (globalClipCache.has(name)) return globalClipCache.get(name);
  const alias = ACTION_ALIASES[name];
  if (alias && globalClipCache.has(alias)) return globalClipCache.get(alias);
  return null;
}

function getStanceClipName(stanceName) {
  if (!stanceName) return globalClipCache.has('idle_shizentai') ? 'idle_shizentai' : 'stance_ready';
  if (globalClipCache.has(stanceName)) return stanceName;
  if (ACTION_ALIASES[stanceName] && globalClipCache.has(ACTION_ALIASES[stanceName])) {
    return ACTION_ALIASES[stanceName];
  }
  switch (stanceName) {
    case 'ready':
      return globalClipCache.has('idle_shizentai') ? 'idle_shizentai' : 'stance_ready';
    case 'zenkutsu':
      return globalClipCache.has('zenkutsu_dachi_left') ? 'zenkutsu_dachi_left' : 'stance_zenkutsu';
    case 'kokutsu':
      return globalClipCache.has('kokutsu_dachi_left') ? 'kokutsu_dachi_left' : 'stance_kokutsu';
    case 'moto':
      return globalClipCache.has('stance_moto_right') ? 'stance_moto_right' : (globalClipCache.has('stance_moto_left') ? 'stance_moto_left' : 'stance_ready');
    case 'heiko':
      return globalClipCache.has('heiko_dachi') ? 'heiko_dachi' : 'stance_ready';
    case 'fudo':
      return globalClipCache.has('fudo_dachi') ? 'fudo_dachi' : 'stance_fudo';
    case 'kiba':
      return 'stance_kiba';
    case 'gankaku':
    case 'tsuruashi':
      return 'stance_gankaku';
    case 'gedan_barai':
      return globalClipCache.has('gedan_barai_left') ? 'gedan_barai_left' : 'gedan_barai';
    case 'age_uke':
      return globalClipCache.has('age_uke_left') ? 'age_uke_left' : 'age_uke';
    case 'empi_uchi':
      return 'empi_uchi';
    case 'gyaku_zuki':
      return globalClipCache.has('gyaku_zuki_right') ? 'gyaku_zuki_right' : 'gyaku_zuki';
    case 'oi_zuki':
      return globalClipCache.has('oi_zuki_right') ? 'oi_zuki_right' : 'oi_zuki';
    case 'shuto_uke':
      return 'shuto_uke';
    default:
      if (globalClipCache.has(stanceName)) return stanceName;
      if (CLIP_FILES[stanceName]) return stanceName;
      if (CLIP_FILES[`stance_${stanceName}`]) return `stance_${stanceName}`;
      return globalClipCache.has('idle_shizentai') ? 'idle_shizentai' : 'stance_ready';
  }
}

// Глобальный кэш распарсенных AnimationClip
const globalClipCache = new Map();
let globalClipPromise = null;

const gltfLoader = new GLTFLoader();
const loadedKataPromises = new Map();

/**
 * Динамическая подгрузка мастер-анимации любого из 26 ката Shotokan из /models/katas/kata_${kataSlug}.glb
 */
export async function ensureKataClipLoaded(kataSlug) {
  if (!kataSlug) return null;
  if (globalClipCache.has(kataSlug)) return globalClipCache.get(kataSlug);
  const alias = ACTION_ALIASES[kataSlug];
  if (alias && globalClipCache.has(alias)) return globalClipCache.get(alias);
  if (loadedKataPromises.has(kataSlug)) return loadedKataPromises.get(kataSlug);

  const promise = new Promise((resolve) => {
    const url = `/models/katas/kata_${kataSlug}.glb`;
    gltfLoader.load(
      url,
      (gltf) => {
        if (gltf.animations && gltf.animations.length > 0) {
          const clip = gltf.animations[0];
          globalClipCache.set(kataSlug, clip);
          globalClipCache.set(clip.name, clip);
          resolve(clip);
        } else {
          resolve(null);
        }
      },
      undefined,
      (err) => {
        const animOnlyUrl = `/models/katas/anim_only/anim_only_kata_${kataSlug}.glb`;
        gltfLoader.load(
          animOnlyUrl,
          (gltf2) => {
            if (gltf2.animations && gltf2.animations.length > 0) {
              const clip = gltf2.animations[0];
              globalClipCache.set(kataSlug, clip);
              globalClipCache.set(clip.name, clip);
              resolve(clip);
            } else {
              resolve(null);
            }
          },
          undefined,
          (err2) => {
            console.warn(`[KaratekaLowpolyModel] Не удалось загрузить мастер-клип ката /models/katas/kata_${kataSlug}.glb:`, err, err2);
            resolve(null);
          }
        );
      }
    );
  });

  loadedKataPromises.set(kataSlug, promise);
  return promise;
}

// Кэш нарезанных подклипов для пошагового выполнения ката
const subclipCache = new Map();

/**
 * Извлекает подклип заданной временной зоны [startTime, endTime]
 * и кэширует его для мгновенного переключения шагов без задержек.
 */
function getSubclipForRange(sourceClip, clipName, startTime, endTime, fps = 60) {
  if (!sourceClip) return null;
  const startFrame = Math.max(0, Math.round(startTime * fps));
  const endFrame = Math.max(startFrame + 1, Math.round(endTime * fps));
  const key = `${sourceClip.uuid || clipName}_sub_${startFrame}_${endFrame}`;

  if (subclipCache.has(key)) {
    return subclipCache.get(key);
  }

  try {
    const sub = THREE.AnimationUtils.subclip(
      sourceClip,
      `${clipName}_step_${startFrame}_${endFrame}`,
      startFrame,
      endFrame,
      fps
    );
    subclipCache.set(key, sub);
    return sub;
  } catch (err) {
    console.warn('Ошибка нарезки подклипа ката:', err);
    return null;
  }
}

/**
 * Возвращает Set имён всех Object3D в сцене (для фильтрации треков).
 * Вызывается один раз после загрузки GLB, кэшируется по ссылке на сцену.
 */
function collectSceneBoneNames(root) {
  const names = new Set();
  root.traverse((obj) => {
    if (obj.name) names.add(obj.name);
  });
  return names;
}

/**
 * Фильтрует треки AnimationClip, оставляя только те, чей nodeName
 * реально присутствует в сцене. Предотвращает «взрыв» мешей при
 * конфликте треков на несуществующие кости.
 */
function filterClipToScene(clip, sceneNames) {
  const validTracks = clip.tracks.filter((track) => {
    try {
      const parsed = THREE.PropertyBinding.parseTrackName(track.name);
      const nodeName = parsed.nodeName ?? '';
      // Пустой nodeName = глобальное свойство, всегда разрешаем
      return nodeName === '' || sceneNames.has(nodeName);
    } catch {
      return false;
    }
  });
  return new THREE.AnimationClip(clip.name, clip.duration, validTracks);
}

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

export default function KaratekaLowpolyModel({
  role = 'tori',
  stance = 'ready',
  angles = null,
  activeClip = null,
  stepClip = null,
  blendDuration = 0.25,
  speed = 1.0,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  kataMode = false,
  kataExecutionMode = 'composed',
  kataClipName = 'heian_shodan',
  kataTimeRange = null,
  kataScrubProgress = null,
  isPlaying = true,
  isLooping = false,
  replayTrigger = 0,
  currentStep = null,
  prevStep = null,
  onStepEnd = null,
  onTimeUpdate = null,
  onRootMove = null,
}) {
  const groupRef = useRef();

  // Загружаем полную библиотеку техник каратэ Шотокан v4 (213 клипов) вместе с мешем мастера
  const { scene, animations } = useGLTF('/models/karateka_techniques_v4.glb');

  // Клонируем персонажа со скелетом через SkeletonUtils для независимой анимации Tori и Uke
  // ВАЖНО: нельзя трогать clone.position или clone.scale после клонирования SkinnedMesh —
  // это ломает bindMatrix скелета и вызывает взрыв вершин в огромные треугольники.
  // Масштаб и смещение применяются через родительский <group>.
  const { clonedModel, modelScale, modelYOffset, sceneNames } = useMemo(() => {
    const clone = SkeletonUtils.clone(scene);

    // Вычисляем bbox ДО изменения трансформации, чтобы не сломать skinning
    const bbox = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    bbox.getSize(size);

    // Калибровка роста до 1.78 м
    const s = size.y > 0 ? 1.78 / size.y : 1.0;

    // Смещение по Y, чтобы подошвы стояли на татами (Y=0)
    // Применяется к родительскому group, а НЕ к clone.position
    const yOffset = -bbox.min.y * s;

    // Аутентичные цвета каратэги и пояса в зависимости от роли
    let giColor = '#faf9f6'; // Белоснежный плотный канвас Arawaza для Тори
    let beltColor = '#141414'; // Kuro-Obi (Черный пояс 5-й Дан)

    if (role === 'uke') {
      giColor = '#243346'; // Традиционное темно-синее доги индиго для Укэ
      beltColor = '#181818';
    } else if (role === 'uke2') {
      giColor = '#342b2b'; // Графитовое соревновательное доги
      beltColor = '#3a1212';
    }

    clone.traverse((child) => {
      if (child.isMesh) {
        // Отключаем frustum culling для анимированных SkinnedMesh, чтобы одежда и части тела
        // никогда не исчезали при приближении, наклоне или повороте камеры
        child.frustumCulled = false;
        child.castShadow = true;
        child.receiveShadow = true;

        const matName = child.material?.name || '';
        const meshName = child.name || '';

        if (child.material) {
          // Клонируем исходный PBR-материал из Blender, СОХРАНЯЯ ВСЕ ТЕКСТУРЫ (диффузная, нормали, шероховатость)
          const newMat = child.material.clone();
          // ВАЖНО: DoubleSide для одежды (Gi, Pants, Belt), чтобы куртка и брюки отображались под любыми углами камеры
          newMat.side = THREE.DoubleSide;
          newMat.shadowSide = THREE.DoubleSide;

          if (matName.includes('Skin') || meshName.includes('Mesh')) {
            // Голова, лицо, глаза, шея, кисти рук, стопы — сохраняем естественную текстуру кожи
            // Умножение на 0xffffff оставляет текстуру sensei_skin_diffuse максимально естественной
            newMat.color = new THREE.Color(0xffffff);
            newMat.roughness = 0.65;
            newMat.metalness = 0.02;
          } else if (matName.includes('Belt') || meshName.includes('Belt')) {
            // Пояс Оби
            newMat.color = new THREE.Color(beltColor);
            newMat.roughness = 0.75;
            newMat.metalness = 0.05;
          } else if (matName.includes('Gi') || meshName.includes('Jacket') || meshName.includes('Pants')) {
            // Хлопковое доги: белое для Тори, индиго для Укэ
            newMat.color = new THREE.Color(giColor);
            newMat.roughness = 0.85;
            newMat.metalness = 0.02;
          }

          child.material = newMat;
        }
      }
    });

    // Собираем имена всех объектов клона для фильтрации треков анимации
    // (см. filterClipToScene — защита от взрыва мешей при мёртвых трек-бондах)
    const sceneNames = collectSceneBoneNames(clone);

    return { clonedModel: clone, modelScale: s, modelYOffset: yOffset, sceneNames };
  }, [scene, role]);

  // AnimationMixer для воспроизведения клипов
  const mixer = useMemo(() => {
    return new THREE.AnimationMixer(clonedModel);
  }, [clonedModel]);

  // Возвращает клип с треками, отфильтрованными под реальный скелет клона
  const getFilteredClip = useMemo(() => {
    const cache = new Map();
    return (clip) => {
      if (!clip) return null;
      if (cache.has(clip.uuid)) return cache.get(clip.uuid);
      const filtered = filterClipToScene(clip, sceneNames);
      cache.set(clip.uuid, filtered);
      return filtered;
    };
  }, [sceneNames]);

  const [clipsLoaded, setClipsLoaded] = useState(false);
  const [kataLoadedClip, setKataLoadedClip] = useState(null);
  const currentActionRef = useRef(null);
  const activeClipRef = useRef(null);
  const prevReplayTriggerRef = useRef(replayTrigger);

  // Динамическая загрузка GLB мастер-анимации ката при выборе любого из 26 ката Shotokan
  useEffect(() => {
    if (!kataMode || !kataClipName) return;

    const existing =
      resolveClip(kataClipName) ||
      globalClipCache.get(kataClipName) ||
      globalClipCache.get(`${kataClipName}_preview`);

    if (existing) {
      setKataLoadedClip(existing);
      return;
    }

    let isMounted = true;
    ensureKataClipLoaded(kataClipName).then((clip) => {
      if (isMounted && clip) {
        setKataLoadedClip(clip);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [kataMode, kataClipName]);

  // Предзагрузка клипов анимаций: сначала встроенные из GLB, затем внешние JSON
  useEffect(() => {
    if (animations && animations.length > 0) {
      animations.forEach((clip) => {
        globalClipCache.set(clip.name, clip);
      });
      // Привязываем канонические алиасы (например heian_shodan -> heian_shodan_preview)
      Object.entries(ACTION_ALIASES).forEach(([aliasKey, targetName]) => {
        if (globalClipCache.has(targetName)) {
          globalClipCache.set(aliasKey, globalClipCache.get(targetName));
        }
      });
    }

    getCachedClips().then(() => {
      setClipsLoaded(true);
    });
  }, [animations]);

  // Переключение стойки (stance) — только если НЕ активен kataMode (стойка Йой)
  useEffect(() => {
    if (kataMode || !clipsLoaded || !mixer) return;

    const clipName = getStanceClipName(stance || 'ready');
    const rawClip = resolveClip(clipName) || globalClipCache.get(clipName);
    if (!rawClip) return;
    const clip = getFilteredClip(rawClip);
    if (!clip || clip.tracks.length === 0) return;

    // Полная остановка предыдущих действий (включая ката-клипы) для гарантированного перехода в стойку (Задача 12)
    mixer.stopAllAction();
    activeClipRef.current = null;

    const newAction = mixer.clipAction(clip);
    newAction.reset();
    newAction.setLoop(THREE.LoopRepeat);
    newAction.timeScale = speed;
    newAction.paused = false;
    newAction.play();
    currentActionRef.current = newAction;

    if (groupRef.current) {
      groupRef.current.position.set(0, 0, 0);
      groupRef.current.rotation.set(0, 0, 0);
    }
  }, [kataMode, stance, clipsLoaded, mixer, speed, getFilteredClip]);

  // Запуск динамического приема (activeClip: choku_zuki, oi_zuki_right, mae_geri, heian_shodan_preview, etc.)
  useEffect(() => {
    if (kataMode || !clipsLoaded || !mixer || !activeClip) return;

    const rawClip = resolveClip(activeClip) || globalClipCache.get(activeClip);
    if (!rawClip) return;
    const clip = getFilteredClip(rawClip);
    if (!clip || clip.tracks.length === 0) return;

    const action = mixer.clipAction(clip);
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.timeScale = speed;

    if (currentActionRef.current) {
      action.crossFadeFrom(currentActionRef.current, 0.15, true);
    }
    action.play();
    activeClipRef.current = action;

    const onFinished = (e) => {
      if (e.action === action) {
        mixer.removeEventListener('finished', onFinished);
        activeClipRef.current = null;

        // Возврат в текущую базовую стойку
        const stanceClipName = getStanceClipName(stance);
        const rawStanceClip = resolveClip(stanceClipName) || globalClipCache.get(stanceClipName);
        const stanceClip = rawStanceClip ? getFilteredClip(rawStanceClip) : null;
        if (stanceClip && stanceClip.tracks.length > 0) {
          const stanceAction = mixer.clipAction(stanceClip);
          stanceAction.reset();
          stanceAction.setLoop(THREE.LoopRepeat);
          stanceAction.timeScale = speed;
          stanceAction.crossFadeFrom(action, 0.3, true);
          stanceAction.play();
          currentActionRef.current = stanceAction;
        }
      }
    };

    mixer.addEventListener('finished', onFinished);
    return () => {
      mixer.removeEventListener('finished', onFinished);
    };
  }, [kataMode, activeClip, clipsLoaded, mixer, stance, speed, getFilteredClip]);

  // Режим Ката (Kata Mode): Клиповая композиция шагов либо MoCap мастер-прогон
  useEffect(() => {
    if (!kataMode || !clipsLoaded || !mixer) return;

    let targetClip = null;
    const isFullMode = kataExecutionMode === 'full' || (!stepClip && kataExecutionMode !== 'composed');

    if (isFullMode) {
      // Вариант 1: Полный мастер-клип ката (heian_shodan_preview для Heian Shodan или /models/katas/kata_${kataSlug}.glb)
      const sourceName = kataClipName || 'heian_shodan';
      const rawSource =
        kataLoadedClip ||
        resolveClip(sourceName) ||
        globalClipCache.get(sourceName) ||
        globalClipCache.get(`${sourceName}_preview`) ||
        globalClipCache.get('heian_shodan_preview') ||
        globalClipCache.get('heian_shodan');

      if (rawSource) {
        if (kataTimeRange && Array.isArray(kataTimeRange) && kataTimeRange.length === 2) {
          const [startTime, endTime] = kataTimeRange;
          targetClip = getSubclipForRange(rawSource, sourceName, startTime, endTime, 60);
        } else {
          targetClip = rawSource;
        }
      }
    } else {
      // Вариант 2: Клиповая композиция отдельного шага ката (библиотека переиспользуемых клипов v4)
      const clipName = stepClip || activeClip;
      const rawClip = resolveClip(clipName) || globalClipCache.get(clipName);
      if (rawClip) {
        targetClip = rawClip;
      } else {
        // Fallback на стойку шага
        const stanceClipName = getStanceClipName(stance);
        targetClip = resolveClip(stanceClipName) || globalClipCache.get(stanceClipName);
      }
    }

    if (!targetClip) return;
    const clip = getFilteredClip(targetClip);
    if (!clip || clip.tracks.length === 0) return;

    const isReplayRequested = prevReplayTriggerRef.current !== replayTrigger;
    prevReplayTriggerRef.current = replayTrigger;

    // Защита от прерывания: если полный мастер-клип уже воспроизводится (или на паузе),
    // не сбрасываем его при смене активного шага таймлайна, если пользователь явно не нажал повтор!
    if (
      isFullMode &&
      !isReplayRequested &&
      currentActionRef.current &&
      currentActionRef.current.getClip() === clip
    ) {
      currentActionRef.current.timeScale = speed;
      currentActionRef.current.paused = !isPlaying;
      return;
    }

    const action = mixer.clipAction(clip);
    action.reset();
    action.timeScale = speed;
    action.setLoop(isLooping ? THREE.LoopRepeat : THREE.LoopOnce, 1);
    action.clampWhenFinished = true;

    if (currentActionRef.current && currentActionRef.current !== action) {
      const prevAction = currentActionRef.current;
      // Замораживаем предыдущую технику в ее завершенной точке (Киме/Дзансин),
      // чтобы она не продолжала двигаться и "доделывать" удар в начале нового шага!
      prevAction.paused = true;
      if (prevAction.time < prevAction.getClip().duration) {
        prevAction.time = prevAction.getClip().duration;
      }
      action.crossFadeFrom(prevAction, Math.min(blendDuration || 0.14, 0.14), false);
    }

    if (isPlaying) {
      action.play();
      action.paused = false;
    } else {
      action.play();
      action.paused = true;
    }

    currentActionRef.current = action;

    const onFinished = (e) => {
      if (e.action === action) {
        if (onStepEnd) onStepEnd();
      }
    };

    mixer.addEventListener('finished', onFinished);
    return () => {
      mixer.removeEventListener('finished', onFinished);
    };
  }, [
    kataMode,
    kataExecutionMode,
    stepClip,
    activeClip,
    blendDuration,
    stance,
    kataClipName,
    kataLoadedClip,
    kataTimeRange ? `${kataTimeRange[0]}_${kataTimeRange[1]}` : null,
    isLooping,
    clipsLoaded,
    mixer,
    getFilteredClip,
    replayTrigger,
    speed,
  ]);

  // Пауза / воспроизведение в kataMode
  useEffect(() => {
    if (kataMode && currentActionRef.current) {
      currentActionRef.current.paused = !isPlaying;
    }
  }, [kataMode, isPlaying]);

  // Скраббинг времени в kataMode
  useEffect(() => {
    if (kataMode && kataScrubProgress !== null && currentActionRef.current) {
      const clipDuration = currentActionRef.current.getClip().duration;
      currentActionRef.current.time = Math.max(0, Math.min(clipDuration, kataScrubProgress * clipDuration));
      mixer.update(0);
    }
  }, [kataMode, kataScrubProgress, mixer]);

  // Обновление таймскейла при изменении скорости (Slow-Mo)
  useEffect(() => {
    if (activeClipRef.current) {
      activeClipRef.current.timeScale = speed;
    }
    if (currentActionRef.current) {
      currentActionRef.current.timeScale = speed;
    }
  }, [speed]);

  const hipsBoneRef = useRef(null);
  useEffect(() => {
    if (clonedModel) {
      hipsBoneRef.current = clonedModel.getObjectByName('Hips') || clonedModel.getObjectByName('Root');
    }
  }, [clonedModel]);

  // Анимационный тик
  useFrame((_, delta) => {
    if (mixer) {
      mixer.update(delta);
      if (currentActionRef.current) {
        let avatarWorldPos = null;
        if (hipsBoneRef.current) {
          const v = new THREE.Vector3();
          hipsBoneRef.current.getWorldPosition(v);
          avatarWorldPos = [v.x, v.y, v.z];
        }
        if (kataMode && onTimeUpdate) {
          onTimeUpdate(currentActionRef.current.time, currentActionRef.current.getClip().duration, avatarWorldPos);
        }
        if (onRootMove && avatarWorldPos) {
          onRootMove(avatarWorldPos);
        }

        // --- ПЛАВНАЯ АНИМАЦИЯ ПОВОРОТА ЧЕРЕЗ СПИНУ И СМЕНЫ НАПРАВЛЕНИЯ ЭМБУСЭН ---
        if (groupRef.current && kataMode) {
          const clipDuration = currentActionRef.current.getClip().duration || 1.0;
          const animTime = currentActionRef.current.time;
          const progress = Math.max(0, Math.min(1, animTime / clipDuration));

          const isStep18 = currentStep?.moveNumber === 18 || (kataClipName === 'heian_shodan' && currentStep?.moveNumber === 18);

          if (isStep18) {
            // Для Шага 18 Heian Shodan: поворот через спину лицом к камере (Север 0°):
            // После шага 17 (3-й ой-цуки с КИАЙ) мастер стоит спиной к камере (180° / π рад).
            // Персонаж разворачивается через спину (по дуге 180° -> 270° -> 360° / 0°),
            // завершая блок сюто-укэ в стойке кокуцу-дати строго лицом к камере (0° / 0 рад).
            if (kataExecutionMode === 'mocap') {
              // В MoCap-записи мастер завершает поворот под углом 48°.
              // Плавно компенсируем поворот группы так, чтобы аватар оказался строго лицом к камере (0°)!
              const turnT = Math.min(1, Math.max(0, (progress - 0.15) / 0.70));
              const ease = turnT * turnT * (3 - 2 * turnT);
              const compYawRad = - (48 * Math.PI / 180) * ease;
              groupRef.current.rotation.y = compYawRad;
            } else {
              // В режиме Клипов v4 (composed): плавно интерполируем поворот через спину от 180° (π) до 360° (2π / 0 rad)
              const turnT = Math.min(1, Math.max(0, progress / 0.70));
              const ease = turnT * turnT * (3 - 2 * turnT);
              const currentAngleRad = Math.PI + Math.PI * ease;
              groupRef.current.rotation.y = currentAngleRad;
            }
          } else if (kataExecutionMode === 'composed' && currentStep) {
            const targetYaw = rotation[1];
            const startYaw = prevStep ? prevStep.rotation[1] : (currentStep.stateIn ? (currentStep.stateIn.facingDeg * Math.PI / 180) : targetYaw);
            let diff = targetYaw - startYaw;
            while (diff > Math.PI) diff -= 2 * Math.PI;
            while (diff < -Math.PI) diff += 2 * Math.PI;

            if (Math.abs(diff) > 0.01) {
              const turnT = Math.min(1, Math.max(0, progress / 0.65));
              const ease = turnT * turnT * (3 - 2 * turnT);
              groupRef.current.rotation.y = startYaw + diff * ease;
            } else {
              groupRef.current.rotation.y = targetYaw;
            }
          } else {
            groupRef.current.rotation.y = rotation[1];
          }
        }
      }
    }
  });

  return (
    // Масштаб и смещение Y применяются к group, а НЕ к clonedModel,
    // чтобы не сломать bindMatrix скелета SkinnedMesh
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
useGLTF.preload('/models/karateka_lowpoly.glb');
