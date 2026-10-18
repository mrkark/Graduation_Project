/**
 * Bunkai Explorer — High-Precision Hand & Finger Retargeting Engine
 * 
 * Модуль мелкой моторики для Karateka_Armature (3D модель мастера Шотокан):
 * 1. Полная анатомическая карта 30 костей фаланг пальцев и 2 лучезапястных суставов
 * 2. Анализ 21 ключевой точки MediaPipe Hands в метрическом 3D-пространстве
 * 3. Непрерывный кинематический перенос формы кисти:
 *    - Плавное формирование кулака Сэйкэн (Seiken) с замком большого пальца поверх указательного и среднего
 *    - Раскрытая ладонь Шуто (Shuto) и Нукитэ (Nukite)
 *    - Свободная независимая артикуляция каждого пальца (указательный, знак «мир», Иппон-кэн и т.д.)
 * 4. Анатомические ограничения подвижности (Range of Motion, ROM) — исключение неестественного выгибания назад
 * 5. Адаптивная 1€ фильтрация фаланг для подавления дрожания в статике при сохранении резкого Кимэ
 * 6. Оценка уверенности (confidence) по каждому пальцу и временное удержание при самоперекрытиях
 * 7. Верификация хиральности и защита от инверсии левой/правой руки
 */

import * as THREE from 'three';

class LowPassFilter {
  constructor(alpha = 0.5) {
    this.alpha = alpha;
    this.s = null;
    this.y = null;
  }
  filter(value, alpha = null) {
    if (alpha !== null) this.alpha = alpha;
    if (this.s === null) {
      this.s = value;
    } else {
      this.s = this.alpha * value + (1.0 - this.alpha) * this.s;
    }
    this.y = value;
    return this.s;
  }
  reset() {
    this.s = null;
    this.y = null;
  }
}

export class OneEuroFilter {
  constructor(freq = 30.0, minCutoff = 1.2, beta = 0.08, dCutoff = 1.0) {
    this.freq = Math.max(1e-3, freq);
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.xFilter = new LowPassFilter(this._alpha(minCutoff));
    this.dxFilter = new LowPassFilter(this._alpha(dCutoff));
    this.lastTime = null;
  }
  _alpha(cutoff) {
    const tau = 1.0 / (2.0 * Math.PI * cutoff);
    const te = 1.0 / this.freq;
    return 1.0 / (1.0 + tau / te);
  }
  filter(x, timestamp = null) {
    if (this.lastTime !== null && timestamp !== null) {
      const dt = (timestamp - this.lastTime) / 1000.0;
      if (dt > 1e-4) this.freq = 1.0 / dt;
    }
    this.lastTime = timestamp;
    const prevX = this.xFilter.y;
    const rawDiff = prevX === null ? 0.0 : Math.abs(x - prevX);
    let dx = prevX === null ? 0.0 : (x - prevX) * this.freq;
    if (rawDiff < 0.006) dx *= 0.15;
    const edx = this.dxFilter.filter(dx, this._alpha(this.dCutoff));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.xFilter.filter(x, this._alpha(cutoff));
  }
  reset() {
    this.xFilter.reset();
    this.dxFilter.reset();
    this.lastTime = null;
  }
}

// ============================================================================
// 1. АНАТОМИЧЕСКАЯ СПЕЦИФИКАЦИЯ РИГА (KARATEKA_ARMATURE BONE MAP)
// ============================================================================

export const FINGER_NAMES = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];

/**
 * Полная таблица соответствия 30 костей фаланг и 2 запястий модели karateka_lowpoly.glb
 */
export const HAND_RIG_SPEC = {
  // Левая рука (Left Hand)
  'Hand.L': {
    parent: 'LowerArm.L',
    anatomical: 'Левое лучезапястное сочленение (Radiocarpal joint)',
    side: 'L',
    type: 'wrist',
    dof: ['flexion_extension', 'radial_ulnar_deviation', 'pronation_supination'],
    localFlexAxis: [-1, 0, 0],
    localAbdAxis: [0, 0, 1],
    restTranslation: [-1.22e-21, 0.260, -1.19e-7],
    restQuaternion: [-6.62e-40, -2.12e-22, -9.02e-16, 1.0],
  },
  'Thumb1.L': {
    parent: 'Hand.L',
    anatomical: 'Большой палец — Запястно-пястный сустав (CMC / Os metacarpale I)',
    side: 'L',
    finger: 'thumb',
    phalanx: 1,
    dof: ['opposition', 'flexion', 'abduction'],
    localFlexAxis: [-0.35, 0.0, 0.80],
    restTranslation: [0.038, 0.020, -0.007],
    restQuaternion: [-0.212, -0.212, -0.334, 0.893],
  },
  'Thumb2.L': {
    parent: 'Thumb1.L',
    anatomical: 'Большой палец — Пястно-фаланговый сустав (MCP / Phalanx proximalis)',
    side: 'L',
    finger: 'thumb',
    phalanx: 2,
    dof: ['flexion'],
    localFlexAxis: [-0.80, 0.0, 0.35],
    restTranslation: [-3.73e-8, 0.0379, -1.02e-8],
    restQuaternion: [0.0177, 0.0196, 0.0255, 0.9993],
  },
  'Thumb3.L': {
    parent: 'Thumb2.L',
    anatomical: 'Большой палец — Межфаланговый сустав (IP / Phalanx distalis)',
    side: 'L',
    finger: 'thumb',
    phalanx: 3,
    dof: ['flexion'],
    localFlexAxis: [-0.95, 0.0, 0.15],
    restTranslation: [-2.24e-8, 0.0342, -7.26e-8],
    restQuaternion: [0.0274, 0.0442, 0.0178, 0.9985],
  },
  'Index1.L': {
    parent: 'Hand.L',
    anatomical: 'Указательный палец — Пястно-фаланговый сустав (MCP II)',
    side: 'L',
    finger: 'index',
    phalanx: 1,
    dof: ['flexion', 'abduction'],
    localFlexAxis: [-1, 0, 0],
    localAbdAxis: [0, 0, 1],
    restTranslation: [0.027, 0.080, -1.19e-7],
    restQuaternion: [0.0, -2.52e-29, -9.02e-16, 1.0],
  },
  'Index2.L': {
    parent: 'Index1.L',
    anatomical: 'Указательный палец — Проксимальный межфаланговый сустав (PIP II)',
    side: 'L',
    finger: 'index',
    phalanx: 2,
    dof: ['flexion'],
    localFlexAxis: [-1, 0, 0],
    restTranslation: [1.86e-9, 0.029, -1.19e-7],
    restQuaternion: [0.0, -3.01e-36, -9.02e-16, 1.0],
  },
  'Index3.L': {
    parent: 'Index2.L',
    anatomical: 'Указательный палец — Дистальный межфаланговый сустав (DIP II)',
    side: 'L',
    finger: 'index',
    phalanx: 3,
    dof: ['flexion'],
    localFlexAxis: [-1, 0, 0],
    restTranslation: [1.86e-9, 0.027, -1.19e-7],
    restQuaternion: [0.0, -3.59e-43, -9.02e-16, 1.0],
  },
  'Middle1.L': {
    parent: 'Hand.L',
    anatomical: 'Средний палец — Пястно-фаланговый сустав (MCP III)',
    side: 'L',
    finger: 'middle',
    phalanx: 1,
    dof: ['flexion', 'abduction'],
    localFlexAxis: [-1, 0, 0],
    localAbdAxis: [0, 0, 1],
    restTranslation: [0.004, 0.080, -1.19e-7],
    restQuaternion: [0.0, -2.52e-29, -9.02e-16, 1.0],
  },
  'Middle2.L': {
    parent: 'Middle1.L',
    anatomical: 'Средний палец — Проксимальный межфаланговый сустав (PIP III)',
    side: 'L',
    finger: 'middle',
    phalanx: 2,
    dof: ['flexion'],
    localFlexAxis: [-1, 0, 0],
    restTranslation: [0.0, 0.032, -1.19e-7],
    restQuaternion: [0.0, -3.01e-36, -9.02e-16, 1.0],
  },
  'Middle3.L': {
    parent: 'Middle2.L',
    anatomical: 'Средний палец — Дистальный межфаланговый сустав (DIP III)',
    side: 'L',
    finger: 'middle',
    phalanx: 3,
    dof: ['flexion'],
    localFlexAxis: [-1, 0, 0],
    restTranslation: [0.0, 0.030, -1.19e-7],
    restQuaternion: [0.0, -3.59e-43, -9.02e-16, 1.0],
  },
  'Ring1.L': {
    parent: 'Hand.L',
    anatomical: 'Безымянный палец — Пястно-фаланговый сустав (MCP IV)',
    side: 'L',
    finger: 'ring',
    phalanx: 1,
    dof: ['flexion', 'abduction'],
    localFlexAxis: [-1, 0, 0],
    localAbdAxis: [0, 0, 1],
    restTranslation: [-0.019, 0.080, -1.19e-7],
    restQuaternion: [0.0, -2.52e-29, -9.02e-16, 1.0],
  },
  'Ring2.L': {
    parent: 'Ring1.L',
    anatomical: 'Безымянный палец — Проксимальный межфаланговый сустав (PIP IV)',
    side: 'L',
    finger: 'ring',
    phalanx: 2,
    dof: ['flexion'],
    localFlexAxis: [-1, 0, 0],
    restTranslation: [0.0, 0.029, -1.19e-7],
    restQuaternion: [0.0, -3.01e-36, -9.02e-16, 1.0],
  },
  'Ring3.L': {
    parent: 'Ring2.L',
    anatomical: 'Безымянный палец — Дистальный межфаланговый сустав (DIP IV)',
    side: 'L',
    finger: 'ring',
    phalanx: 3,
    dof: ['flexion'],
    localFlexAxis: [-1, 0, 0],
    restTranslation: [0.0, 0.027, -1.19e-7],
    restQuaternion: [0.0, -3.59e-43, -9.02e-16, 1.0],
  },
  'Pinky1.L': {
    parent: 'Hand.L',
    anatomical: 'Мизинец — Пястно-фаланговый сустав (MCP V)',
    side: 'L',
    finger: 'pinky',
    phalanx: 1,
    dof: ['flexion', 'abduction'],
    localFlexAxis: [-1, 0, 0],
    localAbdAxis: [0, 0, 1],
    restTranslation: [-0.036, 0.080, -1.19e-7],
    restQuaternion: [0.0, -2.52e-29, -9.02e-16, 1.0],
  },
  'Pinky2.L': {
    parent: 'Pinky1.L',
    anatomical: 'Мизинец — Проксимальный межфаланговый сустав (PIP V)',
    side: 'L',
    finger: 'pinky',
    phalanx: 2,
    dof: ['flexion'],
    localFlexAxis: [-1, 0, 0],
    restTranslation: [0.0, 0.024, -1.19e-7],
    restQuaternion: [0.0, -3.01e-36, -9.02e-16, 1.0],
  },
  'Pinky3.L': {
    parent: 'Pinky2.L',
    anatomical: 'Мизинец — Дистальный межфаланговый сустав (DIP V)',
    side: 'L',
    finger: 'pinky',
    phalanx: 3,
    dof: ['flexion'],
    localFlexAxis: [-1, 0, 0],
    restTranslation: [0.0, 0.022, -1.19e-7],
    restQuaternion: [0.0, -3.59e-43, -9.02e-16, 1.0],
  },

  // Правая рука (Right Hand) — симметричная структура
  'Hand.R': {
    parent: 'LowerArm.R',
    anatomical: 'Правое лучезапястное сочленение (Radiocarpal joint)',
    side: 'R',
    type: 'wrist',
    dof: ['flexion_extension', 'radial_ulnar_deviation', 'pronation_supination'],
    localFlexAxis: [-1, 0, 0],
    localAbdAxis: [0, 0, 1],
    restTranslation: [1.22e-21, 0.260, -1.19e-7],
    restQuaternion: [-6.62e-40, 2.12e-22, 9.02e-16, 1.0],
  },
  'Thumb1.R': {
    parent: 'Hand.R',
    anatomical: 'Большой палец — Запястно-пястный сустав (CMC I)',
    side: 'R',
    finger: 'thumb',
    phalanx: 1,
    dof: ['opposition', 'flexion', 'abduction'],
    localFlexAxis: [-0.35, 0.0, -0.80],
    restTranslation: [-0.038, 0.020, -0.007],
    restQuaternion: [-0.212, 0.212, 0.334, 0.893],
  },
  'Thumb2.R': {
    parent: 'Thumb1.R',
    anatomical: 'Большой палец — Пястно-фаланговый сустав (MCP I)',
    side: 'R',
    finger: 'thumb',
    phalanx: 2,
    dof: ['flexion'],
    localFlexAxis: [-0.80, 0.0, -0.35],
    restTranslation: [3.73e-8, 0.0379, -1.02e-8],
    restQuaternion: [0.0177, -0.0196, -0.0255, 0.9993],
  },
  'Thumb3.R': {
    parent: 'Thumb2.R',
    anatomical: 'Большой палец — Межфаланговый сустав (IP I)',
    side: 'R',
    finger: 'thumb',
    phalanx: 3,
    dof: ['flexion'],
    localFlexAxis: [-0.95, 0.0, -0.15],
    restTranslation: [2.24e-8, 0.0342, -7.26e-8],
    restQuaternion: [0.0274, -0.0442, -0.0178, 0.9985],
  },
  'Index1.R': {
    parent: 'Hand.R',
    anatomical: 'Указательный палец — Пястно-фаланговый сустав (MCP II)',
    side: 'R',
    finger: 'index',
    phalanx: 1,
    dof: ['flexion', 'abduction'],
    localFlexAxis: [-1, 0, 0],
    localAbdAxis: [0, 0, 1],
    restTranslation: [-0.027, 0.080, -1.19e-7],
    restQuaternion: [0.0, 2.52e-29, 9.02e-16, 1.0],
  },
  'Index2.R': {
    parent: 'Index1.R',
    anatomical: 'Указательный палец — Проксимальный межфаланговый сустав (PIP II)',
    side: 'R',
    finger: 'index',
    phalanx: 2,
    dof: ['flexion'],
    localFlexAxis: [-1, 0, 0],
    restTranslation: [-1.86e-9, 0.029, -1.19e-7],
    restQuaternion: [0.0, 3.01e-36, 9.02e-16, 1.0],
  },
  'Index3.R': {
    parent: 'Index2.R',
    anatomical: 'Указательный палец — Дистальный межфаланговый сустав (DIP II)',
    side: 'R',
    finger: 'index',
    phalanx: 3,
    dof: ['flexion'],
    localFlexAxis: [-1, 0, 0],
    restTranslation: [-1.86e-9, 0.027, -1.19e-7],
    restQuaternion: [0.0, 3.59e-43, 9.02e-16, 1.0],
  },
  'Middle1.R': {
    parent: 'Hand.R',
    anatomical: 'Средний палец — Пястно-фаланговый сустав (MCP III)',
    side: 'R',
    finger: 'middle',
    phalanx: 1,
    dof: ['flexion', 'abduction'],
    localFlexAxis: [-1, 0, 0],
    localAbdAxis: [0, 0, 1],
    restTranslation: [-0.004, 0.080, -1.19e-7],
    restQuaternion: [0.0, 2.52e-29, 9.02e-16, 1.0],
  },
  'Middle2.R': {
    parent: 'Middle1.R',
    anatomical: 'Средний палец — Проксимальный межфаланговый сустав (PIP III)',
    side: 'R',
    finger: 'middle',
    phalanx: 2,
    dof: ['flexion'],
    localFlexAxis: [-1, 0, 0],
    restTranslation: [0.0, 0.032, -1.19e-7],
    restQuaternion: [0.0, 3.01e-36, 9.02e-16, 1.0],
  },
  'Middle3.R': {
    parent: 'Middle2.R',
    anatomical: 'Средний палец — Дистальный межфаланговый сустав (DIP III)',
    side: 'R',
    finger: 'middle',
    phalanx: 3,
    dof: ['flexion'],
    localFlexAxis: [-1, 0, 0],
    restTranslation: [0.0, 0.030, -1.19e-7],
    restQuaternion: [0.0, 3.59e-43, 9.02e-16, 1.0],
  },
  'Ring1.R': {
    parent: 'Hand.R',
    anatomical: 'Безымянный палец — Пястно-фаланговый сустав (MCP IV)',
    side: 'R',
    finger: 'ring',
    phalanx: 1,
    dof: ['flexion', 'abduction'],
    localFlexAxis: [-1, 0, 0],
    localAbdAxis: [0, 0, 1],
    restTranslation: [0.019, 0.080, -1.19e-7],
    restQuaternion: [0.0, 2.52e-29, 9.02e-16, 1.0],
  },
  'Ring2.R': {
    parent: 'Ring1.R',
    anatomical: 'Безымянный палец — Проксимальный межфаланговый сустав (PIP IV)',
    side: 'R',
    finger: 'ring',
    phalanx: 2,
    dof: ['flexion'],
    localFlexAxis: [-1, 0, 0],
    restTranslation: [0.0, 0.029, -1.19e-7],
    restQuaternion: [0.0, 3.01e-36, 9.02e-16, 1.0],
  },
  'Ring3.R': {
    parent: 'Ring2.R',
    anatomical: 'Безымянный палец — Дистальный межфаланговый сустав (DIP IV)',
    side: 'R',
    finger: 'ring',
    phalanx: 3,
    dof: ['flexion'],
    localFlexAxis: [-1, 0, 0],
    restTranslation: [0.0, 0.027, -1.19e-7],
    restQuaternion: [0.0, 3.59e-43, 9.02e-16, 1.0],
  },
  'Pinky1.R': {
    parent: 'Hand.R',
    anatomical: 'Мизинец — Пястно-фаланговый сустав (MCP V)',
    side: 'R',
    finger: 'pinky',
    phalanx: 1,
    dof: ['flexion', 'abduction'],
    localFlexAxis: [-1, 0, 0],
    localAbdAxis: [0, 0, 1],
    restTranslation: [0.036, 0.080, -1.19e-7],
    restQuaternion: [0.0, 2.52e-29, 9.02e-16, 1.0],
  },
  'Pinky2.R': {
    parent: 'Pinky1.R',
    anatomical: 'Мизинец — Проксимальный межфаланговый сустав (PIP V)',
    side: 'R',
    finger: 'pinky',
    phalanx: 2,
    dof: ['flexion'],
    localFlexAxis: [-1, 0, 0],
    restTranslation: [0.0, 0.024, -1.19e-7],
    restQuaternion: [0.0, 3.01e-36, 9.02e-16, 1.0],
  },
  'Pinky3.R': {
    parent: 'Pinky2.R',
    anatomical: 'Мизинец — Дистальный межфаланговый сустав (DIP V)',
    side: 'R',
    finger: 'pinky',
    phalanx: 3,
    dof: ['flexion'],
    localFlexAxis: [-1, 0, 0],
    restTranslation: [0.0, 0.022, -1.19e-7],
    restQuaternion: [0.0, 3.59e-43, 9.02e-16, 1.0],
  },
};

// ============================================================================
// 2. АНАТОМИЧЕСКИЕ ПРЕДЕЛЫ ПОДВИЖНОСТИ (RANGE OF MOTION, ROM)
// Предотвращают неестественный выворот фаланг и взаимные пересечения
// ============================================================================

export const ANATOMICAL_ROM = {
  // Четыре пальца (Index, Middle, Ring, Pinky)
  finger: {
    mcpFlexion: { min: 0.0, max: 1.571 },   // 0° ... 90° (строгий запрет разгибания назад < 0)
    pipFlexion: { min: 0.0, max: 1.833 },   // 0° ... 105° (блоковидный сустав)
    dipFlexion: { min: 0.0, max: 1.484 },   // 0° ... 85°
    abduction: {
      index: { min: -0.35, max: 0.35 },     // -20° ... +20°
      middle: { min: -0.15, max: 0.15 },    // -8° ... +8°
      ring: { min: -0.25, max: 0.25 },      // -14° ... +14°
      pinky: { min: -0.38, max: 0.38 },     // -22° ... +22°
    },
  },
  // Большой палец (Thumb)
  thumb: {
    cmcOpposition: { min: 0.0, max: 1.15 }, // 0° ... 66° оппозиция к ладони
    cmcFlexion: { min: 0.0, max: 0.785 },    // 0° ... 45°
    mcpFlexion: { min: 0.0, max: 1.134 },    // 0° ... 65°
    ipFlexion: { min: 0.0, max: 1.396 },     // 0° ... 80°
  },
  // Лучезапястный сустав (Wrist)
  wrist: {
    flexionExtension: { min: -1.22, max: 1.31 },   // -70° ... +75°
    radialUlnarDev: { min: -0.35, max: 0.52 },     // -20° ... +30°
    pronationSupination: { min: -1.48, max: 1.48 }, // -85° ... +85°
  },
};

/**
 * Клампинг угла фаланги в анатомический диапазон
 */
export function clampPhalanxAngle(angle, jointType, fingerKey = 'index') {
  if (typeof angle !== 'number' || isNaN(angle)) return 0.15;

  if (fingerKey === 'thumb') {
    if (jointType === 'cmc' || jointType === 'ph1') {
      return Math.max(ANATOMICAL_ROM.thumb.cmcFlexion.min, Math.min(ANATOMICAL_ROM.thumb.cmcFlexion.max, angle));
    }
    if (jointType === 'mcp' || jointType === 'ph2') {
      return Math.max(ANATOMICAL_ROM.thumb.mcpFlexion.min, Math.min(ANATOMICAL_ROM.thumb.mcpFlexion.max, angle));
    }
    if (jointType === 'ip' || jointType === 'ph3') {
      return Math.max(ANATOMICAL_ROM.thumb.ipFlexion.min, Math.min(ANATOMICAL_ROM.thumb.ipFlexion.max, angle));
    }
  } else {
    if (jointType === 'mcp' || jointType === 'ph1') {
      return Math.max(ANATOMICAL_ROM.finger.mcpFlexion.min, Math.min(ANATOMICAL_ROM.finger.mcpFlexion.max, angle));
    }
    if (jointType === 'pip' || jointType === 'ph2') {
      return Math.max(ANATOMICAL_ROM.finger.pipFlexion.min, Math.min(ANATOMICAL_ROM.finger.pipFlexion.max, angle));
    }
    if (jointType === 'dip' || jointType === 'ph3') {
      return Math.max(ANATOMICAL_ROM.finger.dipFlexion.min, Math.min(ANATOMICAL_ROM.finger.dipFlexion.max, angle));
    }
  }
  return Math.max(0.0, Math.min(1.85, angle));
}

/**
 * Клампинг угла отведения (abduction)
 */
export function clampAbductionAngle(angle, fingerKey) {
  if (typeof angle !== 'number' || isNaN(angle)) return 0.0;
  const lim = ANATOMICAL_ROM.finger.abduction[fingerKey] || { min: -0.25, max: 0.25 };
  return Math.max(lim.min, Math.min(lim.max, angle));
}

// ============================================================================
// 3. АДАПТИВНАЯ ФИЛЬТРАЦИЯ 1€ И ВРЕМЕННОЕ УДЕРЖАНИЕ ПЕРЕКРЫТЫХ ПАЛЬЦЕВ
// ============================================================================

/**
 * Пофаланговый банк 1€ фильтров с отслеживанием уверенности и временной согласованностью
 */
export class HandTemporalTracker {
  constructor(sideKey = 'R') {
    this.sideKey = sideKey;
    this.filters = {};
    this.lastValidState = null;
    this.occlusionFrames = { thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0 };
    this.lastTimestamp = null;

    // Инициализация 1€ фильтров для каждого пальца и каждой фаланги
    // minCutoff = 1.2 Гц (полное подавление сенсорного дрожания в покое)
    // beta = 1.0 (мгновенный отклик на ударный импульс Кимэ при высокой скорости dx)
    FINGER_NAMES.forEach((fname) => {
      const fkey = fname.toLowerCase();
      this.filters[fkey] = {
        ph1: new OneEuroFilter(30.0, 1.2, 1.0, 1.0),
        ph2: new OneEuroFilter(30.0, 1.2, 1.0, 1.0),
        ph3: new OneEuroFilter(30.0, 1.2, 1.0, 1.0),
        abd: new OneEuroFilter(30.0, 1.0, 0.60, 1.0),
      };
    });

    // Фильтры для 3D вектора ориентации кисти
    this.handDirFilters = [
      new OneEuroFilter(30.0, 1.5, 0.60, 1.0),
      new OneEuroFilter(30.0, 1.5, 0.60, 1.0),
      new OneEuroFilter(30.0, 1.5, 0.60, 1.0),
    ];
    this.palmNormFilters = [
      new OneEuroFilter(30.0, 1.5, 0.60, 1.0),
      new OneEuroFilter(30.0, 1.5, 0.60, 1.0),
      new OneEuroFilter(30.0, 1.5, 0.60, 1.0),
    ];
  }

  reset() {
    Object.values(this.filters).forEach((fObj) => {
      fObj.ph1.reset();
      fObj.ph2.reset();
      fObj.ph3.reset();
      fObj.abd.reset();
    });
    this.handDirFilters.forEach((f) => f.reset());
    this.palmNormFilters.forEach((f) => f.reset());
    this.lastValidState = null;
    this.occlusionFrames = { thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0 };
    this.lastTimestamp = null;
  }

  /**
   * Сглаживает кинематику пальцев с адаптивной фильтрацией 1€ и устойчивостью к перекрытиям
   */
  filterHandKinematics(rawHand, timestamp = null) {
    if (!rawHand) return null;
    const curTime = timestamp || Date.now();

    const outPhalanges = {};
    const outAbduction = {};
    const confidences = rawHand.confidence || { thumb: 0.9, index: 0.9, middle: 0.9, ring: 0.9, pinky: 0.9 };

    let totalCurl = 0;

    FINGER_NAMES.forEach((fname) => {
      const fkey = fname.toLowerCase();
      const rawAngles = rawHand.phalanges?.[fkey] || [0.15, 0.15, 0.15];
      const rawAbd = rawHand.abduction?.[fkey] || 0.0;
      const conf = confidences[fkey] !== undefined ? confidences[fkey] : 0.85;

      const fSet = this.filters[fkey];
      let a1 = rawAngles[0];
      let a2 = rawAngles[1];
      let a3 = rawAngles[2];
      let abd = rawAbd;

      if (conf < 0.40) {
        // Палец временно перекрыт (occluded) — плавное удержание с экспоненциальным затуханием
        this.occlusionFrames[fkey]++;
        const prev = this.lastValidState?.phalanges?.[fkey];
        const prevAbd = this.lastValidState?.abduction?.[fkey];

        if (prev) {
          const decay = Math.exp(-this.occlusionFrames[fkey] * 0.08); // Период полураспада ~8 кадров
          const neutralAngle = 0.20;
          a1 = prev[0] * decay + neutralAngle * (1.0 - decay);
          a2 = prev[1] * decay + neutralAngle * (1.0 - decay);
          a3 = prev[2] * decay + neutralAngle * (1.0 - decay);
          abd = (prevAbd || 0.0) * decay;
        }
      } else {
        this.occlusionFrames[fkey] = 0;
      }

      // 1. Анатомический ROM клампинг
      const c1 = clampPhalanxAngle(a1, 'ph1', fkey);
      const c2 = clampPhalanxAngle(a2, 'ph2', fkey);
      const c3 = clampPhalanxAngle(a3, 'ph3', fkey);
      const cAbd = fkey === 'thumb'
        ? Math.max(0.0, Math.min(1.15, abd))
        : clampAbductionAngle(abd, fkey);

      // 2. 1€ фильтрация для устранения микродрожания в покое и мгновенного Кимэ при ударе
      const f1 = fSet.ph1.filter(c1, curTime);
      const f2 = fSet.ph2.filter(c2, curTime);
      const f3 = fSet.ph3.filter(c3, curTime);
      const fAbd = fSet.abd.filter(cAbd, curTime);

      outPhalanges[fkey] = [
        parseFloat(f1.toFixed(3)),
        parseFloat(f2.toFixed(3)),
        parseFloat(f3.toFixed(3)),
      ];
      outAbduction[fkey] = parseFloat(fAbd.toFixed(3));

      // Расчет общего сгибания пальца
      const fingerCurl = fkey === 'thumb'
        ? (f1 / 0.785 + f2 / 1.134 + f3 / 1.396) / 3.0
        : (f1 / 1.571 + f2 / 1.833 + f3 / 1.484) / 3.0;
      totalCurl += Math.max(0.0, Math.min(1.0, fingerCurl));
    });

    // Фильтрация векторов нормали и направления
    let fwd = rawHand.hand_direction || [0, 1, 0];
    let norm = rawHand.palm_normal || [0, 0, 1];

    fwd = [
      this.handDirFilters[0].filter(fwd[0], curTime),
      this.handDirFilters[1].filter(fwd[1], curTime),
      this.handDirFilters[2].filter(fwd[2], curTime),
    ];
    norm = [
      this.palmNormFilters[0].filter(norm[0], curTime),
      this.palmNormFilters[1].filter(norm[1], curTime),
      this.palmNormFilters[2].filter(norm[2], curTime),
    ];

    // Нормализация векторов
    const magFwd = Math.hypot(fwd[0], fwd[1], fwd[2]) || 1.0;
    const magNorm = Math.hypot(norm[0], norm[1], norm[2]) || 1.0;
    fwd = [fwd[0] / magFwd, fwd[1] / magFwd, fwd[2] / magFwd];
    norm = [norm[0] / magNorm, norm[1] / magNorm, norm[2] / magNorm];

    const avgCurl = parseFloat((totalCurl / 5.0).toFixed(2));
    const isFist = avgCurl >= 0.75;
    const isShuto = avgCurl <= 0.22 && Math.abs(outAbduction.index) < 0.12 && Math.abs(outAbduction.pinky) < 0.15;

    const result = {
      ...rawHand,
      general_curl: avgCurl,
      fistScore: Math.round(avgCurl * 100),
      isFist,
      isShuto,
      phalanges: outPhalanges,
      abduction: outAbduction,
      hand_direction: fwd,
      palm_normal: norm,
      confidence: confidences,
      detected: true,
    };

    this.lastValidState = result;
    this.lastTimestamp = curTime;
    return result;
  }
}

// Банки фильтров для обеих рук
export const leftHandTracker = new HandTemporalTracker('L');
export const rightHandTracker = new HandTemporalTracker('R');

export function resetHandTrackers() {
  leftHandTracker.reset();
  rightHandTracker.reset();
}

// ============================================================================
// 4. ЗАЩИТА ОТ ИНВЕРСИИ РУК (HANDEDNESS FLIP PROTECTION & CHIRALITY CHECK)
// ============================================================================

/**
 * Проверяет хиральность кисти по векторному смешанному произведению
 * (vAcross x vFwd) . vNormal > 0
 */
export function verifyHandChirality(landmarks21) {
  if (!landmarks21 || landmarks21.length < 21) return 'unknown';

  const w = landmarks21[0];   // Wrist
  const m = landmarks21[9];   // Middle MCP
  const i = landmarks21[5];   // Index MCP
  const p = landmarks21[17];  // Pinky MCP

  // Вектор направления пальцев
  const vFwd = [m.x - w.x, m.y - w.y, (m.z || 0) - (w.z || 0)];
  // Вектор поперек ладони от мизинца к указательному
  const vPinkyToIndex = [i.x - p.x, i.y - p.y, (i.z || 0) - (p.z || 0)];

  // Векторное произведение дает нормаль ладони
  const nX = vPinkyToIndex[1] * vFwd[2] - vPinkyToIndex[2] * vFwd[1];
  const nY = vPinkyToIndex[2] * vFwd[0] - vPinkyToIndex[0] * vFwd[2];
  const nZ = vPinkyToIndex[0] * vFwd[1] - vPinkyToIndex[1] * vFwd[0];

  // В пространстве MediaPipe (Y вниз, Z от камеры):
  // Если нормаль ладони направлена к камере (Z < 0), ладонь открыта к зрителю
  return {
    normal: [nX, nY, nZ],
    isFacingCamera: nZ < 0,
    chiralityScore: Math.hypot(nX, nY, nZ),
  };
}

/**
 * Сопоставляет руку MediaPipe Hands с телом человека из MediaPipe Pose,
 * исключая спутывание левой и правой руки
 */
export function disambiguateHandSide(hWristPoint, poseLandmarks) {
  if (!hWristPoint || !poseLandmarks || poseLandmarks.length < 33) return null;

  const lw = poseLandmarks[15]; // Left wrist
  const rw = poseLandmarks[16]; // Right wrist
  const le = poseLandmarks[13]; // Left elbow
  const re = poseLandmarks[14]; // Right elbow

  if (!lw || !rw) return null;

  // Дистанция до левого и правого запястья
  const distL = Math.hypot(hWristPoint.x - lw.x, hWristPoint.y - lw.y);
  const distR = Math.hypot(hWristPoint.x - rw.x, hWristPoint.y - rw.y);

  if (Math.abs(distL - distR) > 0.08) {
    return distL < distR ? 'left' : 'right';
  }

  // При близости запястий (скрещивание рук) привлекаем локти для разрешения неоднозначности
  if (le && re) {
    const distLE = Math.hypot(hWristPoint.x - le.x, hWristPoint.y - le.y);
    const distRE = Math.hypot(hWristPoint.x - re.x, hWristPoint.y - re.y);
    return distLE < distRE ? 'left' : 'right';
  }

  return distL < distR ? 'left' : 'right';
}

// ============================================================================
// 5. РАСЧЕТ УВЕРЕННОСТИ (CONFIDENCE) ПО КАЖДОМУ ПАЛЬЦУ
// ============================================================================

/**
 * Рассчитывает уверенность детекции для каждого пальца на основе
 * взаимных расстояний, z-глубины и коэффициентов видимости
 */
export function computePerFingerConfidence(hPts) {
  if (!hPts || hPts.length < 21) {
    return { thumb: 0.5, index: 0.5, middle: 0.5, ring: 0.5, pinky: 0.5 };
  }

  const checkSegmentPlausibility = (idxA, idxB) => {
    const a = hPts[idxA];
    const b = hPts[idxB];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], (b[2] || 0) - (a[2] || 0));
    // Аномально короткие или растянутые сегменты свидетельствуют о перекрытии
    return len > 0.015 && len < 0.28 ? 1.0 : 0.35;
  };

  const cThumb = Math.min(
    checkSegmentPlausibility(1, 2),
    checkSegmentPlausibility(2, 3),
    checkSegmentPlausibility(3, 4)
  );
  const cIndex = Math.min(
    checkSegmentPlausibility(5, 6),
    checkSegmentPlausibility(6, 7),
    checkSegmentPlausibility(7, 8)
  );
  const cMiddle = Math.min(
    checkSegmentPlausibility(9, 10),
    checkSegmentPlausibility(10, 11),
    checkSegmentPlausibility(11, 12)
  );
  const cRing = Math.min(
    checkSegmentPlausibility(13, 14),
    checkSegmentPlausibility(14, 15),
    checkSegmentPlausibility(15, 16)
  );
  const cPinky = Math.min(
    checkSegmentPlausibility(17, 18),
    checkSegmentPlausibility(18, 19),
    checkSegmentPlausibility(19, 20)
  );

  return {
    thumb: parseFloat(cThumb.toFixed(2)),
    index: parseFloat(cIndex.toFixed(2)),
    middle: parseFloat(cMiddle.toFixed(2)),
    ring: parseFloat(cRing.toFixed(2)),
    pinky: parseFloat(cPinky.toFixed(2)),
  };
}

// ============================================================================
// 6. НЕПРЕРЫВНЫЙ РЕТАРГЕТИНГ В KARATEKA_ARMATURE (30 КОСТЕЙ)
// ============================================================================

/**
 * Преобразует вычисленные углы фаланг в локальные кватернионы модели Karateka_Armature
 * Реализует плавный переход: Свободная кисть <-> Шуто <-> Сэйкэн кулак
 */
export function applyHandRetargetingToArmature(boneMap, fData, sideKey = 'R', alpha = 0.82) {
  if (!boneMap || !fData) return;
  const isLeft = sideKey === 'L';
  const hasPhalanges = Boolean(fData.phalanges && fData.detected);

  const tracker = isLeft ? leftHandTracker : rightHandTracker;
  const filteredData = tracker.filterHandKinematics(fData);
  if (!filteredData) return;

  const phalangesData = filteredData.phalanges || {};
  const abductionData = filteredData.abduction || {};
  const generalCurl = filteredData.general_curl ?? 0.15;

  FINGER_NAMES.forEach((ftype) => {
    const fKey = ftype.toLowerCase();
    const phalanges = phalangesData[fKey] || [0.15, 0.15, 0.15];
    const abd = abductionData[fKey] || 0.0;

    for (let ph = 1; ph <= 3; ph++) {
      const bname = `${ftype}${ph}.${sideKey}`;
      const bone = boneMap.get(bname);
      if (!bone || !bone.restLocalQ) continue;

      if (ftype === 'Thumb') {
        const zSign = isLeft ? 1.0 : -1.0;
        const flexVal = phalanges[ph - 1];

        let rotVec;
        if (ph === 1) {
          // Trapeziometacarpal / CMC: оппозиция поперек ладони к указательному и среднему пальцам
          // В Сэйкэн кулаке оппозиция усиливается для фиксации замка кулака
          const oppVal = hasPhalanges ? Math.max(0.0, abd) : generalCurl;
          const fistBonus = generalCurl > 0.65 ? (generalCurl - 0.65) * 0.40 : 0.0;
          rotVec = new THREE.Vector3(
            -0.35 * flexVal,
            0.0,
            (0.80 * oppVal + fistBonus) * zSign
          );
        } else if (ph === 2) {
          // MCP: плотное прижатие большого пальца к фалангам указательного
          rotVec = new THREE.Vector3(-0.80 * flexVal, 0.0, 0.35 * generalCurl * zSign);
        } else {
          // IP: дистальное замыкание кулака
          rotVec = new THREE.Vector3(-0.95 * flexVal, 0.0, 0.15 * zSign);
        }

        const len = rotVec.length();
        if (len > 1e-4) {
          const flexQ = new THREE.Quaternion().setFromAxisAngle(rotVec.clone().normalize(), len);
          const qTarget = bone.restLocalQ.clone().multiply(flexQ);
          bone.quaternion.slerp(qTarget, alpha);
        } else {
          bone.quaternion.slerp(bone.restLocalQ, alpha);
        }
      } else {
        // 4 пальца: независимое фаланговое сгибание вокруг локальной оси -X
        const flexAng = phalanges[ph - 1];
        const flexQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(-1, 0, 0), flexAng);

        if (ph === 1) {
          // MCP: разведение пальцев в плоскости ладони (abduction) вокруг локальной оси +Z
          const sideSign = isLeft ? 1.0 : -1.0;
          let abdDir = 0.0;
          if (ftype === 'Index') abdDir = 1.0 * sideSign;
          else if (ftype === 'Pinky') abdDir = -1.2 * sideSign;
          else if (ftype === 'Ring') abdDir = -0.4 * sideSign;

          // В плотном кулаке разведение пальцев сводится к нулю анатомическим контактом
          const fistCompression = Math.max(0.0, 1.0 - generalCurl * 0.90);
          const abdAng = abd * abdDir * 0.45 * fistCompression;

          const abdQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), abdAng);
          const qTarget = bone.restLocalQ.clone().multiply(abdQ).multiply(flexQ);
          bone.quaternion.slerp(qTarget, alpha);
        } else {
          // PIP и DIP: прямое сгибание фаланги
          const qTarget = bone.restLocalQ.clone().multiply(flexQ);
          bone.quaternion.slerp(qTarget, alpha);
        }
      }
    }
  });
}
