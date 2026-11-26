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
  stance_neko_left: {
    id: 'stance_neko_left',
    nameRu: 'Хидари нэкоаси-дати',
    kanji: '猫足立ち',
    side: 'left',
    sideRu: 'Хидари (левосторонняя)',
    weightRatio: [10, 90],
    feetDistance: 0.45,
    feetWidth: 0.18,
    leadFootAngle: 0,
    rearFootAngle: 45,
    hipAngle: 45,
    kneeFlex: 'Задняя нога согнута, передняя на носке',
    description: 'Кошачья стойка (левосторонняя). 90% веса на задней правой ноге, передняя левая касается пола подушечкой стопы.',
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
  { id: 'turn', label: 'Поворот (Маваттэ)', icon: 'RotateCw' },
  { id: 'punch', label: 'Удар рукой (Цуки / Учи)', icon: 'Zap' },
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
 * Полный 34-шаговый канонический сценарий Бункая ката Хэйан Шодан (из эталонного плана).
 * 1 — Тори (синий, атакующий), 2 — Укэ (белый, защищающийся).
 */
export const HEIAN_SHODAN_BUNKAI_18_STEPS = [
  // 1 (Исх. шаг 1): Начало комплекса — Хэйко-дати
  {
    stepNumber: 1,
    title: 'Шаг 1: Хэйко-дати (Исх. шаг 1)',
    description: '1 (Тори): Хэйко-дати (стойка готовности). 2 (Укэ): Хэйко-дати (стойка готовности).',
    notes: 'Исходная стойка готовности (2.00м, То-ма) · Кимэ: стойка',
    optimalDistance: 2.00,
    attackAngleDeg: 0,
    contactType: 'none',
    interactionType: 'distance_only',
    tContact: 0.50,
    duration: 1.2,
    toriActionType: 'stance',
    ukeActionType: 'stance',
    scenarioAngles: { label: 'Осевая линия 0° · 2.00м (То-ма)', toriAngleDeg: 0, ukeAngleDeg: 180, relativeAngleDeg: 0 },
    toriTrajectory: { start: [0, 0, -1.00], end: [0, 0, -1.00], startYaw: 0, endYaw: 0, isStationary: true },
    ukeTrajectory: { start: [0, 0, 1.00], end: [0, 0, 1.00], startYaw: Math.PI, endYaw: Math.PI, isStationary: true },
    displacementTori: [0, 0, 0],
    displacementUke: [0, 0, 0],
    participants: [
      { role: 'tori', clipName: 'heiko_dachi', stance: 'heiko_dachi', finalStance: 'heiko_dachi', actionType: 'stance', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'heiko_dachi', stance: 'heiko_dachi', finalStance: 'heiko_dachi', actionType: 'stance', delaySeconds: 0.0, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 2 (Исх. шаг 2.1): Переход в стойку Мусуби-дати
  {
    stepNumber: 2,
    title: 'Шаг 2: Переход в стойку Мусуби-дати (Исх. шаг 2.1)',
    description: '1 (Тори): Сведение пяток в Мусуби-дати. 2 (Укэ): Сведение пяток в Мусуби-дати.',
    notes: 'Подготовка к начальному поклону (2.00м, То-ма) · Кимэ: стойка',
    optimalDistance: 2.00,
    attackAngleDeg: 0,
    contactType: 'none',
    interactionType: 'distance_only',
    tContact: 0.50,
    duration: 1.2,
    toriActionType: 'stance',
    ukeActionType: 'stance',
    scenarioAngles: { label: 'Мусуби-дати · 2.00м', toriAngleDeg: 0, ukeAngleDeg: 180, relativeAngleDeg: 0 },
    toriTrajectory: { start: [0, 0, -1.00], end: [0, 0, -1.00], startYaw: 0, endYaw: 0, isStationary: true },
    ukeTrajectory: { start: [0, 0, 1.00], end: [0, 0, 1.00], startYaw: Math.PI, endYaw: Math.PI, isStationary: true },
    displacementTori: [0, 0, 0],
    displacementUke: [0, 0, 0],
    participants: [
      { role: 'tori', clipName: 'stance_musubi', stance: 'heiko_dachi', finalStance: 'stance_musubi', actionType: 'stance', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'stance_musubi', stance: 'heiko_dachi', finalStance: 'stance_musubi', actionType: 'stance', delaySeconds: 0.0, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 3 (Исх. шаг 2.2): Начальный поклон (Рэй)
  {
    stepNumber: 3,
    title: 'Шаг 3: Начальный поклон Рэй (Исх. шаг 2.2)',
    description: '1 (Тори): Наклон корпуса 30° вперёд и возврат в Мусуби-дати. 2 (Укэ): Синхронный поклон Рэй 30°.',
    notes: 'Ритуальное приветствие перед боем (2.00м, То-ма) · Кимэ: стойка',
    optimalDistance: 2.00,
    attackAngleDeg: 0,
    contactType: 'none',
    interactionType: 'distance_only',
    isBow: true,
    tContact: 0.50,
    duration: 1.8,
    toriActionType: 'stance',
    ukeActionType: 'stance',
    scenarioAngles: { label: 'Поклон Рэй · 2.00м', toriAngleDeg: 0, ukeAngleDeg: 180, relativeAngleDeg: 0 },
    toriTrajectory: { start: [0, 0, -1.00], end: [0, 0, -1.00], startYaw: 0, endYaw: 0, isStationary: true },
    ukeTrajectory: { start: [0, 0, 1.00], end: [0, 0, 1.00], startYaw: Math.PI, endYaw: Math.PI, isStationary: true },
    displacementTori: [0, 0, 0],
    displacementUke: [0, 0, 0],
    participants: [
      { role: 'tori', clipName: 'stance_musubi', stance: 'stance_musubi', finalStance: 'stance_musubi', actionType: 'stance', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'stance_musubi', stance: 'stance_musubi', finalStance: 'stance_musubi', actionType: 'stance', delaySeconds: 0.0, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 4 (Исх. шаг 3): Возврат в Хэйко-дати (Сидзэнтай)
  {
    stepNumber: 4,
    title: 'Шаг 4: Стойка готовности Хэйко-дати (Исх. шаг 3)',
    description: '1 (Тори): Переход в Хэйко-дати (Сидзэнтай). 2 (Укэ): Переход в Хэйко-дати (Сидзэнтай).',
    notes: 'Стойка готовности перед началом схватки (2.00м, То-ма) · Кимэ: стойка',
    optimalDistance: 2.00,
    attackAngleDeg: 0,
    contactType: 'none',
    interactionType: 'distance_only',
    tContact: 0.50,
    duration: 1.4,
    toriActionType: 'stance',
    ukeActionType: 'stance',
    scenarioAngles: { label: 'Хэйко-дати · 2.00м', toriAngleDeg: 0, ukeAngleDeg: 180, relativeAngleDeg: 0 },
    toriTrajectory: { start: [0, 0, -1.00], end: [0, 0, -1.00], startYaw: 0, endYaw: 0, isStationary: true },
    ukeTrajectory: { start: [0, 0, 1.00], end: [0, 0, 1.00], startYaw: Math.PI, endYaw: Math.PI, isStationary: true },
    displacementTori: [0, 0, 0],
    displacementUke: [0, 0, 0],
    participants: [
      { role: 'tori', clipName: 'heiko_dachi', stance: 'stance_musubi', finalStance: 'heiko_dachi', actionType: 'stance', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'heiko_dachi', stance: 'stance_musubi', finalStance: 'heiko_dachi', actionType: 'stance', delaySeconds: 0.0, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 5 (Исх. шаг 4): Вход в боевые стойки (Ма-ай) — Синхронное сближение
  {
    stepNumber: 5,
    title: 'Шаг 5: Вход в боевые стойки (Ма-ай) (Исх. шаг 4)',
    description: '1 (Тори): Шаг левой ногой вперёд в Хидари дзэнкуцу-дати (+0.70м по Z). 2 (Укэ): Шаг левой ногой назад в Миги дзэнкуцу-дати (камаэ, +0.20м).',
    notes: 'Синхронное сближение на дистанцию удара ногой (1.50м Иссоку-итто) · Кимэ: стойка',
    optimalDistance: 1.50,
    attackAngleDeg: 0,
    contactType: 'distance_only',
    interactionType: 'distance_only',
    tContact: 0.55,
    duration: 2.0,
    toriActionType: 'locomotion',
    ukeActionType: 'locomotion',
    scenarioAngles: { label: 'Вход в Дзэнкуцу-дати · 1.50м (Иссоку-итто)', toriAngleDeg: 0, ukeAngleDeg: 180, relativeAngleDeg: 0 },
    toriTrajectory: { start: [0, 0, -1.00], end: [0, 0, -0.30], startYaw: 0, endYaw: 0, isStationary: false },
    ukeTrajectory: { start: [0, 0, 1.00], end: [0, 0, 1.20], startYaw: Math.PI, endYaw: Math.PI, isStationary: false },
    displacementTori: [0, 0, 0.70],
    displacementUke: [0, 0, 0.20],
    participants: [
      { role: 'tori', clipName: 'enter_zenkutsu_left', stance: 'heiko_dachi', finalStance: 'zenkutsu_dachi_left', actionType: 'locomotion', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'enter_zenkutsu_right', stance: 'heiko_dachi', finalStance: 'zenkutsu_dachi_right', actionType: 'locomotion', delaySeconds: 0.0, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 6 (Исх. шаг 5.1): Маэ-гэри vs Тай-сабаки 35° и Гэдан-барай
  {
    stepNumber: 6,
    title: 'Шаг 6: Маэ-гэри vs Тай-сабаки 35° и Гэдан-барай (Исх. шаг 5.1)',
    description: '1 (Тори): Маэ-гэри правой (Тюдан) с приходом вперёд в Миги дзэнкуцу-дати (+0.60м). 2 (Укэ): Гэдан-барай левой с уходом вправо +35° (юри-аси) в Хидари дзэнкуцу-дати.',
    notes: 'Уход челноком (юри-аси) · Предплечье левой руки Укэ сбивает голень правой ноги Тори (1.05м) · Кимэ: блок и стойка',
    optimalDistance: 1.05,
    attackAngleDeg: 0,
    contactType: 'block_gedan',
    interactionType: 'body_contact',
    tContact: 0.48,
    duration: 2.2,
    toriActionType: 'kick',
    ukeActionType: 'block',
    scenarioAngles: { label: 'Маэ-гэри 0° · Тай-сабаки +35° · Гэдан-барай 1.05м', toriAngleDeg: 0, ukeAngleDeg: -161, retreatAngleDeg: 35 },
    toriTrajectory: { start: [0, 0, -0.30], end: [0, 0, 0.30], startYaw: 0, endYaw: 0, isStationary: false },
    ukeTrajectory: { start: [0, 0, 1.20], end: [0.35, 0, 1.30], startYaw: Math.PI, endYaw: -2.805, isStationary: false },
    displacementTori: [0, 0, 0.60],
    displacementUke: [0.35, 0, 0.10],
    participants: [
      { role: 'tori', clipName: 'mae_geri_right', stance: 'zenkutsu_dachi_left', finalStance: 'zenkutsu_dachi_right', landingMode: 'forward', actionType: 'kick', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'gedan_barai_left', stance: 'zenkutsu_dachi_right', finalStance: 'zenkutsu_dachi_left', actionType: 'block', delaySeconds: 0.16, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 7 (Исх. шаг 5.2): Контрудар Гяку-дзуки в корпус
  {
    stepNumber: 7,
    title: 'Шаг 7: Контрудар Гяку-дзуки в корпус (Исх. шаг 5.2)',
    description: '1 (Тори): Фиксация Миги дзэнкуцу-дати после выпада (стационарно). 2 (Укэ): Гяку-дзуки правой в корпус (Тюдан) под углом +35° с подачей таза вперёд.',
    notes: 'Реверсивная атака с фланга · Правый кулак Укэ в солнечное сплетение Тори (контакт 0.76м) · Кимэ: фиксация кулака',
    optimalDistance: 0.76,
    attackAngleDeg: 0,
    contactType: 'punch_body',
    interactionType: 'body_contact',
    tContact: 0.46,
    duration: 1.8,
    toriActionType: 'stance',
    ukeActionType: 'punch',
    scenarioAngles: { label: 'Контрудар Гяку-дзуки +35° · 0.76м', toriAngleDeg: 0, ukeAngleDeg: -161 },
    toriTrajectory: { start: [0, 0, 0.30], end: [0, 0, 0.30], startYaw: 0, endYaw: 0, isStationary: true },
    ukeTrajectory: { start: [0.35, 0, 1.30], end: [0.24, 0, 1.02], startYaw: -2.805, endYaw: -2.836, isStationary: false },
    displacementTori: [0, 0, 0],
    displacementUke: [-0.11, 0, -0.28],
    participants: [
      { role: 'tori', clipName: 'zenkutsu_dachi_right', stance: 'zenkutsu_dachi_right', finalStance: 'zenkutsu_dachi_right', actionType: 'stance', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'gyaku_zuki_right', stance: 'zenkutsu_dachi_left', finalStance: 'zenkutsu_dachi_left', actionType: 'punch', delaySeconds: 0.06, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 8 (Исх. шаг 6.1): Маэ-гэри под 12.5° vs возврат на ось
  {
    stepNumber: 8,
    title: 'Шаг 8: Маэ-гэри под 12.5° vs возврат на ось (Исх. шаг 6.1)',
    description: '1 (Тори): Маэ-гэри левой (Тюдан) с доворотом +12.5° и приходом вперёд в Хидари дзэнкуцу-дати. 2 (Укэ): Шаг левой назад на ось X=0.00м в Миги дзэнкуцу-дати и Гэдан-барай правой.',
    notes: 'Смена направления атаки (+12.5°) и Гэдан-барай · Предплечье правой руки Укэ сбивает голень левой ноги Тори (1.05м)',
    optimalDistance: 1.05,
    attackAngleDeg: 12.5,
    contactType: 'block_gedan',
    interactionType: 'body_contact',
    tContact: 0.48,
    duration: 2.2,
    toriActionType: 'kick',
    ukeActionType: 'block',
    scenarioAngles: { label: 'Атака +12.5° · Возврат Укэ на ось · Гэдан-барай 1.05м', toriAngleDeg: 12.5, ukeAngleDeg: -172 },
    toriTrajectory: { start: [0, 0, 0.30], end: [0.15, 0, 1.00], startYaw: 0, endYaw: 0.218, isStationary: false },
    ukeTrajectory: { start: [0.24, 0, 1.02], end: [0.00, 0, 2.04], startYaw: -2.836, endYaw: -2.998, isStationary: false },
    displacementTori: [0.15, 0, 0.70],
    displacementUke: [-0.24, 0, 1.02],
    participants: [
      { role: 'tori', clipName: 'mae_geri_left', stance: 'zenkutsu_dachi_right', finalStance: 'zenkutsu_dachi_left', landingMode: 'forward', actionType: 'kick', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'gedan_barai_right', stance: 'zenkutsu_dachi_left', finalStance: 'zenkutsu_dachi_right', actionType: 'block', delaySeconds: 0.14, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 9 (Исх. шаг 6.3): Контрудар Тэтцуи (рука-молот) (шаг с Хайван-укэ убран)
  {
    stepNumber: 9,
    title: 'Шаг 9: Контрудар Тэтцуи (рука-молот) (Исх. шаг 6.3)',
    description: '1 (Тори): Удержание Хидари дзэнкуцу-дати (стационарно). 2 (Укэ): Контрудар Тэтцуи-учи правой в голову (Дзёдан) в Миги дзэнкуцу-дати.',
    notes: 'Основание правого кулака Укэ в область виска/ключицы Тори (контакт 0.62м) · Кимэ: фиксация удара',
    optimalDistance: 0.62,
    attackAngleDeg: 12.5,
    contactType: 'punch_head',
    interactionType: 'body_contact',
    tContact: 0.45,
    duration: 1.8,
    toriActionType: 'stance',
    ukeActionType: 'punch',
    scenarioAngles: { label: 'Тэтцуи-учи в Дзёдан · 0.62м', toriAngleDeg: 12.5, ukeAngleDeg: -170 },
    toriTrajectory: { start: [0.15, 0, 1.00], end: [0.15, 0, 1.00], startYaw: 0.218, endYaw: 0.218, isStationary: true },
    ukeTrajectory: { start: [0.00, 0, 2.04], end: [0.02, 0, 1.61], startYaw: -2.998, endYaw: -2.93, isStationary: false },
    displacementTori: [0, 0, 0],
    displacementUke: [0.02, 0, -0.43],
    participants: [
      { role: 'tori', clipName: 'zenkutsu_dachi_left', stance: 'zenkutsu_dachi_left', finalStance: 'zenkutsu_dachi_left', actionType: 'stance', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'tech_tettsui_right', stance: 'zenkutsu_dachi_right', finalStance: 'zenkutsu_dachi_right', actionType: 'punch', delaySeconds: 0.06, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 10 (Исх. шаг 6.4): Добивающий Гяку-дзуки левой
  {
    stepNumber: 10,
    title: 'Шаг 10: Добивающий Гяку-дзуки левой (Исх. шаг 6.4)',
    description: '1 (Тори): Удержание Хидари дзэнкуцу-дати (стационарно). 2 (Укэ): Гяку-дзуки левой в корпус (Тюдан) с разворотом бёдер (коши).',
    notes: 'Завершение серии Укэ · Левый кулак Укэ в солнечное сплетение Тори (контакт 0.76м) · Кимэ: фиксация кулака',
    optimalDistance: 0.76,
    attackAngleDeg: 12.5,
    contactType: 'punch_body',
    interactionType: 'body_contact',
    tContact: 0.45,
    duration: 1.8,
    toriActionType: 'stance',
    ukeActionType: 'punch',
    scenarioAngles: { label: 'Добивающий Гяку-дзуки левой · 0.76м', toriAngleDeg: 12.5, ukeAngleDeg: -170 },
    toriTrajectory: { start: [0.15, 0, 1.00], end: [0.15, 0, 1.00], startYaw: 0.218, endYaw: 0.218, isStationary: true },
    ukeTrajectory: { start: [0.02, 0, 1.61], end: [0.00, 0, 1.75], startYaw: -2.93, endYaw: -2.94, isStationary: false },
    displacementTori: [0, 0, 0],
    displacementUke: [-0.02, 0, 0.14],
    participants: [
      { role: 'tori', clipName: 'zenkutsu_dachi_left', stance: 'zenkutsu_dachi_left', finalStance: 'zenkutsu_dachi_left', actionType: 'stance', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'gyaku_zuki_left', stance: 'zenkutsu_dachi_right', finalStance: 'zenkutsu_dachi_right', actionType: 'punch', delaySeconds: 0.05, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 11 (Исх. шаг 7.1): Отход/докручивание угла правой ногой, оставаясь в Хидари дзэнкуцу-дати
  {
    stepNumber: 11,
    title: 'Шаг 11: Докручивание угла правой ногой в Хидари дзэнкуцу (Исх. шаг 7.1)',
    description: '1 (Тори): Правой ногой подшаг назад и доворот угла на ось атаки, оставаясь в Хидари дзэнкуцу-дати. 2 (Укэ): Боевой контроль в Миги дзэнкуцу-дати.',
    notes: 'Сохранение Хидари дзэнкуцу-дати (левая впереди, правая докручивает угол) перед ударом Миги маэ-гэри (1.15м)',
    optimalDistance: 1.15,
    attackAngleDeg: 3.0,
    contactType: 'distance_only',
    interactionType: 'distance_only',
    tContact: 0.50,
    duration: 1.5,
    toriActionType: 'locomotion',
    ukeActionType: 'stance',
    scenarioAngles: { label: 'Доворот правой ногой в Хидари дзэнкуцу · 1.15м', toriAngleDeg: 3, ukeAngleDeg: -178 },
    toriTrajectory: { start: [0.15, 0, 1.00], end: [0.00, 0, 0.55], startYaw: 0.218, endYaw: 0.05, isStationary: false },
    ukeTrajectory: { start: [0.00, 0, 1.75], end: [0.03, 0, 1.70], startYaw: -2.94, endYaw: -3.11, isStationary: false },
    displacementTori: [-0.15, 0, -0.45],
    displacementUke: [0.03, 0, -0.05],
    participants: [
      { role: 'tori', clipName: 'slide_backward', stance: 'zenkutsu_dachi_left', finalStance: 'zenkutsu_dachi_left', actionType: 'locomotion', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'zenkutsu_dachi_right', stance: 'zenkutsu_dachi_right', finalStance: 'zenkutsu_dachi_right', actionType: 'stance', delaySeconds: 0.0, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 12 (Исх. шаг 7.2): Атака Миги Маэ-гэри (правой ногой) — Отход Укэ и блок Гэдан-барай
  {
    stepNumber: 12,
    title: 'Шаг 12: Атака Миги Маэ-гэри (правой ногой) (Исх. шаг 7.2)',
    description: '1 (Тори): Маэ-гэри правой (Миги Маэ-гэри, Тюдан) из Хидари дзэнкуцу-дати с возвратом ноги назад в Хидари дзэнкуцу-дати. 2 (Укэ): Шаг правой ногой назад в Хидари дзэнкуцу-дати и Гэдан-барай левой.',
    notes: 'Миги Маэ-гэри и блок Гэдан-барай · Левое предплечье Укэ сбивает голень правой ноги Тори (1.07м) · Кимэ: блок Гэдан-барай',
    optimalDistance: 1.07,
    attackAngleDeg: 3.0,
    contactType: 'block_gedan',
    interactionType: 'body_contact',
    tContact: 0.48,
    duration: 2.0,
    toriActionType: 'kick',
    ukeActionType: 'block',
    scenarioAngles: { label: 'Миги Маэ-гэри · Гэдан-барай левой · 1.07м', toriAngleDeg: 3, ukeAngleDeg: -177 },
    toriTrajectory: { start: [0.00, 0, 0.55], end: [0.00, 0, 0.55], startYaw: 0.05, endYaw: 0.05, isStationary: true },
    ukeTrajectory: { start: [0.03, 0, 1.70], end: [0.04, 0, 1.62], startYaw: -3.11, endYaw: -3.09, isStationary: false },
    displacementTori: [0, 0, 0],
    displacementUke: [0.01, 0, -0.08],
    participants: [
      { role: 'tori', clipName: 'mae_geri_right', stance: 'zenkutsu_dachi_left', finalStance: 'zenkutsu_dachi_left', landingMode: 'back', actionType: 'kick', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'gedan_barai_left', stance: 'zenkutsu_dachi_right', finalStance: 'zenkutsu_dachi_left', actionType: 'block', delaySeconds: 0.14, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 13 (Исх. шаг 7.3): Выпад Ой-дзуки в голову (Дзёдан) — Встречный блок Агэ-укэ
  {
    stepNumber: 13,
    title: 'Шаг 13: Выпад Ой-дзуки в голову (Дзёдан) (Исх. шаг 7.3)',
    description: '1 (Тори): Шаг правой ногой вперёд с ударом Ой-дзуки в голову (Дзёдан) в Миги дзэнкуцу-дати. 2 (Укэ): Восходящий блок Агэ-укэ левой (Дзёдан) с упором на переднюю ногу.',
    notes: 'Встречный блок Агэ-укэ · Левое предплечье Укэ перехватывает правую руку Тори на уровне головы (0.86м) · Кимэ: верхний блок',
    optimalDistance: 0.86,
    attackAngleDeg: 5.0,
    contactType: 'block_jodan',
    interactionType: 'body_contact',
    tContact: 0.48,
    duration: 2.0,
    toriActionType: 'punch',
    ukeActionType: 'block',
    scenarioAngles: { label: 'Выпад Ой-дзуки Дзёдан · Агэ-укэ · 0.86м', toriAngleDeg: 5, ukeAngleDeg: -175 },
    toriTrajectory: { start: [0.00, 0, 0.55], end: [0.06, 0, 1.15], startYaw: 0.05, endYaw: 0.08, isStationary: false },
    ukeTrajectory: { start: [0.04, 0, 1.62], end: [0.12, 0, 2.01], startYaw: -3.09, endYaw: -3.05, isStationary: false },
    displacementTori: [0.06, 0, 0.60],
    displacementUke: [0.08, 0, 0.39],
    participants: [
      { role: 'tori', clipName: 'tech_jodan_zuki_right', stance: 'zenkutsu_dachi_left', finalStance: 'zenkutsu_dachi_right', actionType: 'punch', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'age_uke_left', stance: 'zenkutsu_dachi_left', finalStance: 'zenkutsu_dachi_left', actionType: 'block', delaySeconds: 0.12, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 14 (Исх. шаг 7.4): Гяку Агэ-укэ с выпадом и БОЛЕВОЙ ПРИЁМ (Ваки-гатамэ)
  {
    stepNumber: 14,
    title: 'Шаг 14: Гяку Агэ-укэ с выпадом и БОЛЕВОЙ ПРИЁМ (Исх. шаг 7.4)',
    description: '1 (Тори): Выпрямленная правая рука остаётся вытянутой в захвате Укэ (стационарно). 2 (Укэ): Захват запястья левой + выпад Гяку Агэ-укэ правой точно по локтю/предплечью Тори (Чика-ма 0.65м).',
    notes: 'Захват запястья и рычаг локтя (Ваки-гатамэ, угол 30°) · Прямой контакт правым предплечьем по правой руке Тори (0.65м Чика-ма) · Кимэ: удержание замка',
    optimalDistance: 0.65,
    attackAngleDeg: 5.0,
    contactType: 'joint_lock',
    interactionType: 'body_contact',
    tContact: 0.45,
    duration: 2.4,
    toriActionType: 'hold',
    ukeActionType: 'joint_lock',
    scenarioAngles: { label: 'Ваки-гатамэ · Болевой приём на локоть · 0.65м (Чика-ма)', toriAngleDeg: 5, ukeAngleDeg: -162 },
    toriTrajectory: { start: [0.06, 0, 1.15], end: [0.06, 0, 1.15], startYaw: 0.08, endYaw: 0.08, isStationary: true },
    ukeTrajectory: { start: [0.12, 0, 2.01], end: [-0.15, 0, 1.77], startYaw: -3.05, endYaw: -2.81, isStationary: false },
    displacementTori: [0, 0, 0],
    displacementUke: [-0.27, 0, -0.24],
    participants: [
      { role: 'tori', clipName: 'zenkutsu_dachi_right', stance: 'zenkutsu_dachi_right', finalStance: 'zenkutsu_dachi_right', actionType: 'hold', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'age_uke_right', stance: 'zenkutsu_dachi_left', finalStance: 'zenkutsu_dachi_left', actionType: 'joint_lock', delaySeconds: 0.06, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 15 (Исх. шаг 8): Разрыв болевого приёма и выход на боевую дистанцию (без разворота на 180°)
  {
    stepNumber: 15,
    title: 'Шаг 15: Выход из болевого и перестроение в Хидари дзэнкуцу (Исх. шаг 8)',
    description: '1 (Тори): Фиксация Миги дзэнкуцу-дати лицом к Укэ (без разворота на 180°). 2 (Укэ): Разрыв замка и отшаг в Хидари дзэнкуцу-дати лицом к Тори.',
    notes: 'Сохранение фронтального направления после болевого приёма и выход на дистанцию Маэ-гэри (1.15м) · Кимэ: стойка',
    optimalDistance: 1.15,
    attackAngleDeg: 0,
    contactType: 'distance_only',
    interactionType: 'distance_only',
    tContact: 0.50,
    duration: 1.8,
    toriActionType: 'stance',
    ukeActionType: 'locomotion',
    scenarioAngles: { label: 'Выход на боевую дистанцию · 1.15м', toriAngleDeg: 5, ukeAngleDeg: -175 },
    toriTrajectory: { start: [0.06, 0, 1.15], end: [0.06, 0, 1.15], startYaw: 0.08, endYaw: 0.08, isStationary: true },
    ukeTrajectory: { start: [-0.15, 0, 1.77], end: [0.15, 0, 2.30], startYaw: -2.81, endYaw: -3.06, isStationary: false },
    displacementTori: [0, 0, 0],
    displacementUke: [0.30, 0, 0.53],
    participants: [
      { role: 'tori', clipName: 'zenkutsu_dachi_right', stance: 'zenkutsu_dachi_right', finalStance: 'zenkutsu_dachi_right', actionType: 'stance', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'step_backward_right', stance: 'zenkutsu_dachi_left', finalStance: 'zenkutsu_dachi_left', actionType: 'locomotion', delaySeconds: 0.05, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 16 (Исх. шаги 9.1–9.2 объединены): Полный разворот 360° Укэ с Гэдан-барай vs Хидари Маэ-гэри
  {
    stepNumber: 16,
    title: 'Шаг 16: Полный разворот Укэ с Гэдан-барай vs Хидари Маэ-гэри (Исх. шаг 9.1–9.2)',
    description: '1 (Тори): Через паузу (после начала разворота Укэ) Хидари Маэ-гэри с возвратом назад в Миги дзэнкуцу-дати (опорная правая стопа плотно на татами). 2 (Укэ): Полный разворот на 360° в Миги дзэнкуцу-дати и Гэдан-барай правой.',
    notes: 'Укэ выполняет полный оборот на 360° и встречает Хидари Маэ-гэри сметным блоком Гэдан-барай (0.95м) · Кимэ: блок и стойка',
    optimalDistance: 0.95,
    attackAngleDeg: 0,
    contactType: 'block_gedan',
    interactionType: 'body_contact',
    ukeFullTurn: true,
    ukeTurnDir: 1,
    tContact: 0.56,
    duration: 2.5,
    toriActionType: 'kick',
    ukeActionType: 'block',
    scenarioAngles: { label: 'Полный разворот Укэ 360° · Хидари Маэ-гэри · 0.95м', toriAngleDeg: 5, ukeAngleDeg: -175 },
    toriTrajectory: { start: [0.06, 0, 1.15], end: [0.06, 0, 1.15], startYaw: 0.08, endYaw: 0.08, isStationary: true },
    ukeTrajectory: { start: [0.15, 0, 2.30], end: [0.13, 0, 2.10], startYaw: -3.06, endYaw: -3.06, isStationary: false },
    displacementTori: [0, 0, 0],
    displacementUke: [-0.02, 0, -0.20],
    participants: [
      { role: 'tori', clipName: 'mae_geri_left', stance: 'zenkutsu_dachi_right', finalStance: 'zenkutsu_dachi_right', landingMode: 'back', actionType: 'kick', delaySeconds: 0.22, isGround: false },
      { role: 'uke1', clipName: 'gedan_barai_right', stance: 'zenkutsu_dachi_left', finalStance: 'zenkutsu_dachi_right', actionType: 'block', delaySeconds: 0.0, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 17 (Исх. шаг 9.3): Контрудар Укэ Гяку-дзуки левой
  {
    stepNumber: 17,
    title: 'Шаг 17: Контрудар Укэ Гяку-дзуки левой (Исх. шаг 9.3)',
    description: '1 (Тори): Фиксация Миги дзэнкуцу-дати (стационарно). 2 (Укэ): Гяку-дзуки левой в корпус (Тюдан) с дожимом бёдрами вперёд.',
    notes: 'Реверсивный удар в корпус · Левый кулак Укэ в солнечное сплетение Тори (контакт 0.76м) · Кимэ: фиксация кулака',
    optimalDistance: 0.76,
    attackAngleDeg: 0,
    contactType: 'punch_body',
    interactionType: 'body_contact',
    tContact: 0.45,
    duration: 1.8,
    toriActionType: 'stance',
    ukeActionType: 'punch',
    scenarioAngles: { label: 'Контрудар Гяку-дзуки левой · 0.76м', toriAngleDeg: 5, ukeAngleDeg: -175 },
    toriTrajectory: { start: [0.06, 0, 1.15], end: [0.06, 0, 1.15], startYaw: 0.08, endYaw: 0.08, isStationary: true },
    ukeTrajectory: { start: [0.13, 0, 2.10], end: [0.12, 0, 1.91], startYaw: -3.06, endYaw: -3.06, isStationary: false },
    displacementTori: [0, 0, 0],
    displacementUke: [-0.01, 0, -0.19],
    participants: [
      { role: 'tori', clipName: 'zenkutsu_dachi_right', stance: 'zenkutsu_dachi_right', finalStance: 'zenkutsu_dachi_right', actionType: 'stance', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'gyaku_zuki_left', stance: 'zenkutsu_dachi_right', finalStance: 'zenkutsu_dachi_right', actionType: 'punch', delaySeconds: 0.05, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 18 (Исх. шаг 10): Отход Тори (руки опущены) и шаг Укэ вперёд в Хидари дзэнкуцу с Гяку-дзуки правой
  {
    stepNumber: 18,
    title: 'Шаг 18: Отход Тори и шаг Укэ в Хидари дзэнкуцу с Гяку-дзуки (Исх. шаг 10)',
    description: '1 (Тори): Отшаг назад (юри-аси, -0.40м) в Миги дзэнкуцу-дати (руки свободно опущены вдоль корпуса). 2 (Укэ): Шаг левой вперёд в Хидари дзэнкуцу-дати и Гяку-дзуки правой в корпус.',
    notes: 'Преследование отступающего противника с переходом в Хидари дзэнкуцу-дати и ударом правым кулаком Укэ в корпус Тори (0.76м) · Кимэ: фиксация удара',
    optimalDistance: 0.76,
    attackAngleDeg: 0,
    contactType: 'punch_body',
    interactionType: 'body_contact',
    tContact: 0.46,
    duration: 1.9,
    toriActionType: 'locomotion',
    ukeActionType: 'punch',
    scenarioAngles: { label: 'Шаг Укэ в Хидари дзэнкуцу · Гяку-дзуки правой · 0.76м', toriAngleDeg: 5, ukeAngleDeg: -175 },
    toriTrajectory: { start: [0.06, 0, 1.15], end: [0.03, 0, 0.75], startYaw: 0.08, endYaw: 0.08, isStationary: false },
    ukeTrajectory: { start: [0.12, 0, 1.91], end: [0.09, 0, 1.51], startYaw: -3.06, endYaw: -3.06, isStationary: false },
    displacementTori: [-0.03, 0, -0.40],
    displacementUke: [-0.03, 0, -0.40],
    participants: [
      { role: 'tori', clipName: 'step_backward_right', stance: 'zenkutsu_dachi_right', finalStance: 'zenkutsu_dachi_right', actionType: 'locomotion', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'gyaku_zuki_right', stance: 'zenkutsu_dachi_right', finalStance: 'zenkutsu_dachi_left', actionType: 'punch', delaySeconds: 0.05, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 19 (Исх. шаги 11.1–11.2 объединены): Дзёдан-цки с выпадом vs Уход влево 30° с линии атаки и Сюто-укэ в Миги кокуцу-дати
  {
    stepNumber: 19,
    title: 'Шаг 19: Дзёдан-цки vs Уход влево 30° с линии атаки и Сюто-укэ (Исх. шаг 11)',
    description: '1 (Тори): Скользящий выпад вперёд (+0.40м) и удар правой в голову (Дзёдан-цки на базе Ой-дзуки). 2 (Укэ): Уход с линии атаки влево под углом 30° в Миги кокуцу-дати со сбивающим блоком Сюто-укэ правой.',
    notes: 'Укэ отходит с линии атаки влево под 30° (не заходя за спину), фиксирует Миги кокуцу-дати и блок Сюто-укэ (0.88м) · Кимэ: блок Сюто-укэ',
    optimalDistance: 0.88,
    attackAngleDeg: 0,
    contactType: 'block_jodan',
    interactionType: 'body_contact',
    ukeTurnDir: 0,
    tContact: 0.44,
    duration: 2.2,
    toriActionType: 'punch',
    ukeActionType: 'block',
    scenarioAngles: { label: 'Дзёдан-цки · Уход влево 30° · Сюто-укэ 0.88м', toriAngleDeg: 5, ukeAngleDeg: 150, retreatAngleDeg: -30 },
    toriTrajectory: { start: [0.03, 0, 0.75], end: [0.06, 0, 1.15], startYaw: 0.08, endYaw: 0.08, isStationary: false },
    ukeTrajectory: { start: [0.09, 0, 1.51], end: [-0.38, 0, 1.91], startYaw: -3.06, endYaw: 2.62, isStationary: false },
    displacementTori: [0.03, 0, 0.40],
    displacementUke: [-0.47, 0, 0.40],
    participants: [
      { role: 'tori', clipName: 'oi_zuki_jodan_right', stance: 'zenkutsu_dachi_right', finalStance: 'zenkutsu_dachi_right', actionType: 'punch', delaySeconds: 0.0, isGround: false },
      { role: 'uke1', clipName: 'tech_shuto_uke_right', stance: 'zenkutsu_dachi_left', finalStance: 'kokutsu_dachi_right', actionType: 'block', delaySeconds: 0.05, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 20 (Исх. шаги 12–13.2 объединены): Шаг вперёд в Хидари кокуцу-дати, Сюто-укэ левой в корпус Тори и падение Тори Укэми
  {
    stepNumber: 20,
    title: 'Шаг 20: Шаг в Хидари кокуцу-дати — Сюто-укэ левой в корпус и падение Тори',
    description: '1 (Тори): После удара левой рукой Укэ в корпус падает на татами со страховкой Укэми. 2 (Укэ): Шаг вперёд в Хидари кокуцу-дати и удар Сюто-укэ левой рукой по корпусу Тори.',
    notes: 'Контакт левой рукой Укэ по корпусу Тори (tContact=0.36), затем падение Тори на татами (Y=0.08м, 0.65м) · Кимэ: Хидари кокуцу-дати',
    optimalDistance: 0.65,
    attackAngleDeg: 0,
    contactType: 'punch_body',
    interactionType: 'body_contact',
    isGround: true,
    tContact: 0.36,
    duration: 2.5,
    toriActionType: 'fall',
    ukeActionType: 'punch',
    scenarioAngles: { label: 'Сюто-укэ левой в Хидари кокуцу-дати и падение Тори · 0.65м', toriAngleDeg: 5, ukeAngleDeg: 150 },
    toriTrajectory: { start: [0.06, 0, 1.15], end: [0.06, 0.08, 1.15], startYaw: 0.08, endYaw: 0.08, isStationary: false },
    ukeTrajectory: { start: [-0.38, 0, 1.91], end: [-0.26, 0, 1.71], startYaw: 2.62, endYaw: 2.62, isStationary: false },
    displacementTori: [0, 0.08, 0],
    displacementUke: [0.12, 0, -0.20],
    participants: [
      { role: 'tori', clipName: 'zenkutsu_dachi_right', stance: 'zenkutsu_dachi_right', finalStance: 'fallen_ukemi', actionType: 'fall', delaySeconds: 0.40, isGround: true },
      { role: 'uke1', clipName: 'tech_shuto_uke_left', stance: 'kokutsu_dachi_right', finalStance: 'kokutsu_dachi_left', actionType: 'punch', delaySeconds: 0.0, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 21 (Исх. шаг 13.3): Добивающий удар Отоши-дзуки в лежащего Тори (рука остаётся внизу)
  {
    stepNumber: 21,
    title: 'Шаг 21: Добивающий удар Отоши-дзуки в лежащего Тори',
    description: '1 (Тори): Лежит на татами (Укэми). 2 (Укэ): Переход в Сико-дати рядом с грудью лежащего Тори и добивающий удар Отоши-дзуки правой сверху вниз с удержанием руки внизу.',
    notes: 'Вертикальный добивающий удар правым кулаком сверху вниз в грудь лежащего Тори, спина и рука удерживаются внизу в точке кимэ · Кимэ: Сико-дати',
    optimalDistance: 1.08,
    attackAngleDeg: 0,
    contactType: 'ground_finish',
    interactionType: 'body_contact',
    preserveScenarioYaw: true,
    isGround: true,
    tContact: 0.48,
    duration: 2.0,
    toriActionType: 'hold',
    ukeActionType: 'punch',
    scenarioAngles: { label: 'Добивающий Отоши-дзуки в лежащего Тори', toriAngleDeg: 5, ukeAngleDeg: -104 },
    toriTrajectory: { start: [0.06, 0.08, 1.15], end: [0.06, 0.08, 1.15], startYaw: 0.08, endYaw: 0.08, isStationary: true },
    ukeTrajectory: { start: [-0.26, 0, 1.71], waypoint: [-0.82, 0, 0.90], end: [-0.08, 0, 0.12], startYaw: 2.62, endYaw: -1.81, isStationary: false },
    displacementTori: [0, 0, 0],
    displacementUke: [0.18, 0, -1.59],
    participants: [
      { role: 'tori', clipName: 'idle_shizentai', stance: 'fallen_ukemi', finalStance: 'fallen_ukemi', actionType: 'hold', delaySeconds: 0.0, isGround: true },
      { role: 'uke1', clipName: 'tech_tate_zuki_right', stance: 'kokutsu_dachi_left', finalStance: 'stance_shiko', actionType: 'punch', delaySeconds: 0.05, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 22 (Исх. шаг 14/16): Отход и подъём Укэ в Хэйко-дати (Тори остаётся лежать)
  {
    stepNumber: 22,
    title: 'Шаг 22: Отход Укэ и переход в Хэйко-дати (Тори лежит на татами)',
    description: '1 (Тори): Продолжает лежать на татами без движения. 2 (Укэ): Разрыв дистанции, встаёт в стойку Хэйко-дати лицом к завершению.',
    notes: 'После добивания встаёт только Укэ, Тори остаётся лежать на татами · Выход на дистанцию поклона · Кимэ: Хэйко-дати',
    optimalDistance: 1.40,
    attackAngleDeg: 0,
    contactType: 'none',
    interactionType: 'distance_only',
    preserveScenarioYaw: true,
    isGround: true,
    tContact: 0.50,
    duration: 2.2,
    toriActionType: 'hold',
    ukeActionType: 'locomotion',
    scenarioAngles: { label: 'Отход и подъём Укэ в Хэйко-дати', toriAngleDeg: 5, ukeAngleDeg: 180 },
    toriTrajectory: { start: [0.06, 0.08, 1.15], end: [0.06, 0.08, 1.15], startYaw: 0.08, endYaw: 0.08, isStationary: true },
    ukeTrajectory: { start: [-0.08, 0, 0.12], waypoint: [0.68, 0, 1.10], end: [0.00, 0, 2.55], startYaw: -1.81, endYaw: Math.PI, isStationary: false },
    displacementTori: [0, 0, 0],
    displacementUke: [0.08, 0, 2.43],
    participants: [
      { role: 'tori', clipName: 'idle_shizentai', stance: 'fallen_ukemi', finalStance: 'fallen_ukemi', actionType: 'hold', delaySeconds: 0.0, isGround: true },
      { role: 'uke1', clipName: 'step_backward', stance: 'stance_shiko', finalStance: 'heiko_dachi', actionType: 'locomotion', delaySeconds: 0.0, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 23: Переход Укэ в стойку Мусуби-дати (Тори лежит на татами)
  {
    stepNumber: 23,
    title: 'Шаг 23: Переход Укэ в Мусуби-дати (Тори лежит)',
    description: '1 (Тори): Остаётся лежать на татами. 2 (Укэ): Сведение пяток в Мусуби-дати перед поклоном.',
    notes: 'Подготовка Укэ к завершающему поклону, Тори остаётся лежать · Кимэ: Мусуби-дати',
    optimalDistance: 1.40,
    attackAngleDeg: 0,
    contactType: 'none',
    interactionType: 'distance_only',
    preserveScenarioYaw: true,
    isGround: true,
    tContact: 0.50,
    duration: 1.2,
    toriActionType: 'hold',
    ukeActionType: 'stance',
    scenarioAngles: { label: 'Укэ Мусуби-дати · Тори лежит', toriAngleDeg: 5, ukeAngleDeg: 180 },
    toriTrajectory: { start: [0.06, 0.08, 1.15], end: [0.06, 0.08, 1.15], startYaw: 0.08, endYaw: 0.08, isStationary: true },
    ukeTrajectory: { start: [0.00, 0, 2.55], end: [0.00, 0, 2.55], startYaw: Math.PI, endYaw: Math.PI, isStationary: true },
    displacementTori: [0, 0, 0],
    displacementUke: [0, 0, 0],
    participants: [
      { role: 'tori', clipName: 'idle_shizentai', stance: 'fallen_ukemi', finalStance: 'fallen_ukemi', actionType: 'hold', delaySeconds: 0.0, isGround: true },
      { role: 'uke1', clipName: 'stance_musubi', stance: 'heiko_dachi', finalStance: 'stance_musubi', actionType: 'stance', delaySeconds: 0.0, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 24: Завершающий поклон (Рэй) делает только Укэ, Тори остаётся лежать
  {
    stepNumber: 24,
    title: 'Шаг 24: Завершающий поклон Укэ (Рэй) — Тори лежит',
    description: '1 (Тори): Продолжает лежать на татами без поклона. 2 (Укэ): Завершающий поклон 30° в Мусуби-дати.',
    notes: 'Поклон после победы выполняет только Укэ, Тори продолжает лежать на татами · Кимэ: стойка',
    optimalDistance: 1.40,
    attackAngleDeg: 0,
    contactType: 'none',
    interactionType: 'distance_only',
    preserveScenarioYaw: true,
    isGround: true,
    isBow: true,
    tContact: 0.50,
    duration: 1.8,
    toriActionType: 'hold',
    ukeActionType: 'stance',
    scenarioAngles: { label: 'Поклон Укэ Рэй · Тори лежит', toriAngleDeg: 5, ukeAngleDeg: 180 },
    toriTrajectory: { start: [0.06, 0.08, 1.15], end: [0.06, 0.08, 1.15], startYaw: 0.08, endYaw: 0.08, isStationary: true },
    ukeTrajectory: { start: [0.00, 0, 2.55], end: [0.00, 0, 2.55], startYaw: Math.PI, endYaw: Math.PI, isStationary: true },
    displacementTori: [0, 0, 0],
    displacementUke: [0, 0, 0],
    participants: [
      { role: 'tori', clipName: 'idle_shizentai', stance: 'fallen_ukemi', finalStance: 'fallen_ukemi', actionType: 'hold', delaySeconds: 0.0, isGround: true },
      { role: 'uke1', clipName: 'stance_musubi', stance: 'stance_musubi', finalStance: 'stance_musubi', actionType: 'stance', delaySeconds: 0.0, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
  // 25: Завершение комплекса — Укэ в Хэйко-дати, Тори лежит
  {
    stepNumber: 25,
    title: 'Шаг 25: Завершение — Укэ в Хэйко-дати (Тори лежит)',
    description: '1 (Тори): Остаётся лежать на татами. 2 (Укэ): Переход в Хэйко-дати (Сидзэнтай).',
    notes: 'Финал комплекса Бункай: Укэ в стойке готовности, Тори лежит на татами · Кимэ: стойка',
    optimalDistance: 1.40,
    attackAngleDeg: 0,
    contactType: 'none',
    interactionType: 'distance_only',
    preserveScenarioYaw: true,
    isGround: true,
    tContact: 0.50,
    duration: 1.6,
    toriActionType: 'hold',
    ukeActionType: 'stance',
    scenarioAngles: { label: 'Финал: Укэ Хэйко-дати · Тори лежит', toriAngleDeg: 5, ukeAngleDeg: 180 },
    toriTrajectory: { start: [0.06, 0.08, 1.15], end: [0.06, 0.08, 1.15], startYaw: 0.08, endYaw: 0.08, isStationary: true },
    ukeTrajectory: { start: [0.00, 0, 2.55], end: [0.00, 0, 2.55], startYaw: Math.PI, endYaw: Math.PI, isStationary: true },
    displacementTori: [0, 0, 0],
    displacementUke: [0, 0, 0],
    participants: [
      { role: 'tori', clipName: 'idle_shizentai', stance: 'fallen_ukemi', finalStance: 'fallen_ukemi', actionType: 'hold', delaySeconds: 0.0, isGround: true },
      { role: 'uke1', clipName: 'heiko_dachi', stance: 'stance_musubi', finalStance: 'heiko_dachi', actionType: 'stance', delaySeconds: 0.0, isGround: false },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0, isGround: false },
    ],
  },
];

export const HEIAN_SHODAN_BUNKAI_34_STEPS = HEIAN_SHODAN_BUNKAI_18_STEPS;

export const CANONICAL_BUNKAI_EPISODES = [
  {
    stepNumber: 1,
    title: 'Защита Сюто-укэ против выпада Ой-цуки',
    description: 'Тори (синий) атакует мощным выпадом Ой-цуки тюдан. Укэ 1 (белый) уходит с линии атаки в Кокуцу-дати и сбивает руку блоком Сюто-укэ.',
    optimalDistance: 1.45,
    attackAngleDeg: 0,
    interactionType: 'local_contact',
    tContact: 0.45,
    activeAttacker: 'tori',
    participants: [
      { role: 'tori', clipName: 'tech_oi_zuki_right', stance: 'zenkutsu_dachi_right', delaySeconds: 0.0 },
      { role: 'uke1', clipName: 'tech_shuto_uke_left', stance: 'kokutsu_dachi_right', delaySeconds: 0.12 },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0 },
    ],
  },
  {
    stepNumber: 2,
    title: 'Восходящий блок Агэ-укэ против выпада в голову',
    description: 'Тори (синий) наносит прямой удар в голову (Дзёдан). Укэ 1 (белый) встречает атаку восходящим блоком Агэ-укэ.',
    optimalDistance: 1.20,
    attackAngleDeg: 10,
    interactionType: 'local_contact',
    tContact: 0.42,
    activeAttacker: 'tori',
    participants: [
      { role: 'tori', clipName: 'tech_oi_zuki_right', stance: 'zenkutsu_dachi_right', delaySeconds: 0.0 },
      { role: 'uke1', clipName: 'tech_age_uke_left', stance: 'zenkutsu_dachi_left', delaySeconds: 0.10 },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0 },
    ],
  },
  {
    stepNumber: 3,
    title: 'Нижний смет Гэдан-барай от прямого удара ногой Маэ-гэри',
    description: 'Тори (синий) атакует ударом ноги Маэ-гэри в корпус. Укэ 1 (белый) сметает голень нижним блоком Гэдан-барай.',
    optimalDistance: 1.55,
    attackAngleDeg: -10,
    interactionType: 'local_contact',
    tContact: 0.50,
    activeAttacker: 'tori',
    participants: [
      { role: 'tori', clipName: 'kick_mae_geri_right', stance: 'zenkutsu_dachi_left', delaySeconds: 0.0 },
      { role: 'uke1', clipName: 'tech_gedan_barai_left', stance: 'zenkutsu_dachi_left', delaySeconds: 0.12 },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0 },
    ],
  },
  {
    stepNumber: 4,
    title: 'Фланговая атака под 45° и блок Сото-укэ',
    description: 'Тори (синий) атакует с фланга под углом 45°. Укэ 1 (белый) разворачивается навстречу удару и парирует блоком Сото-укэ.',
    optimalDistance: 1.25,
    attackAngleDeg: 45,
    interactionType: 'local_contact',
    tContact: 0.44,
    activeAttacker: 'tori',
    participants: [
      { role: 'tori', clipName: 'tech_oi_zuki_right', stance: 'zenkutsu_dachi_right', delaySeconds: 0.0 },
      { role: 'uke1', clipName: 'tech_soto_uke_left', stance: 'zenkutsu_dachi_left', delaySeconds: 0.10 },
      { role: 'uke2', clipName: 'idle_shizentai', stance: 'ready', delaySeconds: 0.0 },
    ],
  },
  {
    stepNumber: 5,
    title: 'Командный бункай (3 бойца): защита Укэ от Тори и фланговой атаки',
    description: 'Тори (синий) начинает атаку с фронта, Укэ 2 подключается с правого фланга (+75°). Укэ 1 (белый) защищается блоком Сюто-укэ.',
    optimalDistance: 1.40,
    attackAngleDeg: 0,
    uke2AngleDeg: 75,
    interactionType: 'local_contact',
    tContact: 0.45,
    activeAttacker: 'tori',
    switchTime: 1.35,
    participants: [
      { role: 'tori', clipName: 'tech_oi_zuki_right', stance: 'zenkutsu_dachi_right', delaySeconds: 0.0 },
      { role: 'uke1', clipName: 'tech_shuto_uke_left', stance: 'kokutsu_dachi_right', delaySeconds: 0.12 },
      { role: 'uke2', clipName: 'kick_mae_geri_right', stance: 'zenkutsu_dachi_left', delaySeconds: 1.35 },
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

  const rawToriClip = toriPart.Clip_Name || toriPart.clipName || raw.Clip_Name || raw.clipName || canonical?.participants?.[0]?.clipName || 'heiko_dachi';
  const rawUke1Clip = uke1Part.Clip_Name || uke1Part.clipName || canonical?.participants?.[1]?.clipName || 'heiko_dachi';
  const isLegacyInvertedDb =
    String(rawToriClip).endsWith('_tori') ||
    String(rawUke1Clip).endsWith('_uke') ||
    (!isExplicitHeian && /(shuto_uke|age_uke|gedan_barai|soto_uke|uchi_uke|haishu|haivan)/.test(String(rawToriClip).toLowerCase()) && /(oi_zuki|mae_geri|mawashi|yoko_geri|ushiro|kizami)/.test(String(rawUke1Clip).toLowerCase()));

  const LEGACY_ATTACK_REMAP = {
    bunkai_shuto_counter_uke: 'tech_oi_zuki_right',
    bunkai_age_empi_uke: 'tech_oi_zuki_right',
    bunkai_kuzushi_sweep_uke: 'kick_mae_geri_right',
  };
  const LEGACY_DEFENSE_REMAP = {
    bunkai_shuto_counter_tori: 'tech_shuto_uke_left',
    bunkai_age_empi_tori: 'tech_age_uke_left',
    bunkai_kuzushi_sweep_tori: 'tech_gedan_barai_left',
  };

  const toriClip = isLegacyInvertedDb
    ? (LEGACY_ATTACK_REMAP[rawUke1Clip] || rawUke1Clip)
    : rawToriClip;
  const uke1Clip = isLegacyInvertedDb
    ? (LEGACY_DEFENSE_REMAP[rawToriClip] || rawToriClip)
    : rawUke1Clip;
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
    phase: raw.phase || canonical?.phase || null,
    outcome: raw.outcome || canonical?.outcome || null,
    toriMovement: raw.toriMovement || canonical?.toriMovement || null,
    optimalDistance: isNaN(optDist) ? (canonical?.optimalDistance ?? 1.45) : optDist,
    isCustomDistance: Boolean(raw.isCustomDistance),
    attackAngleDeg: isNaN(atkAngle) ? (canonical?.attackAngleDeg ?? 0) : atkAngle,
    toriAngleOffsetDeg: raw.toriAngleOffsetDeg ?? canonical?.toriAngleOffsetDeg ?? 0,
    ukeEvasionAngleDeg: raw.ukeEvasionAngleDeg ?? canonical?.ukeEvasionAngleDeg ?? 0,
    relativeAngleDegTori: raw.relativeAngleDegTori ?? canonical?.relativeAngleDegTori ?? undefined,
    relativeAngleDegUke: raw.relativeAngleDegUke ?? canonical?.relativeAngleDegUke ?? undefined,
    uke2AngleDeg: isNaN(uke2Angle) ? (canonical?.uke2AngleDeg ?? atkAngle + 65) : uke2Angle,
    toriEndAngleDeg: toriEndAngleDeg !== undefined ? Number(toriEndAngleDeg) : undefined,
    ukeEndAngleDeg: ukeEndAngleDeg !== undefined ? Number(ukeEndAngleDeg) : undefined,
    orientationModeTori: raw.orientationModeTori ?? canonical?.orientationModeTori ?? undefined,
    orientationModeUke: raw.orientationModeUke ?? canonical?.orientationModeUke ?? undefined,
    customToriPosX: raw.customToriPosX ?? canonical?.customToriPosX ?? undefined,
    customToriPosZ: raw.customToriPosZ ?? canonical?.customToriPosZ ?? undefined,
    customUkePosX: raw.customUkePosX ?? canonical?.customUkePosX ?? undefined,
    customUkePosZ: raw.customUkePosZ ?? canonical?.customUkePosZ ?? undefined,
    toriEndYaw,
    ukeEndYaw,
    interactionType: raw.Interaction_Type || raw.interactionType || canonical?.interactionType || 'body_contact',
    contactType: raw.contactType || canonical?.contactType || 'none',
    tContact: Number(raw.tContact || canonical?.tContact || 0.48),
    duration: Number(raw.duration || canonical?.duration || 2.4),
    toriActionType: raw.toriActionType || toriPart.actionType || canonical?.toriActionType || 'stance',
    ukeActionType: raw.ukeActionType || uke1Part.actionType || canonical?.ukeActionType || 'stance',
    scenarioAngles: raw.scenarioAngles || canonical?.scenarioAngles || null,
    toriTrajectory: effectiveToriTrajectory,
    ukeTrajectory: effectiveUkeTrajectory,
    isStationaryTori: Boolean(raw.isStationaryTori ?? (isExplicitHeian ? canonical?.isStationaryTori : null) ?? raw.toriTrajectory?.isStationary ?? (isExplicitHeian ? canonical?.toriTrajectory?.isStationary : false)),
    isStationaryUke: Boolean(raw.isStationaryUke ?? (isExplicitHeian ? canonical?.isStationaryUke : null) ?? raw.ukeTrajectory?.isStationary ?? (isExplicitHeian ? canonical?.ukeTrajectory?.isStationary : false)),
    isGround: Boolean(raw.isGround || toriPart.isGround || canonical?.isGround || canonical?.participants?.[0]?.isGround),
    isRising: Boolean(raw.isRising || toriPart.isRising || canonical?.isRising || canonical?.participants?.[0]?.isRising),
    isBow: Boolean(raw.isBow || canonical?.isBow),
    backToOpponent: Boolean(raw.backToOpponent || canonical?.backToOpponent),
    ukeFullTurn: Boolean(raw.ukeFullTurn || canonical?.ukeFullTurn),
    preserveScenarioYaw: Boolean(raw.preserveScenarioYaw || canonical?.preserveScenarioYaw),
    toriTurnDir: raw.toriTurnDir ?? canonical?.toriTurnDir ?? 0,
    ukeTurnDir: raw.ukeTurnDir ?? canonical?.ukeTurnDir ?? 0,
    displacementTori: raw.displacementTori || (isExplicitHeian ? canonical?.displacementTori : null) || [0, 0, 0],
    displacementUke: raw.displacementUke || (isExplicitHeian ? canonical?.displacementUke : null) || [0, 0, 0],
    participants: [
      {
        role: 'tori',
        clipName: toriClip,
        stance: (isLegacyInvertedDb ? uke1Part : toriPart).Stance_In || (isLegacyInvertedDb ? uke1Part : toriPart).initialStance || (isLegacyInvertedDb ? uke1Part : toriPart).stance || canonical?.participants?.[0]?.stance || 'zenkutsu_dachi_left',
        hasExplicitStance: Boolean((isLegacyInvertedDb ? uke1Part : toriPart).Stance_In || (isLegacyInvertedDb ? uke1Part : toriPart).initialStance || (isLegacyInvertedDb ? uke1Part : toriPart).stance || canonical?.participants?.[0]?.stance),
        finalStance: (isLegacyInvertedDb ? uke1Part : toriPart).Final_Stance || (isLegacyInvertedDb ? uke1Part : toriPart).Stance_Out || (isLegacyInvertedDb ? uke1Part : toriPart).finalStance || canonical?.participants?.[0]?.finalStance || null,
        landingMode: (isLegacyInvertedDb ? uke1Part : toriPart).Landing_Mode || (isLegacyInvertedDb ? uke1Part : toriPart).landingMode || canonical?.participants?.[0]?.landingMode || 'auto',
        actionType: (isLegacyInvertedDb ? uke1Part : toriPart).actionType || raw.toriActionType || canonical?.toriActionType || 'stance',
        delaySeconds: isLegacyInvertedDb ? 0.0 : toriDelay,
        isGround: Boolean(raw.isGround || toriPart.isGround || canonical?.isGround || canonical?.participants?.[0]?.isGround),
        isRising: Boolean(raw.isRising || toriPart.isRising || canonical?.isRising || canonical?.participants?.[0]?.isRising),
      },
      {
        role: 'uke1',
        clipName: uke1Clip,
        stance: (isLegacyInvertedDb ? toriPart : uke1Part).Stance_In || (isLegacyInvertedDb ? toriPart : uke1Part).initialStance || (isLegacyInvertedDb ? toriPart : uke1Part).stance || canonical?.participants?.[1]?.stance || 'zenkutsu_dachi_left',
        hasExplicitStance: Boolean((isLegacyInvertedDb ? toriPart : uke1Part).Stance_In || (isLegacyInvertedDb ? toriPart : uke1Part).initialStance || (isLegacyInvertedDb ? toriPart : uke1Part).stance || canonical?.participants?.[1]?.stance),
        finalStance: (isLegacyInvertedDb ? toriPart : uke1Part).Final_Stance || (isLegacyInvertedDb ? toriPart : uke1Part).Stance_Out || (isLegacyInvertedDb ? toriPart : uke1Part).finalStance || canonical?.participants?.[1]?.finalStance || null,
        landingMode: (isLegacyInvertedDb ? toriPart : uke1Part).Landing_Mode || (isLegacyInvertedDb ? toriPart : uke1Part).landingMode || canonical?.participants?.[1]?.landingMode || 'auto',
        actionType: (isLegacyInvertedDb ? toriPart : uke1Part).actionType || raw.ukeActionType || canonical?.ukeActionType || 'stance',
        delaySeconds: isLegacyInvertedDb ? 0.12 : uke1Delay,
        isGround: Boolean(uke1Part.isGround),
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
  fudo_dachi: 'fudo_dachi',
  fudo_dachi_right: 'fudo_dachi',
  stance_kiba: 'stance_shiko',
  kiba_dachi: 'stance_shiko',
  stance_neko_left: 'stance_neko_left',
  shuto_uke: 'tech_shuto_uke_left',
  tech_shuto_uke_right: 'tech_shuto_uke_right',
  uchi_uke: 'tech_uchi_uke_left',
  tech_uchi_uke_left: 'tech_uchi_uke_left',
  tech_uchi_uke_right: 'tech_uchi_uke_right',
  tetsui_uchi: 'tech_tettsui_right',
  tech_tettsui_right: 'tech_tettsui_right',
  strike_above_elbow: 'strike_above_elbow',
  tech_strike_above_elbow: 'strike_above_elbow',
  arm_strike: 'strike_above_elbow',
  kizami_zuki: 'jodan_zuki_left',
  jodan_zuki_right: 'jodan_zuki_right',
  jodan_zuki_left: 'jodan_zuki_left',
  shuto_uchi: 'tech_shuto_uchi_right',
  tech_shuto_uchi_right: 'tech_shuto_uchi_right',
  heiko_dachi: 'heiko_dachi',
  stance_musubi: 'stance_musubi',
  stance_heisoku: 'stance_heisoku',
  stance_shiko: 'stance_shiko',
  mae_geri: 'mae_geri_right',
  mae_geri_right: 'mae_geri_right',
  mae_geri_left: 'mae_geri_left',
  kick_mae_geri_right: 'kick_mae_geri_right',
  kick_mae_geri_left: 'kick_mae_geri_left',
  gedan_barai: 'gedan_barai_left',
  gedan_barai_left: 'gedan_barai_left',
  gedan_barai_right: 'gedan_barai_right',
  tech_gedan_barai_left: 'tech_gedan_barai_left',
  age_uke: 'age_uke_left',
  age_uke_left: 'age_uke_left',
  age_uke_right: 'age_uke_right',
  tech_age_uke_right: 'tech_age_uke_right',
  oi_zuki: 'oi_zuki_right',
  oi_zuki_right: 'oi_zuki_right',
  oi_zuki_jodan_right: 'oi_zuki_jodan_right',
  oi_zuki_jodan_left: 'oi_zuki_jodan_left',
  tech_oi_zuki_right: 'tech_oi_zuki_right',
  gyaku_zuki: 'gyaku_zuki_right',
  gyaku_zuki_right: 'gyaku_zuki_right',
  gyaku_zuki_left: 'gyaku_zuki_left',
  tech_gyaku_zuki_left: 'tech_gyaku_zuki_left',
  ren_zuki: 'tech_gyaku_zuki_left',
  enter_zenkutsu_left: 'enter_zenkutsu_left',
  enter_zenkutsu_right: 'enter_zenkutsu_right',
  turn_into_zenkutsu_right: 'turn_into_zenkutsu_right',
  turn_into_zenkutsu_left: 'turn_into_zenkutsu_left',
  step_forward_right: 'step_forward_right',
  step_backward_left: 'step_backward_left',
  step_backward_right: 'step_backward_right',
  step_backward: 'step_backward',
  tech_haishu_uke_left: 'tech_haishu_uke_left',
  tech_haishu_uke_right: 'tech_haishu_uke_right',
  kick_nami_gaeshi_left: 'kick_nami_gaeshi_left',
  kick_nami_gaeshi_right: 'kick_nami_gaeshi_right',
  tech_tate_zuki_left: 'tech_tate_zuki_left',
  tech_tate_zuki_right: 'tech_tate_zuki_right',
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
/**
 * Единое объединение шагов из БД с каноническими траекториями и параметрами бункай,
 * чтобы отображение в просмотрщике бункая и в редакторе совпадало 1-в-1.
 */
export function buildStepsFromDb(dbSteps = []) {
  if (!Array.isArray(dbSteps) || dbSteps.length === 0) {
    return HEIAN_SHODAN_BUNKAI_18_STEPS;
  }
  const isCanonical = dbSteps.length === HEIAN_SHODAN_BUNKAI_18_STEPS.length;
  return dbSteps.map((s, idx) => {
    const meta = s.metadata && typeof s.metadata === 'object' ? s.metadata : null;
    const canonical = isCanonical ? HEIAN_SHODAN_BUNKAI_18_STEPS[idx] : null;

    if (!meta && !canonical) {
      const norm = normalizeBunkaiEpisode(s, idx);
      const rawParticipants = s.participants || s.Participants || [];
      const toriP = rawParticipants.find((p) => (p.role || p.Role) === 'tori') || {};
      const ukeP = rawParticipants.find((p) => {
        const r = p.role || p.Role;
        return r === 'uke' || r === 'uke1';
      }) || {};
      if (toriP.offsetX !== undefined && toriP.offsetX !== null && Number(toriP.offsetX) !== 0) {
        norm.customToriPosX = Number(toriP.offsetX);
      }
      if (ukeP.offsetX !== undefined && ukeP.offsetX !== null && Number(ukeP.offsetX) !== 0) {
        norm.customUkePosX = Number(ukeP.offsetX);
      }
      return norm;
    }

    const base = meta || canonical || {};
    const rawParticipants = s.participants || s.Participants || [];
    const toriPart = rawParticipants.find((p) => (p.role || p.Role) === 'tori') || {};
    const ukePart = rawParticipants.find((p) => {
      const r = p.role || p.Role;
      return r === 'uke' || r === 'uke1';
    }) || {};
    const uke2Part = rawParticipants.find((p) => (p.role || p.Role) === 'uke2') || {};

    const baseTori = (base.participants || []).find((p) => p.role === 'tori') || {};
    const baseUke = (base.participants || []).find((p) => p.role === 'uke1' || p.role === 'uke') || {};
    const baseUke2 = (base.participants || []).find((p) => p.role === 'uke2') || {};

    const rawToriClip = toriPart.clipName || toriPart.Clip_Name || baseTori.clipName || 'heiko_dachi';
    const rawUkeClip = ukePart.clipName || ukePart.Clip_Name || baseUke.clipName || 'heiko_dachi';
    const isLegacyInvertedDb =
      !meta &&
      (String(rawToriClip).endsWith('_tori') || String(rawUkeClip).endsWith('_uke'));

    const effToriPart = isLegacyInvertedDb ? ukePart : toriPart;
    const effUkePart = isLegacyInvertedDb ? toriPart : ukePart;

    const toriClip = isLegacyInvertedDb ? baseTori.clipName : rawToriClip;
    const ukeClip = isLegacyInvertedDb ? baseUke.clipName : rawUkeClip;
    const uke2Clip = uke2Part.clipName || uke2Part.Clip_Name || baseUke2.clipName || 'idle_shizentai';

    const rawToriRotY = effToriPart.rotationY !== undefined ? effToriPart.rotationY : effToriPart.Rotation_Y;
    const rawUkeRotY = effUkePart.rotationY !== undefined ? effUkePart.rotationY : effUkePart.Rotation_Y;

    const toriYawDeg = (!isLegacyInvertedDb && rawToriRotY !== undefined && rawToriRotY !== null)
      ? Number(rawToriRotY)
      : (base.toriEndAngleDeg ?? base.scenarioAngles?.toriAngleDeg ?? (base.toriTrajectory?.endYaw !== undefined ? Math.round((base.toriTrajectory.endYaw * 180) / Math.PI) : 0));
    const ukeYawDeg = (!isLegacyInvertedDb && rawUkeRotY !== undefined && rawUkeRotY !== null)
      ? (Math.abs(Number(rawUkeRotY) - Math.PI) < 0.05 ? 180 : Number(rawUkeRotY))
      : (base.ukeEndAngleDeg ?? base.scenarioAngles?.ukeAngleDeg ?? (base.ukeTrajectory?.endYaw !== undefined ? Math.round((base.ukeTrajectory.endYaw * 180) / Math.PI) : 180));

    return {
      ...base,
      stepNumber: s.stepNumber ?? base.stepNumber ?? (idx + 1),
      title: s.title || base.title || `Шаг ${idx + 1}`,
      description: s.description || base.description || '',
      notes: base.notes || s.notes || '',
      optimalDistance: Number(s.targetDistance ?? base.optimalDistance ?? 1.45),
      attackAngleDeg: Number(s.targetAngle ?? base.attackAngleDeg ?? 0),
      duration: Number(s.duration || base.duration || 2.0),
      toriEndAngleDeg: toriYawDeg,
      ukeEndAngleDeg: ukeYawDeg,
      toriEndYaw: (toriYawDeg * Math.PI) / 180,
      ukeEndYaw: (ukeYawDeg * Math.PI) / 180,
      toriTrajectory: base.toriTrajectory
        ? { ...base.toriTrajectory, endYaw: (toriYawDeg * Math.PI) / 180 }
        : { endYaw: (toriYawDeg * Math.PI) / 180 },
      ukeTrajectory: base.ukeTrajectory
        ? { ...base.ukeTrajectory, endYaw: (ukeYawDeg * Math.PI) / 180 }
        : { endYaw: (ukeYawDeg * Math.PI) / 180 },
      participants: [
        {
          ...baseTori,
          role: 'tori',
          clipName: toriClip,
          stance: effToriPart.initialStance || effToriPart.stance || baseTori.stance || 'zenkutsu_dachi_left',
          finalStance: effToriPart.finalStance || baseTori.finalStance || null,
          landingMode: effToriPart.landingMode || baseTori.landingMode || 'auto',
          actionType: base.toriActionType || baseTori.actionType || 'stance',
          delaySeconds: effToriPart.delaySeconds ?? baseTori.delaySeconds ?? 0.0,
          isGround: Boolean(base.toriIsGround ?? base.isGround ?? baseTori.isGround),
          isRising: Boolean(base.toriIsRising ?? base.isRising ?? baseTori.isRising),
        },
        {
          ...baseUke,
          role: 'uke1',
          clipName: ukeClip,
          stance: effUkePart.initialStance || effUkePart.stance || baseUke.stance || 'zenkutsu_dachi_left',
          finalStance: effUkePart.finalStance || baseUke.finalStance || null,
          landingMode: effUkePart.landingMode || baseUke.landingMode || 'auto',
          actionType: base.ukeActionType || baseUke.actionType || 'stance',
          delaySeconds: effUkePart.delaySeconds ?? baseUke.delaySeconds ?? 0.08,
          isGround: Boolean(base.ukeIsGround ?? baseUke.isGround),
        },
        {
          ...baseUke2,
          role: 'uke2',
          clipName: uke2Clip,
          stance: uke2Part.initialStance || uke2Part.stance || baseUke2.stance || 'ready',
          delaySeconds: uke2Part.delaySeconds ?? baseUke2.delaySeconds ?? 0.0,
        },
      ],
    };
  });
}

/**
 * Единая конвертация эпизода из редактора (BunkaiFormPage) в объект шага для 3D плеера.
 * Гарантирует 100% совпадение предпросмотра в редакторе с демонстрацией на странице просмотра.
 */
export function formEpisodeToEngineStep(ep, idx, totalCount = 0) {
  const isCanonical = totalCount === HEIAN_SHODAN_BUNKAI_18_STEPS.length;
  const canonical = isCanonical ? HEIAN_SHODAN_BUNKAI_18_STEPS[idx] : null;

  const toriYawDeg = ep.toriEndAngleDeg !== undefined && ep.toriEndAngleDeg !== null
    ? Number(ep.toriEndAngleDeg)
    : (ep.toriTrajectory?.endYaw !== undefined
      ? Math.round((ep.toriTrajectory.endYaw * 180) / Math.PI)
      : (canonical?.scenarioAngles?.toriAngleDeg ?? 0));
  const ukeYawDeg = ep.ukeEndAngleDeg !== undefined && ep.ukeEndAngleDeg !== null
    ? Number(ep.ukeEndAngleDeg)
    : (ep.ukeTrajectory?.endYaw !== undefined
      ? Math.round((ep.ukeTrajectory.endYaw * 180) / Math.PI)
      : (canonical?.scenarioAngles?.ukeAngleDeg ?? 180));

  const baseToriTraj = ep.toriTrajectory || canonical?.toriTrajectory || null;
  const effectiveToriTraj = baseToriTraj
    ? { ...baseToriTraj, endYaw: (toriYawDeg * Math.PI) / 180 }
    : { endYaw: (toriYawDeg * Math.PI) / 180 };

  const baseUkeTraj = ep.ukeTrajectory || canonical?.ukeTrajectory || null;
  const effectiveUkeTraj = baseUkeTraj
    ? { ...baseUkeTraj, endYaw: (ukeYawDeg * Math.PI) / 180 }
    : { endYaw: (ukeYawDeg * Math.PI) / 180 };

  const inferredContact =
    ep.contactType ||
    (ep.phase === 'Залом сустава (Кансэцу)'
      ? 'joint_lock'
      : ep.phase === 'Бросок / сваливание (Нагэ)'
      ? 'sweep_fall'
      : canonical?.contactType || 'none');

  const inferredInteraction =
    ep.interactionType ||
    (ep.phase === 'Бросок / сваливание (Нагэ)'
      ? 'takedown'
      : canonical?.interactionType || (inferredContact === 'none' ? 'distance_only' : 'body_contact'));

  const isGround = ep.isGround !== undefined ? Boolean(ep.isGround) : Boolean(canonical?.isGround || canonical?.participants?.[0]?.isGround);
  const isRising = ep.isRising !== undefined ? Boolean(ep.isRising) : Boolean(canonical?.isRising || canonical?.participants?.[0]?.isRising);

  return {
    stepNumber: idx + 1,
    title: ep.attackTechnique || `Шаг ${idx + 1}`,
    description: ep.toriCounter || ep.outcome || '',
    notes: ep.outcome || ep.notes || '',
    phase: ep.phase || canonical?.phase || null,
    outcome: ep.outcome || null,
    toriMovement: ep.toriMovement || null,
    optimalDistance: Number(ep.combatDistance ?? canonical?.optimalDistance ?? 1.45),
    isCustomDistance: Boolean(ep.isCustomDistance),
    attackAngleDeg: Number(ep.attackAngleDeg ?? canonical?.attackAngleDeg ?? 0),
    toriAngleOffsetDeg: Number(ep.toriAngleOffsetDeg ?? canonical?.toriAngleOffsetDeg ?? 0),
    ukeEvasionAngleDeg: Number(ep.ukeEvasionAngleDeg ?? canonical?.ukeEvasionAngleDeg ?? 0),
    relativeAngleDegTori: ep.relativeAngleDegTori ?? canonical?.relativeAngleDegTori ?? undefined,
    relativeAngleDegUke: ep.relativeAngleDegUke ?? canonical?.relativeAngleDegUke ?? undefined,
    uke2AngleDeg: ep.uke2AngleDeg ?? canonical?.uke2AngleDeg,
    toriEndAngleDeg: toriYawDeg,
    ukeEndAngleDeg: ukeYawDeg,
    toriEndYaw: (toriYawDeg * Math.PI) / 180,
    ukeEndYaw: (ukeYawDeg * Math.PI) / 180,
    orientationModeTori: ep.orientationModeTori ?? canonical?.orientationModeTori ?? undefined,
    orientationModeUke: ep.orientationModeUke ?? canonical?.orientationModeUke ?? undefined,
    customToriPosX: ep.customToriPosX ?? canonical?.customToriPosX ?? undefined,
    customToriPosZ: ep.customToriPosZ ?? canonical?.customToriPosZ ?? undefined,
    customUkePosX: ep.customUkePosX ?? canonical?.customUkePosX ?? undefined,
    customUkePosZ: ep.customUkePosZ ?? canonical?.customUkePosZ ?? undefined,
    scenarioAngles: ep.scenarioAngles || canonical?.scenarioAngles || {
      toriAngleDeg: toriYawDeg,
      ukeAngleDeg: ukeYawDeg,
    },
    contactType: inferredContact,
    interactionType: inferredInteraction,
    isGround,
    isRising,
    isBow: ep.isBow !== undefined ? Boolean(ep.isBow) : Boolean(canonical?.isBow),
    backToOpponent: ep.backToOpponent !== undefined ? Boolean(ep.backToOpponent) : Boolean(canonical?.backToOpponent),
    ukeFullTurn: ep.ukeFullTurn !== undefined ? Boolean(ep.ukeFullTurn) : Boolean(canonical?.ukeFullTurn),
    preserveScenarioYaw: ep.preserveScenarioYaw !== undefined ? Boolean(ep.preserveScenarioYaw) : Boolean(canonical?.preserveScenarioYaw),
    toriTurnDir: ep.toriTurnDir ?? canonical?.toriTurnDir ?? 0,
    ukeTurnDir: ep.ukeTurnDir ?? canonical?.ukeTurnDir ?? 0,
    toriActionType: ep.toriActionType ?? canonical?.toriActionType ?? 'stance',
    ukeActionType: ep.ukeActionType ?? canonical?.ukeActionType ?? 'stance',
    displacementTori: ep.displacementTori || canonical?.displacementTori || [0, 0, 0],
    displacementUke: ep.displacementUke || canonical?.displacementUke || [0, 0, 0],
    toriTrajectory: effectiveToriTraj,
    ukeTrajectory: effectiveUkeTraj,
    tContact: Number(ep.tContact ?? canonical?.tContact ?? 0.48),
    duration: Number(ep.duration ?? canonical?.duration ?? 2.2),
    participants: [
      {
        role: 'tori',
        clipName: ep.toriClip || 'heiko_dachi',
        stance: ep.toriStance || canonical?.participants?.[0]?.stance || 'zenkutsu_dachi_right',
        finalStance: ep.toriFinalStance || canonical?.participants?.[0]?.finalStance || null,
        landingMode: ep.toriLandingMode || canonical?.participants?.[0]?.landingMode || 'auto',
        actionType: ep.toriActionType ?? canonical?.participants?.[0]?.actionType ?? 'stance',
        isGround,
        isRising,
        delaySeconds: ep.toriDelaySeconds ?? canonical?.participants?.[0]?.delaySeconds ?? 0.0,
      },
      {
        role: 'uke1',
        clipName: ep.ukeClip || 'heiko_dachi',
        stance: ep.ukeStance || canonical?.participants?.[1]?.stance || 'zenkutsu_dachi_left',
        finalStance: ep.ukeFinalStance || canonical?.participants?.[1]?.finalStance || null,
        landingMode: ep.ukeLandingMode || canonical?.participants?.[1]?.landingMode || 'auto',
        actionType: ep.ukeActionType ?? canonical?.participants?.[1]?.actionType ?? 'stance',
        isGround: Boolean(ep.ukeIsGround ?? canonical?.participants?.[1]?.isGround),
        delaySeconds: ep.ukeDelaySeconds ?? canonical?.participants?.[1]?.delaySeconds ?? 0.08,
      },
      {
        role: 'uke2',
        clipName: ep.uke2Clip || 'idle_shizentai',
        stance: 'ready',
        delaySeconds: 0.0,
      },
    ],
  };
}

/**
 * Сериализует эпизод редактора в формат БД (включая metadata JSON),
 * чтобы при открытии демонстрации воспроизведение совпадало с редактором 1-в-1.
 */
export function episodeToDbStep(ep, idx, clipIdMap, is3Person = false, totalCount = 0) {
  const step = formEpisodeToEngineStep(ep, idx, totalCount);
  const toriP = step.participants[0];
  const ukeP = step.participants[1];
  const uke2P = step.participants[2];

  const participants = [
    {
      role: 'tori',
      clipId: clipIdMap?.get(toriP.clipName) || null,
      clipName: toriP.clipName,
      initialStance: toriP.stance,
      finalStance: toriP.finalStance || null,
      landingMode: toriP.landingMode || 'auto',
      offsetX: step.customToriPosX ?? step.toriTrajectory?.end?.[0] ?? 0.0,
      offsetZ: step.customToriPosZ ?? step.toriTrajectory?.end?.[2] ?? 0.0,
      rotationY: step.toriEndAngleDeg,
      delaySeconds: toriP.delaySeconds ?? 0.0,
    },
    {
      role: 'uke1',
      clipId: clipIdMap?.get(ukeP.clipName) || null,
      clipName: ukeP.clipName,
      initialStance: ukeP.stance,
      finalStance: ukeP.finalStance || null,
      landingMode: ukeP.landingMode || 'auto',
      offsetX: step.customUkePosX ?? step.ukeTrajectory?.end?.[0] ?? 0.0,
      offsetZ: step.customUkePosZ ?? step.ukeTrajectory?.end?.[2] ?? step.optimalDistance ?? 1.45,
      rotationY: step.ukeEndAngleDeg,
      delaySeconds: ukeP.delaySeconds ?? 0.08,
    },
  ];

  if (is3Person) {
    participants.push({
      role: 'uke2',
      clipId: clipIdMap?.get(uke2P.clipName) || null,
      clipName: uke2P.clipName || 'idle_shizentai',
      initialStance: 'idle_shizentai',
      offsetX: 0.85,
      offsetZ: (step.optimalDistance || 1.45) + 0.35,
      rotationY: 155.0,
      delaySeconds: 0.3,
    });
  }

  const metadata = {
    notes: step.notes,
    phase: step.phase,
    outcome: step.outcome,
    isCustomDistance: Boolean(step.isCustomDistance),
    toriMovement: step.toriMovement,
    contactType: step.contactType,
    interactionType: step.interactionType,
    tContact: step.tContact,
    isGround: step.isGround,
    isRising: step.isRising,
    isBow: step.isBow,
    backToOpponent: step.backToOpponent,
    ukeFullTurn: step.ukeFullTurn,
    preserveScenarioYaw: step.preserveScenarioYaw,
    toriTurnDir: step.toriTurnDir,
    ukeTurnDir: step.ukeTurnDir,
    toriActionType: step.toriActionType,
    ukeActionType: step.ukeActionType,
    toriAngleOffsetDeg: step.toriAngleOffsetDeg,
    ukeEvasionAngleDeg: step.ukeEvasionAngleDeg,
    relativeAngleDegTori: step.relativeAngleDegTori,
    relativeAngleDegUke: step.relativeAngleDegUke,
    orientationModeTori: step.orientationModeTori,
    orientationModeUke: step.orientationModeUke,
    customToriPosX: step.customToriPosX,
    customToriPosZ: step.customToriPosZ,
    customUkePosX: step.customUkePosX,
    customUkePosZ: step.customUkePosZ,
    displacementTori: step.displacementTori,
    displacementUke: step.displacementUke,
    toriTrajectory: step.toriTrajectory,
    ukeTrajectory: step.ukeTrajectory,
    scenarioAngles: step.scenarioAngles,
    toriIsGround: toriP.isGround,
    toriIsRising: toriP.isRising,
    ukeIsGround: ukeP.isGround,
    uke2AngleDeg: step.uke2AngleDeg,
  };

  return {
    stepNumber: step.stepNumber,
    title: step.title,
    description: step.description,
    duration: step.duration,
    participantCount: is3Person ? 3 : 2,
    targetDistance: step.optimalDistance,
    targetAngle: step.attackAngleDeg,
    metadata,
    participants,
  };
}

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
  let lastToriHandPunchClip = null;
  let lastUkeHandPunchClip = null;

  const isHandStrikePart = (part, epActionType) => {
    if (!part) return false;
    const c = String(part.clipName || '').toLowerCase();
    const act = String(part.actionType || epActionType || '').toLowerCase();
    if (act === 'punch') return true;
    return (
      c.includes('zuki') ||
      c.includes('tsuki') ||
      c.includes('tettsui') ||
      c.includes('shuto_uchi') ||
      c.includes('uraken') ||
      c.includes('empi')
    );
  };

  const isStandingHoldPart = (part, epActionType, isBowStep, isGroundStep, isRisingStep) => {
    if (!part || isBowStep || isGroundStep || isRisingStep || part.isGround || part.isRising) return false;
    const c = String(part.clipName || '').toLowerCase();
    const act = String(part.actionType || epActionType || '').toLowerCase();
    const isStanceClip = (
      c.startsWith('zenkutsu_dachi') ||
      c.startsWith('kokutsu_dachi') ||
      c.startsWith('fudo_dachi') ||
      c === 'stance_shiko' ||
      c === 'kiba_dachi'
    );
    return isStanceClip && (act === 'stance' || act === 'hold');
  };

  return normalized.map((ep, idx) => {
    let toriStartPos = [...curToriPos];
    let ukeStartPos = [...curUkePos];
    let toriStartYaw = curToriYaw;
    let ukeStartYaw = curUkeYaw;

    const toriPart = ep.participants?.[0] || {};
    const ukePart = ep.participants?.[1] || {};

    if (isHandStrikePart(toriPart, ep.toriActionType)) {
      lastToriHandPunchClip = toriPart.clipName;
    } else if (isStandingHoldPart(toriPart, ep.toriActionType, ep.isBow, ep.isGround, ep.isRising)) {
      if (lastToriHandPunchClip && !toriPart.holdPunchClip) {
        toriPart.holdPunchClip = lastToriHandPunchClip;
      }
    } else {
      lastToriHandPunchClip = null;
    }

    if (isHandStrikePart(ukePart, ep.ukeActionType)) {
      lastUkeHandPunchClip = ukePart.clipName;
    } else if (isStandingHoldPart(ukePart, ep.ukeActionType, ep.isBow, ep.isGround, ep.isRising)) {
      if (lastUkeHandPunchClip && !ukePart.holdPunchClip) {
        ukePart.holdPunchClip = lastUkeHandPunchClip;
      }
    } else {
      lastUkeHandPunchClip = null;
    }

    if (idx > 0 && lastToriFinalStance && toriPart && (!toriPart.stance || !toriPart.hasExplicitStance) && !toriPart.customStanceApplied) {
      toriPart.stance = lastToriFinalStance;
    }
    if (idx > 0 && lastUkeFinalStance && ukePart && (!ukePart.stance || !ukePart.hasExplicitStance) && !ukePart.customStanceApplied) {
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

    if (ep.toriTrajectory?.end && ep.ukeTrajectory?.end) {
      if (idx === 0) {
        toriStartPos = ep.toriTrajectory.start ? [...ep.toriTrajectory.start] : toriStartPos;
        nextToriPos = [...ep.toriTrajectory.end];
        nextToriYaw = ep.toriTrajectory.endYaw !== undefined ? ep.toriTrajectory.endYaw : toriStartYaw;
        toriStartYaw = ep.toriTrajectory.startYaw !== undefined ? ep.toriTrajectory.startYaw : nextToriYaw;

        ukeStartPos = ep.ukeTrajectory.start ? [...ep.ukeTrajectory.start] : ukeStartPos;
        nextUkePos = [...ep.ukeTrajectory.end];
        nextUkeYaw = ep.ukeTrajectory.endYaw !== undefined ? ep.ukeTrajectory.endYaw : ukeStartYaw;
        ukeStartYaw = ep.ukeTrajectory.startYaw !== undefined ? ep.ukeTrajectory.startYaw : nextUkeYaw;
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

        if (isToriKick) {
          if (toriPart.landingMode === 'back') {
            dTor[0] = 0.0;
            dTor[2] = 0.0;
          } else if (toriPart.landingMode === 'forward' && Math.hypot(dTor[0], dTor[2]) < 0.1) {
            dTor[0] = Math.sin(curToriYaw) * 0.70;
            dTor[2] = Math.cos(curToriYaw) * 0.70;
          }
        }

        if (isUkeKick) {
          if (ukePart.landingMode === 'back') {
            dUke[0] = 0.0;
            dUke[2] = 0.0;
          } else if (ukePart.landingMode === 'forward' && Math.hypot(dUke[0], dUke[2]) < 0.1) {
            dUke[0] = Math.sin(curUkeYaw) * 0.70;
            dUke[2] = Math.cos(curUkeYaw) * 0.70;
          }
        }

        nextToriPos = [
          ep.customToriPosX !== undefined && ep.customToriPosX !== null && ep.customToriPosX !== '' ? Number(ep.customToriPosX) : (toriStartPos[0] + dTor[0]),
          toriStartPos[1] + dTor[1],
          ep.customToriPosZ !== undefined && ep.customToriPosZ !== null && ep.customToriPosZ !== '' ? Number(ep.customToriPosZ) : (toriStartPos[2] + dTor[2]),
        ];
        nextUkePos = [
          ep.customUkePosX !== undefined && ep.customUkePosX !== null && ep.customUkePosX !== '' ? Number(ep.customUkePosX) : (ukeStartPos[0] + dUke[0]),
          ukeStartPos[1] + dUke[1],
          ep.customUkePosZ !== undefined && ep.customUkePosZ !== null && ep.customUkePosZ !== '' ? Number(ep.customUkePosZ) : (ukeStartPos[2] + dUke[2]),
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
        nextToriYaw = ep.toriEndYaw !== undefined ? ep.toriEndYaw : (ep.toriTrajectory?.endYaw !== undefined ? ep.toriTrajectory.endYaw : curToriYaw);
        nextUkeYaw = ep.ukeEndYaw !== undefined ? ep.ukeEndYaw : (ep.ukeTrajectory?.endYaw !== undefined ? ep.ukeTrajectory.endYaw : curUkeYaw);
        if (idx === 0) {
          toriStartYaw = ep.toriTrajectory?.startYaw !== undefined ? ep.toriTrajectory.startYaw : nextToriYaw;
          ukeStartYaw = ep.ukeTrajectory?.startYaw !== undefined ? ep.ukeTrajectory.startYaw : nextUkeYaw;
        }
      }
    }

    const isStationaryTori = ep.toriTrajectory?.isStationary ?? (
      Math.hypot(nextToriPos[0] - toriStartPos[0], nextToriPos[2] - toriStartPos[2]) < 0.01
    );
    const isStationaryUke = ep.ukeTrajectory?.isStationary ?? (
      Math.hypot(nextUkePos[0] - ukeStartPos[0], nextUkePos[2] - ukeStartPos[2]) < 0.01
    );

    const chainedStep = {
      ...ep,
      toriStartPos,
      toriEndPos: [...nextToriPos],
      ukeStartPos,
      ukeEndPos: [...nextUkePos],
      toriWaypoint: ep.toriTrajectory?.waypoint ? [...ep.toriTrajectory.waypoint] : null,
      ukeWaypoint: ep.ukeTrajectory?.waypoint ? [...ep.ukeTrajectory.waypoint] : null,
      toriStartYaw,
      toriEndYaw: nextToriYaw,
      ukeStartYaw,
      ukeEndYaw: nextUkeYaw,
      isStationaryTori,
      isStationaryUke,
    };

    // Синхронизируем конечную позицию и ориентацию следующего шага строго с тем,
    // где computeAvatarPlacement реально завершит текущий шаг (исключает скачки 15-24° между шагами).
    const realized = computeAvatarPlacement({ episode: chainedStep });
    curToriPos = [...realized.endPosTori];
    curUkePos = [...realized.endPosUke1];
    curToriYaw = realized.rotTori[1];
    curUkeYaw = realized.rotUke1[1];

    chainedStep.toriEndPos = [...realized.endPosTori];
    chainedStep.ukeEndPos = [...realized.endPosUke1];
    chainedStep.toriEndYaw = realized.rotTori[1];
    chainedStep.ukeEndYaw = realized.rotUke1[1];
    chainedStep.toriStartYaw = realized.startRotTori[1];
    chainedStep.ukeStartYaw = realized.startRotUke1[1];

    return chainedStep;
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
  const effToriAngleOffsetDeg = toriAngleOffsetDeg || norm.toriAngleOffsetDeg || 0;
  const effUkeEvasionAngleDeg = ukeEvasionAngleDeg !== undefined ? ukeEvasionAngleDeg : (norm.ukeEvasionAngleDeg || 0);
  const effOrientationModeTori = orientationModeTori ?? norm.orientationModeTori;
  const effOrientationModeUke = orientationModeUke ?? norm.orientationModeUke;
  const effCustomToriPosX = customToriPosX !== undefined ? customToriPosX : norm.customToriPosX;
  const effCustomToriPosZ = customToriPosZ !== undefined ? customToriPosZ : norm.customToriPosZ;
  const effCustomUkePosX = customUkePosX !== undefined ? customUkePosX : norm.customUkePosX;
  const effCustomUkePosZ = customUkePosZ !== undefined ? customUkePosZ : norm.customUkePosZ;

  let attackYaw = 0;
  if (episode.toriTrajectory?.endYaw !== undefined && Math.abs(episode.toriTrajectory.endYaw) > 0.001) {
    attackYaw = episode.toriTrajectory.endYaw;
  } else if (norm.attackAngleDeg !== undefined) {
    attackYaw = (norm.attackAngleDeg * Math.PI) / 180;
  }
  if (effToriAngleOffsetDeg !== undefined && Math.abs(effToriAngleOffsetDeg) > 0.001) {
    attackYaw += (effToriAngleOffsetDeg * Math.PI) / 180;
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

  if (effCustomToriPosX !== undefined && effCustomToriPosX !== null && effCustomToriPosX !== '') {
    endTori[0] = Number(effCustomToriPosX);
  }
  if (effCustomToriPosZ !== undefined && effCustomToriPosZ !== null && effCustomToriPosZ !== '') {
    endTori[2] = Number(effCustomToriPosZ);
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

  if (effCustomUkePosX !== undefined && effCustomUkePosX !== null && effCustomUkePosX !== '') {
    endUke1[0] = Number(effCustomUkePosX);
  }
  if (effCustomUkePosZ !== undefined && effCustomUkePosZ !== null && effCustomUkePosZ !== '') {
    endUke1[2] = Number(effCustomUkePosZ);
  }

  const hasExplicitCustomUkePos =
    (effCustomUkePosX !== undefined && effCustomUkePosX !== null && effCustomUkePosX !== '') ||
    (effCustomUkePosZ !== undefined && effCustomUkePosZ !== null && effCustomUkePosZ !== '');

  // Если дистанция настраивалась вручную пользователем (без явного ручного X/Z):
  if (!hasExplicitCustomUkePos && ((customDistance !== undefined && customDistance !== null) || episode.isCustomDistance || norm.isCustomDistance)) {
    const dX = endUke1[0] - endTori[0];
    const dZ = endUke1[2] - endTori[2];
    const curLen = Math.hypot(dX, dZ) || 0.001;
    endUke1[0] = endTori[0] + (dX / curLen) * targetDist;
    endUke1[2] = endTori[2] + (dZ / curLen) * targetDist;
  }

  // Если задан динамический угол ухода тай-сабаки Укэ пользователем:
  const effectiveUkeEvasionDeg = effUkeEvasionAngleDeg;
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

  // 7. Устранение скольжения: фиксируем start === end только если смещения действительно нет
  const hasExplicitChainedToriStart = Boolean(episode.toriStartPos);
  const hasExplicitChainedUkeStart = Boolean(episode.ukeStartPos);
  const toriDispLen = Math.hypot(endTori[0] - startTori[0], endTori[2] - startTori[2]);
  const ukeDispLen = Math.hypot(endUke1[0] - startUke1[0], endUke1[2] - startUke1[2]);
  const isStationaryTori = Boolean(episode.isStationaryTori) || (toriDispLen < 0.01);
  const isStationaryUke = Boolean(episode.isStationaryUke) || (ukeDispLen < 0.01);

  if (isStationaryTori && !isToriStep && !hasExplicitChainedToriStart) {
    startTori[0] = endTori[0];
    startTori[2] = endTori[2];
  }

  const effectiveUkeClip = customUkeClip || uke1Part.clipName;
  const isUkeStep = effectiveUkeClip?.includes('oi_zuki') || ukeLandingMode === 'forward';
  if (isStationaryUke && !isUkeStep && Math.abs(effectiveUkeEvasionDeg) < 0.001 && !hasExplicitChainedUkeStart) {
    startUke1[0] = endUke1[0];
    startUke1[2] = endUke1[2];
  }

  // 8. ПРИНЦИП РАЗДЕЛЕНИЯ ОРИЕНТАЦИИ (КЛЮЧЕВОЕ ТРЕБОВАНИЕ):
  const resolvedToriFreeYawDeg = (customToriYawDeg !== undefined && customToriYawDeg !== null)
    ? customToriYawDeg
    : norm.toriEndAngleDeg;
  let endToriYaw;
  if (effOrientationModeTori === 'mode1_free' && resolvedToriFreeYawDeg !== undefined && resolvedToriFreeYawDeg !== null) {
    endToriYaw = (Number(resolvedToriFreeYawDeg) * Math.PI) / 180;
  } else if (effOrientationModeTori === 'mode3_relative_angle' && relativeAngleDegTori !== undefined) {
    endToriYaw = attackYaw + (Number(relativeAngleDegTori) * Math.PI) / 180;
  } else if (effOrientationModeTori === 'mode4_fixed_direction' && fixedDirectionYawTori !== undefined) {
    endToriYaw = Number(fixedDirectionYawTori);
  } else if (effOrientationModeTori === 'mode2_look_at' || Math.abs(effectiveToriEvasionDeg) > 0.001) {
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

  const hasExplicitToriStartYaw = episode.toriStartYaw !== undefined || episode.toriTrajectory?.startYaw !== undefined;
  let startToriYaw = episode.toriStartYaw !== undefined
    ? episode.toriStartYaw
    : (episode.toriTrajectory?.startYaw !== undefined ? episode.toriTrajectory.startYaw : endToriYaw);

  if (((customToriYawDeg !== undefined && customToriYawDeg !== null) || effOrientationModeTori === 'mode1_free') && !hasExplicitToriStartYaw) {
    startToriYaw = endToriYaw;
  } else if (isStationaryTori && !hasExplicitToriStartYaw) {
    startToriYaw = endToriYaw;
  }

  // Белый персонаж (Укэ) при уходе поворачивается ВСЕМ ТЕЛОМ лицом к Тори!
  const faceToriFromUke = Math.atan2(endTori[0] - endUke1[0], endTori[2] - endUke1[2]);
  const isUkeEvading = Math.abs(effectiveUkeEvasionDeg) > 0.001 || isEvaded || lateralOffsetMeters >= 0.08 || Math.abs(endUke1[0] - startTori[0]) >= 0.08;

  const resolvedUkeFreeYawDeg = (customUkeYawDeg !== undefined && customUkeYawDeg !== null)
    ? customUkeYawDeg
    : norm.ukeEndAngleDeg;
  let endUke1Yaw;
  if (effOrientationModeUke === 'mode1_free' && resolvedUkeFreeYawDeg !== undefined && resolvedUkeFreeYawDeg !== null) {
    endUke1Yaw = (Number(resolvedUkeFreeYawDeg) * Math.PI) / 180;
  } else if (norm.backToOpponent) {
    // Позиция спиной к атакующему (например, Хэйсоку-дати с блоком Хайван-укэ)
    endUke1Yaw = Math.atan2(Math.sin(faceToriFromUke + Math.PI), Math.cos(faceToriFromUke + Math.PI));
  } else if (norm.preserveScenarioYaw && episode.ukeTrajectory?.endYaw !== undefined) {
    endUke1Yaw = episode.ukeTrajectory.endYaw;
  } else if (effOrientationModeUke === 'mode3_relative_angle' && relativeAngleDegUke !== undefined) {
    endUke1Yaw = faceToriFromUke + (Number(relativeAngleDegUke) * Math.PI) / 180;
  } else if (effOrientationModeUke === 'mode4_fixed_direction' && fixedDirectionYawUke !== undefined) {
    endUke1Yaw = Number(fixedDirectionYawUke);
  } else if (effOrientationModeUke === 'mode2_look_at' || isUkeEvading) {
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
  const hasExplicitUkeStartYaw = episode.ukeStartYaw !== undefined || episode.ukeTrajectory?.startYaw !== undefined;
  let startUke1Yaw = episode.ukeStartYaw !== undefined
    ? episode.ukeStartYaw
    : (episode.ukeTrajectory?.startYaw !== undefined ? episode.ukeTrajectory.startYaw : endUke1Yaw);

  if (((customUkeYawDeg !== undefined && customUkeYawDeg !== null) || effOrientationModeUke === 'mode1_free') && !hasExplicitUkeStartYaw) {
    startUke1Yaw = endUke1Yaw;
  } else if (isStationaryUke && !isUkeEvading && !hasExplicitUkeStartYaw) {
    startUke1Yaw = endUke1Yaw;
  } else if (!hasExplicitUkeStartYaw && !isUkeEvading && !norm.backToOpponent) {
    startUke1Yaw = faceToriAtStart;
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
    waypointTori: episode.toriWaypoint || episode.toriTrajectory?.waypoint || null,
    startPosUke1: startUke1,
    endPosUke1: endUke1,
    waypointUke: episode.ukeWaypoint || episode.ukeTrajectory?.waypoint || null,
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
