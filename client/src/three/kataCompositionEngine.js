/**
 * Единый движок композиции Ката Шотокан (Kata Composition Engine v5).
 * 
 * Назначение:
 * 1. Составление любого из 26 ката Shotokan из переиспользуемых GLB-клипов техник,
 *    перемещений, поворотов и стоек (библиотека karateka_techniques_v4.glb, 213 клипов).
 * 2. Устранение необходимости создавать 26 отдельных монолитных GLB.
 * 3. Единый источник истины (SSOT) для траектории эмбусэна, пошагового разбора и полного исполнения.
 * 4. Согласование стоек, переходов, ориентаций, таймингов и кинематики шагов.
 */

import {
  normalizeAngleDeg,
  parseStepOrientation,
  CANONICAL_EMBUSEN,
  HEIAN_SHODAN_CANONICAL_EVENTS,
} from './kataMotionUtils.js';

/**
 * Словарь канонических техник Shotokan: маппинг кодов сценария (T, S)
 * в наименования анимационных клипов библиотеки v4 и русские названия.
 */
export const TECHNIQUE_REGISTRY = {
  // --- БЛОКИ (УКЭ) ---
  gedan_barai: {
    clipLeft: 'tech_gedan_barai_left',
    clipRight: 'tech_gedan_barai_right',
    fallback: 'tech_gedan_barai_left',
    title: 'Гэдан-барай (Нижний смет)',
    type: 'block',
    defaultDuration: 2.20,
    heightOffset: -0.15,
  },
  age_uke: {
    clipLeft: 'tech_age_uke_left',
    clipRight: 'tech_age_uke_right',
    fallback: 'tech_age_uke_left',
    title: 'Агэ-укэ (Верхний восходящий блок)',
    type: 'block',
    defaultDuration: 2.20,
    heightOffset: -0.15,
  },
  soto_uke: {
    clipLeft: 'tech_soto_uke_left',
    clipRight: 'tech_soto_uke_right',
    fallback: 'tech_soto_uke_left',
    title: 'Сото-укэ (Блок снаружи-внутрь)',
    type: 'block',
    defaultDuration: 2.20,
    heightOffset: -0.15,
  },
  uchi_uke: {
    clipLeft: 'tech_uchi_uke_left',
    clipRight: 'tech_uchi_uke_right',
    fallback: 'tech_uchi_uke_left',
    title: 'Ути-укэ (Блок изнутри-наружу)',
    type: 'block',
    defaultDuration: 2.20,
    heightOffset: -0.15,
  },
  shuto_uke: {
    clipLeft: 'tech_shuto_uke_left',
    clipRight: 'tech_shuto_uke_right',
    fallback: 'tech_shuto_uke_left',
    title: 'Сюто-укэ (Блок ребром ладони в Кокуцу-дати)',
    type: 'block',
    defaultDuration: 2.30,
    heightOffset: -0.16,
  },
  morote_uke: {
    clipLeft: 'tech_morote_uke_left',
    clipRight: 'tech_morote_uke_right',
    fallback: 'tech_morote_uke_right',
    title: 'Моротэ-укэ (Усиленный блок двумя руками)',
    type: 'block',
    defaultDuration: 1.30,
    heightOffset: -0.15,
  },
  kakiwake_uke: {
    clipLeft: 'tech_kakiwake_uke_left',
    clipRight: 'tech_kakiwake_uke_right',
    fallback: 'tech_kakiwake_uke_right',
    title: 'Какивакэ-укэ (Разводящий клин-блок)',
    type: 'block',
    defaultDuration: 1.35,
    heightOffset: -0.15,
  },
  haishu_uke: {
    clipLeft: 'tech_haishu_uke_left',
    clipRight: 'tech_haishu_uke_right',
    fallback: 'tech_haishu_uke_right',
    title: 'Хайсю-укэ (Блок тыльной стороной ладони)',
    type: 'block',
    defaultDuration: 1.25,
    heightOffset: -0.15,
  },
  juji_uke: {
    clipLeft: 'tech_juji_uke_left',
    clipRight: 'tech_juji_uke_right',
    fallback: 'tech_juji_uke_right',
    title: 'Дзюдзи-укэ (Скрестный верхний блок)',
    type: 'block',
    defaultDuration: 1.30,
    heightOffset: -0.15,
  },
  gedan_juji_uke: {
    clipLeft: 'tech_gedan_juji_uke_left',
    clipRight: 'tech_gedan_juji_uke_right',
    fallback: 'tech_gedan_juji_uke_left',
    title: 'Гэдан дзюдзи-укэ (Нижний скрестный блок)',
    type: 'block',
    defaultDuration: 1.30,
    heightOffset: -0.15,
  },
  shuto_juji_uke: {
    clipLeft: 'tech_shuto_juji_uke_left',
    clipRight: 'tech_shuto_juji_uke_right',
    fallback: 'tech_shuto_juji_uke_left',
    title: 'Сюто дзюдзи-укэ (Скрестный блок открытыми ладонями)',
    type: 'block',
    defaultDuration: 1.35,
    heightOffset: -0.16,
  },
  manji_uke: {
    clipLeft: 'tech_manji_uke_left',
    clipRight: 'tech_manji_uke_right',
    fallback: 'manji_uke',
    title: 'Мандзи-укэ (Вихревой блок верх-низ)',
    type: 'block',
    defaultDuration: 1.40,
    heightOffset: -0.16,
  },
  osae_uke: {
    clipLeft: 'tech_osae_uke_left',
    clipRight: 'tech_osae_uke_right',
    fallback: 'tech_osae_uke_right',
    title: 'Осаэ-укэ (Осаживающий блок вниз)',
    type: 'block',
    defaultDuration: 1.20,
    heightOffset: -0.15,
  },
  sukui_uke: {
    clipLeft: 'tech_sukui_uke_left',
    clipRight: 'tech_sukui_uke_right',
    fallback: 'tech_sukui_uke_right',
    title: 'Сукуи-укэ (Зачерпывающий блок снизу)',
    type: 'block',
    defaultDuration: 1.30,
    heightOffset: -0.15,
  },
  morote_age_uke: {
    clipLeft: 'tech_morote_age_uke_left',
    clipRight: 'tech_morote_age_uke_right',
    fallback: 'tech_morote_age_uke_right',
    title: 'Моротэ агэ-укэ (Двойной восходящий блок)',
    type: 'block',
    defaultDuration: 1.35,
    heightOffset: -0.15,
  },

  // --- УДАРЫ РУКАМИ (ЦУКИ И УЧИ) ---
  oi_zuki: {
    clipLeft: 'tech_oi_zuki_left',
    clipRight: 'tech_oi_zuki_right',
    fallback: 'tech_oi_zuki_right',
    title: 'Ой-цуки (Прямой выпад кулаком)',
    type: 'punch',
    defaultDuration: 2.15,
    heightOffset: -0.15,
  },
  gyaku_zuki: {
    clipLeft: 'tech_gyaku_zuki_left',
    clipRight: 'tech_gyaku_zuki_right',
    fallback: 'gyaku_zuki_right',
    title: 'Гяку-цуки (Реверсивный удар кулаком)',
    type: 'punch',
    defaultDuration: 1.10,
    heightOffset: -0.15,
  },
  jodan_zuki: {
    clipLeft: 'tech_jodan_zuki_left',
    clipRight: 'tech_jodan_zuki_right',
    fallback: 'jodan_zuki_right',
    title: 'Дзёдан-цуки (Удар в голову)',
    type: 'punch',
    defaultDuration: 1.15,
    heightOffset: -0.15,
  },
  chudan_zuki: {
    clipLeft: 'chudan_zuki_left',
    clipRight: 'chudan_zuki_right',
    fallback: 'chudan_zuki_right',
    title: 'Тюдан-цуки (Прямой удар в корпус)',
    type: 'punch',
    defaultDuration: 1.10,
    heightOffset: 0,
  },
  gedan_zuki: {
    clipLeft: 'tech_gedan_zuki_left',
    clipRight: 'tech_gedan_zuki_right',
    fallback: 'tech_gedan_zuki_right',
    title: 'Гэдан-цуки (Удар вниз)',
    type: 'punch',
    defaultDuration: 1.15,
    heightOffset: -0.15,
  },
  tate_zuki: {
    clipLeft: 'tech_tate_zuki_left',
    clipRight: 'tech_tate_zuki_right',
    fallback: 'tech_tate_zuki_right',
    title: 'Татэ-цуки (Вертикальный кулак)',
    type: 'punch',
    defaultDuration: 1.10,
    heightOffset: -0.15,
  },
  kagi_zuki: {
    clipLeft: 'tech_kagi_zuki_left',
    clipRight: 'tech_kagi_zuki_right',
    fallback: 'tech_kagi_zuki_right',
    title: 'Каги-цуки (Удар крюком в корпус)',
    type: 'punch',
    defaultDuration: 1.10,
    heightOffset: -0.15,
  },
  yama_zuki: {
    clipLeft: 'tech_yama_zuki_left',
    clipRight: 'tech_yama_zuki_right',
    fallback: 'tech_yama_zuki_right',
    title: 'Яма-цуки (Широкий U-образный удар)',
    type: 'punch',
    defaultDuration: 1.35,
    heightOffset: -0.15,
  },
  morote_zuki: {
    clipLeft: 'tech_morote_zuki_left',
    clipRight: 'tech_morote_zuki_right',
    fallback: 'morote_zuki',
    title: 'Моротэ-цуки (Двойной удар двумя кулаками)',
    type: 'punch',
    defaultDuration: 1.25,
    heightOffset: -0.15,
  },
  yoko_zuki: {
    clipLeft: 'tech_yoko_zuki_left',
    clipRight: 'tech_yoko_zuki_right',
    fallback: 'tech_yoko_zuki_left',
    title: 'Ёко-цуки (Боковой удар кулаком)',
    type: 'punch',
    defaultDuration: 1.15,
    heightOffset: -0.15,
  },
  uraken: {
    clipLeft: 'tech_uraken_left',
    clipRight: 'tech_uraken_right',
    fallback: 'uraken_uchi',
    title: 'Уракэн-учи (Хлесткий удар тыльной стороной кулака)',
    type: 'strike',
    defaultDuration: 1.10,
    heightOffset: -0.15,
  },
  tettsui: {
    clipLeft: 'tech_tettsui_left',
    clipRight: 'tech_tettsui_right',
    fallback: 'tech_tettsui_right',
    title: 'Тэтцуи-учи в Мото-дати (Стойка половина длины дзэнкуцу-дати)',
    type: 'strike',
    defaultDuration: 2.20,
    heightOffset: -0.10,
    stance: 'moto',
  },
  shuto_uchi: {
    clipLeft: 'tech_shuto_uchi_left',
    clipRight: 'tech_shuto_uchi_right',
    fallback: 'shuto_uchi',
    title: 'Сюто-учи (Рубящий удар ребром ладони)',
    type: 'strike',
    defaultDuration: 1.20,
    heightOffset: -0.15,
  },
  nukite: {
    clipLeft: 'tech_nukite_left',
    clipRight: 'tech_nukite_right',
    fallback: 'tech_nukite_right',
    title: 'Нукитэ (Удар копьем пальцев)',
    type: 'strike',
    defaultDuration: 1.25,
    heightOffset: -0.15,
  },
  teisho: {
    clipLeft: 'tech_teisho_left',
    clipRight: 'tech_teisho_right',
    fallback: 'tech_teisho_right',
    title: 'Тэйсё (Удар основанием ладони)',
    type: 'strike',
    defaultDuration: 1.15,
    heightOffset: -0.15,
  },
  mae_empi: {
    clipLeft: 'tech_mae_empi_left',
    clipRight: 'tech_mae_empi_right',
    fallback: 'empi_uchi',
    title: 'Маэ-эмпи (Удар локтем вперед)',
    type: 'strike',
    defaultDuration: 1.15,
    heightOffset: -0.15,
  },
  yoko_empi: {
    clipLeft: 'tech_yoko_empi_left',
    clipRight: 'tech_yoko_empi_right',
    fallback: 'empi_uchi',
    title: 'Ёко-эмпи (Боковой удар локтем)',
    type: 'strike',
    defaultDuration: 1.15,
    heightOffset: -0.15,
  },
  age_empi: {
    clipLeft: 'tech_age_empi_left',
    clipRight: 'tech_age_empi_right',
    fallback: 'empi_uchi',
    title: 'Агэ-эмпи (Восходящий удар локтем)',
    type: 'strike',
    defaultDuration: 1.15,
    heightOffset: -0.15,
  },
  otoshi_empi: {
    clipLeft: 'tech_otoshi_empi_left',
    clipRight: 'tech_otoshi_empi_right',
    fallback: 'empi_uchi',
    title: 'Отоси-эмпи (Нисходящий удар локтем)',
    type: 'strike',
    defaultDuration: 1.15,
    heightOffset: -0.15,
  },
  ushiro_empi: {
    clipLeft: 'tech_ushiro_empi_left',
    clipRight: 'tech_ushiro_empi_right',
    fallback: 'empi_uchi',
    title: 'Усиро-эмпи (Удар локтем назад)',
    type: 'strike',
    defaultDuration: 1.15,
    heightOffset: -0.15,
  },
  hasami: {
    clipLeft: 'tech_hasami_left',
    clipRight: 'tech_hasami_right',
    fallback: 'tech_hasami_right',
    title: 'Хасами-учи (Удар ножницы)',
    type: 'strike',
    defaultDuration: 1.20,
    heightOffset: -0.15,
  },
  koho_zuki_age: {
    clipLeft: 'tech_koho_zuki_age_left',
    clipRight: 'tech_koho_zuki_age_right',
    fallback: 'tech_koho_zuki_age_left',
    title: 'Кохо-цуки агэ (Двойной апперкот назад)',
    type: 'strike',
    defaultDuration: 1.25,
    heightOffset: -0.15,
  },

  // --- УДАРЫ НОГАМИ (ГЭРИ) ---
  mae_geri: {
    clipLeft: 'kick_mae_geri_left',
    clipRight: 'kick_mae_geri_right',
    fallback: 'mae_geri',
    title: 'Маэ-гэри (Прямой хлесткий удар ногой)',
    type: 'kick',
    defaultDuration: 1.35,
    heightOffset: 0,
  },
  mae_keage: {
    clipLeft: 'kick_mae_keage_left',
    clipRight: 'kick_mae_keage_right',
    fallback: 'mae_geri',
    title: 'Маэ-кэагэ (Мах ногой вперед)',
    type: 'kick',
    defaultDuration: 1.25,
    heightOffset: 0,
  },
  mawashi_geri: {
    clipLeft: 'kick_mawashi_left',
    clipRight: 'kick_mawashi_right',
    fallback: 'mawashi_geri',
    title: 'Маваси-гэри (Круговой удар ногой)',
    type: 'kick',
    defaultDuration: 1.40,
    heightOffset: 0,
  },
  yoko_kekomi: {
    clipLeft: 'kick_yoko_kekomi_left',
    clipRight: 'kick_yoko_kekomi_right',
    fallback: 'yoko_geri',
    title: 'Ёко-гэри кэкоми (Боковой пробивающий удар)',
    type: 'kick',
    defaultDuration: 1.45,
    heightOffset: 0,
  },
  yoko_keage: {
    clipLeft: 'kick_yoko_keage_left',
    clipRight: 'kick_yoko_keage_right',
    fallback: 'yoko_geri',
    title: 'Ёко-гэри кэагэ (Боковой хлесткий удар)',
    type: 'kick',
    defaultDuration: 1.35,
    heightOffset: 0,
  },
  ushiro_geri: {
    clipLeft: 'kick_ushiro_left',
    clipRight: 'kick_ushiro_right',
    fallback: 'ushiro_geri',
    title: 'Усиро-гэри (Удар пяткой назад)',
    type: 'kick',
    defaultDuration: 1.45,
    heightOffset: 0,
  },
  hiza_geri: {
    clipLeft: 'kick_hiza_left',
    clipRight: 'kick_hiza_right',
    fallback: 'kick_mae_geri_right',
    title: 'Хидза-гэри (Удар коленом)',
    type: 'kick',
    defaultDuration: 1.20,
    heightOffset: 0,
  },
  mikazuki_geri: {
    clipLeft: 'kick_mikazuki_left',
    clipRight: 'kick_mikazuki_right',
    fallback: 'kick_mikazuki_right',
    title: 'Микадзуки-гэри (Удар серпом стопы снаружи-внутрь)',
    type: 'kick',
    defaultDuration: 1.30,
    heightOffset: 0,
  },
  nami_gaeshi: {
    clipLeft: 'kick_nami_gaeshi_left',
    clipRight: 'kick_nami_gaeshi_right',
    fallback: 'kick_nami_gaeshi_right',
    title: 'Нами-гаэси (Подхват возвращающейся волны)',
    type: 'kick',
    defaultDuration: 1.25,
    heightOffset: -0.26,
  },
  yoko_fumikomi: {
    clipLeft: 'kick_yoko_fumikomi_left',
    clipRight: 'kick_yoko_fumikomi_right',
    fallback: 'kick_yoko_fumikomi_right',
    title: 'Ёко фумикоми (Топчущий сокрушительный удар)',
    type: 'kick',
    defaultDuration: 1.35,
    heightOffset: -0.16,
  },

  // --- ПРЫЖКИ (ТОБИ) ---
  jump_turn_180: {
    clipLeft: 'jump_turn_180',
    clipRight: 'jump_turn_180_right',
    fallback: 'jump_turn_180',
    title: 'Тоби кайтэн 180° (Прыжок с разворотом на 180°)',
    type: 'jump',
    defaultDuration: 1.60,
    heightOffset: 0,
  },
  jump_turn_360: {
    clipLeft: 'jump_turn_360',
    clipRight: 'jump_turn_360',
    fallback: 'jump_turn_360',
    title: 'Тоби кайтэн 360° (Прыжок с вращением на 360°)',
    type: 'jump',
    defaultDuration: 1.85,
    heightOffset: 0,
  },
  jump_forward: {
    clipLeft: 'jump_forward',
    clipRight: 'jump_forward',
    fallback: 'jump_forward',
    title: 'Тоби (Прыжок вперед с приземлением в Коса-дати)',
    type: 'jump',
    defaultDuration: 1.70,
    heightOffset: 0,
  },

  // --- СТОЙКИ И ПЕРЕХОДЫ ---
  zenkutsu: {
    clipLeft: 'zenkutsu_dachi_left',
    clipRight: 'zenkutsu_dachi_right',
    fallback: 'stance_zenkutsu',
    title: 'Дзэнкуцу-дати (Передняя атакующая стойка)',
    type: 'stance',
    defaultDuration: 1.0,
    heightOffset: -0.15,
  },
  kokutsu: {
    clipLeft: 'kokutsu_dachi_left',
    clipRight: 'kokutsu_dachi_right',
    fallback: 'stance_kokutsu',
    title: 'Кокуцу-дати (Защитная задняя стойка)',
    type: 'stance',
    defaultDuration: 1.0,
    heightOffset: -0.16,
  },
  kiba: {
    clipLeft: 'kiba_dachi',
    clipRight: 'kiba_dachi',
    fallback: 'stance_kiba',
    title: 'Киба-дати (Стойка всадника)',
    type: 'stance',
    defaultDuration: 1.0,
    heightOffset: -0.26,
  },
  fudo: {
    clipLeft: 'fudo_dachi',
    clipRight: 'fudo_dachi',
    fallback: 'stance_fudo',
    title: 'Фудо-дати (Непоколебимая стойка)',
    type: 'stance',
    defaultDuration: 1.0,
    heightOffset: -0.18,
  },
  heiko: {
    clipLeft: 'heiko_dachi',
    clipRight: 'heiko_dachi',
    fallback: 'stance_ready',
    title: 'Хэйко-дати (Параллельная стойка)',
    type: 'stance',
    defaultDuration: 1.0,
    heightOffset: 0,
  },
  moto: {
    clipLeft: 'stance_moto_left',
    clipRight: 'stance_moto_right',
    fallback: 'stance_moto_right',
    title: 'Мото-дати (Стойка половина длины дзэнкуцу-дати)',
    type: 'stance',
    defaultDuration: 1.0,
    heightOffset: -0.08,
  },
  renoji: {
    clipLeft: 'stance_renoji_left',
    clipRight: 'stance_renoji_right',
    fallback: 'stance_renoji_left',
    title: 'Рэнодзи-дати (L-образная стойка)',
    type: 'stance',
    defaultDuration: 1.0,
    heightOffset: -0.08,
  },
  neko: {
    clipLeft: 'stance_neko_left',
    clipRight: 'stance_neko_right',
    fallback: 'stance_neko_left',
    title: 'Нэкоаси-дати (Кошачья стойка)',
    type: 'stance',
    defaultDuration: 1.0,
    heightOffset: -0.12,
  },
  kosa: {
    clipLeft: 'stance_kosa_left',
    clipRight: 'stance_kosa_right',
    fallback: 'stance_kosa_left',
    title: 'Коса-дати (Скрестная стойка)',
    type: 'stance',
    defaultDuration: 1.0,
    heightOffset: -0.22,
  },
  hangetsu: {
    clipLeft: 'stance_hangetsu_left',
    clipRight: 'stance_hangetsu_right',
    fallback: 'stance_hangetsu_left',
    title: 'Хангэцу-дати (Стойка полумесяца)',
    type: 'stance',
    defaultDuration: 1.0,
    heightOffset: -0.14,
  },
  sanchin: {
    clipLeft: 'stance_sanchin_left',
    clipRight: 'stance_sanchin_right',
    fallback: 'stance_sanchin_left',
    title: 'Санчин-дати (Стойка песочных часов)',
    type: 'stance',
    defaultDuration: 1.0,
    heightOffset: -0.10,
  },
  shiko: {
    clipLeft: 'stance_shiko',
    clipRight: 'stance_shiko',
    fallback: 'stance_shiko',
    title: 'Сико-дати (Стойка борца сумо)',
    type: 'stance',
    defaultDuration: 1.0,
    heightOffset: -0.26,
  },
  moto: {
    clipLeft: 'stance_moto_left',
    clipRight: 'stance_moto_right',
    fallback: 'stance_moto_left',
    title: 'Мото-дати (Короткая базовая стойка)',
    type: 'stance',
    defaultDuration: 1.0,
    heightOffset: -0.06,
  },
  tsuru: {
    clipLeft: 'stance_tsuru_left',
    clipRight: 'stance_tsuru_right',
    fallback: 'stance_tsuru_left',
    title: 'Цуруаси-дати (Стойка журавля на одной ноге)',
    type: 'stance',
    defaultDuration: 1.0,
    heightOffset: 0,
  },
  heisoku: {
    clipLeft: 'stance_heisoku',
    clipRight: 'stance_heisoku',
    fallback: 'idle_shizentai',
    title: 'Хэйсоку-дати (Ступни вместе)',
    type: 'stance',
    defaultDuration: 1.0,
    heightOffset: 0,
  },
  musubi: {
    clipLeft: 'stance_musubi',
    clipRight: 'stance_musubi',
    fallback: 'idle_shizentai',
    title: 'Мусуби-дати (Пятки вместе, носки врозь)',
    type: 'stance',
    defaultDuration: 1.0,
    heightOffset: 0,
  },
  hachiji: {
    clipLeft: 'stance_hachiji',
    clipRight: 'stance_hachiji',
    fallback: 'idle_shizentai',
    title: 'Хатидзи-дати (Естественная стойка готовности)',
    type: 'stance',
    defaultDuration: 1.0,
    heightOffset: 0,
  },
  ready: {
    clipLeft: 'idle_shizentai',
    clipRight: 'idle_shizentai',
    fallback: 'stance_ready',
    title: 'Сидзэнтай Йой (Готовность)',
    type: 'stance',
    defaultDuration: 1.0,
    heightOffset: 0,
  },
};

/**
 * Парсер перехода в коде S: извлекает опорную ногу (pivotFoot), тип перехода и целевую ногу
 */
export function parseTransitionCode(sCode = '') {
  if (!sCode || typeof sCode !== 'string') {
    return { type: 'normal', pivotFoot: 'left', stepFoot: 'right' };
  }

  // Jump transitions: S_jump_...
  if (sCode.startsWith('S_jump')) {
    return { type: 'jump', pivotFoot: 'both', stepFoot: 'both' };
  }
  // Turn transitions through the back: S_turn_...
  if (sCode.startsWith('S_turn')) {
    const stepFoot = sCode.includes('_R') ? 'right' : 'left';
    const pivotFoot = stepFoot === 'right' ? 'left' : 'right';
    return { type: 'turn_back', pivotFoot, stepFoot };
  }
  // Kick transitions: S_kick_<type>_<foot>_<targetStance>
  if (sCode.startsWith('S_kick')) {
    const isRight = sCode.includes('_R_') || sCode.endsWith('_R');
    return { type: 'kick', pivotFoot: isRight ? 'left' : 'right', stepFoot: isRight ? 'right' : 'left' };
  }
  // Hold transitions: S_hold_<stance>_<foot>
  if (sCode.startsWith('S_hold')) {
    const foot = sCode.endsWith('_R') ? 'right' : 'left';
    return { type: 'hold', pivotFoot: foot, stepFoot: foot };
  }
  // Step transitions: S_step_<fromStance>_<toStance>_<steppingFoot>
  if (sCode.startsWith('S_step')) {
    const stepFoot = sCode.endsWith('_R') ? 'right' : 'left';
    const pivotFoot = stepFoot === 'right' ? 'left' : 'right';
    return { type: 'step', pivotFoot, stepFoot };
  }

  return { type: 'step', pivotFoot: 'left', stepFoot: 'right' };
}

/**
 * Разрешает конкретный GLB-клип анимации и описание для шага сценария
 */
export function resolveComposedClip(step, availableClips = null) {
  if (!step) {
    return {
      clipName: 'idle_shizentai',
      title: 'Сидзэнтай (Готовность)',
      duration: 1.0,
      type: 'stance',
      heightOffset: 0,
    };
  }

  let tCode = (step.T || step.techniqueCode || '').trim();
  const sCode = (step.S || '').trim();
  const stance = (step.stance || 'zenkutsu').toLowerCase().trim();

  // Резервный разбор по названию техники (Technique или Title), если явный код T отсутствует
  if (!tCode && (step.Technique || step.Title)) {
    const txt = `${step.Technique || ''} ${step.Title || ''}`.toLowerCase();
    const isL = txt.includes('левой') || txt.includes('левый') || txt.includes('left') || txt.includes('l:');
    const prefix = isL ? 'T_L-' : 'T_R-';
    if (txt.includes('гэдан') || txt.includes('gedan')) tCode = `${prefix}gedan_barai`;
    else if (txt.includes('ой-цуки') || txt.includes('oi-zuki') || txt.includes('oi_zuki') || txt.includes('прямой')) tCode = `${prefix}oi_zuki`;
    else if (txt.includes('гяку') || txt.includes('gyaku')) tCode = `${prefix}gyaku_zuki`;
    else if (txt.includes('агэ') || txt.includes('age_uke') || txt.includes('age-uke') || txt.includes('верхний блок')) tCode = `${prefix}age_uke`;
    else if (txt.includes('тэтцуи') || txt.includes('tettsui')) tCode = `${prefix}tettsui`;
    else if (txt.includes('сюто-укэ') || txt.includes('shuto_uke') || txt.includes('сюто')) tCode = `${prefix}shuto_uke`;
    else if (txt.includes('сото') || txt.includes('soto')) tCode = `${prefix}soto_uke`;
    else if (txt.includes('ути-укэ') || txt.includes('uchi_uke') || txt.includes('ути')) tCode = `${prefix}uchi_uke`;
    else if (txt.includes('маэ-гэри') || txt.includes('mae_geri')) tCode = `${prefix}mae_geri`;
    else if (txt.includes('ёко') || txt.includes('yoko')) tCode = `${prefix}yoko_kekomi`;
  }

  // Определяем сторону ведущей руки / ноги (приоритет у кода техники T)
  let isLeft = false;
  let isRight = false;
  if (tCode.includes('L-') || tCode.includes('_left')) {
    isLeft = true;
  } else if (tCode.includes('R-') || tCode.includes('_right')) {
    isRight = true;
  } else if (sCode.endsWith('_L') || sCode.includes('L_')) {
    isLeft = true;
  } else if (sCode.endsWith('_R') || sCode.includes('R_')) {
    isRight = true;
  } else {
    isRight = true; // default right side
  }
  const sideKey = isLeft ? 'clipLeft' : 'clipRight';

  // 1. Проверяем прыжки
  if (sCode.startsWith('S_jump')) {
    if (sCode.includes('360')) {
      const reg = TECHNIQUE_REGISTRY.jump_turn_360;
      return { clipName: reg.clipRight, title: reg.title, duration: reg.defaultDuration, type: 'jump', heightOffset: 0 };
    }
    if (sCode.includes('180') || step.R === 'R_p180' || step.R === 'R_m180') {
      const reg = TECHNIQUE_REGISTRY.jump_turn_180;
      return { clipName: isLeft ? reg.clipLeft : reg.clipRight, title: reg.title, duration: reg.defaultDuration, type: 'jump', heightOffset: 0 };
    }
    const reg = TECHNIQUE_REGISTRY.jump_forward;
    return { clipName: reg.clipRight, title: reg.title, duration: reg.defaultDuration, type: 'jump', heightOffset: 0 };
  }

  // 1b. Проверяем развороты через спину в стойку кокуцу-дати (Сюто-укэ)
  if (
    (sCode.startsWith('S_turn') || sCode.includes('turn') || sCode.includes('kokutsu') || step.R?.includes('180') || step.R?.includes('90') || step.n === 18 || step.moveNumber === 18) &&
    (stance === 'kokutsu' || tCode.includes('shuto'))
  ) {
    const clipName = isLeft ? 'turn_into_kokutsu_left' : 'turn_into_kokutsu_right';
    return {
      clipName,
      title: `Сюто-укэ с разворотом через спину в Кокуцу-дати (${isLeft ? 'левой' : 'правой'})`,
      duration: 2.30,
      type: 'turn',
      heightOffset: -0.16,
    };
  }

  // 2. Проверяем удары ногами
  if (sCode.startsWith('S_kick') || tCode.includes('geri')) {
    let kickKey = 'mae_geri';
    if (sCode.includes('yoko_kekomi') || tCode.includes('kekomi')) kickKey = 'yoko_kekomi';
    else if (sCode.includes('yoko_keage') || tCode.includes('keage')) kickKey = 'yoko_keage';
    else if (sCode.includes('mawashi') || tCode.includes('mawashi')) kickKey = 'mawashi_geri';
    else if (sCode.includes('ushiro') || tCode.includes('ushiro')) kickKey = 'ushiro_geri';
    else if (sCode.includes('nami_gaeshi') || tCode.includes('nami_gaeshi')) kickKey = 'nami_gaeshi';
    else if (sCode.includes('fumikomi') || tCode.includes('fumikomi')) kickKey = 'yoko_fumikomi';
    else if (sCode.includes('mikazuki') || tCode.includes('mikazuki')) kickKey = 'mikazuki_geri';
    else if (sCode.includes('hiza') || tCode.includes('hiza')) kickKey = 'hiza_geri';

    const reg = TECHNIQUE_REGISTRY[kickKey] || TECHNIQUE_REGISTRY.mae_geri;
    const clipName = isLeft ? reg.clipLeft : reg.clipRight;
    return { clipName, title: reg.title, duration: reg.defaultDuration, type: 'kick', heightOffset: reg.heightOffset };
  }

  // 3. Проверяем сложные двойные техники
  if (tCode.includes('uchi_uke') && tCode.includes('gedan_barai')) {
    const reg = TECHNIQUE_REGISTRY.manji_uke;
    return { clipName: isLeft ? reg.clipLeft : reg.clipRight, title: reg.title, duration: reg.defaultDuration, type: 'block', heightOffset: reg.heightOffset };
  }
  if (tCode.includes('kakiwake')) {
    const reg = TECHNIQUE_REGISTRY.kakiwake_uke;
    return { clipName: isLeft ? reg.clipLeft : reg.clipRight, title: reg.title, duration: reg.defaultDuration, type: 'block', heightOffset: reg.heightOffset };
  }
  if (tCode.includes('gedan_juji')) {
    const reg = TECHNIQUE_REGISTRY.gedan_juji_uke;
    return { clipName: isLeft ? reg.clipLeft : reg.clipRight, title: reg.title, duration: reg.defaultDuration, type: 'block', heightOffset: reg.heightOffset };
  }
  if (tCode.includes('shuto_juji')) {
    const reg = TECHNIQUE_REGISTRY.shuto_juji_uke;
    return { clipName: isLeft ? reg.clipLeft : reg.clipRight, title: reg.title, duration: reg.defaultDuration, type: 'block', heightOffset: reg.heightOffset };
  }
  if (tCode.includes('juji')) {
    const reg = TECHNIQUE_REGISTRY.juji_uke;
    return { clipName: isLeft ? reg.clipLeft : reg.clipRight, title: reg.title, duration: reg.defaultDuration, type: 'block', heightOffset: reg.heightOffset };
  }
  if (tCode.includes('morote_age_uke')) {
    const reg = TECHNIQUE_REGISTRY.morote_age_uke;
    return { clipName: isLeft ? reg.clipLeft : reg.clipRight, title: reg.title, duration: reg.defaultDuration, type: 'block', heightOffset: reg.heightOffset };
  }
  if (tCode.includes('morote_uke')) {
    const reg = TECHNIQUE_REGISTRY.morote_uke;
    return { clipName: isLeft ? reg.clipLeft : reg.clipRight, title: reg.title, duration: reg.defaultDuration, type: 'block', heightOffset: reg.heightOffset };
  }
  if (tCode.includes('yama_zuki')) {
    const reg = TECHNIQUE_REGISTRY.yama_zuki;
    return { clipName: isLeft ? reg.clipLeft : reg.clipRight, title: reg.title, duration: reg.defaultDuration, type: 'punch', heightOffset: reg.heightOffset };
  }
  if (tCode.includes('kagi_zuki')) {
    const reg = TECHNIQUE_REGISTRY.kagi_zuki;
    return { clipName: isLeft ? reg.clipLeft : reg.clipRight, title: reg.title, duration: reg.defaultDuration, type: 'punch', heightOffset: reg.heightOffset };
  }
  if (tCode.includes('hasami')) {
    const reg = TECHNIQUE_REGISTRY.hasami;
    return { clipName: isLeft ? reg.clipLeft : reg.clipRight, title: reg.title, duration: reg.defaultDuration, type: 'strike', heightOffset: reg.heightOffset };
  }
  if (tCode.includes('koho_zuki_age')) {
    const reg = TECHNIQUE_REGISTRY.koho_zuki_age;
    return { clipName: isLeft ? reg.clipLeft : reg.clipRight, title: reg.title, duration: reg.defaultDuration, type: 'strike', heightOffset: reg.heightOffset };
  }

  // 4. Одиночные техники рук (парсинг названия)
  const cleanT = tCode.replace(/^T_/, '').split('+')[0].split('-level=')[0];
  const techBase = cleanT.replace(/^[LR]-/, '').replace(/-/g, '_');

  // Поиск в реестре по ключу
  let matchedReg = TECHNIQUE_REGISTRY[techBase];
  if (!matchedReg) {
    if (techBase === 'zuki') matchedReg = TECHNIQUE_REGISTRY.oi_zuki;
    else if (techBase.includes('shuto')) matchedReg = TECHNIQUE_REGISTRY.shuto_uke;
    else if (techBase.includes('empi')) matchedReg = TECHNIQUE_REGISTRY.mae_empi;
    else if (techBase.includes('tettsui')) matchedReg = TECHNIQUE_REGISTRY.tettsui;
    else if (techBase.includes('uraken')) matchedReg = TECHNIQUE_REGISTRY.uraken;
    else if (techBase.includes('nukite')) matchedReg = TECHNIQUE_REGISTRY.nukite;
    else if (techBase.includes('teisho')) matchedReg = TECHNIQUE_REGISTRY.teisho;
    else if (techBase.includes('haishu')) matchedReg = TECHNIQUE_REGISTRY.haishu_uke;
    else if (techBase.includes('osae')) matchedReg = TECHNIQUE_REGISTRY.osae_uke;
  }

  if (matchedReg) {
    const clipName = matchedReg[sideKey] || matchedReg.clipRight || matchedReg.fallback;
    const sideRu = isLeft ? ' левой' : ' правой';
    return {
      clipName,
      title: `${matchedReg.title}${sideRu}`,
      duration: matchedReg.defaultDuration,
      type: matchedReg.type,
      heightOffset: matchedReg.heightOffset,
    };
  }

  // 5. Удержание стойки / пауза / фиксация
  if (tCode === 'T_hold' || tCode.includes('guard') || !tCode) {
    const stanceReg = TECHNIQUE_REGISTRY[stance] || TECHNIQUE_REGISTRY.ready;
    const clipName = isLeft ? stanceReg.clipLeft : stanceReg.clipRight;
    return {
      clipName,
      title: `${stanceReg.title} (Фиксация)`,
      duration: stanceReg.defaultDuration,
      type: 'stance',
      heightOffset: stanceReg.heightOffset,
    };
  }

  // 6. Общий дефолт
  const fallbackReg = TECHNIQUE_REGISTRY[stance] || TECHNIQUE_REGISTRY.zenkutsu;
  return {
    clipName: isLeft ? fallbackReg.clipLeft : fallbackReg.clipRight,
    title: step.Technique || step.title || 'Техника каратэ',
    duration: fallbackReg.defaultDuration,
    type: 'technique',
    heightOffset: fallbackReg.heightOffset,
  };
}

/**
 * Оценивает совместимость перехода между шагом A и шагом B.
 * Рассчитывает оптимальную длительность управляемого смешивания (crossfade)
 * и выбирает переходной клип, если он требуется.
 */
export function evaluateStepCompatibility(stepA, stepB) {
  if (!stepA || !stepB) {
    return { compatible: true, blendDuration: 0.20, transitionClip: null, note: 'Начальный шаг' };
  }

  const stanceA = stepA.stance || 'zenkutsu';
  const stanceB = stepB.stance || 'zenkutsu';
  const deltaYaw = Math.abs(normalizeAngleDeg(stepB.facingDeg - stepA.facingDeg));

  // Одинаковая стойка и прямое продолжение
  if (stanceA === stanceB && deltaYaw === 0) {
    return {
      compatible: true,
      blendDuration: 0.18,
      transitionClip: null,
      note: `Непрерывный ход в стойке ${stanceB}`,
    };
  }

  // Переход в кокуцу-дати с поворотом через спину (лицом к камере на 180° или поворот на 90°)
  if (stanceB === 'kokutsu' && (deltaYaw > 130 || (deltaYaw >= 80 && deltaYaw <= 100))) {
    const transClip = stepB.stepFoot === 'right' ? 'turn_into_kokutsu_right' : 'turn_into_kokutsu_left';
    return {
      compatible: true,
      blendDuration: 0.34,
      transitionClip: transClip,
      note: deltaYaw > 130
        ? 'Поворот через спину лицом к камере в стойку Кокуцу-дати (Сюто-укэ)'
        : 'Поворот через спину на 90° в стойку Кокуцу-дати (Сюто-укэ)',
    };
  }

  // Поворот на 90°
  if (deltaYaw >= 80 && deltaYaw <= 100) {
    const transClip = deltaYaw > 0 ? 'turn_and_block' : 'turn_and_step';
    return {
      compatible: true,
      blendDuration: 0.28,
      transitionClip: transClip,
      note: `Поворот на 90° с переходом ${stanceA} -> ${stanceB}`,
    };
  }

  // Разворот на 180° или 270° через спину
  if (deltaYaw > 130) {
    return {
      compatible: true,
      blendDuration: 0.35,
      transitionClip: 'turn_with_step_left',
      note: `Разворот на ${deltaYaw}° с переходом ${stanceA} -> ${stanceB}`,
    };
  }

  // Смена стойки на месте или с шагом (например дзэнкуцу -> кокуцу)
  if (stanceA !== stanceB) {
    const transName = `enter_${stanceB}_${stepB.stepFoot || 'left'}`;
    return {
      compatible: true,
      blendDuration: 0.30,
      transitionClip: transName,
      note: `Смена стойки: ${stanceA} -> ${stanceB}`,
    };
  }

  return {
    compatible: true,
    blendDuration: 0.25,
    transitionClip: null,
    note: 'Согласованный переход',
  };
}

/**
 * Главный сценарийный компилятор Ката Шотокан.
 * Преобразует сырой JSON любого ката (все 26 файлов public/kata_data/*.json)
 * в структурированный стандартизированный массив выполнения ComposedKataStep[].
 */
export function compileKataScenario(rawSteps = [], kataSlug = 'heian_shodan', options = {}) {
  const stepsList = Array.isArray(rawSteps) && rawSteps.length > 0 ? rawSteps : [];
  if (stepsList.length === 0) {
    return { steps: [], embusenPoints: [], totalDuration: 0, meta: { kataSlug, totalSteps: 0 } };
  }

  let prevFacingDeg = 0;
  let curX = 0;
  let curZ = 0;
  let cumulativeTime = 0;

  const canonicalPoints = CANONICAL_EMBUSEN[kataSlug] || null;

  const composedSteps = stepsList.map((raw, idx) => {
    // 1. Извлечение ориентации и углов
    const rot = parseStepOrientation(raw, prevFacingDeg);
    const facingDeg = rot.targetFacingDeg;
    const deltaYawDeg = rot.deltaYawDeg;
    prevFacingDeg = facingDeg;

    // 2. Разрешение техники и клипа анимации
    const resolvedClip = resolveComposedClip(raw);
    const trans = parseTransitionCode(raw.S);

    // 3. Расчет позиции шага на татами (эмбусэн)
    let stepPos = [0, 0, 0];
    if (canonicalPoints && canonicalPoints[idx]) {
      const cp = canonicalPoints[idx];
      stepPos = [cp[0], 0, cp[2]];
      curX = cp[0];
      curZ = cp[2];
    } else {
      // Кинематический расчет смещения
      let stepDx = raw.Root_Displacement_X;
      let stepDz = raw.Root_Displacement_Z;

      if (stepDx === undefined || stepDz === undefined) {
        let stride = 0.90;
        if (raw.stance === 'moto' || (raw.Technique && raw.Technique.toLowerCase().includes('мото'))) {
          stride = 0.45; // Стойка мото-дати: ровно половина длины дзэнкуцу-дати
        }
        if (trans.type === 'hold' || (raw.Direction && raw.Direction.toLowerCase().includes('на месте'))) {
          stepDx = 0;
          stepDz = 0;
        } else if (trans.type === 'jump') {
          const jumpDistance = 1.1;
          stepDx = jumpDistance * Math.sin(rot.targetFacingRad);
          stepDz = jumpDistance * Math.cos(rot.targetFacingRad);
        } else if (raw.Direction && raw.Direction.toLowerCase().includes('назад')) {
          stepDx = -stride * Math.sin(rot.targetFacingRad);
          stepDz = -stride * Math.cos(rot.targetFacingRad);
        } else {
          stepDx = stride * Math.sin(rot.targetFacingRad);
          stepDz = stride * Math.cos(rot.targetFacingRad);
        }
      }
      curX += stepDx;
      curZ += stepDz;
      stepPos = [curX, 0, curZ];
    }

    // 4. Расчет таймингов
    const scale = typeof raw.scale === 'number' && raw.scale > 0 ? raw.scale : 1.0;
    const stepDuration = +(resolvedClip.duration * scale).toFixed(2);
    const startTime = +cumulativeTime.toFixed(2);
    cumulativeTime += stepDuration;
    const endTime = +cumulativeTime.toFixed(2);

    const mocapEv = (kataSlug === 'heian_shodan' && HEIAN_SHODAN_CANONICAL_EVENTS[idx]) ? HEIAN_SHODAN_CANONICAL_EVENTS[idx] : null;
    const mocapStartTime = mocapEv ? mocapEv.startTime : startTime;
    const mocapEndTime = mocapEv ? mocapEv.endTime : endTime;

    // 5. Маркер КИАЙ
    const isKiai = Boolean(
      raw.kiai ||
      (kataSlug === 'heian_shodan' && (idx + 1 === 9 || idx + 1 === 17)) ||
      (raw.Title && raw.Title.includes('КИАЙ')) ||
      (raw.Technique && raw.Technique.includes('КИАЙ'))
    );

    // 6. Формирование стандартизированного объекта шага
    const composed = {
      stepId: `step_${idx + 1}`,
      moveNumber: raw.n || idx + 1,
      title: raw.Technique || resolvedClip.title,
      technique: resolvedClip.title,
      techniqueCode: raw.T || 'T_technique',
      stance: raw.stance || 'zenkutsu',
      stanceIn: idx === 0 ? 'heisoku' : (stepsList[idx - 1]?.stance || 'zenkutsu'),
      stanceOut: raw.stance || 'zenkutsu',
      clipName: resolvedClip.clipName,
      fallbackClipName: resolvedClip.fallback || 'idle_shizentai',
      transitionClipName: null,
      displacement: [stepPos[0], 0, stepPos[2]],
      position: stepPos,
      worldPosition: stepPos,
      deltaYawDeg,
      facingDeg,
      targetFacingRad: rot.targetFacingRad,
      rotation: [0, rot.targetFacingRad, 0],
      pivotFoot: trans.pivotFoot,
      stepFoot: trans.stepFoot,
      pivotType: trans.type,
      stateIn: {
        stance: idx === 0 ? 'heisoku' : (stepsList[idx - 1]?.stance || 'zenkutsu'),
        facingDeg: normalizeAngleDeg(facingDeg - deltaYawDeg),
        position: idx === 0 ? [0, 0, 0] : (stepsList[idx - 1]?.position || [0, 0, 0]),
      },
      stateOut: {
        stance: raw.stance || 'zenkutsu',
        facingDeg,
        position: stepPos,
      },
      duration: stepDuration,
      startTime,
      endTime,
      mocapStartTime,
      mocapEndTime,
      scale,
      kiai: isKiai,
      rootMotionMode: 'composed',
      blendDuration: 0.25,
      note: raw.note || '',
      // Обратная совместимость с прежними полями
      ...raw,
      Technique: raw.Technique || resolvedClip.title,
    };

    return composed;
  });

  // Взаимная проверка совместимости смежных шагов
  for (let i = 0; i < composedSteps.length - 1; i++) {
    const cur = composedSteps[i];
    const next = composedSteps[i + 1];
    const compat = evaluateStepCompatibility(cur, next);
    next.blendDuration = compat.blendDuration;
    next.transitionClipName = compat.transitionClip;
    next.compatibilityNote = compat.note;
  }

  const embusenPoints = composedSteps.map((s) => [s.position[0], 0.02, s.position[2]]);

  return {
    steps: composedSteps,
    embusenPoints,
    totalDuration: +cumulativeTime.toFixed(2),
    meta: {
      kataSlug,
      totalSteps: composedSteps.length,
      kiaiSteps: composedSteps.filter((s) => s.kiai).map((s) => s.moveNumber),
    },
  };
}
