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
 * Анатомические спецификации стоек каратэ Шотокан с явным разделением сторон (Хидари / Миги).
 * Включает точное распределение веса, ориентацию стоп, положение таза и сгиб коленей.
 */
export const SHOTOKAN_STANCES = {
  zenkutsu_dachi_left: {
    id: 'zenkutsu_dachi_left',
    nameRu: 'Дзэнкуцу-дати',
    kanji: '前屈立ち',
    side: 'left',
    sideRu: 'Хидари (левосторонняя)',
    weightRatio: [60, 40],
    feetDistance: 1.25,
    feetWidth: 0.35,
    leadFootAngle: 0,
    rearFootAngle: 45,
    hipAngle: 45,
    kneeFlex: 'Переднее колено согнуто под 90°, заднее колено выпрямлено',
    description: 'Передняя ударно-пробивная стойка. 60% веса на передней левой ноге, колено строго над пальцами стопы, задняя нога выпрямлена с упором в пятку.',
  },
  zenkutsu_dachi_right: {
    id: 'zenkutsu_dachi_right',
    nameRu: 'Дзэнкуцу-дати',
    kanji: '前屈立ち',
    side: 'right',
    sideRu: 'Миги (правосторонняя)',
    weightRatio: [60, 40],
    feetDistance: 1.25,
    feetWidth: 0.35,
    leadFootAngle: 0,
    rearFootAngle: -45,
    hipAngle: -45,
    kneeFlex: 'Переднее колено согнуто под 90°, заднее колено выпрямлено',
    description: 'Передняя ударно-пробивная стойка. 60% веса на передней правой ноге, колено строго над пальцами стопы, задняя нога выпрямлена с упором в пятку.',
  },
  kokutsu_dachi_left: {
    id: 'kokutsu_dachi_left',
    nameRu: 'Кокуцу-дати',
    kanji: '後屈立ち',
    side: 'left',
    sideRu: 'Хидари (левосторонняя)',
    weightRatio: [30, 70],
    feetDistance: 1.10,
    feetWidth: 0.12,
    leadFootAngle: 0,
    rearFootAngle: 90,
    hipAngle: 90,
    kneeFlex: 'Заднее правое колено согнуто под 100°, переднее слегка расслаблено',
    description: 'Защитная стойка с оттяжкой центра тяжести назад. 70% веса на задней правой ноге, пятки на одной линии под углом 90°.',
  },
  kokutsu_dachi_right: {
    id: 'kokutsu_dachi_right',
    nameRu: 'Кокуцу-дати',
    kanji: '後屈立ち',
    side: 'right',
    sideRu: 'Миги (правосторонняя)',
    weightRatio: [30, 70],
    feetDistance: 1.10,
    feetWidth: 0.12,
    leadFootAngle: 0,
    rearFootAngle: -90,
    hipAngle: -90,
    kneeFlex: 'Заднее левое колено согнуто под 100°, переднее слегка расслаблено',
    description: 'Защитная стойка с оттяжкой центра тяжести назад. 70% веса на задней левой ноге, пятки на одной линии под углом 90°.',
  },
  kiba_dachi: {
    id: 'kiba_dachi',
    nameRu: 'Киба-дати',
    kanji: '騎馬立ち',
    side: 'symmetric',
    sideRu: 'Симметричная',
    weightRatio: [50, 50],
    feetDistance: 1.15,
    feetWidth: 1.15,
    leadFootAngle: 0,
    rearFootAngle: 0,
    hipAngle: 0,
    kneeFlex: 'Оба колена разведены наружу и напряжены под 110°',
    description: 'Стойка всадника. Стопы параллельны, расстояние две ширины плеч, колени напряжены наружу, таз подобран, вес строго 50/50.',
  },
  fudo_dachi: {
    id: 'fudo_dachi',
    nameRu: 'Фудо-дати (Сочин-дати)',
    kanji: '不動立ち',
    side: 'left',
    sideRu: 'Хидари (левосторонняя)',
    weightRatio: [50, 50],
    feetDistance: 1.20,
    feetWidth: 0.40,
    leadFootAngle: 15,
    rearFootAngle: 45,
    hipAngle: 45,
    kneeFlex: 'Оба колена согнуты для максимальной устойчивости',
    description: 'Непоколебимая укорененная стойка. Сочетает стабильность Киба-дати и динамику Дзэнкуцу-дати.',
  },
  fudo_dachi_right: {
    id: 'fudo_dachi_right',
    nameRu: 'Фудо-дати (Сочин-дати)',
    kanji: '不動立ち',
    side: 'right',
    sideRu: 'Миги (правосторонняя)',
    weightRatio: [50, 50],
    feetDistance: 1.20,
    feetWidth: 0.40,
    leadFootAngle: -15,
    rearFootAngle: -45,
    hipAngle: -45,
    kneeFlex: 'Оба колена согнуты для максимальной устойчивости',
    description: 'Непоколебимая укорененная стойка. Сочетает стабильность Киба-дати и динамику Дзэнкуцу-дати.',
  },
  heiko_dachi: {
    id: 'heiko_dachi',
    nameRu: 'Хэйко-дати',
    kanji: '平行立ち',
    side: 'symmetric',
    sideRu: 'Симметричная',
    weightRatio: [50, 50],
    feetDistance: 0.35,
    feetWidth: 0.35,
    leadFootAngle: 0,
    rearFootAngle: 0,
    hipAngle: 0,
    kneeFlex: 'Естественно выпрямлены',
    description: 'Параллельная стойка готовности. Стопы параллельны на ширине плеч.',
  },
  stance_musubi: {
    id: 'stance_musubi',
    nameRu: 'Мусуби-дати',
    kanji: '結び立ち',
    side: 'symmetric',
    sideRu: 'Симметричная',
    weightRatio: [50, 50],
    feetDistance: 0.05,
    feetWidth: 0.20,
    leadFootAngle: 22.5,
    rearFootAngle: -22.5,
    hipAngle: 0,
    kneeFlex: 'Выпрямлены',
    description: 'Стойка поклона рэй. Пятки сомкнуты вместе, носки развернуты под 45°.',
  },
  stance_heisoku: {
    id: 'stance_heisoku',
    nameRu: 'Хэйсоку-дати',
    kanji: '閉足立ち',
    side: 'symmetric',
    sideRu: 'Симметричная',
    weightRatio: [50, 50],
    feetDistance: 0.0,
    feetWidth: 0.15,
    leadFootAngle: 0,
    rearFootAngle: 0,
    hipAngle: 0,
    kneeFlex: 'Выпрямлены',
    description: 'Сомкнутая стойка ожидания. Стопы плотно прижаты друг к другу.',
  },
  stance_shiko: {
    id: 'stance_shiko',
    nameRu: 'Сико-дати',
    kanji: '四股立ち',
    side: 'symmetric',
    sideRu: 'Симметричная',
    weightRatio: [50, 50],
    feetDistance: 1.15,
    feetWidth: 1.15,
    leadFootAngle: 45,
    rearFootAngle: -45,
    hipAngle: 0,
    kneeFlex: 'Колени согнуты наружу',
    description: 'Квадратная стойка. Широкая позиция, носки развернуты наружу под 45°.',
  },
};

/**
 * Каноническая пространственная система координат Бункай (Bunkai 3D Coordinate System)
 * Соответствует мировой декартовой системе координат Three.js на площадке татами:
 * - Ось X (Красная): Латеральная ось / Боковое смещение (Тай-сабаки, уход с линии атаки)
 * - Ось Y (Зеленая): Вертикальная ось / Уровни атаки и стоек (Дзёдан, Тюдан, Гэдан, Партер)
 * - Ось Z (Синяя): Продольная ось / Линия атаки и боевая дистанция (Ма-ай)
 * - Поворот Yaw: Угол ориентации вокруг вертикальной оси Y (0° = вдоль +Z на Север)
 */
export const BUNKAI_COORDINATE_SYSTEM = {
  origin: {
    name: 'Центр татами (Origin)',
    coords: [0, 0, 0],
    description: 'Начальная точка отсчета поединка и осевая линия Додзё',
  },
  axes: {
    X: {
      name: 'Ось X (Латеральная / Боковая)',
      color: '#ef4444',
      positiveDirection: 'Вправо / Восток (+X)',
      negativeDirection: 'Влево / Запад (-X)',
      tacticalRole: 'Смещение с линии атаки (Тай-сабаки, челночный уход юри-аси, фланговый маневр)',
      unit: 'метры (м)',
    },
    Y: {
      name: 'Ось Y (Вертикальная / Высота)',
      color: '#22c55e',
      positiveDirection: 'Вверх (+Y)',
      negativeDirection: 'Вниз (-Y)',
      tacticalRole: 'Боевые уровни: Партер (0.08м), Гэдан (0.65м), Тюдан (1.15м), Дзёдан (1.55м)',
      unit: 'метры (м)',
      levels: {
        tatami: { y: 0.0, label: 'Татами (Пол)' },
        ground: { y: 0.08, label: 'Партер / Укэми' },
        gedan: { y: 0.65, label: 'Гэдан (Нижний уровень)' },
        chudan: { y: 1.15, label: 'Тюдан (Средний уровень / корпус)' },
        jodan: { y: 1.55, label: 'Дзёдан (Верхний уровень / голова)' },
      },
    },
    Z: {
      name: 'Ось Z (Продольная / Дистанция боя)',
      color: '#3b82f6',
      positiveDirection: 'Вперед / Север (+Z) — вектор атаки Тори',
      negativeDirection: 'Назад / Юг (-Z) — отступление / разрыв дистанции',
      tacticalRole: 'Боевая дистанция (Ма-ай) и директриса атаки нападающего',
      unit: 'метры (м)',
    },
  },
  orientation: {
    name: 'Ориентация и угол поворота тела (Yaw / Heading)',
    referenceAxis: 'Вращение вокруг вертикальной оси Y',
    unit: 'градусы (°) и радианы (rad)',
    compassPoints: [
      { angleDeg: 0, label: '0° (Север)', desc: 'Прямо вперед вдоль оси +Z (директриса атаки Тори)' },
      { angleDeg: 35, label: '+35° (Тай-сабаки вправо)', desc: 'Канонический уход вправо под 35° с сохранением взгляда на противника' },
      { angleDeg: 45, label: '+45° (Северо-Восток)', desc: 'Диагональный шаг вправо-вперед' },
      { angleDeg: 90, label: '+90° (Восток)', desc: 'Поворот строго направо вдоль оси +X' },
      { angleDeg: 180, label: '180° / -180° (Юг)', desc: 'Фронтально навстречу вдоль оси -Z (исходная стойка Укэ)' },
      { angleDeg: -35, label: '-35° (Тай-сабаки влево)', desc: 'Канонический уход влево под -35° с сохранением взгляда на противника' },
      { angleDeg: -45, label: '-45° (Северо-Запад)', desc: 'Диагональный шаг влево-вперед' },
      { angleDeg: -90, label: '-90° (Запад)', desc: 'Поворот строго налево вдоль оси -X' },
    ],
  },
};

/**
 * 5 Режимов пространственной ориентации каратистов
 */
export const BUNKAI_ORIENTATION_MODES = [
  { id: 'mode1_free', label: 'Режим 1: Свободный поворот', desc: 'Угол относительно мировой оси координат' },
  { id: 'mode2_look_at', label: 'Режим 2: Ориентация на противника', desc: 'Авто-поворот всем телом на соперника (0°)' },
  { id: 'mode3_relative_angle', label: 'Режим 3: Относительный угол', desc: 'Угол к сопернику (0°, 30°, 45°, 90°, 180°) с перестроением тела и стоп' },
  { id: 'mode4_fixed_direction', label: 'Режим 4: Сохранение направления', desc: 'Жесткий вектор вне зависимости от маневров противника' },
  { id: 'mode5_track_opponent', label: 'Режим 5: Следование за противником', desc: 'Непрерывное сопровождение движения противника' },
];

/**
 * Механика поворота каратиста
 */
export const BUNKAI_TURN_MECHANICS = [
  { id: 'pivot_support', label: 'Поворот на опорной ноге', desc: 'Вращение вокруг опорной стопы без отрыва' },
  { id: 'step_lead', label: 'Перестановка передней ноги', desc: 'Шаг передней ногой с разворотом таза и плеч' },
  { id: 'step_rear', label: 'Перестановка задней ноги', desc: 'Завод задней ноги с переходом в новую стойку' },
  { id: 'step_turn_90', label: 'Разворот через шаг на 90°', desc: 'Классический переход под прямым углом' },
  { id: 'step_turn_180', label: 'Разворот через шаг на 180°', desc: 'Полный боевой разворот (Маваттэ)' },
  { id: 'arbitrary', label: 'Произвольный угол', desc: 'Плавная динамическая подстройка положения тела' },
];

/**
 * 14 Типов действий в универсальной панели управления
 */
export const BUNKAI_ACTION_TYPES = [
  { id: 'stance', label: 'Стойка (Дати)', icon: 'Footprints' },
  { id: 'locomotion', label: 'Перемещение (Сабаки)', icon: 'Move' },
  { id: 'turn', label: 'Поворот / Разворот (Тэнсин)', icon: 'RotateCw' },
  { id: 'strike', label: 'Удар рукой (Цуки / Учи)', icon: 'Zap' },
  { id: 'kick', label: 'Удар ногой (Гэри)', icon: 'Flame' },
  { id: 'block', label: 'Блок (Укэ)', icon: 'Shield' },
  { id: 'grab', label: 'Захват (Цуками)', icon: 'Hand' },
  { id: 'hold', label: 'Удержание (Осаэ)', icon: 'Lock' },
  { id: 'joint_lock', label: 'Болевой приём (Кансэцу)', icon: 'Activity' },
  { id: 'sweep', label: 'Подсечка (Аси-барай)', icon: 'CornerDownRight' },
  { id: 'throw', label: 'Бросок (Нагэ)', icon: 'TrendingDown' },
  { id: 'fall', label: 'Падение со страховкой (Укэми)', icon: 'ShieldAlert' },
  { id: 'rise', label: 'Подъём с татами (Окиагари)', icon: 'TrendingUp' },
  { id: 'combo', label: 'Комбинированное действие (Рэндзоку)', icon: 'Layers' },
];

/**
 * Биомеханическая проверка корректности параметров движения каратиста
 */
export function validateBunkaiBiomechanics({
  stance = '',
  stanceSide = '',
  limbSide = '',
  orientationMode = 'mode2_look_at',
  relativeAngleDeg = 0,
  distance = 1.45,
  isStationary = false,
  displacement = [0, 0, 0],
  contactType = 'none',
  jointAngleDeg = 0,
}) {
  const warnings = [];
  const checks = [];

  // 1. Проверка соответствия стойки и стороны
  if (stance && stanceSide) {
    if (stance.includes('left') && stanceSide === 'right') {
      warnings.push('Несоответствие: выбрана левосторонняя стойка (Хидари), но указана правая сторона (Миги).');
    } else if (stance.includes('right') && stanceSide === 'left') {
      warnings.push('Несоответствие: выбрана правосторонняя стойка (Миги), но указана левая сторона (Хидари).');
    } else {
      checks.push('Сторона стойки строго согласована с анатомией ног.');
    }
  }

  // 2. Проверка поворота всего тела (исключение скрученной головы без тела)
  if (orientationMode === 'mode3_relative_angle') {
    const angle = Math.abs(relativeAngleDeg || 0);
    if (angle > 90) {
      checks.push(`Разворот на ${angle}° выполняется через шаг (Маваттэ) с перестановкой опорной стопы.`);
    } else if (angle > 0) {
      checks.push(`Угол ${angle}° применен к ориентации всего тела: стопы, таз и корпус перестроены.`);
    }
  }

  // 3. Проверка безопасной дистанции (анти-проникновение)
  if (distance !== undefined && distance !== null) {
    if (distance < 0.58 && contactType !== 'sweep' && contactType !== 'joint_lock' && contactType !== 'clinch') {
      warnings.push(`Дистанция ${distance.toFixed(2)}м слишком мала: опасность геометрического пересечения торсов.`);
    } else if (distance > 2.6) {
      warnings.push(`Дистанция ${distance.toFixed(2)}м превышает эффективный радиус атаки (То-ма).`);
    } else {
      checks.push(`Боевая дистанция ${distance.toFixed(2)}м корректна для выбранного взаимодействия.`);
    }
  }

  // 4. Проверка скольжения стоп (anti-skating)
  if (isStationary && displacement) {
    const dispMag = Math.hypot(displacement[0] || 0, displacement[2] || 0);
    if (dispMag > 0.05) {
      warnings.push(`Техника заявлена как стационарная, но задано линейное смещение ${dispMag.toFixed(2)}м (риск скольжения).`);
    } else {
      checks.push('Стопы жестко прижаты к татами (скольжение исключено).');
    }
  }

  // 5. Проверка суставных ограничений при болевых приемах
  if (contactType === 'joint_lock' || contactType === 'lock_arm') {
    if (jointAngleDeg && Math.abs(jointAngleDeg) > 45) {
      warnings.push(`Угол залома сустава ${jointAngleDeg}° превышает физиологический предел подвижности.`);
    } else {
      checks.push('Биомеханика суставного замка в пределах допустимой анатомии.');
    }
  }

  return {
    isValid: warnings.length === 0,
    warnings,
    checks,
  };
}

/**
 * Полный 18-шаговый сценарий Бункая ката Хэйан Шодан из пошагового описания.
 * 1 — Тори (атакующий), 2 — Укэ (защищающийся).
 */
export const HEIAN_SHODAN_BUNKAI_18_STEPS = [
  // 1: Хейко дати
  {
    stepNumber: 1,
    title: 'Шаг 1: Хэйко-дати',
    description: '1 (Тори): Хейко дати. 2 (Укэ): Хейко дати.',
    notes: 'Исходная стойка готовности (2.10м)',
    optimalDistance: 2.10,
    attackAngleDeg: 0,
    contactType: 'none',
    interactionType: 'distance_only',
    tContact: 0.50,
    duration: 1.8,
    scenarioAngles: {
      label: 'Осевая линия 0° · 2.10м',
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
      { role: 'tori', clipName: 'heiko_dachi', stance: 'heiko_dachi', finalStance: 'heiko_dachi', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'heiko_dachi', stance: 'heiko_dachi', finalStance: 'heiko_dachi', delaySeconds: 0.0, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 2: Мусуби дати + поклон
  {
    stepNumber: 2,
    title: 'Шаг 2: Мусуби-дати + поклон',
    description: '1 (Тори): Мусуби дати + поклон. 2 (Укэ): Мусуби дати + поклон.',
    notes: 'Ритуальный поклон (рэй)',
    optimalDistance: 2.10,
    attackAngleDeg: 0,
    contactType: 'none',
    interactionType: 'distance_only',
    isBow: true,
    tContact: 0.50,
    duration: 2.2,
    scenarioAngles: {
      label: 'Поклон рэй · 2.10м',
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
      { role: 'tori', clipName: 'stance_musubi', stance: 'stance_musubi', finalStance: 'stance_musubi', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'stance_musubi', stance: 'stance_musubi', finalStance: 'stance_musubi', delaySeconds: 0.0, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 3: Хейко дати
  {
    stepNumber: 3,
    title: 'Шаг 3: Хэйко-дати',
    description: '1 (Тори): Хейко дати. 2 (Укэ): Хейко дати.',
    notes: 'Возврат в стойку готовности',
    optimalDistance: 2.10,
    attackAngleDeg: 0,
    contactType: 'none',
    interactionType: 'distance_only',
    tContact: 0.50,
    duration: 1.8,
    scenarioAngles: {
      label: 'Готовность Хэйко-дати · 2.10м',
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
      { role: 'tori', clipName: 'heiko_dachi', stance: 'heiko_dachi', finalStance: 'heiko_dachi', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'heiko_dachi', stance: 'heiko_dachi', finalStance: 'heiko_dachi', delaySeconds: 0.0, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 4: Хидари дзэнкуцу дати / Миги дзэнкуцу дати
  {
    stepNumber: 4,
    title: 'Шаг 4: Хидари дзэнкуцу-дати / Миги дзэнкуцу-дати',
    description: '1 (Тори): Хидари дзэнкуцу дати. 2 (Укэ): Миги дзэнкуцу дати.',
    notes: 'Вход на боевую дистанцию (1.70м)',
    optimalDistance: 1.70,
    attackAngleDeg: 0,
    contactType: 'none',
    interactionType: 'distance_only',
    tContact: 0.55,
    duration: 2.2,
    scenarioAngles: {
      label: 'Боевые стойки Дзэнкуцу-дати · 1.70м',
      toriAngleDeg: 0,
      ukeAngleDeg: 180,
      relativeAngleDeg: 0,
    },
    toriTrajectory: {
      start: [0, 0, -1.05],
      end: [0, 0, -0.45],
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
    displacementTori: [0, 0, 0.60],
    displacementUke: [0, 0, 0.20],
    participants: [
      { role: 'tori', clipName: 'enter_zenkutsu_left', stance: 'zenkutsu_dachi_left', finalStance: 'zenkutsu_dachi_left', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'step_backward_right + zenkutsu_dachi_right', stance: 'zenkutsu_dachi_right', finalStance: 'zenkutsu_dachi_right', delaySeconds: 0.0, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 5: Маэ-гэри / Шаг назад 30-45° гэдан-барай гяку-дзуки (юри-аши челнок)
  {
    stepNumber: 5,
    title: 'Шаг 5: Маэ-гэри — уход 35° (юри-аши), Гэдан-барай + Гяку-дзуки',
    description: '1 (Тори): Маэ-гэри приход в дзэнкуцу дати. 2 (Укэ): Шаг назад под углом 30-45 градусов дзэнкуцу дати гэдан-барай гяку-дзуки (юри-аши челнок).',
    notes: 'Сбив ноги блоком Гэдан-барай и контрудар Гяку-дзуки',
    optimalDistance: 1.20,
    attackAngleDeg: 0,
    contactType: 'block_gedan_counter',
    interactionType: 'body_contact',
    tContact: 0.42,
    duration: 2.8,
    scenarioAngles: {
      label: 'Тори Маэ-гэри 0° · Укэ уход 35° (юри-аши) · 1.20м',
      toriAngleDeg: 0,
      ukeAngleDeg: -163.0,
      retreatAngleDeg: 35,
    },
    toriTrajectory: {
      start: [0, 0, -0.45],
      end: [0, 0, 0.20],
      startYaw: 0,
      endYaw: 0,
      isStationary: false,
    },
    ukeTrajectory: {
      start: [0, 0, 1.25],
      end: [0.35, 0, 1.35],
      startYaw: Math.PI,
      endYaw: -Math.PI + 0.29,
      isStationary: false,
    },
    displacementTori: [0, 0, 0.65],
    displacementUke: [0.35, 0, 0.10],
    participants: [
      { role: 'tori', clipName: 'kick_mae_geri_right', stance: 'zenkutsu_dachi_right', finalStance: 'zenkutsu_dachi_right', landingMode: 'forward', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'tech_gedan_barai_left + tech_gyaku_zuki_right', stance: 'zenkutsu_dachi_left', finalStance: 'zenkutsu_dachi_left', delaySeconds: 0.12, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 6: Маэ-гэри гяку-дзуки (10-15°) / Возврат на ось: гэдан-барай, фудо-дати хайван укэ, дзэнкуцу тэтцуи гяку-дзуки
  {
    stepNumber: 6,
    title: 'Шаг 6: Маэ-гэри Гяку-дзуки — возврат на ось, Хайван-укэ, Тэтцуи и Гяку-дзуки',
    description: '1 (Тори): Маэ-гэри гяку-дзуки приход в дзэнкуцу дати под углом 10-15 градусов. 2 (Укэ): Шаг назад (возвращение на осевую линию) дзэнкуцу дати гэдан-барай, Фудо дати хайван укэ, Дзэнкуцу дати тэтцуи (рука-молот) гяку-дзуки.',
    notes: 'Возврат на осевую линию, серия блоков и контрударов в корпус',
    optimalDistance: 1.07,
    attackAngleDeg: 12,
    contactType: 'combo_block_counter',
    interactionType: 'body_contact',
    tContact: 0.44,
    duration: 3.3,
    scenarioAngles: {
      label: 'Тори угол 12° · Укэ возврат на ось · Контакт 1.07м',
      toriAngleDeg: 12,
      ukeAngleDeg: -178.0,
    },
    toriTrajectory: {
      start: [0, 0, 0.20],
      end: [0.14, 0, 0.85],
      startYaw: 0,
      endYaw: 0.21,
      isStationary: false,
    },
    ukeTrajectory: {
      start: [0.35, 0, 1.35],
      end: [0.18, 0, 1.92],
      startYaw: -Math.PI + 0.29,
      endYaw: -Math.PI + 0.04,
      isStationary: false,
    },
    displacementTori: [0.14, 0, 0.65],
    displacementUke: [-0.17, 0, 0.57],
    participants: [
      { role: 'tori', clipName: 'kick_mae_geri_right + tech_gyaku_zuki_right', stance: 'zenkutsu_dachi_left', finalStance: 'zenkutsu_dachi_left', landingMode: 'forward', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'tech_gedan_barai_left + tech_haishu_uke_left + tech_tettsui_right + tech_gyaku_zuki_right', stance: 'fudo_dachi', finalStance: 'zenkutsu_dachi_left', delaySeconds: 0.10, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 7: Шаг назад + вперёд Маэ-гэри ой-дзуки / Гэдан-барай, агэ-укэ, ГЯКУ АГЭ-УКЭ с выпадом вперёд (без захвата руки)
  {
    stepNumber: 7,
    title: 'Шаг 7: Маэ-гэри + Ой-дзуки — Гэдан-барай, Агэ-укэ и Гяку Агэ-укэ (без захвата)',
    description: '1 (Тори): Шаг назад дзэнкуцу дати + шаг вперёд Маэ-гэри ой-дзуки. 2 (Укэ): Шаг назад дзэнкуцу дати гэдан-барай, агэ-укэ и гяку агэ-укэ с выпадом вперёд.',
    notes: 'Захват руки заменён на обратный восходящий блок Гяку Агэ-укэ',
    optimalDistance: 0.97,
    attackAngleDeg: 12,
    contactType: 'block_gyaku_age_uke',
    interactionType: 'body_contact',
    tContact: 0.55,
    duration: 3.2,
    scenarioAngles: {
      label: 'Блок Гяку Агэ-укэ с выпадом вперёд · Контакт 0.97м',
      toriAngleDeg: 12,
      ukeAngleDeg: -168.0,
      retreatAngleDeg: 15,
    },
    toriTrajectory: {
      start: [0.14, 0, 0.85],
      end: [0.24, 0, 1.25],
      startYaw: 0.21,
      endYaw: 0.21,
      isStationary: false,
    },
    ukeTrajectory: {
      start: [0.18, 0, 1.92],
      end: [0.44, 0, 2.20],
      startYaw: -Math.PI + 0.04,
      endYaw: -Math.PI + 0.21,
      isStationary: false,
    },
    displacementTori: [0.10, 0, 0.40],
    displacementUke: [0.26, 0, 0.28],
    participants: [
      { role: 'tori', clipName: 'step_backward + kick_mae_geri_right + tech_oi_zuki_right', stance: 'zenkutsu_dachi_right', finalStance: 'zenkutsu_dachi_right', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'step_backward + tech_gedan_barai_left + tech_age_uke_left + tech_age_uke_right', stance: 'zenkutsu_dachi_left', finalStance: 'zenkutsu_dachi_left', delaySeconds: 0.08, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 8: Разворот Тори на 180° в миги дзэнкуцу / Шаг Укэ в сторону 30-45° с разворотом в хидари дзэнкуцу
  {
    stepNumber: 8,
    title: 'Шаг 8: Разворот Тори на 180° — проход Укэ во фланг под 35° и разворот',
    description: '1 (Тори): Шаг левой ногой с разворотом в обратную сторону в миги дзэнкуцу дати. 2 (Укэ): Шаг вперёд в сторону миги дзэнкуцу дати угол 30-45 градусов с последующим разворотом в хидари дзэнкуцу дати.',
    notes: 'Смена направления боя на противоположное (1.27м)',
    optimalDistance: 1.27,
    attackAngleDeg: 0,
    contactType: 'none',
    interactionType: 'tai_sabaki',
    tContact: 0.50,
    duration: 2.6,
    scenarioAngles: {
      label: 'Разворот 180° · Укэ уход 35° и разворот в Хидари дзэнкуцу',
      toriAngleDeg: -168.0,
      ukeAngleDeg: 11.0,
    },
    toriTrajectory: {
      start: [0.24, 0, 1.25],
      end: [0.24, 0, 1.25],
      startYaw: 0.21,
      endYaw: -2.93,
      isStationary: false,
    },
    ukeTrajectory: {
      start: [0.44, 0, 2.20],
      end: [0.00, 0, 0.00],
      startYaw: -Math.PI + 0.21,
      endYaw: 0.19,
      isStationary: false,
    },
    displacementTori: [0.00, 0, 0.00],
    displacementUke: [-0.44, 0, -2.20],
    participants: [
      { role: 'tori', clipName: 'turn_into_zenkutsu_right', stance: 'zenkutsu_dachi_right', finalStance: 'zenkutsu_dachi_right', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'step_forward_right + turn_into_zenkutsu_left', stance: 'zenkutsu_dachi_left', finalStance: 'zenkutsu_dachi_left', delaySeconds: 0.05, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 9: Маэ-гэри / Хидари хайван укэ, полшага назад хейсоку дати (спиной к 1), разворот в миги дзэнкуцу гэдан-барай гяку-дзуки
  {
    stepNumber: 9,
    title: 'Шаг 9: Маэ-гэри — Хайван-укэ (Хэйсоку-дати), разворот Гэдан-барай + Гяку-дзуки',
    description: '1 (Тори): Маэ-гэри. 2 (Укэ): Хидари хайван укэ, пол шага назад хейсоку дати (спиной к 1), разворот в миги дзэнкуцу дати гэдан-барай гяку-дзуки.',
    notes: 'Сбив ноги тыльной стороной предплечья, разворот и контрудар',
    optimalDistance: 1.12,
    attackAngleDeg: 0,
    contactType: 'block_haivan',
    interactionType: 'body_contact',
    tContact: 0.42,
    duration: 3.4,
    scenarioAngles: {
      label: 'Хайван-укэ в Хэйсоку-дати · Разворот в Миги дзэнкуцу · 1.12м',
      toriAngleDeg: -168.0,
      ukeAngleDeg: 10.0,
    },
    toriTrajectory: {
      start: [0.24, 0, 1.25],
      end: [0.24, 0, 1.25],
      startYaw: -2.93,
      endYaw: -2.93,
      isStationary: true,
    },
    ukeTrajectory: {
      start: [0.00, 0, 0.00],
      end: [0.05, 0, 0.15],
      startYaw: 0.19,
      endYaw: 0.17,
      isStationary: false,
    },
    displacementTori: [0.00, 0, 0.00],
    displacementUke: [0.05, 0, 0.15],
    participants: [
      { role: 'tori', clipName: 'kick_mae_geri_right', stance: 'zenkutsu_dachi_right', finalStance: 'zenkutsu_dachi_right', landingMode: 'back', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'tech_haishu_uke_left + stance_heisoku + tech_gedan_barai_right + tech_gyaku_zuki_left', stance: 'zenkutsu_dachi_right', finalStance: 'zenkutsu_dachi_right', delaySeconds: 0.08, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 10: Шаг назад в миги дзэнкуцу дати / Гяку-дзуки / гяку-дзуки с шагом в хидари дзэнкуцу дати
  {
    stepNumber: 10,
    title: 'Шаг 10: Отступление Тори — сдвоенный Гяку-дзуки Укэ в Хидари дзэнкуцу',
    description: '1 (Тори): Шаг назад в миги дзэнкуцу дати. 2 (Укэ): Гяку-дзуки / гяку-дзуки с шагом в хидари дзэнкуцу дати.',
    notes: 'Преследование и сдвоенный контрудар кулаком в корпус',
    optimalDistance: 0.98,
    attackAngleDeg: 0,
    contactType: 'strike_chudan',
    interactionType: 'body_contact',
    tContact: 0.50,
    duration: 2.8,
    scenarioAngles: {
      label: 'Двойной Гяку-дзуки с шагом в Хидари дзэнкуцу · 0.98м',
      toriAngleDeg: -170.0,
      ukeAngleDeg: 8.0,
    },
    toriTrajectory: {
      start: [0.24, 0, 1.25],
      end: [0.30, 0, 1.55],
      startYaw: -2.93,
      endYaw: -2.96,
      isStationary: false,
    },
    ukeTrajectory: {
      start: [0.05, 0, 0.15],
      end: [0.16, 0, 0.58],
      startYaw: 0.17,
      endYaw: 0.14,
      isStationary: false,
    },
    displacementTori: [0.06, 0, 0.30],
    displacementUke: [0.11, 0, 0.43],
    participants: [
      { role: 'tori', clipName: 'step_backward_right', stance: 'zenkutsu_dachi_right', finalStance: 'zenkutsu_dachi_right', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'tech_gyaku_zuki_left + step_forward_left + tech_gyaku_zuki_right', stance: 'zenkutsu_dachi_left', finalStance: 'zenkutsu_dachi_left', delaySeconds: 0.06, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 11: Кидзами-дзуки с выпадом вперёд / Перестроение в миги кокуцу дати с нагаши укэ + сюто-укэ
  {
    stepNumber: 11,
    title: 'Шаг 11: Кидзами-дзуки с выпадом — Нагаси-укэ + Сюто-укэ в Миги кокуцу-дати',
    description: '1 (Тори): Кидзами-дзуки с выпадом вперёд. 2 (Укэ): Перестроение в миги кокуцу дати с выполнением нагаши укэ + сюто-укэ.',
    notes: 'Мягкий отвод джеба ладонью (Нагаси-укэ) и блок Сюто-укэ',
    optimalDistance: 1.00,
    attackAngleDeg: 0,
    contactType: 'parry_shuto',
    interactionType: 'body_contact',
    tContact: 0.46,
    duration: 2.6,
    scenarioAngles: {
      label: 'Выпад Кидзами-дзуки · Нагаси-укэ + Сюто-укэ · 1.00м',
      toriAngleDeg: -175.0,
      ukeAngleDeg: 5.0,
    },
    toriTrajectory: {
      start: [0.30, 0, 1.55],
      end: [0.22, 0, 1.32],
      startYaw: -2.96,
      endYaw: -3.05,
      isStationary: false,
    },
    ukeTrajectory: {
      start: [0.16, 0, 0.58],
      end: [0.14, 0, 0.32],
      startYaw: 0.14,
      endYaw: 0.08,
      isStationary: false,
    },
    displacementTori: [-0.08, 0, -0.23],
    displacementUke: [-0.02, 0, -0.26],
    participants: [
      { role: 'tori', clipName: 'jodan_zuki_left', stance: 'zenkutsu_dachi_left', finalStance: 'zenkutsu_dachi_left', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'tech_uchi_uke_right + tech_shuto_uke_left', stance: 'kokutsu_dachi_right', finalStance: 'kokutsu_dachi_right', delaySeconds: 0.05, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 12: Шаг вперёд в кокуцу дати дзёдан сюто-учи (Удар в область горла)
  {
    stepNumber: 12,
    title: 'Шаг 12: Шаг вперёд в Кокуцу-дати — Дзёдан Сюто-учи в область горла',
    description: '1 (Тори): Раскрыт в стойке после парирования. 2 (Укэ): Шаг вперёд в кокуцу дати дзёдан сюто-учи.',
    notes: 'Удар в область горла',
    optimalDistance: 0.87,
    attackAngleDeg: 0,
    contactType: 'strike_throat',
    interactionType: 'body_contact',
    tContact: 0.48,
    duration: 2.3,
    scenarioAngles: {
      label: 'Дзёдан Сюто-учи в область горла · 0.87м',
      toriAngleDeg: -177.0,
      ukeAngleDeg: 3.0,
    },
    toriTrajectory: {
      start: [0.22, 0, 1.32],
      end: [0.22, 0, 1.32],
      startYaw: -3.05,
      endYaw: -3.10,
      isStationary: true,
    },
    ukeTrajectory: {
      start: [0.14, 0, 0.32],
      end: [0.18, 0, 0.45],
      startYaw: 0.08,
      endYaw: 0.05,
      isStationary: false,
    },
    displacementTori: [0.00, 0, 0.00],
    displacementUke: [0.04, 0, 0.13],
    participants: [
      { role: 'tori', clipName: 'kokutsu_dachi_left', stance: 'kokutsu_dachi_left', finalStance: 'kokutsu_dachi_left', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'step_forward + tech_shuto_uchi_right', stance: 'kokutsu_dachi_left', finalStance: 'kokutsu_dachi_left', delaySeconds: 0.05, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 13: Падает со страховкой левой рукой (правая нога скрестно) / Гяку Агэ-укэ (вместо захвата), аши-барай, шико-дати + отоши-дзуки
  {
    stepNumber: 13,
    title: 'Шаг 13: Гяку Агэ-укэ, подсечка Аши-барай, падение Укэми и Отоши-дзуки в Сико-дати',
    description: '1 (Тори): Падает со страховкой левой рукой, правая нога лежит поверх левой скрестно. 2 (Укэ): Гяку агэ-укэ (вместо захвата за рукав), аши-барай, постановка ноги в шико дати + отоши-дзуки.',
    notes: 'Захват руки заменён на Гяку Агэ-укэ; сваливание подсечкой и добивание в Сико-дати',
    optimalDistance: 0.60,
    attackAngleDeg: 0,
    contactType: 'sweep_finish',
    interactionType: 'takedown',
    tContact: 0.46,
    duration: 3.4,
    scenarioAngles: {
      label: 'Гяку Агэ-укэ + Аши-барай + Отоши-дзуки в Сико-дати',
      toriAngleDeg: -178.0,
      ukeAngleDeg: 2.0,
    },
    toriTrajectory: {
      start: [0.22, 0, 1.32],
      end: [0.22, 0.08, 1.32],
      startYaw: -3.10,
      endYaw: -3.10,
      isStationary: false,
    },
    ukeTrajectory: {
      start: [0.18, 0, 0.45],
      end: [0.20, 0, 0.72],
      startYaw: 0.05,
      endYaw: 0.03,
      isStationary: false,
    },
    displacementTori: [0.00, 0.08, 0.00],
    displacementUke: [0.02, 0, 0.27],
    participants: [
      { role: 'tori', clipName: 'idle_shizentai', stance: 'fallen_ukemi', finalStance: 'fallen_ukemi', delaySeconds: 0.18, isGround: true },
      { role: 'uke1', clipName: 'tech_age_uke_right + kick_nami_gaeshi_left + stance_shiko + tech_tate_zuki_left', stance: 'stance_shiko', finalStance: 'stance_shiko', delaySeconds: 0.0, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 14: Шаг правой ногой назад в стойку хидари дзэнкуцу дати
  {
    stepNumber: 14,
    title: 'Шаг 14: Отход Укэ правой ногой назад в Хидари дзэнкуцу-дати',
    description: '1 (Тори): Остается на татами в страховке (укэми). 2 (Укэ): Делает шаг правой ногой назад и становится в стойку хидари дзэнкуцу дати.',
    notes: 'Разрыв дистанции и контроль лежащего противника (1.57м)',
    optimalDistance: 1.57,
    attackAngleDeg: 0,
    contactType: 'none',
    interactionType: 'distance_only',
    tContact: 0.50,
    duration: 2.2,
    scenarioAngles: {
      label: 'Отход в Хидари дзэнкуцу-дати · 1.57м',
      toriAngleDeg: -178.0,
      ukeAngleDeg: 2.0,
    },
    toriTrajectory: {
      start: [0.22, 0.08, 1.32],
      end: [0.22, 0.08, 1.32],
      startYaw: -3.10,
      endYaw: -3.10,
      isStationary: true,
    },
    ukeTrajectory: {
      start: [0.20, 0, 0.72],
      end: [0.18, 0, -0.25],
      startYaw: 0.03,
      endYaw: 0.03,
      isStationary: false,
    },
    displacementTori: [0.00, 0.00, 0.00],
    displacementUke: [-0.02, 0, -0.97],
    participants: [
      { role: 'tori', clipName: 'idle_shizentai', stance: 'fallen_ukemi', finalStance: 'fallen_ukemi', delaySeconds: 0.0, isGround: true },
      { role: 'uke1', clipName: 'step_backward_right + zenkutsu_dachi_left', stance: 'zenkutsu_dachi_left', finalStance: 'zenkutsu_dachi_left', delaySeconds: 0.0, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 15: Через паузу встаёт в миги дзэнкуцу дати
  {
    stepNumber: 15,
    title: 'Шаг 15: Подъем Тори через паузу в Миги дзэнкуцу-дати',
    description: '1 (Тори): Через паузу встаёт в миги дзэнкуцу дати. 2 (Укэ): Сохраняет контроль в хидари дзэнкуцу дати.',
    notes: 'Подъем Тори с татами при контроле со стороны Укэ',
    optimalDistance: 1.57,
    attackAngleDeg: 0,
    contactType: 'none',
    interactionType: 'distance_only',
    tContact: 0.50,
    duration: 2.5,
    scenarioAngles: {
      label: 'Подъем Тори в Миги дзэнкуцу-дати · 1.57м',
      toriAngleDeg: -178.0,
      ukeAngleDeg: 2.0,
    },
    toriTrajectory: {
      start: [0.22, 0.08, 1.32],
      end: [0.22, 0.00, 1.32],
      startYaw: -3.10,
      endYaw: -3.10,
      isStationary: false,
    },
    ukeTrajectory: {
      start: [0.18, 0, -0.25],
      end: [0.18, 0, -0.25],
      startYaw: 0.03,
      endYaw: 0.03,
      isStationary: true,
    },
    displacementTori: [0.00, -0.08, 0.00],
    displacementUke: [0.00, 0.00, 0.00],
    participants: [
      { role: 'tori', clipName: 'zenkutsu_dachi_right', stance: 'zenkutsu_dachi_right', finalStance: 'zenkutsu_dachi_right', delaySeconds: 0.25, isGround: false, isRising: true },
      { role: 'uke1', clipName: 'zenkutsu_dachi_left', stance: 'zenkutsu_dachi_left', finalStance: 'zenkutsu_dachi_left', delaySeconds: 0.0, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 16: Шагом назад становится в хэйко дати
  {
    stepNumber: 16,
    title: 'Шаг 16: Возврат шагом назад в Хэйко-дати',
    description: '1 (Тори): Шагом назад становится в хэйко дати. 2 (Укэ): Шагом назад становится в хэйко дати.',
    notes: 'Возврат на исходную дистанцию (2.10м)',
    optimalDistance: 2.10,
    attackAngleDeg: 0,
    contactType: 'none',
    interactionType: 'distance_only',
    tContact: 0.50,
    duration: 2.2,
    scenarioAngles: {
      label: 'Синхронный шаг назад в Хэйко-дати · 2.10м',
      toriAngleDeg: 180,
      ukeAngleDeg: 0,
    },
    toriTrajectory: {
      start: [0.22, 0.00, 1.32],
      end: [0.00, 0.00, 1.55],
      startYaw: -3.10,
      endYaw: -Math.PI,
      isStationary: false,
    },
    ukeTrajectory: {
      start: [0.18, 0, -0.25],
      end: [0.00, 0, -0.55],
      startYaw: 0.03,
      endYaw: 0.0,
      isStationary: false,
    },
    displacementTori: [-0.22, 0, 0.23],
    displacementUke: [-0.18, 0, -0.30],
    participants: [
      { role: 'tori', clipName: 'step_backward + heiko_dachi', stance: 'heiko_dachi', finalStance: 'heiko_dachi', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'step_backward + heiko_dachi', stance: 'heiko_dachi', finalStance: 'heiko_dachi', delaySeconds: 0.0, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 17: Мусуби дати поклон
  {
    stepNumber: 17,
    title: 'Шаг 17: Мусуби-дати — поклон',
    description: '1 (Тори): Мусуби дати поклон. 2 (Укэ): Мусуби дати поклон.',
    notes: 'Заключительный ритуальный поклон (рэй)',
    optimalDistance: 2.10,
    attackAngleDeg: 0,
    contactType: 'none',
    interactionType: 'distance_only',
    isBow: true,
    tContact: 0.50,
    duration: 2.2,
    scenarioAngles: {
      label: 'Поклон рэй в Мусуби-дати · 2.10м',
      toriAngleDeg: 180,
      ukeAngleDeg: 0,
    },
    toriTrajectory: {
      start: [0.00, 0.00, 1.55],
      end: [0.00, 0.00, 1.55],
      startYaw: -Math.PI,
      endYaw: -Math.PI,
      isStationary: true,
    },
    ukeTrajectory: {
      start: [0.00, 0, -0.55],
      end: [0.00, 0, -0.55],
      startYaw: 0.0,
      endYaw: 0.0,
      isStationary: true,
    },
    displacementTori: [0.00, 0, 0.00],
    displacementUke: [0.00, 0, 0.00],
    participants: [
      { role: 'tori', clipName: 'stance_musubi', stance: 'stance_musubi', finalStance: 'stance_musubi', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'stance_musubi', stance: 'stance_musubi', finalStance: 'stance_musubi', delaySeconds: 0.0, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 18: Хэйко дати
  {
    stepNumber: 18,
    title: 'Шаг 18: Хэйко-дати (завершение)',
    description: '1 (Тори): Хэйко дати. 2 (Укэ): Хэйко дати.',
    notes: 'Завершение комплекса Бункай Хэйан Шодан',
    optimalDistance: 2.10,
    attackAngleDeg: 0,
    contactType: 'none',
    interactionType: 'distance_only',
    tContact: 0.50,
    duration: 1.8,
    scenarioAngles: {
      label: 'Завершение Хэйко-дати · 2.10м',
      toriAngleDeg: 180,
      ukeAngleDeg: 0,
    },
    toriTrajectory: {
      start: [0.00, 0.00, 1.55],
      end: [0.00, 0.00, 1.55],
      startYaw: -Math.PI,
      endYaw: -Math.PI,
      isStationary: true,
    },
    ukeTrajectory: {
      start: [0.00, 0, -0.55],
      end: [0.00, 0, -0.55],
      startYaw: 0.0,
      endYaw: 0.0,
      isStationary: true,
    },
    displacementTori: [0.00, 0, 0.00],
    displacementUke: [0.00, 0, 0.00],
    participants: [
      { role: 'tori', clipName: 'heiko_dachi', stance: 'heiko_dachi', finalStance: 'heiko_dachi', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'heiko_dachi', stance: 'heiko_dachi', finalStance: 'heiko_dachi', delaySeconds: 0.0, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
];

export const CANONICAL_BUNKAI_EPISODES = [
  {
    stepNumber: 1,
    title: 'Защита Сюто-укэ против выпада Ой-цуки',
    description: 'Укэ 1 атакует мощным выпадом Ой-цуки тюдан. Тори уходит с линии атаки в Кокуцу-дати, сбивает руку блоком Сюто-укэ и контратакует Гяку-цуки в корпус.',
    optimalDistance: 1.45,
    attackAngleDeg: 0,
    interactionType: 'local_contact',
    tContact: 0.45,
    activeAttacker: 'uke1',
    participants: [
      { role: 'tori', clipName: 'shuto_uke', stance: 'kokutsu', delaySeconds: 0.15 },
      { role: 'uke1', clipName: 'oi_zuki_right', stance: 'zenkutsu', delaySeconds: 0.0 },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0 },
    ],
  },
  {
    stepNumber: 2,
    title: 'Восходящий блок Агэ-укэ и сокрушительный локоть Эмпи',
    description: 'Укэ 1 наносит прямой удар в голову (Дзёдан). Тори встречает атаку блоком Агэ-укэ, смещается в ближнюю дистанцию и пробивает локтем Эмпи-учи.',
    optimalDistance: 1.20,
    attackAngleDeg: 10,
    interactionType: 'local_contact',
    tContact: 0.42,
    activeAttacker: 'uke1',
    participants: [
      { role: 'tori', clipName: 'age_uke_left', stance: 'zenkutsu', delaySeconds: 0.10 },
      { role: 'uke1', clipName: 'oi_zuki_right', stance: 'zenkutsu', delaySeconds: 0.0 },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0 },
    ],
  },
  {
    stepNumber: 3,
    title: 'Нижний смет Гэдан-барай от прямого удара ногой Маэ-гэри',
    description: 'Укэ 1 атакует ударом ноги Маэ-гэри в живот. Тори сметает голень блоком Гэдан-барай и добивает молотом Тэтцуи-учи.',
    optimalDistance: 1.65,
    attackAngleDeg: -10,
    interactionType: 'local_contact',
    tContact: 0.50,
    activeAttacker: 'uke1',
    participants: [
      { role: 'tori', clipName: 'gedan_barai_left', stance: 'zenkutsu', delaySeconds: 0.12 },
      { role: 'uke1', clipName: 'mae_geri_right', stance: 'zenkutsu', delaySeconds: 0.0 },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0 },
    ],
  },
  {
    stepNumber: 4,
    title: 'Фланговая атака под 45°: уход Сото-укэ и контрудар Уракэн',
    description: 'Укэ 1 атакует с левого фланга под углом 45°. Тори разворачивается навстречу удару, парирует блоком Сото-укэ и наносит хлесткий Уракэн-учи в висок.',
    optimalDistance: 1.25,
    attackAngleDeg: 45,
    interactionType: 'local_contact',
    tContact: 0.44,
    activeAttacker: 'uke1',
    participants: [
      { role: 'tori', clipName: 'soto_uke', stance: 'zenkutsu', delaySeconds: 0.10 },
      { role: 'uke1', clipName: 'oi_zuki_right', stance: 'zenkutsu', delaySeconds: 0.0 },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0 },
    ],
  },
  {
    stepNumber: 5,
    title: 'Командный бункай (3 бойца): защита от Укэ 1 и разворот к Укэ 2',
    description: 'Укэ 1 начинает атаку с фронта. Тори защищается Сюто-укэ. В этот момент Укэ 2 атакует с правого фланга (+75°). Тори разворачивается на 75°, сбивает атаку Гэдан-барай и поражает Укэ 2 ударом Гяку-цуки.',
    optimalDistance: 1.40,
    attackAngleDeg: 0,
    uke2AngleDeg: 75,
    interactionType: 'local_contact',
    tContact: 0.45,
    activeAttacker: 'sequential',
    switchTime: 1.35,
    participants: [
      { role: 'tori', clipName: 'shuto_uke', stance: 'kokutsu', delaySeconds: 0.15 },
      { role: 'uke1', clipName: 'oi_zuki_right', stance: 'zenkutsu', delaySeconds: 0.0 },
      { role: 'uke2', clipName: 'mae_geri_right', stance: 'zenkutsu', delaySeconds: 1.35 },
    ],
  },
];

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
    stepForwardDist: 0.70,
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
    stepForwardDist: 0.15,
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
    stepForwardDist: 0.15,
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
    stepForwardDist: 0.60,
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
    stepForwardDist: -0.30,
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
    stepForwardDist: -0.20,
  },
  age_uke_left: {
    clipName: 'age_uke_left',
    altClips: ['tech_age_uke_left', 'age_uke'],
    titleRu: 'Агэ-укэ (Восходящий верхний блок)',
    role: 'tori',
    type: 'block',
    optimalDistance: 1.15,
    tContact: 0.45,
    defaultDuration: 1.25,
    stepForwardDist: -0.20,
  },
  shuto_uke: {
    clipName: 'tech_shuto_uke_left',
    altClips: ['shuto_uke_left', 'shuto_uke'],
    titleRu: 'Сюто-укэ (Блок ребром ладони в Кокуцу-дати)',
    role: 'tori',
    type: 'block',
    optimalDistance: 1.30,
    tContact: 0.45,
    defaultDuration: 1.30,
    stepForwardDist: -0.45,
  },
  soto_uke: {
    clipName: 'soto_uke',
    altClips: ['tech_soto_uke_left', 'tech_soto_uke_right'],
    titleRu: 'Сото-укэ (Блок предплечьем снаружи-внутрь)',
    role: 'tori',
    type: 'block',
    optimalDistance: 1.25,
    tContact: 0.44,
    defaultDuration: 1.20,
    stepForwardDist: -0.25,
  },
  uchi_uke: {
    clipName: 'uchi_uke',
    altClips: ['tech_uchi_uke_left', 'tech_uchi_uke_right'],
    titleRu: 'Ути-укэ (Блок предплечьем изнутри-наружу)',
    role: 'tori',
    type: 'block',
    optimalDistance: 1.20,
    tContact: 0.44,
    defaultDuration: 1.20,
    stepForwardDist: -0.25,
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
    stepForwardDist: 0.20,
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
    stepForwardDist: 0.10,
  },
  strike_above_elbow: {
    clipName: 'strike_above_elbow',
    altClips: ['tech_strike_above_elbow', 'arm_strike'],
    titleRu: 'Удар второй рукой выше локтя',
    role: 'uke',
    type: 'strike',
    optimalDistance: 1.18,
    tContact: 0.46,
    defaultDuration: 1.25,
    stepForwardDist: 0.0,
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
    stepForwardDist: 0.35,
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
    stepForwardDist: 0.60,
  },
  idle_shizentai: {
    clipName: 'idle_shizentai',
    altClips: ['stance_ready'],
    titleRu: 'Сидзэнтай (Позиция готовности)',
    role: 'both',
    type: 'stance',
    optimalDistance: 2.10,
    tContact: 0.50,
    defaultDuration: 1.00,
    stepForwardDist: 0.0,
  },
};

/**
 * Нормализует шаг бункая из любого источника (БД, camelCase или канонический)
 */
export function normalizeBunkaiEpisode(raw, index = 0) {
  if (!raw) return HEIAN_SHODAN_BUNKAI_18_STEPS[0];

  const stepNum = raw.Step_Number ?? raw.stepNumber ?? (index + 1);
  const canonicalIdx = stepNum - 1;
  const isExplicitHeian = Boolean(raw.isHeian18 || (raw.scenarioAngles && raw.toriTrajectory));
  const canonical = isExplicitHeian && (canonicalIdx >= 0 && canonicalIdx < HEIAN_SHODAN_BUNKAI_18_STEPS.length)
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

  const toriEndAngleDeg = raw.toriEndAngleDeg ?? (toriPart.rotationY !== undefined ? toriPart.rotationY : (toriPart.Rotation_Y !== undefined ? toriPart.Rotation_Y : (canonical?.scenarioAngles?.toriAngleDeg !== undefined ? canonical.scenarioAngles.toriAngleDeg : (raw.toriTrajectory?.endYaw !== undefined ? Math.round((raw.toriTrajectory.endYaw * 180) / Math.PI) : (canonical?.toriTrajectory?.endYaw !== undefined ? Math.round((canonical.toriTrajectory.endYaw * 180) / Math.PI) : undefined)))));
  const ukeEndAngleDeg = raw.ukeEndAngleDeg ?? (uke1Part.rotationY !== undefined ? uke1Part.rotationY : (uke1Part.Rotation_Y !== undefined ? uke1Part.Rotation_Y : (canonical?.scenarioAngles?.ukeAngleDeg !== undefined ? canonical.scenarioAngles.ukeAngleDeg : (raw.ukeTrajectory?.endYaw !== undefined ? Math.round((raw.ukeTrajectory.endYaw * 180) / Math.PI) : (canonical?.ukeTrajectory?.endYaw !== undefined ? Math.round((canonical.ukeTrajectory.endYaw * 180) / Math.PI) : undefined)))));

  const toriEndYaw = toriEndAngleDeg !== undefined ? (Number(toriEndAngleDeg) * Math.PI) / 180 : (raw.toriEndYaw ?? canonical?.toriTrajectory?.endYaw);
  const ukeEndYaw = ukeEndAngleDeg !== undefined ? (Number(ukeEndAngleDeg) * Math.PI) / 180 : (raw.ukeEndYaw ?? canonical?.ukeTrajectory?.endYaw);

  const toriTrajectory = raw.toriTrajectory || (isExplicitHeian ? canonical?.toriTrajectory : null) || null;
  const effectiveToriTrajectory = toriTrajectory ? {
    ...toriTrajectory,
    endYaw: toriEndYaw !== undefined ? toriEndYaw : toriTrajectory.endYaw,
  } : (toriEndYaw !== undefined ? { endYaw: toriEndYaw } : null);

  const ukeTrajectory = raw.ukeTrajectory || (isExplicitHeian ? canonical?.ukeTrajectory : null) || null;
  const effectiveUkeTrajectory = ukeTrajectory ? {
    ...ukeTrajectory,
    endYaw: ukeEndYaw !== undefined ? ukeEndYaw : ukeTrajectory.endYaw,
  } : (ukeEndYaw !== undefined ? { endYaw: ukeEndYaw } : null);

  return {
    stepNumber: stepNum,
    title: raw.Title || raw.title || canonical?.title || `Шаг ${index + 1}`,
    description: raw.Description || raw.description || canonical?.description || '',
    notes: raw.Notes || raw.notes || canonical?.notes || '',
    optimalDistance: isNaN(optDist) ? (canonical?.optimalDistance ?? 1.45) : optDist,
    attackAngleDeg: isNaN(atkAngle) ? (canonical?.attackAngleDeg ?? 0) : atkAngle,
    uke2AngleDeg: isNaN(uke2Angle) ? (canonical?.uke2AngleDeg ?? atkAngle + 65) : uke2Angle,
    toriEndAngleDeg: toriEndAngleDeg !== undefined ? Number(toriEndAngleDeg) : undefined,
    ukeEndAngleDeg: ukeEndAngleDeg !== undefined ? Number(ukeEndAngleDeg) : undefined,
    toriEndYaw,
    ukeEndYaw,
    interactionType: raw.Interaction_Type || raw.interactionType || canonical?.interactionType || 'body_contact',
    contactType: raw.contactType || canonical?.contactType || 'none',
    tContact: Number(raw.tContact || canonical?.tContact || 0.48),
    duration: Number(raw.duration || canonical?.duration || 2.4),
    scenarioAngles: raw.scenarioAngles || canonical?.scenarioAngles || null,
    toriTrajectory: effectiveToriTrajectory,
    ukeTrajectory: effectiveUkeTrajectory,
    isStationaryTori: Boolean(raw.isStationaryTori ?? (isExplicitHeian ? canonical?.isStationaryTori : null) ?? raw.toriTrajectory?.isStationary ?? (isExplicitHeian ? canonical?.toriTrajectory?.isStationary : false)),
    isStationaryUke: Boolean(raw.isStationaryUke ?? (isExplicitHeian ? canonical?.isStationaryUke : null) ?? raw.ukeTrajectory?.isStationary ?? (isExplicitHeian ? canonical?.ukeTrajectory?.isStationary : false)),
    isGround: Boolean(raw.isGround || toriPart.isGround || canonical?.isGround || canonical?.participants?.[0]?.isGround),
    isRising: Boolean(raw.isRising || toriPart.isRising || canonical?.isRising || canonical?.participants?.[0]?.isRising),
    isBow: Boolean(raw.isBow || canonical?.isBow),
    displacementTori: raw.displacementTori || (isExplicitHeian ? canonical?.displacementTori : null) || [0, 0, 0],
    displacementUke: raw.displacementUke || (isExplicitHeian ? canonical?.displacementUke : null) || [0, 0, 0],
    participants: [
      {
        role: 'tori',
        clipName: toriClip,
        stance: toriPart.Stance_In || toriPart.initialStance || toriPart.stance || canonical?.participants?.[0]?.stance || 'zenkutsu_dachi_left',
        finalStance: toriPart.Final_Stance || toriPart.Stance_Out || toriPart.finalStance || canonical?.participants?.[0]?.finalStance || null,
        landingMode: toriPart.Landing_Mode || toriPart.landingMode || canonical?.participants?.[0]?.landingMode || 'auto',
        delaySeconds: toriDelay,
        isGround: Boolean(raw.isGround || toriPart.isGround || canonical?.isGround || canonical?.participants?.[0]?.isGround),
        isRising: Boolean(raw.isRising || toriPart.isRising || canonical?.isRising || canonical?.participants?.[0]?.isRising),
      },
      {
        role: 'uke1',
        clipName: uke1Clip,
        stance: uke1Part.Stance_In || uke1Part.initialStance || uke1Part.stance || canonical?.participants?.[1]?.stance || 'zenkutsu_dachi_left',
        finalStance: uke1Part.Final_Stance || uke1Part.Stance_Out || uke1Part.finalStance || canonical?.participants?.[1]?.finalStance || null,
        landingMode: uke1Part.Landing_Mode || uke1Part.landingMode || canonical?.participants?.[1]?.landingMode || 'auto',
        delaySeconds: uke1Delay,
        isGround: false,
      },
      {
        role: 'uke2',
        clipName: uke2Clip,
        stance: uke2Part.Stance_In || uke2Part.initialStance || uke2Part.stance || canonical?.participants?.[2]?.stance || 'ready',
        finalStance: uke2Part.Final_Stance || uke2Part.Stance_Out || uke2Part.finalStance || canonical?.participants?.[2]?.finalStance || null,
        landingMode: uke2Part.Landing_Mode || uke2Part.landingMode || canonical?.participants?.[2]?.landingMode || 'auto',
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
  strike_above_elbow: 'strike_above_elbow',
  tech_strike_above_elbow: 'strike_above_elbow',
  arm_strike: 'strike_above_elbow',
  kizami_zuki: 'jodan_zuki_left',
  shuto_uchi: 'tech_shuto_uchi_right',
  heiko_dachi: 'heiko_dachi',
  stance_musubi: 'stance_musubi',
  stance_heisoku: 'stance_heisoku',
  stance_shiko: 'stance_shiko',
  mae_geri: 'mae_geri_right',
  mae_geri_right: 'mae_geri_right',
  kick_mae_geri_right: 'kick_mae_geri_right',
  gedan_barai: 'gedan_barai_left',
  gedan_barai_left: 'gedan_barai_left',
  tech_gedan_barai_left: 'tech_gedan_barai_left',
  age_uke: 'age_uke_left',
  age_uke_left: 'age_uke_left',
  tech_age_uke_right: 'tech_age_uke_right',
  oi_zuki: 'oi_zuki_right',
  oi_zuki_right: 'oi_zuki_right',
  tech_oi_zuki_right: 'tech_oi_zuki_right',
  gyaku_zuki: 'gyaku_zuki_right',
  gyaku_zuki_right: 'gyaku_zuki_right',
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
    // В изолированном режиме каждый шаг сохраняет свою биомеханическую траекторию и уход Тай-сабаки
    return normalized.map((ep) => {
      if (ep.toriTrajectory && ep.ukeTrajectory) {
        return {
          ...ep,
          toriStartPos: [...ep.toriTrajectory.start],
          toriEndPos: [...ep.toriTrajectory.end],
          ukeStartPos: [...ep.ukeTrajectory.start],
          ukeEndPos: [...ep.ukeTrajectory.end],
          toriStartYaw: ep.toriTrajectory.startYaw !== undefined ? ep.toriTrajectory.startYaw : 0,
          toriEndYaw: ep.toriTrajectory.endYaw !== undefined ? ep.toriTrajectory.endYaw : 0,
          ukeStartYaw: ep.ukeTrajectory.startYaw !== undefined ? ep.ukeTrajectory.startYaw : Math.PI,
          ukeEndYaw: ep.ukeTrajectory.endYaw !== undefined ? ep.ukeTrajectory.endYaw : Math.PI,
          isStationaryTori: Boolean(ep.toriTrajectory.isStationary),
          isStationaryUke: Boolean(ep.ukeTrajectory.isStationary),
        };
      }
      const dist = ep.optimalDistance || 1.45;
      const angleRad = ((ep.attackAngleDeg || 0) * Math.PI) / 180;
      return {
        ...ep,
        toriStartPos: [0, 0, 0],
        toriEndPos: [0, 0, 0],
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
  const hasFirstTraj = Boolean(episodes[0]?.toriTrajectory?.start);
  let curToriPos = hasFirstTraj ? [...episodes[0].toriTrajectory.start] : [0, 0, 0];
  let curUkePos = hasFirstTraj && episodes[0]?.ukeTrajectory?.start ? [...episodes[0].ukeTrajectory.start] : [0, 0, 1.45];
  let curToriYaw = hasFirstTraj && episodes[0]?.toriTrajectory?.startYaw !== undefined ? episodes[0].toriTrajectory.startYaw : 0;
  let curUkeYaw = hasFirstTraj && episodes[0]?.ukeTrajectory?.startYaw !== undefined ? episodes[0].ukeTrajectory.startYaw : Math.PI;

  let lastToriFinalStance = null;
  let lastUkeFinalStance = null;

  return normalized.map((ep, idx) => {
    let toriStartPos = [...curToriPos];
    let ukeStartPos = [...curUkePos];
    let toriStartYaw = curToriYaw;
    let ukeStartYaw = curUkeYaw;

    const toriPart = ep.participants?.[0] || {};
    const ukePart = ep.participants?.[1] || {};

    if (idx > 0 && lastToriFinalStance && toriPart && !toriPart.customStanceApplied) {
      toriPart.stance = lastToriFinalStance;
    }
    if (idx > 0 && lastUkeFinalStance && ukePart && !ukePart.customStanceApplied) {
      ukePart.stance = lastUkeFinalStance;
    }

    if (toriPart.finalStance) {
      lastToriFinalStance = toriPart.finalStance;
    } else if (toriPart.landingMode === 'forward') {
      lastToriFinalStance = (toriPart.stance || '').includes('left') ? (toriPart.stance || '').replace('left', 'right') : 'zenkutsu_dachi_right';
      toriPart.finalStance = lastToriFinalStance;
    } else {
      lastToriFinalStance = toriPart.stance || 'zenkutsu_dachi_left';
    }

    if (ukePart.finalStance) {
      lastUkeFinalStance = ukePart.finalStance;
    } else if (ukePart.landingMode === 'forward') {
      lastUkeFinalStance = (ukePart.stance || '').includes('left') ? (ukePart.stance || '').replace('left', 'right') : 'zenkutsu_dachi_right';
      ukePart.finalStance = lastUkeFinalStance;
    } else {
      lastUkeFinalStance = ukePart.stance || 'zenkutsu_dachi_left';
    }

    let nextToriPos, nextUkePos, nextToriYaw, nextUkeYaw;

    const isToriKick = Boolean(toriPart.clipName && (toriPart.clipName.includes('mae_geri') || toriPart.clipName.includes('kick') || toriPart.clipName.includes('geri')));
    const isUkeKick = Boolean(ukePart.clipName && (ukePart.clipName.includes('mae_geri') || ukePart.clipName.includes('kick') || ukePart.clipName.includes('geri')));

    if (ep.toriTrajectory && ep.ukeTrajectory) {
      if (idx === 0) {
        toriStartPos = ep.toriTrajectory.start ? [...ep.toriTrajectory.start] : toriStartPos;
        nextToriPos = [...ep.toriTrajectory.end];
        toriStartYaw = ep.toriTrajectory.startYaw !== undefined ? ep.toriTrajectory.startYaw : toriStartYaw;
        nextToriYaw = ep.toriTrajectory.endYaw !== undefined ? ep.toriTrajectory.endYaw : toriStartYaw;

        ukeStartPos = ep.ukeTrajectory.start ? [...ep.ukeTrajectory.start] : ukeStartPos;
        nextUkePos = [...ep.ukeTrajectory.end];
        ukeStartYaw = ep.ukeTrajectory.startYaw !== undefined ? ep.ukeTrajectory.startYaw : ukeStartYaw;
        nextUkeYaw = ep.ukeTrajectory.endYaw !== undefined ? ep.ukeTrajectory.endYaw : ukeStartYaw;
      } else {
        // Непрерывное сохранение состояния (idx > 0):
        // Начальная позиция строго равна конечной позиции предыдущего шага!
        toriStartPos = [...curToriPos];
        ukeStartPos = [...curUkePos];
        toriStartYaw = curToriYaw;
        ukeStartYaw = curUkeYaw;

        let dTor = ep.displacementTori && (ep.displacementTori[0] !== 0 || ep.displacementTori[1] !== 0 || ep.displacementTori[2] !== 0)
          ? [...ep.displacementTori]
          : [
              ep.toriTrajectory.end[0] - ep.toriTrajectory.start[0],
              ep.toriTrajectory.end[1] - ep.toriTrajectory.start[1],
              ep.toriTrajectory.end[2] - ep.toriTrajectory.start[2],
            ];

        let dUke = ep.displacementUke && (ep.displacementUke[0] !== 0 || ep.displacementUke[1] !== 0 || ep.displacementUke[2] !== 0)
          ? [...ep.displacementUke]
          : [
              ep.ukeTrajectory.end[0] - ep.ukeTrajectory.start[0],
              ep.ukeTrajectory.end[1] - ep.ukeTrajectory.start[1],
              ep.ukeTrajectory.end[2] - ep.ukeTrajectory.start[2],
            ];

        if (isToriKick && !ep.displacementTori) {
          if (toriPart.landingMode === 'forward') {
            dTor[2] = Math.max(dTor[2], 0.70);
          } else if (toriPart.landingMode === 'back') {
            dTor[2] = 0.0;
          }
        }

        if (isUkeKick && !ep.displacementUke) {
          if (ukePart.landingMode === 'forward') {
            dUke[2] = -Math.max(Math.abs(dUke[2]), 0.70);
          } else if (ukePart.landingMode === 'back') {
            dUke[2] = 0.0;
          }
        }

        nextToriPos = [
          toriStartPos[0] + dTor[0],
          toriStartPos[1] + dTor[1],
          toriStartPos[2] + dTor[2],
        ];
        nextUkePos = [
          ukeStartPos[0] + dUke[0],
          ukeStartPos[1] + dUke[1],
          ukeStartPos[2] + dUke[2],
        ];

        nextToriYaw = ep.toriTrajectory.endYaw !== undefined ? ep.toriTrajectory.endYaw : curToriYaw;
        nextUkeYaw = ep.ukeTrajectory.endYaw !== undefined ? ep.ukeTrajectory.endYaw : curUkeYaw;
      }
    } else {
      // Резервный расчет для произвольных пользовательских шагов
      const toriMeta = resolveBunkaiClip(toriPart.clipName);
      let stepDist = BUNKAI_TECHNIQUE_METADATA[toriMeta.clipName]?.stepForwardDist
        ?? BUNKAI_TECHNIQUE_METADATA[toriPart.clipName]?.stepForwardDist
        ?? 0;

      let dTor = ep.displacementTori && (ep.displacementTori[0] !== 0 || ep.displacementTori[2] !== 0)
        ? [...ep.displacementTori]
        : [0, 0, stepDist];
      let dUke = ep.displacementUke ? [...ep.displacementUke] : [0, 0, 0];

      if (isToriKick) {
        if (toriPart.landingMode === 'forward') {
          dTor[2] = Math.max(dTor[2], 0.70);
        } else if (toriPart.landingMode === 'back') {
          dTor[2] = 0.0;
        }
      }

      if (isUkeKick) {
        if (ukePart.landingMode === 'forward') {
          dUke[2] = -Math.max(Math.abs(dUke[2]), 0.70);
        } else if (ukePart.landingMode === 'back') {
          dUke[2] = 0.0;
        }
      }

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

      if (ep.activeAttacker === 'sequential' || ep.activeAttacker === 'uke2') {
        const uke2Deg = normalizeAngleDeg(ep.uke2AngleDeg || 75);
        nextToriYaw = (uke2Deg * Math.PI) / 180;
        nextUkeYaw = curUkeYaw;
      } else {
        nextToriYaw = curToriYaw;
        nextUkeYaw = curUkeYaw;
      }
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
 * Проверяет, является ли техника строго стационарной (выполняется на месте без шага вперед/назад).
 * Исключает скольжение стоп по татами для ударов на месте, блоков и стоек.
 */
export function isTechniqueStationary(clipName, landingMode = 'auto') {
  if (!clipName) return false;
  const name = String(clipName).toLowerCase();
  if (name.includes('mae_geri') || name.includes('mawashi_geri') || name.includes('yoko_geri') || name.includes('ushiro_geri') || name.includes('kick') || name.includes('geri')) {
    return landingMode === 'back' || landingMode === 'retract';
  }
  if (name.includes('oi_zuki') || name.includes('step_forward') || name.includes('advance')) {
    return false;
  }
  // Все блоки (age_uke, shuto_uke, soto_uke, uchi_uke, gedan_barai), стойки и удары на месте (gyaku_zuki, choku_zuki, empi, uraken) - стационарные
  return true;
}

/**
 * Рассчитывает пространственное положение участников, ориентацию и анти-проникновение
 */
export function computeAvatarPlacement({
  episode,
  distanceOffset = 0,
  customDistance = undefined,
  angleOffsetDeg = 0,
  ukeAngleOffsetDeg = undefined,
  toriAngleOffsetDeg = 0,
  toriEvasionAngleDeg = undefined,
  ukeEvasionAngleDeg = undefined,
  showUke2 = false,
  baseToriPos = [0, 0, 0],
  targetRole = 'uke1',
  customToriClip = null,
  customUkeClip = null,
  toriLandingMode = 'auto',
  ukeLandingMode = 'auto',
  orientationModeTori = undefined,
  orientationModeUke = undefined,
  customToriYawDeg = undefined,
  customUkeYawDeg = undefined,
  relativeAngleDegTori = undefined,
  relativeAngleDegUke = undefined,
  fixedDirectionYawTori = undefined,
  fixedDirectionYawUke = undefined,
  customToriPosX = undefined,
  customToriPosZ = undefined,
  customUkePosX = undefined,
  customUkePosZ = undefined,
  stanceTori = null,
  stanceUke = null,
}) {
  const norm = normalizeBunkaiEpisode(episode);
  const isGround = Boolean(norm.isGround || norm.participants?.[0]?.isGround);

  const toriPart = norm.participants?.find((p) => p.role === 'tori') || {};
  const uke1Part = norm.participants?.find((p) => p.role === 'uke' || p.role === 'uke1') || {};

  // 1. Динамическая боевая дистанция (Ма-ай)
  const rawDist = (customDistance !== undefined && customDistance !== null)
    ? Number(customDistance)
    : ((norm.optimalDistance || 1.45) + (distanceOffset || 0));

  const minSafeDist = isGround
    ? 0.38
    : (norm.contactType === 'arm_strike' || norm.contactType === 'strike_above_elbow' || norm.contactType === 'block_gyaku_age_uke')
    ? 0.55
    : 0.60;
  const targetDist = Math.max(minSafeDist, rawDist);

  // 2. Исходная линия и угол атаки Синего персонажа (Тори)
  // Направление атаки Тори строго зафиксировано и НЕ зависит от уклонений Укэ!
  let attackYaw = 0;
  if (episode.toriTrajectory?.endYaw !== undefined && Math.abs(episode.toriTrajectory.endYaw) > 0.001) {
    attackYaw = episode.toriTrajectory.endYaw;
  } else if (norm.attackAngleDeg !== undefined) {
    attackYaw = (norm.attackAngleDeg * Math.PI) / 180;
  }
  if (toriAngleOffsetDeg !== undefined && Math.abs(toriAngleOffsetDeg) > 0.001) {
    attackYaw += (toriAngleOffsetDeg * Math.PI) / 180;
  }

  const attackDirX = Math.sin(attackYaw);
  const attackDirZ = Math.cos(attackYaw);
  // Перпендикулярный вектор для бокового ухода (Тай-сабаки)
  const perpDirX = Math.cos(attackYaw);
  const perpDirZ = -Math.sin(attackYaw);

  // 3. Координаты Синего персонажа (Тори — атакующий):
  const startTori = episode.toriStartPos
    ? [...episode.toriStartPos]
    : (episode.toriTrajectory?.start ? [...episode.toriTrajectory.start] : [...baseToriPos]);
  let endTori = episode.toriEndPos
    ? [...episode.toriEndPos]
    : (episode.toriTrajectory?.end ? [...episode.toriTrajectory.end] : [...startTori]);

  if (customToriPosX !== undefined && customToriPosX !== null) {
    endTori[0] = Number(customToriPosX);
  }
  if (customToriPosZ !== undefined && customToriPosZ !== null) {
    endTori[2] = Number(customToriPosZ);
  }

  const effectiveToriClip = customToriClip || toriPart.clipName;
  const isToriStep = effectiveToriClip?.includes('oi_zuki') || toriLandingMode === 'forward' || toriPart.landingMode === 'forward';

  // Если задан явный угол ухода для Тори (в сценариях, где Тори защищается/уклоняется)
  const effectiveToriEvasionDeg = toriEvasionAngleDeg !== undefined ? toriEvasionAngleDeg : 0;
  if (Math.abs(effectiveToriEvasionDeg) > 0.001) {
    const evadeRad = (effectiveToriEvasionDeg * Math.PI) / 180;
    const evadeStepDist = 0.62;
    endTori[0] = startTori[0] - Math.sin(evadeRad) * evadeStepDist;
    endTori[2] = startTori[2] - Math.cos(evadeRad) * evadeStepDist * 0.35;
  } else if (isToriStep && endTori[0] === startTori[0] && endTori[2] === startTori[2]) {
    endTori[0] = startTori[0] + attackDirX * 0.65;
    endTori[2] = startTori[2] + attackDirZ * 0.65;
  }

  // 4. Координаты Белого персонажа (Укэ — защищающийся):
  const nominalBaseX = endTori[0] + attackDirX * targetDist;
  const nominalBaseZ = endTori[2] + attackDirZ * targetDist;

  let startUke1 = episode.ukeStartPos
    ? [...episode.ukeStartPos]
    : (episode.ukeTrajectory?.start ? [...episode.ukeTrajectory.start] : [startTori[0] + attackDirX * targetDist, 0, startTori[2] + attackDirZ * targetDist]);
  let endUke1 = episode.ukeEndPos
    ? [...episode.ukeEndPos]
    : (episode.ukeTrajectory?.end ? [...episode.ukeTrajectory.end] : [nominalBaseX, 0, nominalBaseZ]);

  if (customUkePosX !== undefined && customUkePosX !== null) {
    endUke1[0] = Number(customUkePosX);
  }
  if (customUkePosZ !== undefined && customUkePosZ !== null) {
    endUke1[2] = Number(customUkePosZ);
  }

  // Если дистанция настраивалась вручную пользователем:
  if (customDistance !== undefined && customDistance !== null) {
    const dX = endUke1[0] - endTori[0];
    const dZ = endUke1[2] - endTori[2];
    const curLen = Math.hypot(dX, dZ) || 0.001;
    endUke1[0] = endTori[0] + (dX / curLen) * targetDist;
    endUke1[2] = endTori[2] + (dZ / curLen) * targetDist;
  }

  // Если задан динамический угол ухода тай-сабаки Укэ пользователем:
  const effectiveUkeEvasionDeg = ukeEvasionAngleDeg !== undefined ? ukeEvasionAngleDeg : 0;
  if (Math.abs(effectiveUkeEvasionDeg) > 0.001) {
    const evadeRad = (effectiveUkeEvasionDeg * Math.PI) / 180;
    const evadeStepDist = 0.62;
    const lateralShift = Math.sin(evadeRad) * evadeStepDist;
    const depthShift = (Math.cos(evadeRad) - 1.0) * evadeStepDist * 0.40;
    endUke1[0] += perpDirX * lateralShift + attackDirX * depthShift;
    endUke1[2] += perpDirZ * lateralShift + attackDirZ * depthShift;
  }

  // 5. Расчет отклонения от директрисы атаки и факт уклонения (Тай-сабаки)
  const toUkeX = endUke1[0] - startTori[0];
  const toUkeZ = endUke1[2] - startTori[2];
  const lateralOffsetMeters = Math.abs(toUkeX * perpDirX + toUkeZ * perpDirZ);
  const isEvaded = lateralOffsetMeters >= 0.28;

  // 6. Анти-проникновение: строгий контроль дистанции корпусов
  let dx = endUke1[0] - endTori[0];
  let dz = endUke1[2] - endTori[2];
  let curDist = Math.hypot(dx, dz) || 0.001;

  let hasCollision = false;
  if (curDist < minSafeDist && norm.contactType !== 'sweep_fall' && norm.contactType !== 'sweep_finish') {
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

  // 7. Устранение скольжения: для стационарных стоек фиксируем start и end
  const isStationaryTori = Boolean(episode.isStationaryTori) || (Math.hypot(endTori[0] - startTori[0], endTori[2] - startTori[2]) < 0.01);
  const isStationaryUke = Boolean(episode.isStationaryUke) || (Math.hypot(endUke1[0] - startUke1[0], endUke1[2] - startUke1[2]) < 0.01);

  if (isStationaryTori && !isToriStep) {
    startTori[0] = endTori[0];
    startTori[2] = endTori[2];
  }

  const effectiveUkeClip = customUkeClip || uke1Part.clipName;
  const isUkeStep = effectiveUkeClip?.includes('oi_zuki') || ukeLandingMode === 'forward';
  if (isStationaryUke && !isUkeStep && Math.abs(effectiveUkeEvasionDeg) < 0.001) {
    startUke1[0] = endUke1[0];
    startUke1[2] = endUke1[2];
  }

  // 8. ПРИНЦИП РАЗДЕЛЕНИЯ ОРИЕНТАЦИИ (КЛЮЧЕВОЕ ТРЕБОВАНИЕ):
  let endToriYaw;
  if (orientationModeTori === 'mode1_free' && customToriYawDeg !== undefined && customToriYawDeg !== null) {
    endToriYaw = (Number(customToriYawDeg) * Math.PI) / 180;
  } else if (orientationModeTori === 'mode3_relative_angle' && relativeAngleDegTori !== undefined) {
    endToriYaw = attackYaw + (Number(relativeAngleDegTori) * Math.PI) / 180;
  } else if (orientationModeTori === 'mode4_fixed_direction' && fixedDirectionYawTori !== undefined) {
    endToriYaw = Number(fixedDirectionYawTori);
  } else if (orientationModeTori === 'mode2_look_at' || Math.abs(effectiveToriEvasionDeg) > 0.001) {
    endToriYaw = Math.atan2(dx, dz);
  } else if (customToriYawDeg !== undefined && customToriYawDeg !== null) {
    endToriYaw = (Number(customToriYawDeg) * Math.PI) / 180;
  } else if (norm.toriEndAngleDeg !== undefined && norm.toriEndAngleDeg !== null) {
    endToriYaw = (Number(norm.toriEndAngleDeg) * Math.PI) / 180;
  } else if (episode.toriEndAngleDeg !== undefined && episode.toriEndAngleDeg !== null) {
    endToriYaw = (Number(episode.toriEndAngleDeg) * Math.PI) / 180;
  } else if (episode.toriEndYaw !== undefined) {
    endToriYaw = episode.toriEndYaw;
  } else if (norm.toriEndYaw !== undefined) {
    endToriYaw = norm.toriEndYaw;
  } else if (episode.toriTrajectory?.endYaw !== undefined) {
    endToriYaw = episode.toriTrajectory.endYaw;
  } else {
    endToriYaw = attackYaw;
  }

  let startToriYaw = episode.toriStartYaw !== undefined
    ? episode.toriStartYaw
    : (episode.toriTrajectory?.startYaw !== undefined ? episode.toriTrajectory.startYaw : attackYaw);

  if ((customToriYawDeg !== undefined && customToriYawDeg !== null) || orientationModeTori === 'mode1_free' || isStationaryTori) {
    if (isStationaryTori || orientationModeTori === 'mode1_free') {
      startToriYaw = endToriYaw;
    }
  }

  // Белый персонаж (Укэ) при уходе поворачивается ВСЕМ ТЕЛОМ лицом к Тори!
  const faceToriFromUke = Math.atan2(endTori[0] - endUke1[0], endTori[2] - endUke1[2]);
  const isUkeEvading = Math.abs(effectiveUkeEvasionDeg) > 0.001 || isEvaded || lateralOffsetMeters >= 0.08 || Math.abs(endUke1[0] - startTori[0]) >= 0.08;

  let endUke1Yaw;
  if (orientationModeUke === 'mode1_free' && customUkeYawDeg !== undefined && customUkeYawDeg !== null) {
    endUke1Yaw = (Number(customUkeYawDeg) * Math.PI) / 180;
  } else if (orientationModeUke === 'mode3_relative_angle' && relativeAngleDegUke !== undefined) {
    endUke1Yaw = faceToriFromUke + (Number(relativeAngleDegUke) * Math.PI) / 180;
  } else if (orientationModeUke === 'mode4_fixed_direction' && fixedDirectionYawUke !== undefined) {
    endUke1Yaw = Number(fixedDirectionYawUke);
  } else if (orientationModeUke === 'mode2_look_at' || isUkeEvading) {
    // КРИТИЧЕСКОЕ ТРЕБОВАНИЕ: При блоке с уходом в сторону (Тай-сабаки), смещении с линии атаки
    // или в режиме ориентации на противника (mode2_look_at) — Укэ автоматически разворачивается
    // ВСЕМ ТЕЛОМ прямо на атакующего Тори!
    endUke1Yaw = faceToriFromUke;
  } else if (customUkeYawDeg !== undefined && customUkeYawDeg !== null) {
    endUke1Yaw = (Number(customUkeYawDeg) * Math.PI) / 180;
  } else if (norm.ukeEndAngleDeg !== undefined && norm.ukeEndAngleDeg !== null) {
    endUke1Yaw = (Number(norm.ukeEndAngleDeg) * Math.PI) / 180;
  } else if (episode.ukeEndAngleDeg !== undefined && episode.ukeEndAngleDeg !== null) {
    endUke1Yaw = (Number(episode.ukeEndAngleDeg) * Math.PI) / 180;
  } else if (episode.ukeEndYaw !== undefined) {
    endUke1Yaw = episode.ukeEndYaw;
  } else if (norm.ukeEndYaw !== undefined) {
    endUke1Yaw = norm.ukeEndYaw;
  } else if (episode.ukeTrajectory?.endYaw !== undefined) {
    endUke1Yaw = episode.ukeTrajectory.endYaw;
  } else {
    endUke1Yaw = faceToriFromUke;
  }

  const faceToriAtStart = Math.atan2(startTori[0] - startUke1[0], startTori[2] - startUke1[2]);
  let startUke1Yaw = episode.ukeStartYaw !== undefined
    ? episode.ukeStartYaw
    : (episode.ukeTrajectory?.startYaw !== undefined ? episode.ukeTrajectory.startYaw : faceToriAtStart);

  if (isStationaryUke && !isUkeEvading) {
    startUke1Yaw = endUke1Yaw;
  } else if (orientationModeUke === 'mode1_free' && customUkeYawDeg !== undefined && customUkeYawDeg !== null && isStationaryUke) {
    startUke1Yaw = endUke1Yaw;
  }

  // 9. Расчет положения и углов стоп на татами
  const effectiveStanceTori = stanceTori || toriPart.stance || 'zenkutsu_dachi_left';
  const stanceSpecTori = SHOTOKAN_STANCES[effectiveStanceTori] || SHOTOKAN_STANCES['zenkutsu_dachi_left'];
  const leadFootAngleTori = endToriYaw + ((stanceSpecTori.leadFootAngle || 0) * Math.PI) / 180;
  const rearFootAngleTori = endToriYaw + ((stanceSpecTori.rearFootAngle || 0) * Math.PI) / 180;

  const effectiveStanceUke = stanceUke || uke1Part.stance || 'zenkutsu_dachi_left';
  const stanceSpecUke = SHOTOKAN_STANCES[effectiveStanceUke] || SHOTOKAN_STANCES['zenkutsu_dachi_left'];
  const leadFootAngleUke = endUke1Yaw + ((stanceSpecUke.leadFootAngle || 0) * Math.PI) / 180;
  const rearFootAngleUke = endUke1Yaw + ((stanceSpecUke.rearFootAngle || 0) * Math.PI) / 180;

  // 10. Директриса атаки (прямая линия от точки старта атаки)
  const attackDirectrix = {
    start: [startTori[0], 0.95, startTori[2]],
    end: [startTori[0] + attackDirX * (targetDist + 1.25), 0.95, startTori[2] + attackDirZ * (targetDist + 1.25)],
    direction: [attackDirX, 0, attackDirZ],
    attackYaw,
  };

  // 11. Укэ 2 (если включен 3-person командный режим)
  const uke2Deg = normalizeAngleDeg((norm.uke2AngleDeg || 60) + (ukeAngleOffsetDeg || 0));
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

  // Векторы направлений и соосность ориентации лицом к противнику
  const toriDirVec = [Math.sin(endToriYaw), 0, Math.cos(endToriYaw)];
  const ukeDirVec = [Math.sin(endUke1Yaw), 0, Math.cos(endUke1Yaw)];
  const distToTori = Math.hypot(endTori[0] - endUke1[0], endTori[2] - endUke1[2]) || 0.001;
  const toToriDir = [(endTori[0] - endUke1[0]) / distToTori, 0, (endTori[2] - endUke1[2]) / distToTori];
  const dotFacing = ukeDirVec[0] * toToriDir[0] + ukeDirVec[2] * toToriDir[2];
  const ukeFacingAngleToToriDeg = Math.round(Math.acos(Math.max(-1, Math.min(1, dotFacing))) * (180 / Math.PI) * 10) / 10;
  const isFacingToriDirectly = ukeFacingAngleToToriDeg <= 3.0;

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
    isStationaryTori: Boolean(isStationaryTori),
    isStationaryUke: Boolean(isStationaryUke),
    isEvaded,
    lateralOffsetMeters,
    attackDirectrix,
    angles: {
      toriYaw: endToriYaw,
      uke1Yaw: endUke1Yaw,
      uke2Yaw: dirUke2ToTori,
    },
    footAnglesTori: {
      lead: leadFootAngleTori,
      rear: rearFootAngleTori,
      spec: stanceSpecTori,
    },
    footAnglesUke: {
      lead: leadFootAngleUke,
      rear: rearFootAngleUke,
      spec: stanceSpecUke,
    },
    torsoFacingTori: endToriYaw,
    torsoFacingUke: endUke1Yaw,
    // Полная телеметрия пространственной системы координат Бункай
    coordinates: {
      tori: {
        x: endTori[0],
        y: endTori[1],
        z: endTori[2],
        yawDeg: Math.round((endToriYaw * 180) / Math.PI),
        yawRad: endToriYaw,
        directionVector: toriDirVec,
      },
      uke1: {
        x: endUke1[0],
        y: endUke1[1],
        z: endUke1[2],
        yawDeg: Math.round((endUke1Yaw * 180) / Math.PI),
        yawRad: endUke1Yaw,
        directionVector: ukeDirVec,
        isFacingOpponent: isFacingToriDirectly,
        facingAngleToOpponentDeg: ukeFacingAngleToToriDeg,
      },
      relative: {
        maaiDistance: curDist,
        deltaX: endUke1[0] - endTori[0],
        deltaZ: endUke1[2] - endTori[2],
        lateralShift: lateralOffsetMeters,
        isEvaded,
      },
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

export function evaluateTimelineState({
  episode,
  timelineTime = 0,
  speed = 1.0,
}) {
  const norm = normalizeBunkaiEpisode(episode);
  const toriPart = norm.participants.find((p) => p.role === 'tori') || {};
  const uke1Part = norm.participants.find((p) => p.role === 'uke1' || p.role === 'uke') || {};
  const uke2Part = norm.participants.find((p) => p.role === 'uke2') || {};

  const toriMeta = resolveBunkaiClip(toriPart.clipName);
  const uke1Meta = resolveBunkaiClip(uke1Part.clipName);
  const uke2Meta = resolveBunkaiClip(uke2Part.clipName);

  const totalDuration = Math.max(
    (toriPart.delaySeconds || 0) + toriMeta.duration,
    (uke1Part.delaySeconds || 0) + uke1Meta.duration,
    (uke2Part.delaySeconds || 0) + uke2Meta.duration,
    2.2
  );

  const t = Math.max(0, Math.min(totalDuration, timelineTime));

  function getParticipantState(part, meta) {
    const delay = part.delaySeconds || 0;
    if (t < delay) {
      return {
        isWaiting: true,
        localTime: 0,
        progress: 0,
        activeClip: part.stance === 'kokutsu' ? 'kokutsu_dachi_left' : part.stance === 'zenkutsu' ? 'zenkutsu_dachi_left' : 'idle_shizentai',
      };
    }
    const elapsed = t - delay;
    const dur = meta.duration || 1.2;
    const progress = Math.min(1.0, elapsed / dur);
    return {
      isWaiting: false,
      localTime: Math.min(dur, elapsed),
      progress,
      activeClip: meta.clipName,
    };
  }

  const toriState = getParticipantState(toriPart, toriMeta);
  const uke1State = getParticipantState(uke1Part, uke1Meta);
  const uke2State = getParticipantState(uke2Part, uke2Meta);

  let currentTargetRole = 'uke1';
  let isTurningToUke2 = false;
  let turnProgress = 0.0;

  if (norm.activeAttacker === 'sequential' || episode.activeAttacker === 'sequential') {
    const switchTime = norm.switchTime || 1.35;
    if (t < switchTime) {
      currentTargetRole = 'uke1';
    } else {
      currentTargetRole = 'uke2';
      isTurningToUke2 = true;
      turnProgress = 1.0;
    }
  }

  const isContactWindow = Math.abs(t - ((uke1Part.delaySeconds || 0) + norm.tContact)) < 0.22;

  return {
    totalDuration,
    currentTime: t,
    toriState,
    uke1State,
    uke2State,
    currentTargetRole,
    isTurningToUke2,
    turnProgress,
    isContactWindow,
    phase: t < 0.35 ? 'kamae' : t < 1.35 ? 'contact' : 'zanshin',
  };
}
