/**
 * Единый движок сценариев Бункая Шотокан (Bunkai Scenario Engine v5).
 * 
 * Назначение:
 * 1. Расширение единой библиотеки анимаций каратэ Шотокан (karateka_techniques_v4.glb, 213 клипов)
 *    на парные (дуэль) и тройные (командный бункай) боевые сценарии.
 * 2. Расчет пространственного взаимного расположения участников (Тори, Укэ 1, Укэ 2)
 *    с учетом боевой дистанции (Ма-ай), угла атаки и капсульного анти-проникновения (min 0.54м).
 * 3. Расчет взаимных углов ориентации (Yaw): атакующие смотрят на Тори, Тори смотрит на активного
 *    атакующего с возможностью поворота ко второму противнику.
 * 4. Синхронизация времени: задержка вступления в бой (delaySeconds), окно контакта (tContact),
 *    доводка конечностей через 2-Bone IK, пошаговый просмотр и непрерывное воспроизведение.
 * 5. Сохранение состояния (позиций, стоек и углов) между последовательными эпизодами бункая.
 * 6. Полная совместимость со всеми форматами данных (API БД, PascalCase, camelCase).
 */

import * as THREE from 'three';
import { normalizeAngleDeg } from './kataMotionUtils.js';
import { TECHNIQUE_REGISTRY } from './kataCompositionEngine.js';
import { resolveAvatarCollision, resolveThreeAvatarsCollision, AVATAR_CAPSULE } from './collisionAvoidance.js';

/**
 * Расширенный реестр техник для боевого применения (Бункай)
 * Содержит оптимальные боевые дистанции (Ма-ай), окна контакта и совместимые стойки.
 */
export const BUNKAI_TECHNIQUE_METADATA = {
  // --- ПРЯМЫЕ УДАРЫ (ЦУКИ) ---
  oi_zuki_right: {
    clipName: 'oi_zuki_right',
    altClips: ['tech_oi_zuki_right', 'oi_zuki'],
    titleRu: 'Ой-цуки (Прямой выпад кулаком вперед)',
    role: 'uke',
    type: 'punch',
    optimalDistance: 1.45,
    tolerance: 0.35,
    tContact: 0.50,
    contactWindow: 0.25,
    defaultDuration: 1.25,
    stanceIn: 'zenkutsu',
    stanceOut: 'zenkutsu',
    stepForwardDist: 0.70,
  },
  oi_zuki_left: {
    clipName: 'oi_zuki_left',
    altClips: ['tech_oi_zuki_left', 'oi_zuki'],
    titleRu: 'Ой-цуки (Выпад левой рукой)',
    role: 'uke',
    type: 'punch',
    optimalDistance: 1.45,
    tolerance: 0.35,
    tContact: 0.50,
    contactWindow: 0.25,
    defaultDuration: 1.25,
    stanceIn: 'zenkutsu',
    stanceOut: 'zenkutsu',
    stepForwardDist: 0.70,
  },
  gyaku_zuki_right: {
    clipName: 'gyaku_zuki_right',
    altClips: ['tech_gyaku_zuki_right', 'gyaku_zuki'],
    titleRu: 'Гяку-цуки (Реверсивный контрудар кулаком)',
    role: 'tori',
    type: 'punch',
    optimalDistance: 1.15,
    tolerance: 0.30,
    tContact: 0.42,
    contactWindow: 0.20,
    defaultDuration: 1.00,
    stanceIn: 'zenkutsu',
    stanceOut: 'zenkutsu',
    stepForwardDist: 0.15,
  },
  gyaku_zuki_left: {
    clipName: 'gyaku_zuki_left',
    altClips: ['tech_gyaku_zuki_left', 'gyaku_zuki'],
    titleRu: 'Гяку-цуки (Реверсивный удар левой)',
    role: 'tori',
    type: 'punch',
    optimalDistance: 1.15,
    tolerance: 0.30,
    tContact: 0.42,
    contactWindow: 0.20,
    defaultDuration: 1.00,
    stanceIn: 'zenkutsu',
    stanceOut: 'zenkutsu',
    stepForwardDist: 0.15,
  },
  choku_zuki: {
    clipName: 'choku_zuki',
    altClips: ['chudan_zuki_right'],
    titleRu: 'Тюдан-цуки (Прямой удар из стойки)',
    role: 'uke',
    type: 'punch',
    optimalDistance: 1.10,
    tolerance: 0.25,
    tContact: 0.45,
    contactWindow: 0.20,
    defaultDuration: 1.00,
    stanceIn: 'heiko',
    stanceOut: 'heiko',
    stepForwardDist: 0.0,
  },

  // --- ЗАЩИТНЫЕ БЛОКИ (УКЭ) ---
  shuto_uke: {
    clipName: 'shuto_uke',
    altClips: ['tech_shuto_uke_left', 'tech_shuto_uke_right'],
    titleRu: 'Сюто-укэ (Блок ребром ладони в Кокуцу-дати)',
    role: 'tori',
    type: 'block',
    optimalDistance: 1.45,
    tolerance: 0.35,
    tContact: 0.45,
    contactWindow: 0.25,
    defaultDuration: 1.30,
    stanceIn: 'zenkutsu',
    stanceOut: 'kokutsu',
    stepForwardDist: -0.45, // уход назад
  },
  age_uke_left: {
    clipName: 'age_uke_left',
    altClips: ['tech_age_uke_left', 'age_uke'],
    titleRu: 'Агэ-укэ (Восходящий верхний блок)',
    role: 'tori',
    type: 'block',
    optimalDistance: 1.15,
    tolerance: 0.30,
    tContact: 0.40,
    contactWindow: 0.25,
    defaultDuration: 1.20,
    stanceIn: 'zenkutsu',
    stanceOut: 'zenkutsu',
    stepForwardDist: -0.20,
  },
  gedan_barai_left: {
    clipName: 'gedan_barai_left',
    altClips: ['tech_gedan_barai_left', 'gedan_barai'],
    titleRu: 'Гэдан-барай (Нижний сметающий сбив)',
    role: 'tori',
    type: 'block',
    optimalDistance: 1.35,
    tolerance: 0.35,
    tContact: 0.48,
    contactWindow: 0.25,
    defaultDuration: 1.25,
    stanceIn: 'zenkutsu',
    stanceOut: 'zenkutsu',
    stepForwardDist: -0.30,
  },
  soto_uke: {
    clipName: 'soto_uke',
    altClips: ['tech_soto_uke_left', 'tech_soto_uke_right'],
    titleRu: 'Сото-укэ (Блок предплечьем снаружи-внутрь)',
    role: 'tori',
    type: 'block',
    optimalDistance: 1.20,
    tolerance: 0.30,
    tContact: 0.44,
    contactWindow: 0.25,
    defaultDuration: 1.20,
    stanceIn: 'zenkutsu',
    stanceOut: 'zenkutsu',
    stepForwardDist: -0.25,
  },
  uchi_uke: {
    clipName: 'uchi_uke',
    altClips: ['tech_uchi_uke_left', 'tech_uchi_uke_right'],
    titleRu: 'Ути-укэ (Блок предплечьем изнутри-наружу)',
    role: 'tori',
    type: 'block',
    optimalDistance: 1.20,
    tolerance: 0.30,
    tContact: 0.44,
    contactWindow: 0.25,
    defaultDuration: 1.20,
    stanceIn: 'zenkutsu',
    stanceOut: 'zenkutsu',
    stepForwardDist: -0.20,
  },

  // --- УДАРЫ РУКАМИ И ЛОКТЯМИ (УЧИ И ЭМПИ) ---
  empi_uchi: {
    clipName: 'empi_uchi',
    altClips: ['tech_mae_empi_right', 'tech_age_empi_right'],
    titleRu: 'Эмпи-учи (Сокрушительный удар локтем)',
    role: 'tori',
    type: 'strike',
    optimalDistance: 0.75, // ближний бой
    tolerance: 0.20,
    tContact: 0.42,
    contactWindow: 0.20,
    defaultDuration: 1.05,
    stanceIn: 'zenkutsu',
    stanceOut: 'zenkutsu',
    stepForwardDist: 0.40, // глубокий вход
  },
  tetsui_uchi: {
    clipName: 'tetsui_uchi',
    altClips: ['tech_tettsui_right', 'tech_tettsui_left'],
    titleRu: 'Тэтцуи-учи (Удар молотом кулака)',
    role: 'tori',
    type: 'strike',
    optimalDistance: 0.95,
    tolerance: 0.25,
    tContact: 0.45,
    contactWindow: 0.22,
    defaultDuration: 1.10,
    stanceIn: 'kiba',
    stanceOut: 'kiba',
    stepForwardDist: 0.20,
  },
  uraken_uchi: {
    clipName: 'uraken_uchi',
    altClips: ['tech_uraken_right', 'tech_uraken_left'],
    titleRu: 'Уракэн-учи (Хлесткий удар тыльной стороной кулака)',
    role: 'tori',
    type: 'strike',
    optimalDistance: 1.05,
    tolerance: 0.25,
    tContact: 0.38,
    contactWindow: 0.20,
    defaultDuration: 0.95,
    stanceIn: 'zenkutsu',
    stanceOut: 'zenkutsu',
    stepForwardDist: 0.10,
  },

  // --- УДАРЫ НОГАМИ (ГЭРИ) ---
  mae_geri_right: {
    clipName: 'mae_geri_right',
    altClips: ['kick_mae_geri_right', 'mae_geri'],
    titleRu: 'Маэ-гэри (Прямой хлесткий удар ногой)',
    role: 'uke',
    type: 'kick',
    optimalDistance: 1.65, // дистанция удара ногой
    tolerance: 0.35,
    tContact: 0.50,
    contactWindow: 0.28,
    defaultDuration: 1.35,
    stanceIn: 'zenkutsu',
    stanceOut: 'zenkutsu',
    stepForwardDist: 0.55,
  },
  mawashi_geri_right: {
    clipName: 'mawashi_geri_right',
    altClips: ['kick_mawashi_right', 'mawashi_geri'],
    titleRu: 'Маваси-гэри (Круговой удар ногой)',
    role: 'uke',
    type: 'kick',
    optimalDistance: 1.70,
    tolerance: 0.35,
    tContact: 0.52,
    contactWindow: 0.28,
    defaultDuration: 1.40,
    stanceIn: 'zenkutsu',
    stanceOut: 'zenkutsu',
    stepForwardDist: 0.50,
  },

  // --- СТОЙКИ И ПЕРЕМЕЩЕНИЯ ---
  idle_shizentai: {
    clipName: 'idle_shizentai',
    altClips: ['stance_ready'],
    titleRu: 'Сидзэнтай (Естественная позиция готовности)',
    role: 'both',
    type: 'stance',
    optimalDistance: 2.10,
    tolerance: 0.50,
    tContact: 0.50,
    contactWindow: 0.0,
    defaultDuration: 1.00,
    stanceIn: 'ready',
    stanceOut: 'ready',
    stepForwardDist: 0.0,
  },
};

/**
 * Канонические сценарии Бункая Шотокан (по умолчанию, для 2 и 3 участников)
 */
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
    activeAttacker: 'sequential', // последовательная атака
    switchTime: 1.35,              // время разворота Тори к Укэ 2
    participants: [
      { role: 'tori', clipName: 'shuto_uke', stance: 'kokutsu', delaySeconds: 0.15 },
      { role: 'uke1', clipName: 'oi_zuki_right', stance: 'zenkutsu', delaySeconds: 0.0 },
      { role: 'uke2', clipName: 'mae_geri_right', stance: 'zenkutsu', delaySeconds: 1.35 },
    ],
  },
];

/**
 * Нормализует шаг бункая из любого источника (БД PascalCase, camelCase или канонический)
 */
export function normalizeBunkaiEpisode(raw, index = 0) {
  if (!raw) return CANONICAL_BUNKAI_EPISODES[0];

  const rawParticipants = raw.Participants || raw.participants || [];
  const toriPart = rawParticipants.find((p) => (p.Role || p.role) === 'tori') || {};
  const uke1Part = rawParticipants.find((p) => {
    const r = p.Role || p.role;
    return r === 'uke' || r === 'uke1';
  }) || {};
  const uke2Part = rawParticipants.find((p) => (p.Role || p.role) === 'uke2') || {};

  const optDist = Number(raw.Combat_Distance_Meters ?? raw.targetDistance ?? raw.optimalDistance ?? 1.45);
  const atkAngle = Number(raw.Attack_Angle_Degrees ?? raw.targetAngle ?? raw.attackAngleDeg ?? 0);
  const uke2Angle = Number(raw.uke2AngleDeg ?? (atkAngle + 65));

  const toriClip = toriPart.Clip_Name || toriPart.clipName || raw.Clip_Name || raw.clipName || 'shuto_uke';
  const uke1Clip = uke1Part.Clip_Name || uke1Part.clipName || 'oi_zuki_right';
  const uke2Clip = uke2Part.Clip_Name || uke2Part.clipName || 'idle_shizentai';

  const toriDelay = Number(toriPart.Delay_Seconds ?? toriPart.delaySeconds ?? 0.12);
  const uke1Delay = Number(uke1Part.Delay_Seconds ?? uke1Part.delaySeconds ?? 0.0);
  const uke2Delay = Number(uke2Part.Delay_Seconds ?? uke2Part.delaySeconds ?? (raw.switchTime ?? 1.35));

  return {
    stepNumber: raw.Step_Number ?? raw.stepNumber ?? (index + 1),
    title: raw.Title || raw.title || `Эпизод ${index + 1}`,
    description: raw.Description || raw.description || '',
    optimalDistance: isNaN(optDist) ? 1.45 : optDist,
    attackAngleDeg: isNaN(atkAngle) ? 0 : atkAngle,
    uke2AngleDeg: isNaN(uke2Angle) ? atkAngle + 65 : uke2Angle,
    interactionType: raw.Interaction_Type || raw.interactionType || 'local_contact',
    tContact: Number(raw.tContact || 0.45),
    activeAttacker: raw.activeAttacker || (rawParticipants.some((p) => (p.Role || p.role) === 'uke2' && (p.Clip_Name || p.clipName) !== 'idle_shizentai') ? 'sequential' : 'uke1'),
    switchTime: Number(raw.switchTime || 1.35),
    participants: [
      {
        role: 'tori',
        clipName: toriClip,
        stance: toriPart.Stance_In || toriPart.initialStance || toriPart.stance || 'kokutsu',
        delaySeconds: toriDelay,
      },
      {
        role: 'uke1',
        clipName: uke1Clip,
        stance: uke1Part.Stance_In || uke1Part.initialStance || uke1Part.stance || 'zenkutsu',
        delaySeconds: uke1Delay,
      },
      {
        role: 'uke2',
        clipName: uke2Clip,
        stance: uke2Part.Stance_In || uke2Part.initialStance || uke2Part.stance || 'ready',
        delaySeconds: uke2Delay,
      },
    ],
  };
}

/**
 * Разрешает клип из канонической библиотеки техник Shotokan
 */
export function resolveBunkaiClip(clipName) {
  if (!clipName) {
    return {
      clipName: 'idle_shizentai',
      title: 'Сидзэнтай (Готовность)',
      optimalDistance: 2.10,
      tContact: 0.50,
      duration: 1.0,
      isKnown: true,
    };
  }

  // 1. Поиск в метаданных Бункая
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

  // 2. Поиск по алиасам внутри метаданных Бункая
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

  // 3. Поиск в реестре Ката (TECHNIQUE_REGISTRY)
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

  // Неизвестный клип: сообщаем флаг isKnown = false (для баннера отсутствия)
  return {
    clipName,
    title: clipName,
    optimalDistance: 1.45,
    tContact: 0.45,
    duration: 1.20,
    isKnown: false,
  };
}

/**
 * Рассчитывает пространственные координаты участников и их ориентацию (Yaw)
 * с учетом боевой дистанции (Ма-ай), угла атаки и предотвращения пересечения тел.
 * 
 * @param {Object} params
 * @param {Object} params.episode - Данные эпизода
 * @param {number} [params.distanceOffset=0] - Смещение дистанции от пользователя
 * @param {number} [params.angleOffsetDeg=0] - Дополнительный угол атаки
 * @param {boolean} [params.showUke2=false] - Включен ли второй нападающий
 * @param {number[]} [params.baseToriPos=[0,0,0]] - Базовая позиция Тори (при сохранении состояния)
 * @param {string} [params.targetRole='uke1'] - Текущий противник, на которого смотрит Тори ('uke1' | 'uke2')
 * @returns {Object} { posTori, posUke1, posUke2, rotTori, rotUke1, rotUke2, finalDist, hasCollision }
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
  const baseDist = norm.optimalDistance + distanceOffset;

  // Безопасная минимальная дистанция ограничена капсулой торса (0.54м)
  const finalDist = Math.max(AVATAR_CAPSULE.minDistance, baseDist);

  // Угол фронтальной атаки Укэ 1
  const baseAngleDeg = normalizeAngleDeg(norm.attackAngleDeg + angleOffsetDeg);
  const baseAngleRad = (baseAngleDeg * Math.PI) / 180;

  // Тори находится в своей позиции на татами (по умолчанию центр [0, 0, 0])
  const [tx, ty, tz] = baseToriPos;
  const rawPosTori = [tx, ty, tz];

  // Укэ 1 нападает с направления baseAngleRad
  // В трехмерной системе каратэ +Z - вперед, +X - влево
  const rawPosUke1 = [
    tx + Math.sin(baseAngleRad) * finalDist,
    ty,
    tz + Math.cos(baseAngleRad) * finalDist,
  ];

  // Укэ 2 (фланговый нападающий)
  const uke2Deg = normalizeAngleDeg(norm.uke2AngleDeg + angleOffsetDeg);
  const angleUke2Rad = (uke2Deg * Math.PI) / 180;
  // Дистанция Укэ 2 слегка увеличена для ожидания своей очереди
  const uke2Dist = finalDist + 0.45;
  const rawPosUke2 = [
    tx + Math.sin(angleUke2Rad) * uke2Dist,
    ty,
    tz + Math.cos(angleUke2Rad) * uke2Dist,
  ];

  // Предотвращение пересечения тел (Anti-penetration Capsule Solver)
  let pTori, pUke1, pUke2, collided;

  if (showUke2) {
    const col = resolveThreeAvatarsCollision(rawPosTori, rawPosUke1, rawPosUke2, AVATAR_CAPSULE.minDistance);
    pTori = col.correctedTori;
    pUke1 = col.correctedUke1;
    pUke2 = col.correctedUke2;
    collided = col.collided;
  } else {
    const col = resolveAvatarCollision(rawPosTori, rawPosUke1, AVATAR_CAPSULE.minDistance);
    pTori = col.correctedA;
    pUke1 = col.correctedB;
    pUke2 = rawPosUke2;
    collided = col.collided;
  }

  // Расчет ориентации (Yaw вращение вокруг оси Y)
  // Направление от A к B: atan2(Bx - Ax, Bz - Az)
  const dirUke1ToTori = Math.atan2(pTori[0] - pUke1[0], pTori[2] - pUke1[2]);
  const dirUke2ToTori = Math.atan2(pTori[0] - pUke2[0], pTori[2] - pUke2[2]);

  // Тори обращен лицом к активной цели в текущей фазе
  const activeTargetPos = targetRole === 'uke2' && showUke2 ? pUke2 : pUke1;
  const dirToriToTarget = Math.atan2(activeTargetPos[0] - pTori[0], activeTargetPos[2] - pTori[2]);

  return {
    posTori: pTori,
    posUke1: pUke1,
    posUke2: pUke2,
    rotTori: [0, dirToriToTarget, 0],
    rotUke1: [0, dirUke1ToTori, 0],
    rotUke2: [0, dirUke2ToTori, 0],
    finalDist,
    hasCollision: collided,
    angles: {
      toriYaw: dirToriToTarget,
      uke1Yaw: dirUke1ToTori,
      uke2Yaw: dirUke2ToTori,
    },
  };
}

/**
 * Кинематическая интерполяция перемещений бойцов во время удара/блока
 * В момент t=0 бойцы находятся на дистанции ожидания (То-ма ~2.2м).
 * К моменту контакта (t=tContact) дистанция сокращается до контактной (Ма-ай ~1.2-1.45м).
 */
export function computeKinematicDisplacement({
  initialPos,
  targetPos,
  progress,
  tContact = 0.45,
  stepForwardDist = 0.50,
}) {
  // Направление шага от начальной позиции к цели
  const dx = targetPos[0] - initialPos[0];
  const dz = targetPos[2] - initialPos[2];
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist < 0.0001) return [...initialPos];

  const nx = dx / dist;
  const nz = dz / dist;

  // Плавная сигмоида движения ноги (S-curve)
  // Фаза разгона до контакта (0 .. tContact), затем фиксация (Кимэ / Дзансин)
  let k;
  if (progress <= tContact) {
    const pNorm = progress / tContact;
    k = pNorm * pNorm * (3 - 2 * pNorm); // Smoothstep
  } else {
    k = 1.0;
  }

  const shift = stepForwardDist * k;
  return [
    initialPos[0] + nx * shift,
    initialPos[1],
    initialPos[2] + nz * shift,
  ];
}

/**
 * Синхронизатор времени шкалы боевого эпизода (Master Timeline Solver)
 * Определяет текущее состояние каждого бойца при воспроизведении и скраббинге.
 */
export function evaluateTimelineState({
  episode,
  timelineTime = 0, // в секундах (0 .. totalDuration)
  speed = 1.0,
}) {
  const norm = normalizeBunkaiEpisode(episode);
  const toriPart = norm.participants.find((p) => p.role === 'tori') || {};
  const uke1Part = norm.participants.find((p) => p.role === 'uke1') || {};
  const uke2Part = norm.participants.find((p) => p.role === 'uke2') || {};

  const toriMeta = resolveBunkaiClip(toriPart.clipName);
  const uke1Meta = resolveBunkaiClip(uke1Part.clipName);
  const uke2Meta = resolveBunkaiClip(uke2Part.clipName);

  // Полная продолжительность эпизода
  const totalDuration = Math.max(
    (toriPart.delaySeconds || 0) + toriMeta.duration,
    (uke1Part.delaySeconds || 0) + uke1Meta.duration,
    (uke2Part.delaySeconds || 0) + uke2Meta.duration,
    2.2
  );

  const t = Math.max(0, Math.min(totalDuration, timelineTime));

  // Определение локального времени для каждого участника с учетом delaySeconds
  function getParticipantState(part, meta) {
    const delay = part.delaySeconds || 0;
    if (t < delay) {
      // Боец ожидает в исходной стойке
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

  // Определение фокуса Тори в 3-участниковом последовательном сценарии
  let currentTargetRole = 'uke1';
  let isTurningToUke2 = false;
  let turnProgress = 0.0;

  if (norm.activeAttacker === 'sequential' || norm.activeAttacker === 'uke2') {
    const switchTime = norm.switchTime || 1.35;
    const turnDuration = 0.40; // время плавного разворота через спину (Тай-сабаки)

    if (t < switchTime) {
      currentTargetRole = 'uke1';
    } else if (t < switchTime + turnDuration) {
      currentTargetRole = 'uke2';
      isTurningToUke2 = true;
      turnProgress = (t - switchTime) / turnDuration;
    } else {
      currentTargetRole = 'uke2';
      turnProgress = 1.0;
    }
  }

  // Окно боевого контакта (для активации 2-Bone IK)
  const isContactWindow = Math.abs(t - (uke1Part.delaySeconds + norm.tContact)) < 0.22;

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

/**
 * Модуль непрерывного сохранения состояния (State Persistence) между эпизодами.
 * Рассчитывает смещения участников от эпизода к эпизоду, устраняя резкие телепортации.
 * 
 * @param {Array} rawEpisodes - Массив эпизодов бункая
 * @param {'continuous' | 'standalone'} mode - Режим соединения шагов
 * @returns {Array} Обогащенные эпизоды с сохраненными начальными координатами
 */
export function chainBunkaiEpisodes(rawEpisodes = [], mode = 'continuous') {
  if (!Array.isArray(rawEpisodes) || rawEpisodes.length === 0) {
    return CANONICAL_BUNKAI_EPISODES;
  }

  const normalized = rawEpisodes.map((ep, idx) => normalizeBunkaiEpisode(ep, idx));

  if (mode === 'standalone') {
    // В изолированном режиме каждый эпизод центрируется на [0, 0, 0]
    return normalized.map((ep) => ({
      ...ep,
      toriStartPos: [0, 0, 0],
      toriStartYaw: 0,
    }));
  }

  // В непрерывном режиме накапливаем смещение Тори
  let curToriPos = [0, 0, 0];
  let curToriYaw = 0;

  return normalized.map((ep, idx) => {
    const toriStartPos = [...curToriPos];
    const toriStartYaw = curToriYaw;

    // Оцениваем конечное смещение Тори в этом эпизоде
    const toriPart = ep.participants.find((p) => p.role === 'tori') || {};
    const toriMeta = resolveBunkaiClip(toriPart.clipName);
    const stepDist = BUNKAI_TECHNIQUE_METADATA[toriMeta.clipName]?.stepForwardDist || 0;

    // Вектор шага вдоль текущего направления взгляда Тори
    const deltaX = Math.sin(curToriYaw) * stepDist;
    const deltaZ = Math.cos(curToriYaw) * stepDist;

    // Обновляем позицию для следующего эпизода
    curToriPos = [curToriPos[0] + deltaX, 0, curToriPos[2] + deltaZ];

    // Если был разворот к Укэ 2, сохраняем новый угол
    if (ep.activeAttacker === 'sequential' || ep.activeAttacker === 'uke2') {
      const uke2Deg = normalizeAngleDeg(ep.uke2AngleDeg || 75);
      curToriYaw = (uke2Deg * Math.PI) / 180;
    }

    return {
      ...ep,
      toriStartPos,
      toriStartYaw,
      toriEndPos: [...curToriPos],
    };
  });
}
