import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  synthesizeModularClip,
  extractLowerBodyClip,
  extractUpperBodyClip,
  makeClipInPlace,
  patchAgeUkeClip,
  hasRootDisplacement,
} from './modularAnimationEngine.js';
import { generateUnsuJump360Clip } from './customMotionManager.js';
import { resolveComposedClip } from './kataCompositionEngine.js';
import { HEIAN_SHODAN_CANONICAL_EVENTS } from './kataMotionUtils.js';

export {
  synthesizeModularClip,
  extractLowerBodyClip,
  extractUpperBodyClip,
  hasRootDisplacement,
  registerCustomClip,
  getCachedClips,
  globalClipCache,
  CLIP_FILES,
};

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

  // Отдельные клипы перемещений и техник для Ката (23 шага)
  heian_shodan_step_0: '/anims/kata_steps/heian_shodan_step_0.json',
  heian_shodan_step_1: '/anims/kata_steps/heian_shodan_step_1.json',
  heian_shodan_step_2: '/anims/kata_steps/heian_shodan_step_2.json',
  heian_shodan_step_3: '/anims/kata_steps/heian_shodan_step_3.json',
  heian_shodan_step_4: '/anims/kata_steps/heian_shodan_step_4.json',
  heian_shodan_step_5: '/anims/kata_steps/heian_shodan_step_5.json',
  heian_shodan_step_6: '/anims/kata_steps/heian_shodan_step_6.json',
  heian_shodan_step_7: '/anims/kata_steps/heian_shodan_step_7.json',
  heian_shodan_step_8: '/anims/kata_steps/heian_shodan_step_8.json',
  heian_shodan_step_9: '/anims/kata_steps/heian_shodan_step_9.json',
  heian_shodan_step_10: '/anims/kata_steps/heian_shodan_step_10.json',
  heian_shodan_step_11: '/anims/kata_steps/heian_shodan_step_11.json',
  heian_shodan_step_12: '/anims/kata_steps/heian_shodan_step_12.json',
  heian_shodan_step_13: '/anims/kata_steps/heian_shodan_step_13.json',
  heian_shodan_step_14: '/anims/kata_steps/heian_shodan_step_14.json',
  heian_shodan_step_15: '/anims/kata_steps/heian_shodan_step_15.json',
  heian_shodan_step_16: '/anims/kata_steps/heian_shodan_step_16.json',
  heian_shodan_step_17: '/anims/kata_steps/heian_shodan_step_17.json',
  heian_shodan_step_18: '/anims/kata_steps/heian_shodan_step_18.json',
  heian_shodan_step_19: '/anims/kata_steps/heian_shodan_step_19.json',
  heian_shodan_step_20: '/anims/kata_steps/heian_shodan_step_20.json',
  heian_shodan_step_21: '/anims/kata_steps/heian_shodan_step_21.json',
  heian_shodan_step_22: '/anims/kata_steps/heian_shodan_step_22.json',
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
  sanbon_zuki: 'oi_zuki_right',
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
  shuto_uke: 'shuto_uke',
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
  if (name === 'jump_turn_360') {
    const unsuClip = generateUnsuJump360Clip('jump_turn_360');
    globalClipCache.set('jump_turn_360', unsuClip);
    return unsuClip;
  }
  if (name === 'shuto_uke') {
    if (globalClipCache.has('tech_shuto_uke_left')) return globalClipCache.get('tech_shuto_uke_left');
    if (globalClipCache.has('tech_shuto_uke_right')) return globalClipCache.get('tech_shuto_uke_right');
  }
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
      return globalClipCache.has('kiba_dachi') ? 'kiba_dachi' : 'stance_kiba';
    case 'nekoashi':
      return globalClipCache.has('stance_neko_left') ? 'stance_neko_left' : 'stance_ready';
    case 'gankaku':
    case 'tsuruashi':
      return globalClipCache.has('stance_tsuru_left') ? 'stance_tsuru_left' : 'stance_gankaku';
    case 'gedan_barai':
      return globalClipCache.has('gedan_barai_left') ? 'gedan_barai_left' : 'gedan_barai';
    case 'age_uke':
      return globalClipCache.has('age_uke_left') ? 'age_uke_left' : 'age_uke';
    case 'empi_uchi':
      return globalClipCache.has('tech_mae_empi_right') ? 'tech_mae_empi_right' : 'empi_uchi';
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

function registerCustomClip(name, clip) {
  if (!name || !clip) return;
  globalClipCache.set(name, clip);
  if (clip.name) globalClipCache.set(clip.name, clip);
}

const gltfLoader = new GLTFLoader();
const loadedKataPromises = new Map();

function populateKataSubclips(kataSlug, masterClip) {
  if (!masterClip) return;
  if (kataSlug === 'heian_shodan') {
    try {
      HEIAN_SHODAN_CANONICAL_EVENTS.forEach((ev, idx) => {
        const subName = `heian_shodan_step_${idx}`;
        if (!globalClipCache.has(subName)) {
          const sub = getSubclipForRange(masterClip, subName, ev.startTime, ev.endTime, 60);
          if (sub) globalClipCache.set(subName, sub);
        }
      });
    } catch (_) {}
  }
}

/**
 * Динамическая подгрузка мастер-анимации любого из 26 ката Shotokan из /models/katas/kata_${kataSlug}.glb
 */
export async function ensureKataClipLoaded(kataSlug) {
  if (!kataSlug) return null;
  if (globalClipCache.has(kataSlug)) {
    const cached = globalClipCache.get(kataSlug);
    populateKataSubclips(kataSlug, cached);
    return cached;
  }
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
          populateKataSubclips(kataSlug, clip);
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
              populateKataSubclips(kataSlug, clip);
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

/**
 * Согласовывает ориентацию Шага 18 Heian Shodan (1-й сюто-укэ в кокуцу-дати):
 * По канону Шотокан разворот выполняется влево в сторону Запад (+90° / Фланг влево),
 * строго в том же направлении, что и Шаг 1 (первое движение ката).
 */
function alignHeianShodanStep18(rawClip) {
  return rawClip;
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
  const key = `${sourceClip.uuid || clipName}_v4_sub_${startFrame}_${endFrame}`;

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
    const patched = patchAgeUkeClip(sub, clipName);
    subclipCache.set(key, patched);
    return patched;
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
 * конфликте треков на несуществующие кости, а также автоматически согласовывает
 * именование костей (UpperArm.L -> UpperArmL) со спецификацией Three.js GLTFLoader.
 */
function filterClipToScene(clip, sceneNames) {
  if (!clip) return null;
  const validTracks = [];
  for (const track of clip.tracks) {
    try {
      let trackNameToUse = track.name;
      let parsed = THREE.PropertyBinding.parseTrackName(trackNameToUse);
      let nodeName = parsed.nodeName ?? '';
      const prop = parsed.propertyName ?? '';

      // Если кость не найдена напрямую (например UpperArm.L при кости UpperArmL),
      // выполняем санитизацию имени в соответствии с соглашениями Three.js GLTFLoader
      if (nodeName !== '' && !sceneNames.has(nodeName)) {
        const sanitized = THREE.PropertyBinding.sanitizeNodeName(nodeName);
        if (sceneNames.has(sanitized)) {
          trackNameToUse = `${sanitized}.${prop}`;
          parsed = THREE.PropertyBinding.parseTrackName(trackNameToUse);
          nodeName = sanitized;
        }
      }

      if (nodeName === '' || sceneNames.has(nodeName)) {
        if (trackNameToUse !== track.name) {
          const Cls = track.constructor;
          validTracks.push(new Cls(trackNameToUse, track.times, track.values));
        } else {
          validTracks.push(track.clone());
        }
      }
    } catch {
      // Игнорируем некорректный трек
    }
  }
  return new THREE.AnimationClip(clip.name, clip.duration, validTracks);
}

async function getCachedClips() {
  if (globalClipPromise) return globalClipPromise;

  globalClipPromise = (async () => {
    await Promise.all(
      Object.entries(CLIP_FILES).map(async ([name, url]) => {
        if (name !== 'shuto_uke' && globalClipCache.has(name)) return;
        try {
          const res = await fetch(url);
          if (!res.ok) return;
          const json = await res.json();
          const clip = THREE.AnimationClip.parse(json);
          globalClipCache.set(name, clip);
          if (name === 'shuto_uke') {
            globalClipCache.set('tech_shuto_uke_left', clip);
            globalClipCache.set('tech_shuto_uke_right', clip);
          }
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
  modularLowerClip = null,
  modularUpperClip = null,
  modularTurn = null,
  modularLoop = false,
  layerAdjustments = null,
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
  lockInPlace = false,
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
      populateKataSubclips(kataClipName, existing);
      return;
    }

    let isMounted = true;
    ensureKataClipLoaded(kataClipName).then((clip) => {
      if (isMounted && clip) {
        setKataLoadedClip(clip);
        populateKataSubclips(kataClipName, clip);
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
        if (clip.name !== 'tech_shuto_uke_left' && clip.name !== 'tech_shuto_uke_right' && clip.name !== 'shuto_uke') {
          const patched = patchAgeUkeClip(clip);
          globalClipCache.set(clip.name, patched);
        }
      });
      // Привязываем канонические алиасы (например heian_shodan -> heian_shodan_preview)
      Object.entries(ACTION_ALIASES).forEach(([aliasKey, targetName]) => {
        if (aliasKey !== 'shuto_uke' && globalClipCache.has(targetName)) {
          globalClipCache.set(aliasKey, globalClipCache.get(targetName));
        }
      });
    }

    getCachedClips().then(() => {
      setClipsLoaded(true);
    });
  }, [animations]);

  // Переключение стойки (stance) — только если НЕ активен kataMode и НЕ активен модульный режим
  useEffect(() => {
    if (kataMode || !clipsLoaded || !mixer) return;
    if (modularLowerClip || modularUpperClip) return;

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
  }, [kataMode, stance, clipsLoaded, mixer, speed, getFilteredClip, modularLowerClip, modularUpperClip]);

  // Модульный режим (Modular Layered Motion):
  // Синтез независимого нижнего слоя стойки/шага и верхнего слоя техники
  useEffect(() => {
    if (kataMode || !clipsLoaded || !mixer) return;
    if (!modularLowerClip && !modularUpperClip) return;

    const lowerRaw = modularLowerClip
      ? (typeof modularLowerClip === 'object' && modularLowerClip?.tracks ? modularLowerClip : (resolveClip(modularLowerClip) || globalClipCache.get(modularLowerClip)))
      : (resolveClip(getStanceClipName(stance || 'ready')) || globalClipCache.get(getStanceClipName(stance || 'ready')));

    const upperRaw = modularUpperClip
      ? (typeof modularUpperClip === 'object' && modularUpperClip?.tracks ? modularUpperClip : (resolveClip(modularUpperClip) || globalClipCache.get(modularUpperClip)))
      : null;

    if (!lowerRaw && !upperRaw) return;

    let composite = null;
    if (lowerRaw && upperRaw) {
      composite = synthesizeModularClip({
        lowerClip: lowerRaw,
        upperClip: upperRaw,
        zeroHorizontalRoot: true,
      });
    } else {
      composite = lowerRaw || upperRaw;
    }

    if (!composite) return;
    const clip = getFilteredClip(composite);
    if (!clip || clip.tracks.length === 0) return;

    mixer.stopAllAction();
    try {
      mixer.uncacheClip(clip);
    } catch (_) {}
    const action = mixer.clipAction(clip);
    action.reset();
    action.setLoop(modularLoop ? THREE.LoopRepeat : THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.timeScale = speed;

    if (currentActionRef.current && currentActionRef.current !== action) {
      action.crossFadeFrom(currentActionRef.current, 0.15, true);
    }
    action.play();
    currentActionRef.current = action;
    activeClipRef.current = action;

    if (groupRef.current && typeof modularTurn === 'number') {
      const rad = THREE.MathUtils.degToRad(modularTurn);
      groupRef.current.rotation.y = rad;
    }
  }, [
    kataMode,
    clipsLoaded,
    mixer,
    modularLowerClip,
    modularUpperClip,
    modularTurn,
    modularLoop,
    stance,
    speed,
    getFilteredClip,
    replayTrigger,
  ]);

  // Запуск динамического приема (activeClip: jump_turn_360, kick_mae_geri, etc.)
  useEffect(() => {
    if (kataMode || !clipsLoaded || !mixer || !activeClip) return;
    if (modularLowerClip || modularUpperClip) return;

    let rawClip = typeof activeClip === 'object' && activeClip?.tracks
      ? activeClip
      : (resolveClip(activeClip) || globalClipCache.get(activeClip));

    if (!rawClip) {
      if (typeof activeClip === 'string' && (activeClip.startsWith('kata_') || activeClip === 'unsu')) {
        const slug = activeClip.replace(/^kata_/, '');
        ensureKataClipLoaded(slug).then((loaded) => {
          if (loaded && mixer && !modularLowerClip && !modularUpperClip) {
            const finalLoaded = lockInPlace ? makeClipInPlace(loaded) : loaded;
            const c = getFilteredClip(finalLoaded);
            if (!c || c.tracks.length === 0) return;
            mixer.stopAllAction();
            try { mixer.uncacheClip(c); } catch (_) {}
            const act = mixer.clipAction(c);
            act.reset();
            act.setLoop(modularLoop ? THREE.LoopRepeat : THREE.LoopOnce, 1);
            act.timeScale = speed;
            act.play();
            currentActionRef.current = act;
            activeClipRef.current = act;
          }
        });
      }
      return;
    }

    if (lockInPlace) {
      rawClip = makeClipInPlace(rawClip);
    }
    const clip = getFilteredClip(rawClip);
    if (!clip || clip.tracks.length === 0) return;

    mixer.stopAllAction();
    try {
      mixer.uncacheClip(clip);
    } catch (_) {}

    const action = mixer.clipAction(clip);
    action.reset();
    action.setLoop(modularLoop ? THREE.LoopRepeat : THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.timeScale = speed;

    if (currentActionRef.current) {
      action.crossFadeFrom(currentActionRef.current, 0.15, true);
    }
    action.play();
    currentActionRef.current = action;
    activeClipRef.current = action;

    if (groupRef.current && typeof modularTurn === 'number') {
      const rad = THREE.MathUtils.degToRad(modularTurn);
      groupRef.current.rotation.y = rad;
    }

    if (!modularLoop) {
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
    }
  }, [kataMode, activeClip, clipsLoaded, mixer, stance, speed, getFilteredClip, modularLowerClip, modularUpperClip, modularLoop, modularTurn, replayTrigger, lockInPlace]);

  // Режим Ката (Kata Mode): Клиповая композиция шагов либо MoCap мастер-прогон
  useEffect(() => {
    if (!kataMode || !clipsLoaded || !mixer) return;

    let targetClip = null;
    const sourceName = kataClipName || 'heian_shodan';
    const rawMaster =
      globalClipCache.get(sourceName) ||
      kataLoadedClip ||
      resolveClip(sourceName) ||
      globalClipCache.get(`${sourceName}_preview`) ||
      globalClipCache.get('heian_shodan_preview') ||
      globalClipCache.get('heian_shodan');

    if (kataExecutionMode === 'composed') {
      // 1. Полноценная клиповая анимация ката (библиотека 213 техник Шотокан v4 + отдельные клипы перемещений шагов)
      const stepIdx = currentStep?.stepIndex !== undefined
        ? currentStep.stepIndex
        : (currentStep?.index !== undefined
          ? currentStep.index
          : (currentStep?.moveNumber !== undefined ? currentStep.moveNumber : null));

      const candidateNames = [
        currentStep?.stepClipName,
        currentStep?.kataStepClip,
        stepClip,
        activeClip,
        stepIdx !== null ? `${sourceName}_step_${stepIdx}` : null,
        stepIdx !== null ? `heian_shodan_step_${stepIdx}` : null,
        currentStep?.clipName,
      ].filter(Boolean);

      let rawClip = null;
      for (const name of candidateNames) {
        rawClip = resolveClip(name) || globalClipCache.get(name);
        if (rawClip) break;
      }

      // Если отдельный подклип ещё не в кэше, но есть rawMaster и тайминги шага
      if (!rawClip && rawMaster && currentStep && (currentStep.mocapStartTime !== undefined || currentStep.startTime !== undefined)) {
        const sTime = currentStep.mocapStartTime !== undefined ? currentStep.mocapStartTime : currentStep.startTime;
        const eTime = currentStep.mocapEndTime !== undefined ? currentStep.mocapEndTime : currentStep.endTime;
        if (sTime !== undefined && eTime !== undefined && eTime > sTime) {
          const num = stepIdx ?? 0;
          rawClip = getSubclipForRange(
            rawMaster,
            `${sourceName}_step_${num}`,
            sTime,
            eTime,
            60
          );
        }
      }

      if (!rawClip && currentStep) {
        const resolved = resolveComposedClip(currentStep);
        if (resolved?.clipName) {
          rawClip = resolveClip(resolved.clipName) || globalClipCache.get(resolved.clipName);
        }
      }
      if (!rawClip) {
        const stanceClipName = getStanceClipName(currentStep?.stance || stance || 'ready');
        rawClip = resolveClip(stanceClipName) || globalClipCache.get(stanceClipName);
      }
      if (rawClip) {
        const isStepMovement = hasRootDisplacement(rawClip) || (rawClip.name && rawClip.name.includes('_step_'));
        targetClip = isStepMovement ? patchAgeUkeClip(rawClip) : makeClipInPlace(rawClip);
      }
    } else if (kataExecutionMode === 'full' && rawMaster && !kataTimeRange) {
      // Монолитная мастер-анимация ката
      targetClip = rawMaster;
    } else if (rawMaster && currentStep && (currentStep.mocapStartTime !== undefined || currentStep.startTime !== undefined)) {
      // Канонический клиповый шаг ката с естественными переходами из стойки в стойку (MoCap нарезка)
      const sTime = currentStep.mocapStartTime !== undefined ? currentStep.mocapStartTime : currentStep.startTime;
      const eTime = currentStep.mocapEndTime !== undefined ? currentStep.mocapEndTime : currentStep.endTime;
      if (sTime !== undefined && eTime !== undefined && eTime > sTime) {
        const stepNum = currentStep.moveNumber !== undefined ? currentStep.moveNumber : (currentStep.n !== undefined ? currentStep.n : 0);
        targetClip = getSubclipForRange(
          rawMaster,
          `${sourceName}_step_${stepNum}`,
          sTime,
          eTime,
          60
        );
      } else {
        targetClip = rawMaster;
      }
    } else if (rawMaster && kataTimeRange && Array.isArray(kataTimeRange) && kataTimeRange.length === 2) {
      const [startTime, endTime] = kataTimeRange;
      targetClip = getSubclipForRange(rawMaster, sourceName, startTime, endTime, 60);
    } else {
      // Fallback на технику или стойку шага
      const clipName = stepClip || activeClip;
      const rawClip = resolveClip(clipName) || globalClipCache.get(clipName);
      if (rawClip) {
        targetClip = makeClipInPlace(rawClip);
      } else {
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
    const isFullPlay = kataExecutionMode === 'full';
    if (
      isFullPlay &&
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
    action.enabled = true;
    action.setEffectiveTimeScale(speed);
    action.setEffectiveWeight(1.0);
    action.setLoop(isLooping ? THREE.LoopRepeat : THREE.LoopOnce, 1);
    action.clampWhenFinished = true;

    if (currentActionRef.current && currentActionRef.current !== action) {
      const prevAction = currentActionRef.current;
      // Плавный органичный переход между стойками и техниками без резкого скачка по времени:
      // Не форсируем prevAction.time = duration и не вызываем prevAction.paused = true,
      // что исключает рывки/дёргания при переходе между шагами!
      const crossFadeSec = Math.max(0.06, Math.min(blendDuration || 0.12, 0.18));
      prevAction.fadeOut(crossFadeSec);
      action.fadeIn(crossFadeSec);
    }

    if (kataScrubProgress !== null) {
      const clipDuration = clip.duration;
      action.time = Math.max(0, Math.min(clipDuration, kataScrubProgress * clipDuration));
      action.play();
      action.paused = true;
      mixer.update(0);
    } else if (isPlaying) {
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
    currentStep?.stepId || currentStep?.moveNumber || currentStep?.techniqueNumber,
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
  const bonesMapRef = useRef({});
  useEffect(() => {
    if (clonedModel) {
      hipsBoneRef.current = clonedModel.getObjectByName('Hips') || clonedModel.getObjectByName('Root');
      bonesMapRef.current = {
        hips: hipsBoneRef.current,
        spine: clonedModel.getObjectByName('Spine'),
        chest: clonedModel.getObjectByName('Chest'),
        neck: clonedModel.getObjectByName('Neck'),
        head: clonedModel.getObjectByName('Head'),
        upperArmL: clonedModel.getObjectByName('UpperArm.L') || clonedModel.getObjectByName('UpperArmL'),
        lowerArmL: clonedModel.getObjectByName('LowerArm.L') || clonedModel.getObjectByName('LowerArmL'),
        handL: clonedModel.getObjectByName('Hand.L') || clonedModel.getObjectByName('HandL'),
        upperArmR: clonedModel.getObjectByName('UpperArm.R') || clonedModel.getObjectByName('UpperArmR'),
        lowerArmR: clonedModel.getObjectByName('LowerArm.R') || clonedModel.getObjectByName('LowerArmR'),
        handR: clonedModel.getObjectByName('Hand.R') || clonedModel.getObjectByName('HandR'),
        upperLegL: clonedModel.getObjectByName('UpperLeg.L') || clonedModel.getObjectByName('UpperLegL'),
        lowerLegL: clonedModel.getObjectByName('LowerLeg.L') || clonedModel.getObjectByName('LowerLegL'),
        footL: clonedModel.getObjectByName('Foot.L') || clonedModel.getObjectByName('FootL'),
        upperLegR: clonedModel.getObjectByName('UpperLeg.R') || clonedModel.getObjectByName('UpperLegR'),
        lowerLegR: clonedModel.getObjectByName('LowerLeg.R') || clonedModel.getObjectByName('LowerLegR'),
        footR: clonedModel.getObjectByName('Foot.R') || clonedModel.getObjectByName('FootR'),
      };
    }
  }, [clonedModel]);

  // Анимационный тик
  useFrame((_, delta) => {
    if (mixer) {
      mixer.update(delta);

      // Динамическая коррекция слоев (доворот Ханми/Сёмен при необходимости)
      if (layerAdjustments?.torsoTwist && clonedModel) {
        const b = bonesMapRef.current;
        const twistRad = (layerAdjustments.torsoTwist * Math.PI / 180) * 0.5;
        if (b.spine) b.spine.rotation.y = twistRad;
        if (b.chest) b.chest.rotation.y = twistRad;
      }

      // В стационарном режиме (lockInPlace) жестко фиксируем таз и модель в начале координат, исключая смещение к камере
      if (lockInPlace && clonedModel) {
        const hips = hipsBoneRef.current;
        if (hips) {
          hips.position.x = 0;
          hips.position.z = 0;
        }
        if (groupRef.current) {
          groupRef.current.position.x = position[0];
          groupRef.current.position.z = position[2];
        }
      }
    }
    // Позиционирование и ориентация модели на татами
    if (groupRef.current && kataMode) {
      if (kataExecutionMode === 'composed') {
        const action = currentActionRef.current;
        const clip = action ? action.getClip() : null;
        const isStepMovement = clip && (hasRootDisplacement(clip) || (clip.name && clip.name.includes('_step_')));

        if (isStepMovement) {
          // Отдельный клип перемещения уже содержит естественную мировую траекторию эмбусэн и перемещение таза (как в GLB)
          groupRef.current.position.set(0, modelYOffset, 0);
          groupRef.current.rotation.set(0, 0, 0);
        } else {
          let p = 0;
          if (action) {
            const dur = clip ? clip.duration : 0;
            if (dur > 0) {
              p = Math.min(1, Math.max(0, action.time / dur));
            }
          }

          // Фазово-синхронизированная весовая кривая (анти-скольжение стоп):
          // 0.00 .. 0.15: Подготовка / опорная нога зафиксирована на татами (0% смещения)
          // 0.15 .. 0.75: Перемещение шагающей ноги и перенос веса тела (кубический Hermite / Smoothstep)
          // 0.75 .. 1.00: Акцент удара / блока (кимэ) и жесткая фиксация конечной стойки (100% смещения)
          let s = 0;
          if (p <= 0.15) {
            s = 0;
          } else if (p >= 0.75) {
            s = 1;
          } else {
            const u = (p - 0.15) / 0.60;
            s = u * u * (3 - 2 * u);
          }

          const startPos = currentStep?.startPosition || prevStep?.position || [0, 0, 0];
          const endPos = currentStep?.position || currentStep?.endPosition || [0, 0, 0];

          // Ориентация основания (Yaw) с плавной интерполяцией между шагами
          const startYaw = prevStep?.rotation ? prevStep.rotation[1] : (currentStep?.startRotation ? currentStep.startRotation[1] : (currentStep?.rotation ? currentStep.rotation[1] : 0));
          const targetYaw = currentStep?.rotation ? currentStep.rotation[1] : startYaw;

          let currentYaw = targetYaw;
          if (Math.abs(targetYaw - startYaw) > 0.01) {
            let rProgress = 0;
            if (p <= 0.15) {
              rProgress = 0;
            } else if (p >= 0.75) {
              rProgress = 1;
            } else {
              const k = (p - 0.15) / 0.60;
              rProgress = k * k * (3 - 2 * k);
            }
            let diff = targetYaw - startYaw;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            currentYaw = startYaw + diff * rProgress;
          }

          let x, y, z;
          const isZeroStepDisp = Math.abs(endPos[0] - startPos[0]) < 0.005 && Math.abs(endPos[2] - startPos[2]) < 0.005;

          if (isZeroStepDisp) {
            // КРИТИЧЕСКОЕ ТРЕБОВАНИЕ: модель должна делать полное движение, даже если конечное
            // положение совпадает с начальным (удары на месте, блоки на месте, маэ-гэри с возвратом назад).
            const techName = String(clip?.name || currentStep?.technique || currentStep?.name || '').toLowerCase();
            const isKick = techName.includes('mae_geri') || techName.includes('kick') || techName.includes('geri');
            const isStrike = techName.includes('zuki') || techName.includes('tsuki') || techName.includes('punch') ||
              techName.includes('strike') || techName.includes('empi') || techName.includes('tettsui') || techName.includes('uraken');
            const isBlock = techName.includes('uke') || techName.includes('barai') || techName.includes('shuto');

            let surgeDist = 0.18;
            if (isKick) {
              surgeDist = 0.32;
            } else if (isStrike) {
              surgeDist = 0.22;
            } else if (isBlock) {
              surgeDist = 0.14;
            }

            let surge = 0;
            if (p <= 0.08) {
              surge = 0;
            } else if (p <= 0.48) {
              const k = (p - 0.08) / 0.40;
              surge = Math.sin(k * Math.PI * 0.5);
            } else if (p <= 0.92) {
              const k = (p - 0.48) / 0.44;
              surge = Math.cos(k * Math.PI * 0.5);
            } else {
              surge = 0;
            }

            const fwdX = Math.sin(currentYaw);
            const fwdZ = Math.cos(currentYaw);

            x = startPos[0] + fwdX * surgeDist * surge;
            y = startPos[1] + modelYOffset;
            z = startPos[2] + fwdZ * surgeDist * surge;
          } else {
            x = startPos[0] + (endPos[0] - startPos[0]) * s;
            y = (startPos[1] + (endPos[1] - startPos[1]) * s) + modelYOffset;
            z = startPos[2] + (endPos[2] - startPos[2]) * s;
          }

          groupRef.current.position.set(x, y, z);
          groupRef.current.rotation.set(0, currentYaw, 0);
        }
      } else {
        // Режим монолитного MoCap GLB: корневая кость Hips в клипе ката уже содержит мировую траекторию эмбусэн
        groupRef.current.position.set(0, modelYOffset, 0);
        groupRef.current.rotation.set(0, 0, 0);
      }
    } else if (groupRef.current && !kataMode) {
      groupRef.current.position.set(position[0], position[1] + modelYOffset, position[2]);
      groupRef.current.rotation.set(rotation[0], rotation[1], rotation[2]);
    }

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
    }
  });

  return (
    // Масштаб и смещение Y применяются к group, а НЕ к clonedModel,
    // чтобы не сломать bindMatrix скелета SkinnedMesh
    <group
      ref={groupRef}
      position={[position[0], position[1] + modelYOffset, position[2]]}
      scale={[modelScale, modelScale, modelScale]}
    >
      <primitive object={clonedModel} />
    </group>
  );
}

// Оптимизация: useGLTF загружает модели по требованию внутри компонента, исключая принудительную фоновую предзагрузку 37 МБ на старте.
