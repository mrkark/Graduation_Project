/**
 * Вспомогательные математические и кинематические утилиты для Ката Шотокан (Kata Motion Utils).
 * Вычисление ориентаций, нормализация углов, парсинг структурированных данных и расчет траекторий эмбусэна.
 */

export const ALL_KATA_SLUGS = [
  'heian_shodan', 'heian_nidan', 'heian_sandan', 'heian_yondan', 'heian_godan',
  'tekki_shodan', 'tekki_nidan', 'tekki_sandan',
  'bassai_dai', 'bassai_sho', 'kanku_dai', 'kanku_sho',
  'jion', 'jiin', 'jitte', 'empi', 'hangetsu', 'gankaku',
  'sochin', 'nijushiho', 'meikyo', 'unsu', 'wankan',
  'gojushiho_dai', 'gojushiho_sho', 'chinte'
];

export function resolveKataSlug(title = '') {
  const t = title.toLowerCase().trim();
  if (ALL_KATA_SLUGS.includes(t)) return t;
  if (t.includes('шодан') || t.includes('shodan')) {
    if (t.includes('тэкки') || t.includes('tekki')) return 'tekki_shodan';
    return 'heian_shodan';
  }
  if (t.includes('нидан') || t.includes('nidan')) {
    if (t.includes('тэкки') || t.includes('tekki')) return 'tekki_nidan';
    return 'heian_nidan';
  }
  if (t.includes('сандан') || t.includes('sandan')) {
    if (t.includes('тэкки') || t.includes('tekki')) return 'tekki_sandan';
    return 'heian_sandan';
  }
  if (t.includes('ёндан') || t.includes('yondan')) return 'heian_yondan';
  if (t.includes('годан') || t.includes('godan')) return 'heian_godan';
  if (t.includes('бассай дай') || t.includes('bassai dai') || t.includes('bassai_dai')) return 'bassai_dai';
  if (t.includes('бассай шо') || t.includes('bassai sho') || t.includes('bassai_sho')) return 'bassai_sho';
  if (t.includes('канку дай') || t.includes('kanku dai') || t.includes('kanku_dai')) return 'kanku_dai';
  if (t.includes('канку шо') || t.includes('kanku sho') || t.includes('kanku_sho')) return 'kanku_sho';
  if (t.includes('дзиин') || t.includes("дзи'ин") || t.includes('jiin') || t.includes("ji'in")) return 'jiin';
  if (t.includes('дзион') || t.includes('jion')) return 'jion';
  if (t.includes('джиттэ') || t.includes('jitte')) return 'jitte';
  if (t.includes('эмпи') || t.includes('empi')) return 'empi';
  if (t.includes('хангэцу') || t.includes('hangetsu')) return 'hangetsu';
  if (t.includes('ганкаку') || t.includes('gankaku')) return 'gankaku';
  if (t.includes('сочин') || t.includes('sochin')) return 'sochin';
  if (t.includes('нидзюсихо') || t.includes('nijushiho')) return 'nijushiho';
  if (t.includes('мэйкё') || t.includes('meikyo')) return 'meikyo';
  if (t.includes('унсу') || t.includes('unsu')) return 'unsu';
  if (t.includes('ванкан') || t.includes('wankan')) return 'wankan';
  if (t.includes('годзюсихо дай') || t.includes('gojushiho dai') || t.includes('gojushiho_dai')) return 'gojushiho_dai';
  if (t.includes('годзюсихо шо') || t.includes('gojushiho sho') || t.includes('gojushiho_sho')) return 'gojushiho_sho';
  if (t.includes('чинтэ') || t.includes('chinte')) return 'chinte';
  return 'heian_shodan';
}

// Канонические координаты эмбусэна 5 Ката Хэйан (извлеченные из Root Motion анимаций)
// Каждое ката начинается и заканчивается в исходной стойке готовности Йой на позиции [0, 0, 0]
export const CANONICAL_EMBUSEN = {
  heian_shodan: [
    [0.0, 0.02, 0.0],    // Шаг 0: стойка готовности Йой (Сидзэнтай)
    [0.23, 0.02, -0.06], // Шаг 1: поворот влево 90°, гэдан-барай
    [1.13, 0.02, -0.06], // Шаг 2: ой-цуки
    [0.33, 0.02, -0.34], // Шаг 3: разворот вправо 180°, гэдан-барай
    [-0.12, 0.02, -0.34], // Шаг 4: тэтцуи-учи в Мото-дати (ровно половина длины дзэнкуцу-дати, 0.45м)
    [-1.02, 0.02, -0.34], // Шаг 5: ой-цуки в Дзэнкуцу-дати (полный шаг вперед 0.90м)
    [0.42, 0.02, -0.08], // Шаг 6: поворот влево 90° на центральную ось, гэдан-барай
    [0.42, 0.02, 0.82],  // Шаг 7: агэ-укэ (1-й)
    [0.42, 0.02, 1.72],  // Шаг 8: агэ-укэ (2-й)
    [0.40, 0.02, 2.64],  // Шаг 9: агэ-укэ (3-й, КИАЙ)
    [-0.12, 0.02, 3.26], // Шаг 10: разворот через спину влево 270°, гэдан-барай
    [-1.01, 0.02, 3.26], // Шаг 11: ой-цуки
    [-0.22, 0.02, 3.54], // Шаг 12: разворот вправо 180°, гэдан-барай
    [0.68, 0.02, 3.54],  // Шаг 13: ой-цуки
    [0.14, 0.02, 3.28],  // Шаг 14: поворот влево 90° по центральной оси назад
    [0.14, 0.02, 2.38],  // Шаг 15: ой-цуки
    [0.14, 0.02, 1.48],  // Шаг 16: ой-цуки
    [0.14, 0.02, 0.58],  // Шаг 17: ой-цуки (КИАЙ)
    [0.54, 0.02, 0.16],  // Шаг 18: разворот на 90° влево в стойку Кокуцу-дати (сюто-укэ, фланг влево Запад)
    [0.98, 0.02, 0.60],  // Шаг 19: шаг под 45° в Кокуцу-дати (сюто-укэ, диагональ влево Северо-Запад)
    [-0.54, 0.02, 0.16], // Шаг 20: разворот через спину на 135° (сюто-укэ, фланг вправо Восток)
    [-0.98, 0.02, 0.60], // Шаг 21: шаг под 45° в Кокуцу-дати (сюто-укэ, диагональ вправо Северо-Восток)
    [0.0, 0.02, 0.0],    // Шаг 22: возвращение в стойку Йой (Сидзэнтай)
  ],
  heian_nidan: [
    [0.0, 0.02, 0.0],
    [0.11, 0.02, -0.03], [0.14, 0.02, -0.04], [0.14, 0.02, -0.04], [0.41, 0.02, -0.2], [0.5, 0.02, -0.25],
    [0.5, 0.02, -0.25], [0.61, 0.02, -0.11], [0.6, 0.02, -0.56], [0.57, 0.02, -0.11], [0.59, 0.02, 0.64],
    [0.55, 0.02, 1.63], [0.29, 0.02, 2.23], [-0.26, 0.02, 2.27], [-0.25, 0.02, 2.27], [-0.32, 0.02, 1.81],
    [-0.27, 0.02, 1.37], [-0.3, 0.02, 0.85], [-0.27, 0.02, 0.49], [-0.26, 0.02, 0.43], [-0.23, 0.02, -0.05],
    [-0.26, 0.02, -0.42], [-0.26, 0.02, -1.24], [-0.49, 0.02, -1.69], [-1.1, 0.02, -1.94], [-1.17, 0.02, -1.36],
    [-1.16, 0.02, -0.41],
    [0.0, 0.02, 0.0],
  ],
  heian_sandan: [
    [0.0, 0.02, 0.0],
    [0.11, 0.02, -0.03], [0.53, 0.02, -0.07], [0.61, 0.02, -0.08], [0.52, 0.02, -0.21], [0.09, 0.02, -0.28],
    [0.03, 0.02, -0.29], [0.06, 0.02, -0.18], [0.02, 0.02, 0.67], [-0.36, 0.02, 1.26], [-0.64, 0.02, 0.97],
    [-0.51, 0.02, 0.44], [-0.59, 0.02, 0.09], [-0.61, 0.02, 0.06], [-0.47, 0.02, 0.6], [-0.44, 0.02, 0.74],
    [-0.57, 0.02, 0.2], [-0.61, 0.02, 0.06], [-0.61, 0.02, 0.06], [-0.2, 0.02, 0.23], [-0.38, 0.02, 0.64],
    [-0.44, 0.02, 0.74],
    [0.0, 0.02, 0.0],
  ],
  heian_yondan: [
    [0.0, 0.02, 0.0],
    [0.11, 0.02, -0.03], [0.41, 0.02, -0.2], [0.14, 0.02, 0.01], [0.1, 0.02, 0.61], [-0.01, 0.02, 1.37],
    [0.35, 0.02, 1.19], [0.93, 0.02, 1.09], [0.57, 0.02, 0.91], [0.2, 0.02, 1.1], [0.19, 0.02, 1.61],
    [0.16, 0.02, 1.99], [0.19, 0.02, 2.34], [0.73, 0.02, 2.43], [1.09, 0.02, 2.46], [1.15, 0.02, 2.47],
    [1.45, 0.02, 2.43], [1.55, 0.02, 2.64], [1.52, 0.02, 2.27], [1.51, 0.02, 2.21], [1.37, 0.02, 1.64],
    [0.91, 0.02, 1.1], [0.39, 0.02, 0.56], [-0.1, 0.02, 0.08], [-0.3, 0.02, -0.33], [-0.38, 0.02, -0.47],
    [0.0, 0.02, 0.0],
  ],
  heian_godan: [
    [0.0, 0.02, 0.0],
    [0.11, 0.02, -0.03], [0.14, 0.02, -0.04], [-0.1, 0.02, 0.02], [-0.22, 0.02, -0.11], [-0.25, 0.02, -0.15],
    [-0.01, 0.02, -0.09], [-0.14, 0.02, 0.11], [-0.13, 0.02, 0.99], [-0.13, 0.02, 1.11], [-0.13, 0.02, 1.9],
    [-0.13, 0.02, 2.78], [-0.51, 0.02, 2.66], [-0.84, 0.02, 2.53], [-0.63, 0.02, 2.59], [-0.28, 0.02, 2.7],
    [-0.01, 0.02, 2.86], [-0.05, 0.02, 3.45], [0.17, 0.02, 4.02], [0.31, 0.02, 4.24], [0.5, 0.02, 4.28],
    [0.41, 0.02, 4.46], [0.21, 0.02, 4.49],
    [0.0, 0.02, 0.0],
  ],
};

// Канонические метаданные всех шагов Heian Shodan (включая стойку Йой на старте и финише формы)
export const HEIAN_SHODAN_CANONICAL_EVENTS = [
  { moveNumber: 0, isYoi: true, startTime: 0.00, endTime: 1.30, form: 'ready', facingDeg: 0.0, R: null, note: 'Стойка готовности Йой (Сидзэнтай) — начало формы' },
  { moveNumber: 1, startTime: 1.30, endTime: 2.48, form: 'zenkutsu', facingDeg: 90.0, R: 'R_p90' },
  { moveNumber: 2, startTime: 2.48, endTime: 3.65, form: 'zenkutsu', facingDeg: 90.0, R: null },
  { moveNumber: 3, startTime: 3.65, endTime: 5.28, form: 'zenkutsu', facingDeg: -90.0, R: 'R_m180' },
  { moveNumber: 4, startTime: 5.28, endTime: 6.23, form: 'moto', stance: 'moto', facingDeg: -90.0, R: null, note: 'Тэтцуи-учи в Мото-дати (подтягивание передней стопы)' },
  { moveNumber: 5, startTime: 6.23, endTime: 7.40, form: 'zenkutsu', facingDeg: -90.0, R: null },
  { moveNumber: 6, startTime: 7.40, endTime: 8.65, form: 'zenkutsu', facingDeg: 0.0, R: 'R_p90' },
  { moveNumber: 7, startTime: 8.65, endTime: 9.83, form: 'zenkutsu', facingDeg: 0.0, R: null },
  { moveNumber: 8, startTime: 9.83, endTime: 11.02, form: 'zenkutsu', facingDeg: 0.0, R: null },
  { moveNumber: 9, startTime: 11.02, endTime: 12.53, form: 'zenkutsu', facingDeg: 0.0, R: null, kiai: true },
  { moveNumber: 10, startTime: 12.53, endTime: 13.73, form: 'zenkutsu', facingDeg: -90.0, R: 'R_p270' },
  { moveNumber: 11, startTime: 13.73, endTime: 14.92, form: 'zenkutsu', facingDeg: -90.0, R: null },
  { moveNumber: 12, startTime: 14.92, endTime: 16.25, form: 'zenkutsu', facingDeg: 90.0, R: 'R_m180' },
  { moveNumber: 13, startTime: 16.25, endTime: 17.42, form: 'zenkutsu', facingDeg: 90.0, R: null },
  { moveNumber: 14, startTime: 17.42, endTime: 18.65, form: 'zenkutsu', facingDeg: 180.0, R: 'R_p90' },
  { moveNumber: 15, startTime: 18.65, endTime: 19.75, form: 'zenkutsu', facingDeg: 180.0, R: null },
  { moveNumber: 16, startTime: 19.75, endTime: 20.85, form: 'zenkutsu', facingDeg: 180.0, R: null },
  { moveNumber: 17, startTime: 20.85, endTime: 21.94, form: 'zenkutsu', facingDeg: 180.0, R: null, kiai: true },
  { moveNumber: 18, startTime: 21.94, endTime: 23.50, form: 'kokutsu', facingDeg: 90.0, R: 'R_p270', note: 'Разворот на 270° через спину влево в стойку Кокуцу-дати (Сюто-укэ, фланг влево Запад / +90°, в ту же сторону, что и шаг 1)' },
  { moveNumber: 19, startTime: 23.50, endTime: 24.81, form: 'kokutsu', facingDeg: 45.0, R: 'R_m45', note: 'Шаг под 45° вперед-влево в Кокуцу-дати (Диагональ влево Северо-Запад / +45°)' },
  { moveNumber: 20, startTime: 24.81, endTime: 26.32, form: 'kokutsu', facingDeg: -90.0, R: 'R_m135', note: 'Разворот через спину на 135° на противоположный фланг (Фланг вправо Восток / -90°)' },
  { moveNumber: 21, startTime: 26.32, endTime: 27.63, form: 'kokutsu', facingDeg: -45.0, R: 'R_p45', note: 'Шаг под 45° вперед-вправо в Кокуцу-дати (Диагональ вправо Северо-Восток / -45°)' },
  { moveNumber: 22, isYoi: true, startTime: 27.63, endTime: 29.53, form: 'ready', facingDeg: 0.0, R: null, note: 'Возвращение в стойку Йой (Сидзэнтай) — завершение формы' },
];

/**
 * Нормализует угол в градусах к каноническому диапазону (-180, 180]
 */
export function normalizeAngleDeg(deg) {
  let angle = deg % 360;
  if (angle > 180) angle -= 360;
  if (angle <= -180) angle += 360;
  return angle;
}

/**
 * Парсер ориентации и направления шага ката.
 * Приоритет:
 * 1. Структурированное поле facingDeg (или targetFacingDeg)
 * 2. Структурированный код поворота R (R_p90, R_m180, R_p270, R_m45, R_p45)
 * 3. Root_Rotation_Yaw
 * 4. Семантический разбор текстового поля Direction
 */
export function parseStepOrientation(step, prevFacingDeg = 0) {
  if (!step) {
    return {
      targetFacingDeg: prevFacingDeg,
      deltaYawDeg: 0,
      targetFacingRad: (prevFacingDeg * Math.PI) / 180,
    };
  }

  // 1. Явные структурированные поля
  if (typeof step.facingDeg === 'number' && !isNaN(step.facingDeg)) {
    const targetDeg = normalizeAngleDeg(step.facingDeg);
    return {
      targetFacingDeg: targetDeg,
      deltaYawDeg: normalizeAngleDeg(targetDeg - prevFacingDeg),
      targetFacingRad: (targetDeg * Math.PI) / 180,
    };
  }
  if (typeof step.targetFacingDeg === 'number' && !isNaN(step.targetFacingDeg)) {
    const targetDeg = normalizeAngleDeg(step.targetFacingDeg);
    return {
      targetFacingDeg: targetDeg,
      deltaYawDeg: normalizeAngleDeg(targetDeg - prevFacingDeg),
      targetFacingRad: (targetDeg * Math.PI) / 180,
    };
  }
  if (typeof step.Root_Rotation_Y === 'number' && !isNaN(step.Root_Rotation_Y)) {
    const targetDeg = normalizeAngleDeg(step.Root_Rotation_Y);
    return {
      targetFacingDeg: targetDeg,
      deltaYawDeg: normalizeAngleDeg(targetDeg - prevFacingDeg),
      targetFacingRad: (targetDeg * Math.PI) / 180,
    };
  }
  if (typeof step.rootRotationY === 'number' && !isNaN(step.rootRotationY)) {
    const targetDeg = normalizeAngleDeg(step.rootRotationY);
    return {
      targetFacingDeg: targetDeg,
      deltaYawDeg: normalizeAngleDeg(targetDeg - prevFacingDeg),
      targetFacingRad: (targetDeg * Math.PI) / 180,
    };
  }

  // 2. Структурированный код поворота R (R_p90, R_m180, R_p270, etc.)
  if (step.R && typeof step.R === 'string') {
    const rMatch = step.R.match(/^R_([pm])(\d+)$/);
    if (rMatch) {
      const sign = rMatch[1] === 'p' ? 1 : -1;
      const angle = parseFloat(rMatch[2]);
      const deltaYaw = normalizeAngleDeg(sign * angle);
      const targetDeg = normalizeAngleDeg(prevFacingDeg + deltaYaw);
      return {
        targetFacingDeg: targetDeg,
        deltaYawDeg: deltaYaw,
        targetFacingRad: (targetDeg * Math.PI) / 180,
      };
    }
  }

  // 3. Root_Rotation_Yaw
  if (typeof step.Root_Rotation_Yaw === 'number' && step.Root_Rotation_Yaw !== 0) {
    const deltaYaw = normalizeAngleDeg(step.Root_Rotation_Yaw);
    const targetDeg = normalizeAngleDeg(prevFacingDeg + deltaYaw);
    return {
      targetFacingDeg: targetDeg,
      deltaYawDeg: deltaYaw,
      targetFacingRad: (targetDeg * Math.PI) / 180,
    };
  }

  // 4. Семантический разбор текстового поля Direction
  const dir = (step.Direction || step.direction || '').toLowerCase().trim();
  if (!dir) {
    return {
      targetFacingDeg: prevFacingDeg,
      deltaYawDeg: 0,
      targetFacingRad: (prevFacingDeg * Math.PI) / 180,
    };
  }

  // Абсолютные стороны света в канонической системе эмбусэн:
  // Север = 0° (вперед), Восток = -90° (вправо), Запад = 90° (влево), Юг = 180° (назад)
  if (dir.includes('(север)') || (dir.includes('север') && !dir.includes('северо-'))) {
    const targetDeg = 0;
    return {
      targetFacingDeg: targetDeg,
      deltaYawDeg: normalizeAngleDeg(targetDeg - prevFacingDeg),
      targetFacingRad: 0,
    };
  }
  if (dir.includes('(восток)') || (dir.includes('восток') && !dir.includes('северо-') && !dir.includes('юго-'))) {
    const targetDeg = -90;
    return {
      targetFacingDeg: targetDeg,
      deltaYawDeg: normalizeAngleDeg(targetDeg - prevFacingDeg),
      targetFacingRad: (-90 * Math.PI) / 180,
    };
  }
  if (dir.includes('(запад)') || (dir.includes('запад') && !dir.includes('северо-') && !dir.includes('юго-'))) {
    // 270° влево через спину из 0° дает Восток (-90°)
    if (dir.includes('270')) {
      const targetDeg = -90;
      return {
        targetFacingDeg: targetDeg,
        deltaYawDeg: normalizeAngleDeg(targetDeg - prevFacingDeg),
        targetFacingRad: (-90 * Math.PI) / 180,
      };
    }
    const targetDeg = 90;
    return {
      targetFacingDeg: targetDeg,
      deltaYawDeg: normalizeAngleDeg(targetDeg - prevFacingDeg),
      targetFacingRad: (90 * Math.PI) / 180,
    };
  }
  if (dir.includes('(юг)') || (dir.includes('юг') && !dir.includes('юго-'))) {
    const targetDeg = 180;
    return {
      targetFacingDeg: targetDeg,
      deltaYawDeg: normalizeAngleDeg(targetDeg - prevFacingDeg),
      targetFacingRad: Math.PI,
    };
  }
  if (dir.includes('северо-восток')) {
    const targetDeg = -135;
    return {
      targetFacingDeg: targetDeg,
      deltaYawDeg: normalizeAngleDeg(targetDeg - prevFacingDeg),
      targetFacingRad: (-135 * Math.PI) / 180,
    };
  }
  if (dir.includes('северо-запад')) {
    const targetDeg = 135;
    return {
      targetFacingDeg: targetDeg,
      deltaYawDeg: normalizeAngleDeg(targetDeg - prevFacingDeg),
      targetFacingRad: (135 * Math.PI) / 180,
    };
  }

  // Относительный разбор: сначала проверяем вправо и влево строго с учетом градусов
  const isRight = dir.includes('вправо') || dir.includes('right');
  const isLeft = dir.includes('влево') || dir.includes('left');

  const degMatch = dir.match(/(\d+)\s*°/);
  const explicitAngle = degMatch ? parseFloat(degMatch[1]) : null;

  let deltaYaw = 0;
  if (isRight) {
    deltaYaw = -(explicitAngle || 90);
  } else if (isLeft) {
    deltaYaw = (explicitAngle || 90);
  } else if (dir.includes('180') || dir.includes('разворот')) {
    deltaYaw = 180;
  } else if (dir.includes('вперед') || dir.includes('forward') || dir.includes('на месте') || dir.includes('0°')) {
    deltaYaw = 0;
  }

  const targetDeg = normalizeAngleDeg(prevFacingDeg + deltaYaw);
  return {
    targetFacingDeg: targetDeg,
    deltaYawDeg: deltaYaw,
    targetFacingRad: (targetDeg * Math.PI) / 180,
  };
}

/**
 * Вычисляет траекторию шагов и ориентации эмбусэна с учетом кинематики движения.
 */
export function computeTrajectory(steps = [], kataSlug = '') {
  // Если есть канонические координаты (например для Ката Хэйан)
  if (CANONICAL_EMBUSEN[kataSlug]) {
    let pts = CANONICAL_EMBUSEN[kataSlug];
    // Адаптация: если передан массив без шагов Йой (21 техника) при 23 канонических точках
    if (steps.length > 0 && steps.length === pts.length - 2 && pts.length >= 3) {
      pts = pts.slice(1, -1);
    } else if (steps.length > 0 && steps.length === pts.length + 2) {
      pts = [[0.0, 0.02, 0.0], ...pts, [0.0, 0.02, 0.0]];
    }
    let prevYaw = 0;
    const positions = pts.map((p, idx) => {
      const step = steps[idx] || {};
      const rot = parseStepOrientation(step, prevYaw);
      prevYaw = rot.targetFacingDeg;
      return {
        position: [p[0], 0, p[2]],
        rotation: [0, rot.targetFacingRad, 0],
        facingDeg: rot.targetFacingDeg,
        deltaYawDeg: rot.deltaYawDeg,
      };
    });
    return { stepPositions: positions, embusenPoints: pts };
  }

  // Расчет траектории шагов на базе кинематики
  let curX = 0;
  let curZ = 0;
  let curFacingDeg = 0;
  const positions = [];
  const points = [[0, 0.02, 0]];

  steps.forEach((s) => {
    const rot = parseStepOrientation(s, curFacingDeg);
    curFacingDeg = rot.targetFacingDeg;

    let stepDx = s.Root_Displacement_X;
    let stepDz = s.Root_Displacement_Z;

    if (stepDx === undefined || stepDz === undefined) {
      const dirText = (s.Direction || s.direction || '').toLowerCase();
      if (dirText.includes('на месте') || dirText.includes('баланс') || dirText.includes('стойка')) {
        stepDx = 0;
        stepDz = 0;
      } else if (dirText.includes('назад')) {
        const stride = 0.85;
        stepDx = -stride * Math.sin(rot.targetFacingRad);
        stepDz = -stride * Math.cos(rot.targetFacingRad);
      } else {
        const stride = 0.85;
        stepDx = stride * Math.sin(rot.targetFacingRad);
        stepDz = stride * Math.cos(rot.targetFacingRad);
      }
    }

    curX += stepDx;
    curZ += stepDz;

    positions.push({
      position: [curX, 0, curZ],
      rotation: [0, rot.targetFacingRad, 0],
      facingDeg: rot.targetFacingDeg,
      deltaYawDeg: rot.deltaYawDeg,
    });

    points.push([curX, 0.02, curZ]);
  });

  return { stepPositions: positions, embusenPoints: points };
}
