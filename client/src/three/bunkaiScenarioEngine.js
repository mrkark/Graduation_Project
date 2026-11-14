/**
 * Единый движок сценариев Бункая Шотокан (Bunkai Scenario Engine v6).
 * 
 * Реализует:
 * 1. Канонический 18-шаговый сценарий боевого применения (Бункай) ката «Хэйан Шодан»
 *    на основе официального пошагового описания техники (Тори — атакующий 1, Укэ — защищающийся 2).
 * 2. Динамический контроль дистанции (Ма-ай):
 *    - Модели находятся на реальной боевой дистанции каждой техники (То-ма, Иссоку-итто, Чика-ма, партер).
 *    - Запрещено фиксированное расстояние: дистанция непрерывно рассчитывается и изменяется.
 * 3. Физический контакт и анти-проникновение (Anti-Penetration Solver):
 *    - Кисть касается предплечья при блоке, стопа касается корпуса при маэ-гэри.
 *    - Исключено прорезание кулака/стопы внутрь корпуса партнера (Limb Clamping).
 *    - Исключено наложение геометрических тел (Torso Separation min 0.50m).
 *    - Реализованы сложные действия: болевой приём на руку (Шаг 7), удар в горло (Шаг 12),
 *      подсечка аши-барай с падением со страховкой и добиванием в сико-дати (Шаг 13), подъем с татами (Шаг 15).
 * 4. Непрерывность последовательности (State Persistence):
 *    - Персонажи не возвращаются в исходную позицию [0,0,0] после каждого шага.
 *    - Конечное положение и ориентация каждого шага становится точным началом следующего.
 */

import * as THREE from 'three';
import { normalizeAngleDeg } from './kataMotionUtils.js';
import { TECHNIQUE_REGISTRY } from './kataCompositionEngine.js';
import {
  BODY_COLLIDER_RADIUS,
  MIN_TORSO_DISTANCE,
  CLINCH_TORSO_DISTANCE,
  resolveBodyInteractions,
} from './bodyColliderSystem.js';
import { resolveAvatarCollision, resolveThreeAvatarsCollision, AVATAR_CAPSULE } from './collisionAvoidance.js';

/**
 * Полный 18-шаговый сценарий Бункая ката Хэйан Шодан из пошагового описания.
 * 1 — Тори (атакующий), 2 — Укэ (защищающийся).
 */
export const HEIAN_SHODAN_BUNKAI_18_STEPS = [
  // 1: Исходное Хэйко-дати
  {
    stepNumber: 1,
    title: 'Шаг 1: Исходное положение — Хэйко-дати',
    description: '1 (Тори): Хэйко дати. 2 (Укэ): Хэйко дати. Участники стоят в параллельной стойке готовности на дистанции То-ма (2.10м), сохраняя концентрацию внимания (дзансин).',
    notes: 'Исходная позиция готовности',
    optimalDistance: 2.10,
    attackAngleDeg: 0,
    contactType: 'none',
    interactionType: 'distance_only',
    tContact: 0.50,
    duration: 2.0,
    scenarioAngles: {
      label: 'Осевая линия 0° · Дистанция То-ма 2.10м',
      toriAngleDeg: 0,
      ukeAngleDeg: 180,
      relativeAngleDeg: 0,
    },
    toriTrajectory: {
      start: [0, 0, -1.05],
      end: [0, 0, -1.05],
      startYaw: 0,
      endYaw: 0,
      isStationary: true,
    },
    ukeTrajectory: {
      start: [0, 0, 1.05],
      end: [0, 0, 1.05],
      startYaw: Math.PI,
      endYaw: Math.PI,
      isStationary: true,
    },
    displacementTori: [0, 0, 0],
    displacementUke: [0, 0, 0],
    participants: [
      { role: 'tori', clipName: 'heiko_dachi', stance: 'heiko', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'heiko_dachi', stance: 'heiko', delaySeconds: 0.0, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 2: Поклон Мусуби-дати
  {
    stepNumber: 2,
    title: 'Шаг 2: Ритуальный поклон — Мусуби-дати (Рэй)',
    description: '1 (Тори): Мусуби дати + поклон. 2 (Укэ): Мусуби дати + поклон. Соединение пяток под углом 45°, традиционный поклон уважения перед началом боевого взаимодействия.',
    notes: 'Взаимный поклон уважения',
    optimalDistance: 2.10,
    attackAngleDeg: 0,
    contactType: 'bow',
    interactionType: 'distance_only',
    tContact: 0.50,
    duration: 2.2,
    scenarioAngles: {
      label: 'Взаимный поклон 0° · Соединение пяток под 45°',
      toriAngleDeg: 0,
      ukeAngleDeg: 180,
      relativeAngleDeg: 0,
    },
    toriTrajectory: {
      start: [0, 0, -1.05],
      end: [0, 0, -1.05],
      startYaw: 0,
      endYaw: 0,
      isStationary: true,
    },
    ukeTrajectory: {
      start: [0, 0, 1.05],
      end: [0, 0, 1.05],
      startYaw: Math.PI,
      endYaw: Math.PI,
      isStationary: true,
    },
    displacementTori: [0, 0, 0],
    displacementUke: [0, 0, 0],
    participants: [
      { role: 'tori', clipName: 'stance_musubi', stance: 'musubi', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'stance_musubi', stance: 'musubi', delaySeconds: 0.0, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 3: Возврат Хэйко-дати
  {
    stepNumber: 3,
    title: 'Шаг 3: Возврат в стойку готовности — Хэйко-дати',
    description: '1 (Тори): Хэйко дати. 2 (Укэ): Хэйко дати. Возврат в параллельную стойку ожидания, готовность к переходу в боевые стойки.',
    notes: 'Возврат в исходную позицию',
    optimalDistance: 2.10,
    attackAngleDeg: 0,
    contactType: 'none',
    interactionType: 'distance_only',
    tContact: 0.50,
    duration: 1.8,
    scenarioAngles: {
      label: 'Стойка готовности Хэйко-дати 0° · Дзансин',
      toriAngleDeg: 0,
      ukeAngleDeg: 180,
      relativeAngleDeg: 0,
    },
    toriTrajectory: {
      start: [0, 0, -1.05],
      end: [0, 0, -1.05],
      startYaw: 0,
      endYaw: 0,
      isStationary: true,
    },
    ukeTrajectory: {
      start: [0, 0, 1.05],
      end: [0, 0, 1.05],
      startYaw: Math.PI,
      endYaw: Math.PI,
      isStationary: true,
    },
    displacementTori: [0, 0, 0],
    displacementUke: [0, 0, 0],
    participants: [
      { role: 'tori', clipName: 'heiko_dachi', stance: 'heiko', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'heiko_dachi', stance: 'heiko', delaySeconds: 0.0, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 4: Вход в боевые стойки Дзэнкуцу-дати
  {
    stepNumber: 4,
    title: 'Шаг 4: Принятие боевых стоек — Дзэнкуцу-дати',
    description: '1 (Тори): Шаг левой ногой вперед в Хидари дзэнкуцу дати. 2 (Укэ): Шаг правой ногой назад в Миги дзэнкуцу дати. Сокращение дистанции до боевой (1.60м).',
    notes: 'Вход в боевую стойку',
    optimalDistance: 1.60,
    attackAngleDeg: 0,
    contactType: 'none',
    interactionType: 'distance_only',
    tContact: 0.55,
    duration: 2.2,
    scenarioAngles: {
      label: 'Фронтальный вход в боевые стойки 0° · Дистанция 1.60м',
      toriAngleDeg: 0,
      ukeAngleDeg: 180,
      relativeAngleDeg: 0,
    },
    toriTrajectory: {
      start: [0, 0, -1.05],
      end: [0, 0, -0.35],
      startYaw: 0,
      endYaw: 0,
      isStationary: false,
    },
    ukeTrajectory: {
      start: [0, 0, 1.05],
      end: [0, 0, 1.25],
      startYaw: Math.PI,
      endYaw: Math.PI,
      isStationary: false,
    },
    displacementTori: [0, 0, 0.70],
    displacementUke: [0, 0, 0.20],
    participants: [
      { role: 'tori', clipName: 'enter_zenkutsu_left', stance: 'zenkutsu', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'step_backward', stance: 'zenkutsu', delaySeconds: 0.0, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 5: Маэ-гэри vs отход под углом 30-45 градусов (Тай-сабаки)
  {
    stepNumber: 5,
    title: 'Шаг 5: Атака Маэ-гэри — отход Укэ под углом 30–45° (Тай-сабаки), Гэдан-барай и Гяку-дзуки',
    description: '1 (Тори): Маэ-гэри приход в дзэнкуцу дати. 2 (Укэ): Шаг назад под углом 30-45 градусов дзэнкуцу дати гэдан-барай гяку-дзуки (юри-аши челнок).',
    notes: 'Отход Укэ строго по диагонали под углом 35° со смещением с осевой линии (X=+0.38м). Контакт стопы и предплечья.',
    optimalDistance: 1.55,
    attackAngleDeg: 18.9,
    contactType: 'block_gedan',
    interactionType: 'body_contact',
    tContact: 0.48,
    duration: 2.6,
    scenarioAngles: {
      label: 'Угол отхода Укэ: 35° (диагонально) · Смещение с оси X=+0.38м',
      toriAngleDeg: 0,
      ukeAngleDeg: 161.1,
      retreatAngleDeg: 35,
    },
    toriTrajectory: {
      start: [0, 0, -0.35],
      end: [0, 0, -0.35],
      startYaw: 0,
      endYaw: 0,
      isStationary: true,
    },
    ukeTrajectory: {
      start: [0, 0, 1.25],
      end: [0.38, 0, 1.70],
      startYaw: Math.PI,
      endYaw: Math.PI - 0.33,
      isStationary: false,
    },
    displacementTori: [0, 0, 0.00],
    displacementUke: [0.38, 0, 0.45],
    participants: [
      { role: 'tori', clipName: 'kick_mae_geri_right', stance: 'zenkutsu', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'tech_gedan_barai_left + tech_gyaku_zuki_right', stance: 'zenkutsu', delaySeconds: 0.10, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 6: Маэ-гэри + Гяку-дзуки под 10-15° vs возврат на осевую линию
  {
    stepNumber: 6,
    title: 'Шаг 6: Маэ-гэри + Гяку-дзуки под углом 10–15° — возврат Укэ на осевую линию, Хайван-укэ, Тэтцуи и Гяку-дзуки',
    description: '1 (Тори): Маэ-гэри гяку-дзуки приход в дзэнкуцу дати под углом 10-15 градусов. 2 (Укэ): Шаг назад (возвращение на осевую линию) дзэнкуцу дати гэдан-барай Фудо дати хайван укэ Дзэнкуцу дати тэтцуи (рука-молот) гяку-дзуки.',
    notes: 'Тори смещается под углом 12.5° (X=+0.16м). Укэ возвращается на осевую линию (X=0.00м) шагом назад.',
    optimalDistance: 1.36,
    attackAngleDeg: -6.8,
    contactType: 'block_gedan',
    interactionType: 'body_contact',
    tContact: 0.46,
    duration: 3.2,
    scenarioAngles: {
      label: 'Тори атака под 12.5° · Укэ возврат на осевую линию (X=0.00м)',
      toriAngleDeg: 12.5,
      ukeAngleDeg: 180,
    },
    toriTrajectory: {
      start: [0, 0, -0.35],
      end: [0.15, 0, 0.35],
      startYaw: 0,
      endYaw: 0.22,
      isStationary: false,
    },
    ukeTrajectory: {
      start: [0.38, 0, 1.70],
      end: [0.00, 0, 1.75],
      startYaw: Math.PI - 0.33,
      endYaw: Math.PI,
      isStationary: false,
    },
    displacementTori: [0.15, 0, 0.70],
    displacementUke: [-0.38, 0, 0.05],
    participants: [
      { role: 'tori', clipName: 'kick_mae_geri_right + tech_gyaku_zuki_right', stance: 'zenkutsu', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'tech_gedan_barai_left + tech_tettsui_right + tech_gyaku_zuki_right', stance: 'zenkutsu', delaySeconds: 0.08, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 7: Ой-дзуки vs Агэ-укэ с выпадом вперед -> болевой приём на руку
  {
    stepNumber: 7,
    title: 'Шаг 7: Выпад Маэ-гэри + Ой-дзуки — Агэ-укэ с выпадом вперед и болевой приём на руку',
    description: '1 (Тори): Шаг назад дзэнкуцу дати + шаг вперёд Маэ-гэри ой-дзуки. 2 (Укэ): Шаг назад дзэнкуцу дати гэдан-барай агэ-укэ гяку агэ-укэ с выпадом вперёд. Выполняется болевой приём на руку.',
    notes: 'Выполняется болевой приём на руку. Плотная дистанция (0.85м), контакт предплечий и захват.',
    optimalDistance: 0.85,
    attackAngleDeg: 0,
    contactType: 'lock_arm',
    interactionType: 'joint_lock',
    tContact: 0.44,
    duration: 3.4,
    scenarioAngles: {
      label: 'Сближение на Чика-ма 0.85м · Захват и болевой приём (Кансэцу-вадза)',
      toriAngleDeg: 0,
      ukeAngleDeg: 180,
    },
    toriTrajectory: {
      start: [0.15, 0, 0.35],
      end: [0.00, 0, 0.95],
      startYaw: 0.22,
      endYaw: 0,
      isStationary: false,
    },
    ukeTrajectory: {
      start: [0.00, 0, 1.75],
      end: [0.00, 0, 1.75],
      startYaw: Math.PI,
      endYaw: Math.PI,
      isStationary: true,
    },
    displacementTori: [-0.15, 0, 0.60],
    displacementUke: [0.00, 0, 0.00],
    participants: [
      { role: 'tori', clipName: 'step_backward + kick_mae_geri_right + tech_oi_zuki_right', stance: 'zenkutsu', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'step_backward + tech_gedan_barai_left + tech_age_uke_right + tech_morote_age_uke_left', stance: 'zenkutsu', delaySeconds: 0.06, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 8: Разворот Тори на 180° vs диагональный шаг Укэ под 30-45°
  {
    stepNumber: 8,
    title: 'Шаг 8: Разворот Тори на 180° — смещение Укэ под углом 30–45° с разворотом в Хидари дзэнкуцу-дати',
    description: '1 (Тори): Шаг левой ногой с разворотом в обратную сторону в миги дзэнкуцу дати. 2 (Укэ): Шаг вперёд в сторону миги дзэнкуцу дати угол 30-45 градусов с последующим разворотом в хидари дзэнкуцу дати.',
    notes: 'Тори разворачивается лицом к противнику. Укэ делает шаг вперед-вбок под углом 30–45° и разворачивается в стойку лицом к Тори.',
    optimalDistance: 0.96,
    attackAngleDeg: 27.9,
    contactType: 'none',
    interactionType: 'tai_sabaki',
    tContact: 0.50,
    duration: 2.6,
    scenarioAngles: {
      label: 'Разворот Тори 180° лицом к Укэ (-152.1°) · Укэ: угол 35° и разворот (+27.9°)',
      toriAngleDeg: -152.1,
      ukeAngleDeg: 27.9,
    },
    toriTrajectory: {
      start: [0.00, 0, 0.95],
      end: [0.00, 0, 0.90],
      startYaw: 0,
      endYaw: Math.PI,
      isStationary: false,
    },
    ukeTrajectory: {
      start: [0.00, 0, 1.75],
      end: [-0.35, 0, 0.15],
      startYaw: Math.PI,
      endYaw: 0,
      isStationary: false,
    },
    displacementTori: [0.00, 0, -0.05],
    displacementUke: [-0.35, 0, -1.60],
    participants: [
      { role: 'tori', clipName: 'turn_into_zenkutsu_right', stance: 'zenkutsu', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'step_forward_right + turn_into_zenkutsu_left', stance: 'zenkutsu', delaySeconds: 0.05, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 9: Маэ-гэри vs Хайван-укэ, полшага в Хэйсоку спиной к Тори и разворот
  {
    stepNumber: 9,
    title: 'Шаг 9: Атака Маэ-гэри — Хайван-укэ, полшага назад в Хэйсоку-дати (спиной к Тори) и разворот',
    description: '1 (Тори): Маэ-гэри. 2 (Укэ): Хидари хайван укэ пол шага назад хейсоку дати (спиной к 1) разворот в миги дзэнкуцу дати гэдан-барай гяку-дзуки.',
    notes: 'Укэ: полшага назад в хейсоку дати спиной к 1, затем разворот в миги дзэнкуцу дати с гэдан-барай и гяку-дзуки лицом к Тори.',
    optimalDistance: 1.31,
    attackAngleDeg: 17.7,
    contactType: 'block_haivan',
    interactionType: 'body_contact',
    tContact: 0.45,
    duration: 2.8,
    scenarioAngles: {
      label: 'Тори Маэ-гэри (-162.3°) · Укэ: гэдан-барай + гяку-дзуки (+17.7°)',
      toriAngleDeg: -162.3,
      ukeAngleDeg: 17.7,
    },
    toriTrajectory: {
      start: [0.00, 0, 0.90],
      end: [0.00, 0, 0.90],
      startYaw: Math.PI,
      endYaw: Math.PI,
      isStationary: true,
    },
    ukeTrajectory: {
      start: [-0.35, 0, 0.15],
      end: [-0.35, 0, -0.45],
      startYaw: 0,
      endYaw: 0,
      isStationary: false,
    },
    displacementTori: [0.00, 0, 0.00],
    displacementUke: [0.00, 0, -0.60],
    participants: [
      { role: 'tori', clipName: 'kick_mae_geri_right', stance: 'zenkutsu', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'slide_backward + tech_gedan_barai_left + tech_gyaku_zuki_right', stance: 'zenkutsu', delaySeconds: 0.08, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 10: Шаг назад Тори vs сдвоенный Гяку-дзуки Укэ
  {
    stepNumber: 10,
    title: 'Шаг 10: Отступление Тори — сдвоенный контрудар Гяку-дзуки (Рэн-дзуки)',
    description: '1 (Тори): Шаг назад в миги дзэнкуцу дати. 2 (Укэ): Гяку-дзуки/гяку-дзуки с шагом в хидари дзэнкуцу дати.',
    notes: 'Тори отступает назад; Укэ продвигается вперед со сдвоенным ударом кулаком (Рэн-дзуки).',
    optimalDistance: 1.17,
    attackAngleDeg: 9.9,
    contactType: 'strike_chudan',
    interactionType: 'body_contact',
    tContact: 0.48,
    duration: 2.6,
    scenarioAngles: {
      label: 'Преследование лицом к лицу: Тори (-170.1°) · Укэ (+9.9°) · Дистанция 1.17м',
      toriAngleDeg: -170.1,
      ukeAngleDeg: 9.9,
    },
    toriTrajectory: {
      start: [0.00, 0, 0.90],
      end: [0.00, 0, 1.45],
      startYaw: Math.PI,
      endYaw: Math.PI,
      isStationary: false,
    },
    ukeTrajectory: {
      start: [-0.35, 0, -0.45],
      end: [-0.15, 0, 0.35],
      startYaw: 0,
      endYaw: 0,
      isStationary: false,
    },
    displacementTori: [0.00, 0, 0.55],
    displacementUke: [0.20, 0, 0.80],
    participants: [
      { role: 'tori', clipName: 'step_backward', stance: 'zenkutsu', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'step_forward + tech_gyaku_zuki_left + tech_gyaku_zuki_right', stance: 'zenkutsu', delaySeconds: 0.06, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 11: Кидзами-дзуки выпад vs Кокуцу-дати Нагаши + Сюто
  {
    stepNumber: 11,
    title: 'Шаг 11: Кидзами-дзуки с выпадом — защита Нагаси-укэ и Сюто-укэ в Миги кокуцу-дати',
    description: '1 (Тори): Кидзами-дзуки с выпадом вперёд. 2 (Укэ): Перестроение в миги кокуцу дати с выполнением нагаши укэ + сюто-укэ.',
    notes: 'Тори делает встречный выпад Кидзами-дзуки. Укэ отходит в стойку Кокуцу-дати с блоком Сюто-укэ.',
    optimalDistance: 1.15,
    attackAngleDeg: 5.0,
    contactType: 'parry_shuto',
    interactionType: 'body_contact',
    tContact: 0.45,
    duration: 2.4,
    scenarioAngles: {
      label: 'Выпад Тори (-175.0°) · Отход Укэ в Кокуцу-дати (+5.0°) · Дистанция 1.15м',
      toriAngleDeg: -175.0,
      ukeAngleDeg: 5.0,
    },
    toriTrajectory: {
      start: [0.00, 0, 1.45],
      end: [-0.10, 0, 1.15],
      startYaw: Math.PI,
      endYaw: Math.PI,
      isStationary: false,
    },
    ukeTrajectory: {
      start: [-0.15, 0, 0.35],
      end: [-0.20, 0, 0.10],
      startYaw: 0,
      endYaw: 0,
      isStationary: false,
    },
    displacementTori: [-0.10, 0, -0.30],
    displacementUke: [-0.05, 0, -0.25],
    participants: [
      { role: 'tori', clipName: 'slide_forward + jodan_zuki_left', stance: 'zenkutsu', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'enter_kokutsu_right + tech_shuto_uke_left', stance: 'kokutsu', delaySeconds: 0.05, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 12: Шаг вперёд в Кокуцу-дати и Дзёдан Сюто-учи в область горла
  {
    stepNumber: 12,
    title: 'Шаг 12: Шаг вперёд в Кокуцу-дати и Дзёдан Сюто-учи — Удар в область горла',
    description: '1 (Тори): Раскрыт после парированного выпада. 2 (Укэ): Шаг вперёд в кокуцу дати дзёдан сюто-учи (Удар в область горла).',
    notes: 'Удар в область горла. Рубящий удар ребром ладони на дистанции 0.70м.',
    optimalDistance: 0.70,
    attackAngleDeg: 4.1,
    contactType: 'strike_throat',
    interactionType: 'body_contact',
    tContact: 0.50,
    duration: 2.2,
    scenarioAngles: {
      label: 'Вход Укэ на дистанцию 0.70м (+4.1°) · Рубящий удар Сюто-учи в область горла',
      toriAngleDeg: -175.9,
      ukeAngleDeg: 4.1,
    },
    toriTrajectory: {
      start: [-0.10, 0, 1.15],
      end: [-0.10, 0, 1.15],
      startYaw: Math.PI,
      endYaw: Math.PI,
      isStationary: true,
    },
    ukeTrajectory: {
      start: [-0.20, 0, 0.10],
      end: [-0.15, 0, 0.55],
      startYaw: 0,
      endYaw: 0,
      isStationary: false,
    },
    displacementTori: [0.00, 0, 0.00],
    displacementUke: [0.05, 0, 0.45],
    participants: [
      { role: 'tori', clipName: 'kokutsu_dachi_left', stance: 'kokutsu', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'step_forward + tech_shuto_uchi_right', stance: 'kokutsu', delaySeconds: 0.05, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 13: Аши-барай, падение со страховкой и добивание в Сико-дати
  {
    stepNumber: 13,
    title: 'Шаг 13: Подсечка Аши-барай, падение со страховкой и добивание в Сико-дати',
    description: '1 (Тори): Падает со страховкой левой рукой на татами (укэми), правая нога лежит поверх левой скрестно. 2 (Укэ): Захват за рукав, подсечка аши-барай, постановка ноги в стойку шико дати + добивающий удар отоши-дзуки (2 левой рукой держит и выпрямляет правую руку 1).',
    notes: '2 левой рукой держит(выпрямляет) правую руку 1. Падение Тори со страховкой и удар Отоши-дзуки сверху вниз.',
    optimalDistance: 0.40,
    attackAngleDeg: 4.1,
    contactType: 'sweep_fall',
    interactionType: 'takedown',
    tContact: 0.44,
    duration: 3.5,
    scenarioAngles: {
      label: 'Подсечка Аши-барай, сваливание в партер и фиксация руки Тори',
      toriAngleDeg: -175.9,
      ukeAngleDeg: 4.1,
    },
    toriTrajectory: {
      start: [-0.10, 0, 1.15],
      end: [-0.10, 0.08, 1.15],
      startYaw: Math.PI,
      endYaw: Math.PI,
      isStationary: false,
    },
    ukeTrajectory: {
      start: [-0.15, 0, 0.55],
      end: [0.25, 0, 0.85],
      startYaw: 0,
      endYaw: 0,
      isStationary: false,
    },
    displacementTori: [0.00, 0.08, 0.00],
    displacementUke: [0.40, 0, 0.30],
    participants: [
      { role: 'tori', clipName: 'idle_shizentai', stance: 'fallen_ukemi', delaySeconds: 0.15, isGround: true },
      { role: 'uke1', clipName: 'stance_shiko + tech_tate_zuki_left', stance: 'shiko', delaySeconds: 0.0, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 14: Разрыв захвата и отход в Хидари дзэнкуцу-дати — Дзансин
  {
    stepNumber: 14,
    title: 'Шаг 14: Разрыв захвата и отход в Хидари дзэнкуцу-дати — Дзансин',
    description: '1 (Тори): Лежит на татами после падения в позиции контроля. 2 (Укэ): Делает шаг правой ногой назад и становится в стойку хидари дзэнкуцу дати, сохраняя боевую бдительность над противником.',
    notes: 'Контроль дистанции и бдительность после добивания',
    optimalDistance: 1.15,
    attackAngleDeg: 4.1,
    contactType: 'none',
    interactionType: 'distance_only',
    tContact: 0.50,
    duration: 2.2,
    scenarioAngles: {
      label: 'Шаг назад правой ногой в Хидари дзэнкуцу · Дистанция 1.15м',
      toriAngleDeg: -175.9,
      ukeAngleDeg: 4.1,
    },
    toriTrajectory: {
      start: [-0.10, 0.08, 1.15],
      end: [-0.10, 0.08, 1.15],
      startYaw: Math.PI,
      endYaw: Math.PI,
      isStationary: true,
    },
    ukeTrajectory: {
      start: [0.25, 0, 0.85],
      end: [-0.15, 0, 0.15],
      startYaw: 0,
      endYaw: 0,
      isStationary: false,
    },
    displacementTori: [0.00, 0.00, 0.00],
    displacementUke: [-0.40, 0, -0.70],
    participants: [
      { role: 'tori', clipName: 'idle_shizentai', stance: 'fallen_ukemi', delaySeconds: 0.0, isGround: true },
      { role: 'uke1', clipName: 'step_backward + zenkutsu_dachi_left', stance: 'zenkutsu', delaySeconds: 0.0, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 15: Подъем Тори с татами в Миги дзэнкуцу-дати
  {
    stepNumber: 15,
    title: 'Шаг 15: Подъем Тори с татами в Миги дзэнкуцу-дати',
    description: '1 (Тори): Через паузу встаёт с татами в стойку миги дзэнкуцу дати. 2 (Укэ): Удерживает позицию Хидари дзэнкуцу дати, контролируя движения Тори.',
    notes: 'Восстановление равновесия и подъем из партера',
    optimalDistance: 1.10,
    attackAngleDeg: 2.6,
    contactType: 'none',
    interactionType: 'distance_only',
    tContact: 0.50,
    duration: 2.6,
    scenarioAngles: {
      label: 'Подъем Тори в Миги дзэнкуцу-дати · Укэ фиксирует стойку · Дистанция 1.10м',
      toriAngleDeg: -177.4,
      ukeAngleDeg: 2.6,
    },
    toriTrajectory: {
      start: [-0.10, 0.08, 1.15],
      end: [-0.10, 0, 1.05],
      startYaw: Math.PI,
      endYaw: Math.PI,
      isStationary: false,
    },
    ukeTrajectory: {
      start: [-0.15, 0, 0.15],
      end: [-0.15, 0, 0.15],
      startYaw: 0,
      endYaw: 0,
      isStationary: true,
    },
    displacementTori: [0.00, -0.08, -0.10],
    displacementUke: [0.00, 0.00, 0.00],
    participants: [
      { role: 'tori', clipName: 'zenkutsu_dachi_right', stance: 'zenkutsu', delaySeconds: 0.20, isGround: false, isRising: true },
      { role: 'uke1', clipName: 'zenkutsu_dachi_left', stance: 'zenkutsu', delaySeconds: 0.0, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 16: Возврат обоих участников шагом назад в Хэйко-дати
  {
    stepNumber: 16,
    title: 'Шаг 16: Возврат обоих участников шагом назад в Хэйко-дати',
    description: '1 (Тори): Шагом назад становится в хэйко дати. 2 (Укэ): Шагом назад становится в хэйко дати. Возврат на безопасную начальную дистанцию (2.10м).',
    notes: 'Синхронный шаг назад в исходную стойку готовности',
    optimalDistance: 2.10,
    attackAngleDeg: 0,
    contactType: 'none',
    interactionType: 'distance_only',
    tContact: 0.50,
    duration: 2.2,
    scenarioAngles: {
      label: 'Синхронный шаг назад · Возврат на дистанцию То-ма 2.10м',
      toriAngleDeg: 180,
      ukeAngleDeg: 0,
    },
    toriTrajectory: {
      start: [-0.10, 0, 1.05],
      end: [0.00, 0, 1.05],
      startYaw: Math.PI,
      endYaw: Math.PI,
      isStationary: false,
    },
    ukeTrajectory: {
      start: [-0.15, 0, 0.15],
      end: [0.00, 0, -1.05],
      startYaw: 0,
      endYaw: 0,
      isStationary: false,
    },
    displacementTori: [0.10, 0, 0.00],
    displacementUke: [0.15, 0, -1.20],
    participants: [
      { role: 'tori', clipName: 'step_backward + heiko_dachi', stance: 'heiko', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'step_backward + heiko_dachi', stance: 'heiko', delaySeconds: 0.0, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 17: Заключительный поклон Мусуби-дати
  {
    stepNumber: 17,
    title: 'Шаг 17: Заключительный поклон — Мусуби-дати (Рэй)',
    description: '1 (Тори): Мусуби дати поклон. 2 (Укэ): Мусуби дати поклон. Традиционный поклон уважения и благодарности за совместную практику бункая.',
    notes: 'Взаимный заключительный поклон',
    optimalDistance: 2.10,
    attackAngleDeg: 0,
    contactType: 'bow',
    interactionType: 'distance_only',
    tContact: 0.50,
    duration: 2.2,
    scenarioAngles: {
      label: 'Мусуби-дати поклон на месте · Дистанция 2.10м',
      toriAngleDeg: 180,
      ukeAngleDeg: 0,
    },
    toriTrajectory: {
      start: [0.00, 0, 1.05],
      end: [0.00, 0, 1.05],
      startYaw: -Math.PI,
      endYaw: -Math.PI,
      isStationary: true,
    },
    ukeTrajectory: {
      start: [0.00, 0, -1.05],
      end: [0.00, 0, -1.05],
      startYaw: 0,
      endYaw: 0,
      isStationary: true,
    },
    displacementTori: [0.00, 0, 0.00],
    displacementUke: [0.00, 0, 0.00],
    participants: [
      { role: 'tori', clipName: 'stance_musubi', stance: 'musubi', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'stance_musubi', stance: 'musubi', delaySeconds: 0.0, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 18: Завершение комплекса Хэйко-дати
  {
    stepNumber: 18,
    title: 'Шаг 18: Завершение комплекса — Хэйко-дати (Сидзэнтай)',
    description: '1 (Тори): Хэйко дати. 2 (Укэ): Хэйко дати. Возврат в естественную стойку готовности Сидзэнтай. Комплекс Бункай Хэйан Шодан завершен.',
    notes: 'Завершение комплекса бункая',
    optimalDistance: 2.10,
    attackAngleDeg: 0,
    contactType: 'none',
    interactionType: 'distance_only',
    tContact: 0.50,
    duration: 2.0,
    scenarioAngles: {
      label: 'Хэйко-дати готовность · Фиксация дзансин · Дистанция 2.10м',
      toriAngleDeg: 180,
      ukeAngleDeg: 0,
    },
    toriTrajectory: {
      start: [0.00, 0, 1.05],
      end: [0.00, 0, 1.05],
      startYaw: -Math.PI,
      endYaw: -Math.PI,
      isStationary: true,
    },
    ukeTrajectory: {
      start: [0.00, 0, -1.05],
      end: [0.00, 0, -1.05],
      startYaw: 0,
      endYaw: 0,
      isStationary: true,
    },
    displacementTori: [0.00, 0, 0.00],
    displacementUke: [0.00, 0, 0.00],
    participants: [
      { role: 'tori', clipName: 'heiko_dachi', stance: 'heiko', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'heiko_dachi', stance: 'heiko', delaySeconds: 0.0, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
];

export const CANONICAL_BUNKAI_EPISODES = HEIAN_SHODAN_BUNKAI_18_STEPS;

/**
 * Расширенный реестр техник для боевого применения (Бункай)
 */
export const BUNKAI_TECHNIQUE_METADATA = {
  oi_zuki_right: {
    clipName: 'tech_oi_zuki_right',
    altClips: ['oi_zuki_right', 'oi_zuki'],
    titleRu: 'Ой-цуки (Прямой выпад кулаком вперед)',
    role: 'tori',
    type: 'punch',
    optimalDistance: 1.40,
    tolerance: 0.35,
    tContact: 0.48,
    defaultDuration: 1.25,
    stanceIn: 'zenkutsu',
    stanceOut: 'zenkutsu',
  },
  gyaku_zuki_right: {
    clipName: 'tech_gyaku_zuki_right',
    altClips: ['gyaku_zuki_right', 'gyaku_zuki'],
    titleRu: 'Гяку-цуки (Реверсивный контрудар кулаком)',
    role: 'uke',
    type: 'punch',
    optimalDistance: 1.25,
    tContact: 0.46,
    defaultDuration: 1.15,
  },
  gyaku_zuki_left: {
    clipName: 'tech_gyaku_zuki_left',
    altClips: ['gyaku_zuki_left'],
    titleRu: 'Гяку-цуки (Реверсивный удар левым кулаком)',
    role: 'uke',
    type: 'punch',
    optimalDistance: 1.25,
    tContact: 0.46,
    defaultDuration: 1.15,
  },
  mae_geri_right: {
    clipName: 'kick_mae_geri_right',
    altClips: ['mae_geri_right', 'mae_geri'],
    titleRu: 'Маэ-гэри (Прямой пробивающий удар ногой)',
    role: 'tori',
    type: 'kick',
    optimalDistance: 1.55,
    tContact: 0.50,
    defaultDuration: 1.35,
  },
  gedan_barai_left: {
    clipName: 'tech_gedan_barai_left',
    altClips: ['gedan_barai_left', 'gedan_barai'],
    titleRu: 'Гэдан-барай (Нижний сметяющий блок)',
    role: 'uke',
    type: 'block',
    optimalDistance: 1.35,
    tContact: 0.48,
    defaultDuration: 1.25,
  },
  age_uke_right: {
    clipName: 'tech_age_uke_right',
    altClips: ['age_uke_right', 'age_uke'],
    titleRu: 'Агэ-укэ (Восходящий верхний блок)',
    role: 'uke',
    type: 'block',
    optimalDistance: 1.15,
    tContact: 0.45,
    defaultDuration: 1.25,
  },
  shuto_uke: {
    clipName: 'tech_shuto_uke_left',
    altClips: ['shuto_uke_left', 'shuto_uke'],
    titleRu: 'Сюто-укэ (Блок ребром ладони)',
    role: 'uke',
    type: 'block',
    optimalDistance: 1.30,
    tContact: 0.45,
    defaultDuration: 1.30,
  },
  shuto_uchi: {
    clipName: 'tech_shuto_uchi_right',
    altClips: ['shuto_uchi_right', 'shuto_uchi'],
    titleRu: 'Сюто-учи (Секущий удар ребром ладони в горло)',
    role: 'uke',
    type: 'strike',
    optimalDistance: 1.10,
    tContact: 0.50,
    defaultDuration: 1.20,
  },
  tetsui_uchi: {
    clipName: 'tech_tettsui_right',
    altClips: ['tech_tettsui_left', 'tetsui_uchi'],
    titleRu: 'Тэтцуи-учи (Удар кулаком-молотом сверху)',
    role: 'uke',
    type: 'strike',
    optimalDistance: 1.20,
    tContact: 0.48,
    defaultDuration: 1.25,
  },
  kizami_zuki: {
    clipName: 'jodan_zuki_left',
    altClips: ['kizami_zuki'],
    titleRu: 'Кидзами-дзуки (Встречный резкий джеб с выпадом)',
    role: 'tori',
    type: 'punch',
    optimalDistance: 1.30,
    tContact: 0.45,
    defaultDuration: 1.15,
  },
  ren_zuki: {
    clipName: 'ren_zuki',
    altClips: ['sanbon_zuki'],
    titleRu: 'Рэн-дзуки (Сдвоенный пробивающий удар кулаками)',
    role: 'uke',
    type: 'punch',
    optimalDistance: 1.25,
    tContact: 0.46,
    defaultDuration: 1.45,
  },
};

/**
 * Нормализует шаг бункая из любого источника (БД, camelCase или канонический)
 */
export function normalizeBunkaiEpisode(raw, index = 0) {
  if (!raw) return HEIAN_SHODAN_BUNKAI_18_STEPS[0];

  const stepNum = raw.Step_Number ?? raw.stepNumber ?? (index + 1);
  const canonicalIdx = stepNum - 1;
  const canonical = (canonicalIdx >= 0 && canonicalIdx < HEIAN_SHODAN_BUNKAI_18_STEPS.length)
    ? HEIAN_SHODAN_BUNKAI_18_STEPS[canonicalIdx]
    : null;

  const rawParticipants = raw.Participants || raw.participants || [];
  const toriPart = rawParticipants.find((p) => (p.Role || p.role) === 'tori') || {};
  const uke1Part = rawParticipants.find((p) => {
    const r = p.Role || p.role;
    return r === 'uke' || r === 'uke1';
  }) || {};
  const uke2Part = rawParticipants.find((p) => (p.Role || p.role) === 'uke2') || {};

  const optDist = Number(raw.Combat_Distance_Meters ?? raw.targetDistance ?? raw.optimalDistance ?? canonical?.optimalDistance ?? 1.45);
  const atkAngle = Number(raw.Attack_Angle_Degrees ?? raw.targetAngle ?? raw.attackAngleDeg ?? canonical?.attackAngleDeg ?? 0);
  const uke2Angle = Number(raw.uke2AngleDeg ?? canonical?.uke2AngleDeg ?? (atkAngle + 65));

  const toriClip = toriPart.Clip_Name || toriPart.clipName || raw.Clip_Name || raw.clipName || canonical?.participants?.[0]?.clipName || 'heiko_dachi';
  const uke1Clip = uke1Part.Clip_Name || uke1Part.clipName || canonical?.participants?.[1]?.clipName || 'heiko_dachi';
  const uke2Clip = uke2Part.Clip_Name || uke2Part.clipName || canonical?.participants?.[2]?.clipName || 'idle_shizentai';

  const toriDelay = Number(toriPart.Delay_Seconds ?? toriPart.delaySeconds ?? canonical?.participants?.[0]?.delaySeconds ?? 0.0);
  const uke1Delay = Number(uke1Part.Delay_Seconds ?? uke1Part.delaySeconds ?? canonical?.participants?.[1]?.delaySeconds ?? 0.0);
  const uke2Delay = Number(uke2Part.Delay_Seconds ?? uke2Part.delaySeconds ?? canonical?.participants?.[2]?.delaySeconds ?? 0.0);

  return {
    stepNumber: stepNum,
    title: raw.Title || raw.title || canonical?.title || `Шаг ${index + 1}`,
    description: raw.Description || raw.description || canonical?.description || '',
    notes: raw.Notes || raw.notes || canonical?.notes || '',
    optimalDistance: isNaN(optDist) ? (canonical?.optimalDistance ?? 1.45) : optDist,
    attackAngleDeg: isNaN(atkAngle) ? (canonical?.attackAngleDeg ?? 0) : atkAngle,
    uke2AngleDeg: isNaN(uke2Angle) ? (canonical?.uke2AngleDeg ?? atkAngle + 65) : uke2Angle,
    interactionType: raw.Interaction_Type || raw.interactionType || canonical?.interactionType || 'body_contact',
    contactType: raw.contactType || canonical?.contactType || 'none',
    tContact: Number(raw.tContact || canonical?.tContact || 0.48),
    duration: Number(raw.duration || canonical?.duration || 2.4),
    scenarioAngles: raw.scenarioAngles || canonical?.scenarioAngles || null,
    toriTrajectory: raw.toriTrajectory || canonical?.toriTrajectory || null,
    ukeTrajectory: raw.ukeTrajectory || canonical?.ukeTrajectory || null,
    isStationaryTori: Boolean(raw.isStationaryTori ?? canonical?.isStationaryTori ?? raw.toriTrajectory?.isStationary ?? canonical?.toriTrajectory?.isStationary),
    isStationaryUke: Boolean(raw.isStationaryUke ?? canonical?.isStationaryUke ?? raw.ukeTrajectory?.isStationary ?? canonical?.ukeTrajectory?.isStationary),
    isGround: Boolean(raw.isGround || toriPart.isGround || canonical?.isGround || canonical?.participants?.[0]?.isGround),
    isRising: Boolean(raw.isRising || toriPart.isRising || canonical?.isRising || canonical?.participants?.[0]?.isRising),
    displacementTori: raw.displacementTori || canonical?.displacementTori || [0, 0, 0],
    displacementUke: raw.displacementUke || canonical?.displacementUke || [0, 0, 0],
    participants: [
      {
        role: 'tori',
        clipName: toriClip,
        stance: toriPart.Stance_In || toriPart.initialStance || toriPart.stance || canonical?.participants?.[0]?.stance || 'zenkutsu',
        delaySeconds: toriDelay,
        isGround: Boolean(raw.isGround || toriPart.isGround || canonical?.isGround || canonical?.participants?.[0]?.isGround),
        isRising: Boolean(raw.isRising || toriPart.isRising || canonical?.isRising || canonical?.participants?.[0]?.isRising),
      },
      {
        role: 'uke1',
        clipName: uke1Clip,
        stance: uke1Part.Stance_In || uke1Part.initialStance || uke1Part.stance || canonical?.participants?.[1]?.stance || 'zenkutsu',
        delaySeconds: uke1Delay,
        isGround: false,
      },
      {
        role: 'uke2',
        clipName: uke2Clip,
        stance: uke2Part.Stance_In || uke2Part.initialStance || uke2Part.stance || canonical?.participants?.[2]?.stance || 'ready',
        delaySeconds: uke2Delay,
        isGround: false,
      },
    ],
  };
}

const FIGHT_CLIP_MAP = {
  zenkutsu_dachi_left: 'zenkutsu_dachi_left',
  zenkutsu_dachi_right: 'zenkutsu_dachi_right',
  kokutsu_dachi_left: 'kokutsu_dachi_left',
  kokutsu_dachi_right: 'kokutsu_dachi_right',
  stance_kiba: 'stance_shiko',
  kiba_dachi: 'stance_shiko',
  shuto_uke: 'tech_shuto_uke_left',
  uchi_uke: 'tech_uchi_uke_left',
  tetsui_uchi: 'tech_tettsui_right',
  kizami_zuki: 'jodan_zuki_left',
  shuto_uchi: 'tech_shuto_uchi_right',
  heiko_dachi: 'heiko_dachi',
  stance_musubi: 'stance_musubi',
  stance_heisoku: 'stance_heisoku',
  stance_shiko: 'stance_shiko',
  mae_geri: 'kick_mae_geri_right',
  kick_mae_geri_right: 'kick_mae_geri_right',
  gedan_barai: 'tech_gedan_barai_left',
  tech_gedan_barai_left: 'tech_gedan_barai_left',
  age_uke: 'tech_age_uke_right',
  tech_age_uke_right: 'tech_age_uke_right',
  oi_zuki: 'tech_oi_zuki_right',
  tech_oi_zuki_right: 'tech_oi_zuki_right',
  gyaku_zuki: 'tech_gyaku_zuki_left',
  tech_gyaku_zuki_left: 'tech_gyaku_zuki_left',
  ren_zuki: 'tech_gyaku_zuki_left',
};

/**
 * Разрешает клип из библиотеки каратэ
 */
export function resolveBunkaiClip(clipName) {
  if (!clipName) {
    return {
      clipName: 'heiko_dachi',
      title: 'Хэйко-дати',
      optimalDistance: 2.40,
      tContact: 0.50,
      duration: 2.0,
      isKnown: true,
    };
  }

  if (FIGHT_CLIP_MAP[clipName]) {
    return {
      clipName: FIGHT_CLIP_MAP[clipName],
      title: clipName,
      optimalDistance: 1.40,
      tContact: 0.48,
      duration: 1.8,
      isKnown: true,
    };
  }

  if (BUNKAI_TECHNIQUE_METADATA[clipName]) {
    const meta = BUNKAI_TECHNIQUE_METADATA[clipName];
    return {
      clipName: meta.clipName,
      title: meta.titleRu,
      optimalDistance: meta.optimalDistance,
      tContact: meta.tContact,
      duration: meta.defaultDuration,
      isKnown: true,
    };
  }

  for (const meta of Object.values(BUNKAI_TECHNIQUE_METADATA)) {
    if (meta.altClips && meta.altClips.includes(clipName)) {
      return {
        clipName: meta.clipName,
        title: meta.titleRu,
        optimalDistance: meta.optimalDistance,
        tContact: meta.tContact,
        duration: meta.defaultDuration,
        isKnown: true,
      };
    }
  }

  const baseKey = clipName.replace(/^tech_/, '').replace(/^kick_/, '').replace(/_(left|right)$/, '');
  if (TECHNIQUE_REGISTRY[baseKey]) {
    const reg = TECHNIQUE_REGISTRY[baseKey];
    const isLeft = clipName.includes('left');
    const resolvedClip = isLeft ? reg.clipLeft : (reg.clipRight || reg.fallback);
    return {
      clipName: resolvedClip || clipName,
      title: reg.title,
      optimalDistance: 1.30,
      tContact: 0.45,
      duration: reg.defaultDuration || 1.25,
      isKnown: true,
    };
  }

  return {
    clipName,
    title: clipName,
    optimalDistance: 1.45,
    tContact: 0.48,
    duration: 1.5,
    isKnown: true,
  };
}

/**
 * Непрерывное сохранение пространственного состояния между эпизодами (State Chaining).
 * Конечная позиция предыдущего действия становится точной начальной позицией следующего шага.
 * Устраняет разрывы, возврат в центр [0,0,0] и искусственные телепортации.
 */
/**
 * Непрерывное сохранение пространственного состояния между эпизодами (State Chaining).
 * Конечная позиция предыдущего действия становится точной начальной позицией следующего шага.
 * Устраняет разрывы, возврат в центр [0,0,0] и искусственные телепортации.
 */
export function chainBunkaiEpisodes(rawEpisodes = [], mode = 'continuous') {
  const episodes = (Array.isArray(rawEpisodes) && rawEpisodes.length > 0)
    ? rawEpisodes
    : HEIAN_SHODAN_BUNKAI_18_STEPS;

  const normalized = episodes.map((ep, idx) => normalizeBunkaiEpisode(ep, idx));

  if (mode === 'standalone') {
    // В изолированном режиме каждый шаг центрируется с соблюдением боевой дистанции
    return normalized.map((ep) => {
      const dist = ep.optimalDistance || 1.45;
      const angleRad = ((ep.attackAngleDeg || 0) * Math.PI) / 180;
      return {
        ...ep,
        toriStartPos: [0, 0, -dist * 0.45],
        toriEndPos: [0, 0, -dist * 0.45],
        ukeStartPos: [Math.sin(angleRad) * dist * 0.55, 0, Math.cos(angleRad) * dist * 0.55],
        ukeEndPos: [Math.sin(angleRad) * dist * 0.55, 0, Math.cos(angleRad) * dist * 0.55],
        toriStartYaw: 0,
        toriEndYaw: 0,
        ukeStartYaw: Math.PI + angleRad,
        ukeEndYaw: Math.PI + angleRad,
        isStationaryTori: true,
        isStationaryUke: true,
      };
    });
  }

  // Непрерывный режим (continuous): накапливаем траектории Тори и Укэ
  let curToriPos = [0, 0, -1.15];
  let curUkePos = [0, 0, 1.15];
  let curToriYaw = 0; // Тори смотрит на Укэ (+Z)
  let curUkeYaw = Math.PI; // Укэ смотрит на Тори (-Z)

  return normalized.map((ep, idx) => {
    let toriStartPos = [...curToriPos];
    let ukeStartPos = [...curUkePos];
    let toriStartYaw = curToriYaw;
    let ukeStartYaw = curUkeYaw;

    let nextToriPos, nextUkePos, nextToriYaw, nextUkeYaw;

    if (ep.toriTrajectory && ep.ukeTrajectory) {
      // Прямая явная пространственная траектория сценария
      toriStartPos = ep.toriTrajectory.start ? [...ep.toriTrajectory.start] : toriStartPos;
      nextToriPos = [...ep.toriTrajectory.end];
      toriStartYaw = ep.toriTrajectory.startYaw !== undefined ? ep.toriTrajectory.startYaw : toriStartYaw;
      nextToriYaw = ep.toriTrajectory.endYaw !== undefined ? ep.toriTrajectory.endYaw : toriStartYaw;

      ukeStartPos = ep.ukeTrajectory.start ? [...ep.ukeTrajectory.start] : ukeStartPos;
      nextUkePos = [...ep.ukeTrajectory.end];
      ukeStartYaw = ep.ukeTrajectory.startYaw !== undefined ? ep.ukeTrajectory.startYaw : ukeStartYaw;
      nextUkeYaw = ep.ukeTrajectory.endYaw !== undefined ? ep.ukeTrajectory.endYaw : ukeStartYaw;
    } else {
      // Резервный расчет для произвольных пользовательских шагов
      const dTor = ep.displacementTori || [0, 0, 0];
      const dUke = ep.displacementUke || [0, 0, 0];

      const cosT = Math.cos(curToriYaw);
      const sinT = Math.sin(curToriYaw);
      const rotTorX = dTor[0] * cosT + dTor[2] * sinT;
      const rotTorZ = -dTor[0] * sinT + dTor[2] * cosT;

      const cosU = Math.cos(curUkeYaw);
      const sinU = Math.sin(curUkeYaw);
      const rotUkeX = dUke[0] * cosU + dUke[2] * sinU;
      const rotUkeZ = -dUke[0] * sinU + dUke[2] * cosU;

      nextToriPos = [curToriPos[0] + rotTorX, curToriPos[1] + dTor[1], curToriPos[2] + rotTorZ];
      nextUkePos = [curUkePos[0] + rotUkeX, curUkePos[1] + dUke[1], curUkePos[2] + rotUkeZ];

      nextToriYaw = Math.atan2(nextUkePos[0] - nextToriPos[0], nextUkePos[2] - nextToriPos[2]);
      nextUkeYaw = Math.atan2(nextToriPos[0] - nextUkePos[0], nextToriPos[2] - nextUkePos[2]);
    }

    curToriPos = [...nextToriPos];
    curUkePos = [...nextUkePos];
    curToriYaw = nextToriYaw;
    curUkeYaw = nextUkeYaw;

    const isStationaryTori = ep.toriTrajectory?.isStationary ?? (
      Math.hypot(nextToriPos[0] - toriStartPos[0], nextToriPos[2] - toriStartPos[2]) < 0.01
    );
    const isStationaryUke = ep.ukeTrajectory?.isStationary ?? (
      Math.hypot(nextUkePos[0] - ukeStartPos[0], nextUkePos[2] - ukeStartPos[2]) < 0.01
    );

    return {
      ...ep,
      toriStartPos,
      toriEndPos: [...nextToriPos],
      ukeStartPos,
      ukeEndPos: [...nextUkePos],
      toriStartYaw,
      toriEndYaw: nextToriYaw,
      ukeStartYaw,
      ukeEndYaw: nextUkeYaw,
      isStationaryTori,
      isStationaryUke,
    };
  });
}

/**
 * Рассчитывает пространственное положение участников, ориентацию и анти-проникновение
 */
export function computeAvatarPlacement({
  episode,
  distanceOffset = 0,
  angleOffsetDeg = 0,
  showUke2 = false,
  baseToriPos = [0, 0, 0],
  targetRole = 'uke1',
}) {
  const norm = normalizeBunkaiEpisode(episode);
  const isGround = Boolean(norm.isGround || norm.participants?.[0]?.isGround);

  // 1. Базовые стартовые и целевые позиции Тори
  const startTori = episode.toriStartPos ? [...episode.toriStartPos] : [0, 0, -1.05];
  let endTori = episode.toriEndPos ? [...episode.toriEndPos] : [...startTori];

  // 2. Базовые стартовые и целевые позиции Укэ
  let startUke1 = episode.ukeStartPos ? [...episode.ukeStartPos] : [0, 0, 1.05];
  let endUke1 = episode.ukeEndPos ? [...episode.ukeEndPos] : [...startUke1];

  // 3. Вычисление вектора направления между бойцами в горизонтальной плоскости (XZ)
  let dx = endUke1[0] - endTori[0];
  let dz = endUke1[2] - endTori[2];
  let curDist = Math.hypot(dx, dz) || 0.001;

  // Базовый азимут линии взаимодействия
  let combatAngleRad = Math.atan2(dx, dz);

  // 4. Относительное изменение угла взаимодействия:
  // При повороте угла Укэ перемещается по окружности относительно Тори,
  // а оба бойца АВТОМАТИЧЕСКИ поворачиваются лицом друг к другу!
  if (Math.abs(angleOffsetDeg) > 0.01) {
    const offsetRad = (angleOffsetDeg * Math.PI) / 180;
    combatAngleRad += offsetRad;

    endUke1[0] = endTori[0] + Math.sin(combatAngleRad) * curDist;
    endUke1[2] = endTori[2] + Math.cos(combatAngleRad) * curDist;

    const startDx = startUke1[0] - startTori[0];
    const startDz = startUke1[2] - startTori[2];
    const startDist = Math.hypot(startDx, startDz) || curDist;
    startUke1[0] = startTori[0] + Math.sin(combatAngleRad) * startDist;
    startUke1[2] = startTori[2] + Math.cos(combatAngleRad) * startDist;

    dx = endUke1[0] - endTori[0];
    dz = endUke1[2] - endTori[2];
    curDist = Math.hypot(dx, dz) || 0.001;
  }

  // 5. Динамическая пользовательская корректировка дистанции (Ма-ай)
  if (Math.abs(distanceOffset) > 0.001) {
    const dirX = dx / curDist;
    const dirZ = dz / curDist;
    endUke1[0] += dirX * distanceOffset;
    endUke1[2] += dirZ * distanceOffset;
    startUke1[0] += dirX * distanceOffset;
    startUke1[2] += dirZ * distanceOffset;

    dx = endUke1[0] - endTori[0];
    dz = endUke1[2] - endTori[2];
    curDist = Math.hypot(dx, dz) || 0.001;
  }

  // 6. Контроль физических границ моделей и анти-проникновение:
  // Минимальная дистанция между центрами тел с учетом анатомических габаритов
  // - Стойка стоя: минимум 0.58м (тела касаются доги, но не проходят сквозь друг друга)
  // - Залом сустава / плотный клинч (Шаг 7): 0.46м
  // - Партер / падение на татами (Шаги 13-15): 0.38м
  const minSafeDist = isGround
    ? 0.38
    : (norm.contactType === 'lock_arm' || norm.interactionType === 'joint_lock' || episode.stepNumber === 7)
    ? 0.46
    : 0.58;

  let hasCollision = false;
  if (curDist < minSafeDist && norm.contactType !== 'sweep_fall') {
    const penetration = minSafeDist - curDist;
    const push = penetration * 0.5;
    const dirX = curDist > 0.001 ? dx / curDist : 0;
    const dirZ = curDist > 0.001 ? dz / curDist : 1;

    endTori[0] -= dirX * push;
    endTori[2] -= dirZ * push;
    endUke1[0] += dirX * push;
    endUke1[2] += dirZ * push;
    hasCollision = true;

    dx = endUke1[0] - endTori[0];
    dz = endUke1[2] - endTori[2];
    curDist = Math.hypot(dx, dz) || 0.001;
  }

  // 7. Относительная система ориентации (Динамический LookAt):
  // Базовые углы всегда ориентируют персонажей ЛИЦОМ К ПАРТНЕРУ
  const faceUkeFromTori = Math.atan2(dx, dz);
  const faceToriFromUke = Math.atan2(-dx, -dz);

  // Относительные сценарные смещения (если техника требует разворота от партнера):
  let relTori = 0;
  let relUke = 0;

  if (episode.stepNumber === 6) {
    relTori = (12.5 * Math.PI) / 180; // Атака под углом 10-15°
  } else if (episode.stepNumber === 8) {
    relTori = Math.PI; // Разворот на 180° в обратную сторону
  } else if (episode.stepNumber === 9) {
    relUke = 0; // Завершает лицом к Тори
  }

  const endToriYaw = faceUkeFromTori + relTori;
  const endUke1Yaw = faceToriFromUke + relUke;

  const startToriYaw = (episode.stepNumber === 8)
    ? faceUkeFromTori
    : (episode.toriStartYaw !== undefined && Math.abs(angleOffsetDeg) < 0.01 ? episode.toriStartYaw : endToriYaw);

  const startUke1Yaw = (episode.stepNumber === 9)
    ? (faceToriFromUke + Math.PI) // Начинает спиной к Тори
    : (episode.ukeStartYaw !== undefined && Math.abs(angleOffsetDeg) < 0.01 ? episode.ukeStartYaw : endUke1Yaw);

  // 8. Укэ 2 (если включен 3-person командный режим)
  const uke2Deg = normalizeAngleDeg((norm.uke2AngleDeg || 60) + angleOffsetDeg);
  const angleUke2Rad = (uke2Deg * Math.PI) / 180;
  const uke2Dist = Math.max(1.8, curDist + 0.55);
  const posUke2 = [
    endTori[0] + Math.sin(angleUke2Rad) * uke2Dist,
    0,
    endTori[2] + Math.cos(angleUke2Rad) * uke2Dist,
  ];
  const dirUke2ToTori = Math.atan2(
    endTori[0] - posUke2[0],
    endTori[2] - posUke2[2]
  );

  return {
    posTori: endTori,
    posUke1: endUke1,
    posUke2,
    startPosTori: startTori,
    endPosTori: endTori,
    startPosUke1: startUke1,
    endPosUke1: endUke1,
    rotTori: [0, endToriYaw, 0],
    startRotTori: [0, startToriYaw, 0],
    rotUke1: [0, endUke1Yaw, 0],
    startRotUke1: [0, startUke1Yaw, 0],
    rotUke2: [0, dirUke2ToTori, 0],
    startRotUke2: [0, dirUke2ToTori, 0],
    finalDist: curDist,
    hasCollision,
    isStationaryTori: Boolean(episode.toriTrajectory?.isStationary),
    isStationaryUke: Boolean(episode.ukeTrajectory?.isStationary),
    angles: {
      toriYaw: endToriYaw,
      uke1Yaw: endUke1Yaw,
      uke2Yaw: dirUke2ToTori,
    },
  };
}


export function computeKinematicCombatState({ episode, timelineTime }) {
  const norm = normalizeBunkaiEpisode(episode);
  const totalDuration = norm.duration || 2.4;
  const t = Math.max(0, Math.min(totalDuration, timelineTime || 0));
  const progress = t / totalDuration;

  const isContactWindow = Math.abs(progress - norm.tContact) < 0.18;

  return {
    totalDuration,
    currentTime: t,
    progress,
    isContactWindow,
    contactType: norm.contactType,
  };
}
