import { listClips, listTransitions, reportMissingAnimation } from '../api/animations';

/**
 * Единый реестр анимаций и валидатор совместимости стоек / переходов Шотокан.
 *
 * Требования ТЗ:
 * 1. Использовать общую библиотеку переиспользуемых GLB-анимаций.
 * 2. Описывать совместимость клипов: начальные и конечные позы (stanceIn, stanceOut),
 *    дистанции, ориентации, точки контакта, допустимые отклонения и число участников.
 * 3. Обнаруживать отсутствующие действия и переходы, регистрировать потребности в новых клипах
 *    на сервере (deduplicated) и НЕ допускать их незаметной подмены неподходящими анимациями (idle).
 */

// Кэш отправленных на сервер запросов для предотвращения сетевого спама
const reportedMissingSet = new Set();

// Локальный fallback-реестр метаданных 56 клипов Шотокан (синхронизирован с БД)
const DEFAULT_CLIP_METADATA = {
  // --- УДАРЫ РУКАМИ ---
  choku_zuki: {
    clipName: 'choku_zuki',
    titleRu: 'Чоку-цуки (Прямой удар кулаком)',
    role: 'tori',
    stanceIn: 'heiko_dachi',
    stanceOut: 'heiko_dachi',
    interactionType: 'local_contact',
    optimalDistance: 1.10,
    tolerance: 0.25,
    contactWindow: 0.25,
    tContact: 0.45,
    duration: 1.0,
  },
  oi_zuki_right: {
    clipName: 'oi_zuki_right',
    titleRu: 'Ой-цуки (Выпад кулаком вперед правой)',
    role: 'uke',
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_right',
    interactionType: 'local_contact',
    optimalDistance: 1.45,
    tolerance: 0.35,
    contactWindow: 0.30,
    tContact: 0.55,
    duration: 1.2,
  },
  oi_zuki: {
    clipName: 'oi_zuki',
    titleRu: 'Ой-цуки (Выпад)',
    role: 'uke',
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_right',
    interactionType: 'local_contact',
    optimalDistance: 1.45,
    tolerance: 0.35,
    contactWindow: 0.30,
    tContact: 0.55,
    duration: 1.2,
  },
  gyaku_zuki_right: {
    clipName: 'gyaku_zuki_right',
    titleRu: 'Гяку-цуки (Реверсивный контрудар кулаком)',
    role: 'tori',
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_left',
    interactionType: 'local_contact',
    optimalDistance: 1.15,
    tolerance: 0.30,
    contactWindow: 0.25,
    tContact: 0.40,
    duration: 0.9,
  },
  gyaku_zuki: {
    clipName: 'gyaku_zuki',
    titleRu: 'Гяку-цуки',
    role: 'tori',
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_left',
    interactionType: 'local_contact',
    optimalDistance: 1.15,
    tolerance: 0.30,
    contactWindow: 0.25,
    tContact: 0.40,
    duration: 0.9,
  },
  kizami_zuki: {
    clipName: 'kizami_zuki',
    titleRu: 'Кизами-цуки (Передний хлесткий джеб)',
    role: 'tori',
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_left',
    interactionType: 'local_contact',
    optimalDistance: 1.20,
    tolerance: 0.20,
    contactWindow: 0.20,
    tContact: 0.35,
    duration: 0.8,
  },
  ren_zuki: {
    clipName: 'ren_zuki',
    titleRu: 'Рэн-цуки (Связка двух прямых ударов)',
    role: 'tori',
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_right',
    interactionType: 'local_contact',
    optimalDistance: 1.30,
    tolerance: 0.25,
    contactWindow: 0.40,
    tContact: 0.50,
    duration: 1.4,
  },
  sanbon_zuki: {
    clipName: 'sanbon_zuki',
    titleRu: 'Санбон-цуки (Тройной пробивающий удар)',
    role: 'tori',
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_left',
    interactionType: 'local_contact',
    optimalDistance: 1.35,
    tolerance: 0.25,
    contactWindow: 0.60,
    tContact: 0.60,
    duration: 1.8,
  },
  uraken_uchi: {
    clipName: 'uraken_uchi',
    titleRu: 'Уракэн-учи (Хлесткий удар тыльной стороной кулака)',
    role: 'tori',
    stanceIn: 'kokutsu_dachi_left',
    stanceOut: 'kokutsu_dachi_left',
    interactionType: 'local_contact',
    optimalDistance: 1.05,
    tolerance: 0.25,
    contactWindow: 0.25,
    tContact: 0.40,
    duration: 0.9,
  },
  tetsui_uchi: {
    clipName: 'tetsui_uchi',
    titleRu: 'Тэтцуи-учи (Удар основанием кулака молот)',
    role: 'tori',
    stanceIn: 'kiba_dachi',
    stanceOut: 'kiba_dachi',
    interactionType: 'local_contact',
    optimalDistance: 0.95,
    tolerance: 0.25,
    contactWindow: 0.25,
    tContact: 0.45,
    duration: 1.0,
  },
  empi_uchi: {
    clipName: 'empi_uchi',
    titleRu: 'Эмпи-учи (Сокрушительный удар локтем)',
    role: 'tori',
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_left',
    interactionType: 'local_contact',
    optimalDistance: 0.70,
    tolerance: 0.20,
    contactWindow: 0.25,
    tContact: 0.45,
    duration: 1.0,
  },
  shuto_uchi: {
    clipName: 'shuto_uchi',
    titleRu: 'Сюто-учи (Рубящий удар ребром ладони)',
    role: 'tori',
    stanceIn: 'kokutsu_dachi_left',
    stanceOut: 'kokutsu_dachi_left',
    interactionType: 'local_contact',
    optimalDistance: 1.00,
    tolerance: 0.25,
    contactWindow: 0.25,
    tContact: 0.45,
    duration: 1.0,
  },

  // --- ЗАЩИТНЫЕ БЛОКИ ---
  age_uke_left: {
    clipName: 'age_uke_left',
    titleRu: 'Агэ-укэ (Верхний восходящий блок)',
    role: 'tori',
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_left',
    interactionType: 'local_contact',
    optimalDistance: 1.10,
    tolerance: 0.35,
    contactWindow: 0.30,
    tContact: 0.40,
    duration: 1.0,
  },
  age_uke: {
    clipName: 'age_uke',
    titleRu: 'Агэ-укэ',
    role: 'tori',
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_left',
    interactionType: 'local_contact',
    optimalDistance: 1.10,
    tolerance: 0.35,
    contactWindow: 0.30,
    tContact: 0.40,
    duration: 1.0,
  },
  gedan_barai_left: {
    clipName: 'gedan_barai_left',
    titleRu: 'Гэдан-барай (Нижний сметающий блок)',
    role: 'tori',
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_left',
    interactionType: 'local_contact',
    optimalDistance: 1.15,
    tolerance: 0.35,
    contactWindow: 0.30,
    tContact: 0.45,
    duration: 1.0,
  },
  gedan_barai: {
    clipName: 'gedan_barai',
    titleRu: 'Гэдан-барай',
    role: 'tori',
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_left',
    interactionType: 'local_contact',
    optimalDistance: 1.15,
    tolerance: 0.35,
    contactWindow: 0.30,
    tContact: 0.45,
    duration: 1.0,
  },
  soto_uke: {
    clipName: 'soto_uke',
    titleRu: 'Сото-укэ (Блок снаружи-внутрь на среднем уровне)',
    role: 'tori',
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_left',
    interactionType: 'local_contact',
    optimalDistance: 1.10,
    tolerance: 0.30,
    contactWindow: 0.30,
    tContact: 0.45,
    duration: 1.0,
  },
  uchi_uke: {
    clipName: 'uchi_uke',
    titleRu: 'Ути-укэ (Блок изнутри-наружу)',
    role: 'tori',
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_left',
    interactionType: 'local_contact',
    optimalDistance: 1.10,
    tolerance: 0.30,
    contactWindow: 0.30,
    tContact: 0.45,
    duration: 1.0,
  },
  shuto_uke: {
    clipName: 'shuto_uke',
    titleRu: 'Сюто-укэ (Блок ребром ладони в стойке Кокуцу-дати)',
    role: 'tori',
    stanceIn: 'kokutsu_dachi_left',
    stanceOut: 'kokutsu_dachi_left',
    interactionType: 'local_contact',
    optimalDistance: 1.15,
    tolerance: 0.35,
    contactWindow: 0.30,
    tContact: 0.45,
    duration: 1.1,
  },
  manji_uke: {
    clipName: 'manji_uke',
    titleRu: 'Мандзи-укэ (Двойной вихревой блок верх-низ)',
    role: 'tori',
    stanceIn: 'kokutsu_dachi_left',
    stanceOut: 'kokutsu_dachi_left',
    interactionType: 'non_contact',
    optimalDistance: 1.20,
    tolerance: 0.40,
    contactWindow: 0.30,
    tContact: 0.50,
    duration: 1.2,
  },

  // --- УДАРЫ НОГАМИ ---
  mae_geri_right: {
    clipName: 'mae_geri_right',
    titleRu: 'Маэ-гэри (Прямой хлесткий удар ногой подушечкой стопы)',
    role: 'uke',
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_left',
    interactionType: 'local_contact',
    optimalDistance: 1.65,
    tolerance: 0.30,
    contactWindow: 0.25,
    tContact: 0.45,
    duration: 1.1,
  },
  mae_geri: {
    clipName: 'mae_geri',
    titleRu: 'Маэ-гэри',
    role: 'uke',
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_left',
    interactionType: 'local_contact',
    optimalDistance: 1.65,
    tolerance: 0.30,
    contactWindow: 0.25,
    tContact: 0.45,
    duration: 1.1,
  },
  yoko_geri: {
    clipName: 'yoko_geri',
    titleRu: 'Ёко-гэри (Боковой пробивающий удар ребром стопы)',
    role: 'uke',
    stanceIn: 'kiba_dachi',
    stanceOut: 'kiba_dachi',
    interactionType: 'local_contact',
    optimalDistance: 1.60,
    tolerance: 0.30,
    contactWindow: 0.25,
    tContact: 0.50,
    duration: 1.2,
  },
  mawashi_geri: {
    clipName: 'mawashi_geri',
    titleRu: 'Маваси-гэри (Круговой удар ногой в корпус/голову)',
    role: 'uke',
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_left',
    interactionType: 'local_contact',
    optimalDistance: 1.50,
    tolerance: 0.30,
    contactWindow: 0.25,
    tContact: 0.50,
    duration: 1.2,
  },
  ushiro_geri: {
    clipName: 'ushiro_geri',
    titleRu: 'Усиро-гэри (Удар пяткой назад с разворота)',
    role: 'uke',
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_right',
    interactionType: 'local_contact',
    optimalDistance: 1.55,
    tolerance: 0.30,
    contactWindow: 0.25,
    tContact: 0.55,
    duration: 1.3,
  },

  // --- СЛОЖНЫЕ ПАРНЫЕ ТЕХНИКИ / БРОСКИ (COUPLED) ---
  ippon_seoi_nage: {
    clipName: 'ippon_seoi_nage',
    titleRu: 'Иппон Сеои-нагэ (Бросок через плечо)',
    role: 'both',
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_left',
    interactionType: 'coupled',
    optimalDistance: 0.65,
    tolerance: 0.15,
    contactWindow: 0.80,
    tContact: 0.90,
    duration: 2.2,
  },
  o_soto_gari: {
    clipName: 'o_soto_gari',
    titleRu: 'О-сото-гари (Большой внешний смет под колено)',
    role: 'both',
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_right',
    interactionType: 'coupled',
    optimalDistance: 0.60,
    tolerance: 0.15,
    contactWindow: 0.70,
    tContact: 0.80,
    duration: 2.0,
  },
  deashi_harai: {
    clipName: 'deashi_harai',
    titleRu: 'Дэаси-харай (Сметающая подсечка под выставленную стопу)',
    role: 'both',
    stanceIn: 'heiko_dachi',
    stanceOut: 'heiko_dachi',
    interactionType: 'coupled',
    optimalDistance: 0.75,
    tolerance: 0.15,
    contactWindow: 0.50,
    tContact: 0.60,
    duration: 1.6,
  },

  // --- БАЗОВЫЕ СТОЙКИ ШОТОКАН ---
  idle_shizentai: {
    clipName: 'idle_shizentai',
    titleRu: 'Сидзэнтай (Естественная стойка готовности)',
    role: 'both',
    stanceIn: 'idle_shizentai',
    stanceOut: 'idle_shizentai',
    interactionType: 'non_contact',
    optimalDistance: 1.80,
    tolerance: 1.00,
    contactWindow: 0,
    tContact: 0,
    duration: 1.0,
  },
  stance_ready: {
    clipName: 'stance_ready',
    titleRu: 'Стойка готовности Йой',
    role: 'both',
    stanceIn: 'idle_shizentai',
    stanceOut: 'idle_shizentai',
    interactionType: 'non_contact',
    optimalDistance: 1.80,
    tolerance: 1.00,
    contactWindow: 0,
    tContact: 0,
    duration: 1.0,
  },
  zenkutsu_dachi_left: {
    clipName: 'zenkutsu_dachi_left',
    titleRu: 'Дзэнкуцу-дати левосторонняя',
    role: 'both',
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_left',
    interactionType: 'non_contact',
    optimalDistance: 1.60,
    tolerance: 0.80,
    contactWindow: 0,
    tContact: 0,
    duration: 1.0,
  },
  stance_zenkutsu: {
    clipName: 'stance_zenkutsu',
    titleRu: 'Дзэнкуцу-дати',
    role: 'both',
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_left',
    interactionType: 'non_contact',
    optimalDistance: 1.60,
    tolerance: 0.80,
    contactWindow: 0,
    tContact: 0,
    duration: 1.0,
  },
  kokutsu_dachi_left: {
    clipName: 'kokutsu_dachi_left',
    titleRu: 'Кокуцу-дати защитная',
    role: 'both',
    stanceIn: 'kokutsu_dachi_left',
    stanceOut: 'kokutsu_dachi_left',
    interactionType: 'non_contact',
    optimalDistance: 1.50,
    tolerance: 0.80,
    contactWindow: 0,
    tContact: 0,
    duration: 1.0,
  },
  stance_kokutsu: {
    clipName: 'stance_kokutsu',
    titleRu: 'Кокуцу-дати',
    role: 'both',
    stanceIn: 'kokutsu_dachi_left',
    stanceOut: 'kokutsu_dachi_left',
    interactionType: 'non_contact',
    optimalDistance: 1.50,
    tolerance: 0.80,
    contactWindow: 0,
    tContact: 0,
    duration: 1.0,
  },
  kiba_dachi: {
    clipName: 'kiba_dachi',
    titleRu: 'Киба-дати стойка всадника',
    role: 'both',
    stanceIn: 'kiba_dachi',
    stanceOut: 'kiba_dachi',
    interactionType: 'non_contact',
    optimalDistance: 1.40,
    tolerance: 0.80,
    contactWindow: 0,
    tContact: 0,
    duration: 1.0,
  },
  stance_kiba: {
    clipName: 'stance_kiba',
    titleRu: 'Киба-дати',
    role: 'both',
    stanceIn: 'kiba_dachi',
    stanceOut: 'kiba_dachi',
    interactionType: 'non_contact',
    optimalDistance: 1.40,
    tolerance: 0.80,
    contactWindow: 0,
    tContact: 0,
    duration: 1.0,
  },
};

class AnimationRegistryManager {
  constructor() {
    this.clips = new Map(Object.entries(DEFAULT_CLIP_METADATA));
    this.transitions = new Map();
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    try {
      const [backendClips, backendTransitions] = await Promise.all([
        listClips().catch(() => []),
        listTransitions().catch(() => []),
      ]);

      if (Array.isArray(backendClips)) {
        backendClips.forEach((c) => {
          this.clips.set(c.Clip_Name, {
            clipName: c.Clip_Name,
            titleRu: c.Title_RU || c.Clip_Name,
            role: c.Role_Target,
            stanceIn: c.Stance_In,
            stanceOut: c.Stance_Out,
            interactionType: c.Interaction_Type || 'non_contact',
            optimalDistance: c.Optimal_Distance || 1.35,
            tolerance: c.Tolerance_Meters || 0.35,
            contactWindow: c.Contact_Window_Seconds || 0.25,
            tContact: c.T_Contact_Seconds || 0.45,
            duration: c.Duration_Seconds || 1.0,
          });
        });
      }

      if (Array.isArray(backendTransitions)) {
        backendTransitions.forEach((t) => {
          const key = `${t.From_Stance}_to_${t.To_Stance}`;
          this.transitions.set(key, t);
        });
      }
    } catch {
      // Использовать дефолтный локальный кэш при сбое сети
    } finally {
      this.initialized = true;
    }
  }

  getClipMetadata(clipName) {
    if (!clipName) return null;
    return this.clips.get(clipName) || null;
  }

  getAllClips() {
    return Array.from(this.clips.values());
  }

  /**
   * Проверяет совместимость перехода между шагом A и шагом B.
   * Если стойки не совпадают и переходный клип отсутствует:
   * регистрирует потребность в анимации на сервере (deduplicated)
   * и возвращает статус несовместимости (ЗАПРЕЩЕНА скрытая подмена на idle).
   */
  validateTransition(fromClipName, toClipName, context = 'Kata/Bunkai Sequence') {
    const fromMeta = this.getClipMetadata(fromClipName);
    const toMeta = this.getClipMetadata(toClipName);

    if (!fromMeta) {
      this.reportMissing(fromClipName, { context: `${context} - missing fromClip` });
      return {
        compatible: false,
        reason: `Клип «${fromClipName}» отсутствует в библиотеке`,
        missingClipName: fromClipName,
      };
    }

    if (!toMeta) {
      this.reportMissing(toClipName, { context: `${context} - missing toClip` });
      return {
        compatible: false,
        reason: `Клип «${toClipName}» отсутствует в библиотеке`,
        missingClipName: toClipName,
      };
    }

    const stanceOut = fromMeta.stanceOut;
    const stanceIn = toMeta.stanceIn;

    if (stanceOut === stanceIn) {
      return { compatible: true, direct: true };
    }

    // Проверяем наличие специального клипа перехода между стойками
    const transitionKey = `${stanceOut}_to_${stanceIn}`;
    if (this.transitions.has(transitionKey)) {
      return {
        compatible: true,
        direct: false,
        transitionClip: this.transitions.get(transitionKey),
      };
    }

    // Переход несовместим и отсутствует клип перехода
    const missingTransitionName = `trans_${stanceOut}_${stanceIn}`;
    this.reportMissing(missingTransitionName, {
      stanceIn,
      stanceOut,
      role: toMeta.role,
      context: `Missing stance transition from ${stanceOut} to ${stanceIn} in ${context}`,
    });

    return {
      compatible: false,
      reason: `Несовместимость стоек: «${stanceOut}» -> «${stanceIn}». Требуется переходный клип ${missingTransitionName}.`,
      missingClipName: missingTransitionName,
    };
  }

  /**
   * Отправляет отчет об отсутствующей анимации на бэкенд.
   * Дедуплицирует запросы в пределах клиентской сессии.
   */
  reportMissing(clipName, { role = 'tori', stanceIn = 'ready', stanceOut = 'ready', context = 'Playback runtime' } = {}) {
    if (!clipName || reportedMissingSet.has(clipName)) return;

    reportedMissingSet.add(clipName);
    reportMissingAnimation({
      clipName,
      role,
      stanceIn,
      stanceOut,
      context,
    }).catch((err) => {
      console.warn('Не удалось зафиксировать отсутствие клипа:', err?.message || err);
    });
  }
}

export const animationRegistry = new AnimationRegistryManager();
