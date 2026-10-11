/**
 * seed-animation-system.js
 * Наполнение БД расширенной библиотекой клипов, матрицей переходов,
 * привязкой шагов 26 Ката к клипам и созданием 26 стандартных Бункаев (2 и 3 бойца).
 * Запуск: node scripts/seed-animation-system.js (из папки server/)
 */
require('dotenv').config();
const { poolPromise, sql } = require('../src/config/database');

const CORE_CLIPS = [
  // Стойки (зацикленные)
  {
    name: 'idle_shizentai',
    title: 'Стойка Сидзэнтай (Йой / Хэйко)',
    category: 'stance',
    duration: 2.0,
    stanceIn: 'shizentai',
    stanceOut: 'shizentai',
    interaction: 'non_contact',
    optDist: 2.0,
    tolMin: 0.5,
    tolMax: 5.0,
  },
  {
    name: 'zenkutsu_dachi_left',
    title: 'Дзэнкуцу-дати (левосторонняя наступательная)',
    category: 'stance',
    duration: 2.0,
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_left',
    leadIn: 'L',
    leadOut: 'L',
    interaction: 'non_contact',
    optDist: 1.8,
  },
  {
    name: 'zenkutsu_dachi_right',
    title: 'Дзэнкуцу-дати (правосторонняя наступательная)',
    category: 'stance',
    duration: 2.0,
    stanceIn: 'zenkutsu_dachi_right',
    stanceOut: 'zenkutsu_dachi_right',
    leadIn: 'R',
    leadOut: 'R',
    interaction: 'non_contact',
    optDist: 1.8,
  },
  {
    name: 'kokutsu_dachi_left',
    title: 'Кокуцу-дати (левосторонняя защитная)',
    category: 'stance',
    duration: 2.0,
    stanceIn: 'kokutsu_dachi_left',
    stanceOut: 'kokutsu_dachi_left',
    leadIn: 'L',
    leadOut: 'L',
    interaction: 'non_contact',
    optDist: 1.8,
  },
  {
    name: 'kokutsu_dachi_right',
    title: 'Кокуцу-дати (правосторонняя защитная)',
    category: 'stance',
    duration: 2.0,
    stanceIn: 'kokutsu_dachi_right',
    stanceOut: 'kokutsu_dachi_right',
    leadIn: 'R',
    leadOut: 'R',
    interaction: 'non_contact',
    optDist: 1.8,
  },
  {
    name: 'heiko_dachi',
    title: 'Хэйко-дати (параллельная стойка)',
    category: 'stance',
    duration: 2.0,
    stanceIn: 'heiko_dachi',
    stanceOut: 'heiko_dachi',
    interaction: 'non_contact',
    optDist: 2.0,
  },
  {
    name: 'fudo_dachi',
    title: 'Фудо-дати (укоренённая стойка Сочин)',
    category: 'stance',
    duration: 2.0,
    stanceIn: 'fudo_dachi',
    stanceOut: 'fudo_dachi',
    interaction: 'non_contact',
    optDist: 1.8,
  },
  {
    name: 'stance_kiba',
    title: 'Киба-дати (стойка всадника из Тэкки)',
    category: 'stance',
    duration: 2.0,
    stanceIn: 'stance_kiba',
    stanceOut: 'stance_kiba',
    interaction: 'non_contact',
    optDist: 1.6,
  },
  {
    name: 'stance_gankaku',
    title: 'Ганкаку-дати (стойка журавля на скале)',
    category: 'stance',
    duration: 2.0,
    stanceIn: 'stance_gankaku',
    stanceOut: 'stance_gankaku',
    interaction: 'non_contact',
    optDist: 1.8,
  },

  // Удары руками (Цуки и Учи)
  {
    name: 'choku_zuki',
    title: 'Чоку-цуки (прямой удар кулаком на месте)',
    category: 'strike',
    duration: 1.5,
    stanceIn: 'shizentai',
    stanceOut: 'shizentai',
    interaction: 'local_contact',
    optDist: 0.95,
    tolMin: 0.8,
    tolMax: 1.15,
    boneSelf: 'Hand.R',
    boneTarget: 'Spine1',
    timeStart: 0.45,
    timeEnd: 0.65,
  },
  {
    name: 'oi_zuki_right',
    title: 'Ой-цуки (правый пробивающий выпад кулаком)',
    category: 'strike',
    duration: 2.0,
    stanceIn: 'shizentai',
    stanceOut: 'zenkutsu_dachi_right',
    leadIn: 'neutral',
    leadOut: 'R',
    interaction: 'local_contact',
    optDist: 1.45,
    tolMin: 1.25,
    tolMax: 1.65,
    boneSelf: 'Hand.R',
    boneTarget: 'Spine1',
    timeStart: 0.7,
    timeEnd: 0.95,
  },
  {
    name: 'oi_zuki_left',
    title: 'Ой-цуки (левый пробивающий выпад кулаком)',
    category: 'strike',
    duration: 2.0,
    stanceIn: 'shizentai',
    stanceOut: 'zenkutsu_dachi_left',
    leadIn: 'neutral',
    leadOut: 'L',
    interaction: 'local_contact',
    optDist: 1.45,
    tolMin: 1.25,
    tolMax: 1.65,
    boneSelf: 'Hand.L',
    boneTarget: 'Spine1',
    timeStart: 0.7,
    timeEnd: 0.95,
  },
  {
    name: 'gyaku_zuki_right',
    title: 'Гяку-цуки (правый реверсивный удар от бедра)',
    category: 'strike',
    duration: 1.5,
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_left',
    leadIn: 'L',
    leadOut: 'L',
    interaction: 'local_contact',
    optDist: 1.05,
    tolMin: 0.9,
    tolMax: 1.25,
    boneSelf: 'Hand.R',
    boneTarget: 'Spine1',
    timeStart: 0.45,
    timeEnd: 0.7,
  },
  {
    name: 'gyaku_zuki_left',
    title: 'Гяку-цуки (левый реверсивный удар от бедра)',
    category: 'strike',
    duration: 1.5,
    stanceIn: 'zenkutsu_dachi_right',
    stanceOut: 'zenkutsu_dachi_right',
    leadIn: 'R',
    leadOut: 'R',
    interaction: 'local_contact',
    optDist: 1.05,
    tolMin: 0.9,
    tolMax: 1.25,
    boneSelf: 'Hand.L',
    boneTarget: 'Spine1',
    timeStart: 0.45,
    timeEnd: 0.7,
  },
  {
    name: 'chudan_zuki_right',
    title: 'Чудан-цуки (удар кулаком в средний уровень)',
    category: 'strike',
    duration: 1.5,
    stanceIn: 'zenkutsu_dachi_right',
    stanceOut: 'zenkutsu_dachi_right',
    interaction: 'local_contact',
    optDist: 1.0,
    tolMin: 0.85,
    tolMax: 1.2,
    boneSelf: 'Hand.R',
    boneTarget: 'Spine1',
    timeStart: 0.5,
    timeEnd: 0.7,
  },
  {
    name: 'jodan_zuki_right',
    title: 'Дзёдан-цуки (удар кулаком в голову)',
    category: 'strike',
    duration: 1.5,
    stanceIn: 'zenkutsu_dachi_right',
    stanceOut: 'zenkutsu_dachi_right',
    interaction: 'local_contact',
    optDist: 1.0,
    tolMin: 0.85,
    tolMax: 1.2,
    boneSelf: 'Hand.R',
    boneTarget: 'Head',
    timeStart: 0.5,
    timeEnd: 0.7,
  },
  {
    name: 'kizami_zuki',
    title: 'Кизами-цуки (быстрый передний джеб)',
    category: 'strike',
    duration: 1.2,
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_left',
    interaction: 'local_contact',
    optDist: 0.9,
    tolMin: 0.75,
    tolMax: 1.1,
    boneSelf: 'Hand.L',
    boneTarget: 'Head',
    timeStart: 0.35,
    timeEnd: 0.55,
  },
  {
    name: 'ren_zuki',
    title: 'Рэн-цуки (серия из двух ударов: левый + правый)',
    category: 'strike',
    duration: 2.2,
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_left',
    interaction: 'local_contact',
    optDist: 1.1,
    tolMin: 0.95,
    tolMax: 1.3,
    boneSelf: 'Hand.R',
    boneTarget: 'Spine1',
    timeStart: 0.8,
    timeEnd: 1.3,
  },
  {
    name: 'sanbon_zuki',
    title: 'Санбон-цуки (тройная каноническая связка ударов)',
    category: 'strike',
    duration: 2.8,
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_right',
    interaction: 'local_contact',
    optDist: 1.4,
    tolMin: 1.15,
    tolMax: 1.6,
    boneSelf: 'Hand.R',
    boneTarget: 'Spine1',
    timeStart: 1.2,
    timeEnd: 1.8,
  },
  {
    name: 'uraken_uchi',
    title: 'Уракэн-учи (хлесткий удар тыльной стороной кулака)',
    category: 'strike',
    duration: 1.5,
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_left',
    interaction: 'local_contact',
    optDist: 0.95,
    tolMin: 0.8,
    tolMax: 1.15,
    boneSelf: 'Hand.R',
    boneTarget: 'Head',
    timeStart: 0.45,
    timeEnd: 0.7,
  },
  {
    name: 'tetsui_uchi',
    title: 'Тэтцуи-учи (сокрушительный удар кулаком-молотом)',
    category: 'strike',
    duration: 1.6,
    stanceIn: 'stance_kiba',
    stanceOut: 'stance_kiba',
    interaction: 'local_contact',
    optDist: 0.9,
    tolMin: 0.75,
    tolMax: 1.1,
    boneSelf: 'Hand.R',
    boneTarget: 'Neck',
    timeStart: 0.5,
    timeEnd: 0.75,
  },
  {
    name: 'empi_uchi',
    title: 'Эмпи-учи (круговой сокрушительный удар локтем)',
    category: 'strike',
    duration: 1.4,
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_left',
    interaction: 'local_contact',
    optDist: 0.65,
    tolMin: 0.5,
    tolMax: 0.85,
    boneSelf: 'LowerArm.R',
    boneTarget: 'Head',
    timeStart: 0.4,
    timeEnd: 0.65,
  },
  {
    name: 'shuto_uchi',
    title: 'Сюто-учи (рубящий удар ребром ладони)',
    category: 'strike',
    duration: 1.6,
    stanceIn: 'kokutsu_dachi_left',
    stanceOut: 'kokutsu_dachi_left',
    interaction: 'local_contact',
    optDist: 0.95,
    tolMin: 0.8,
    tolMax: 1.15,
    boneSelf: 'Hand.R',
    boneTarget: 'Neck',
    timeStart: 0.5,
    timeEnd: 0.75,
  },
  {
    name: 'morote_zuki',
    title: 'Моротэ-цуки (одновременный удар двумя кулаками)',
    category: 'strike',
    duration: 1.8,
    stanceIn: 'fudo_dachi',
    stanceOut: 'fudo_dachi',
    interaction: 'local_contact',
    optDist: 0.95,
    tolMin: 0.8,
    tolMax: 1.15,
    boneSelf: 'Hand.R',
    boneTarget: 'Spine1',
    timeStart: 0.55,
    timeEnd: 0.8,
  },

  // Защитные блоки (Укэ)
  {
    name: 'gedan_barai_left',
    title: 'Гэдан-барай (левый нижний смет предплечьем)',
    category: 'defense',
    duration: 1.8,
    stanceIn: 'shizentai',
    stanceOut: 'zenkutsu_dachi_left',
    leadIn: 'neutral',
    leadOut: 'L',
    interaction: 'local_contact',
    optDist: 1.2,
    tolMin: 1.0,
    tolMax: 1.45,
    boneSelf: 'LowerArm.L',
    boneTarget: 'Hand.R',
    timeStart: 0.6,
    timeEnd: 0.85,
  },
  {
    name: 'gedan_barai_right',
    title: 'Гэдан-барай (правый нижний смет предплечьем)',
    category: 'defense',
    duration: 1.8,
    stanceIn: 'shizentai',
    stanceOut: 'zenkutsu_dachi_right',
    leadIn: 'neutral',
    leadOut: 'R',
    interaction: 'local_contact',
    optDist: 1.2,
    tolMin: 1.0,
    tolMax: 1.45,
    boneSelf: 'LowerArm.R',
    boneTarget: 'Hand.L',
    timeStart: 0.6,
    timeEnd: 0.85,
  },
  {
    name: 'age_uke_left',
    title: 'Агэ-укэ (левый верхний восходящий блок головы)',
    category: 'defense',
    duration: 1.8,
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_left',
    interaction: 'local_contact',
    optDist: 1.15,
    tolMin: 0.95,
    tolMax: 1.4,
    boneSelf: 'LowerArm.L',
    boneTarget: 'Hand.R',
    timeStart: 0.55,
    timeEnd: 0.8,
  },
  {
    name: 'age_uke_right',
    title: 'Агэ-укэ (правый верхний восходящий блок головы)',
    category: 'defense',
    duration: 1.8,
    stanceIn: 'zenkutsu_dachi_right',
    stanceOut: 'zenkutsu_dachi_right',
    interaction: 'local_contact',
    optDist: 1.15,
    tolMin: 0.95,
    tolMax: 1.4,
    boneSelf: 'LowerArm.R',
    boneTarget: 'Hand.L',
    timeStart: 0.55,
    timeEnd: 0.8,
  },
  {
    name: 'soto_uke',
    title: 'Сото-укэ (блок предплечьем снаружи-внутрь)',
    category: 'defense',
    duration: 1.7,
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_left',
    interaction: 'local_contact',
    optDist: 1.05,
    tolMin: 0.85,
    tolMax: 1.3,
    boneSelf: 'LowerArm.R',
    boneTarget: 'Hand.R',
    timeStart: 0.5,
    timeEnd: 0.75,
  },
  {
    name: 'uchi_uke',
    title: 'Ути-укэ (блок предплечьем изнутри-наружу)',
    category: 'defense',
    duration: 1.7,
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_left',
    interaction: 'local_contact',
    optDist: 1.05,
    tolMin: 0.85,
    tolMax: 1.3,
    boneSelf: 'LowerArm.R',
    boneTarget: 'Hand.R',
    timeStart: 0.5,
    timeEnd: 0.75,
  },
  {
    name: 'shuto_uke',
    title: 'Сюто-укэ (блок ребром ладони в Кокуцу-дати)',
    category: 'defense',
    duration: 1.8,
    stanceIn: 'shizentai',
    stanceOut: 'kokutsu_dachi_left',
    interaction: 'local_contact',
    optDist: 1.15,
    tolMin: 0.95,
    tolMax: 1.35,
    boneSelf: 'LowerArm.L',
    boneTarget: 'Hand.R',
    timeStart: 0.55,
    timeEnd: 0.8,
  },
  {
    name: 'manji_uke',
    title: 'Маньдзи-укэ (вихревой блок верх/низ)',
    category: 'defense',
    duration: 2.0,
    stanceIn: 'kokutsu_dachi_left',
    stanceOut: 'kokutsu_dachi_left',
    interaction: 'local_contact',
    optDist: 1.1,
    tolMin: 0.9,
    tolMax: 1.3,
    boneSelf: 'LowerArm.L',
    boneTarget: 'Hand.R',
    timeStart: 0.6,
    timeEnd: 0.9,
  },

  // Удары ногами (Гэри)
  {
    name: 'mae_geri_right',
    title: 'Маэ-гэри (правый прямой хлесткий удар ногой)',
    category: 'kick',
    duration: 1.8,
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_right',
    interaction: 'local_contact',
    optDist: 1.5,
    tolMin: 1.2,
    tolMax: 1.8,
    boneSelf: 'Foot.R',
    boneTarget: 'Spine',
    timeStart: 0.65,
    timeEnd: 0.9,
  },
  {
    name: 'mae_geri_left',
    title: 'Маэ-гэри (левый прямой хлесткий удар ногой)',
    category: 'kick',
    duration: 1.8,
    stanceIn: 'zenkutsu_dachi_right',
    stanceOut: 'zenkutsu_dachi_left',
    interaction: 'local_contact',
    optDist: 1.5,
    tolMin: 1.2,
    tolMax: 1.8,
    boneSelf: 'Foot.L',
    boneTarget: 'Spine',
    timeStart: 0.65,
    timeEnd: 0.9,
  },
  {
    name: 'yoko_geri',
    title: 'Ёко-гэри (боковой проникающий удар ребром стопы)',
    category: 'kick',
    duration: 2.0,
    stanceIn: 'stance_kiba',
    stanceOut: 'stance_kiba',
    interaction: 'local_contact',
    optDist: 1.6,
    tolMin: 1.3,
    tolMax: 1.9,
    boneSelf: 'Foot.R',
    boneTarget: 'Spine1',
    timeStart: 0.7,
    timeEnd: 1.0,
  },
  {
    name: 'mawashi_geri',
    title: 'Маваси-гэри (круговой удар подъемом стопы)',
    category: 'kick',
    duration: 2.0,
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_left',
    interaction: 'local_contact',
    optDist: 1.5,
    tolMin: 1.2,
    tolMax: 1.8,
    boneSelf: 'Foot.R',
    boneTarget: 'Head',
    timeStart: 0.7,
    timeEnd: 1.0,
  },
  {
    name: 'ushiro_geri',
    title: 'Усиро-гэри (удар пяткой назад с разворотом)',
    category: 'kick',
    duration: 2.2,
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_left',
    interaction: 'local_contact',
    optDist: 1.55,
    tolMin: 1.25,
    tolMax: 1.85,
    boneSelf: 'Foot.R',
    boneTarget: 'Spine',
    timeStart: 0.8,
    timeEnd: 1.1,
  },

  // Локомоция и переходы
  {
    name: 'step_forward',
    title: 'Шаг вперед (Сури-аси)',
    category: 'locomotion',
    duration: 1.2,
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_right',
    interaction: 'non_contact',
    optDist: 1.5,
  },
  {
    name: 'step_backward',
    title: 'Шаг назад',
    category: 'locomotion',
    duration: 1.2,
    stanceIn: 'zenkutsu_dachi_right',
    stanceOut: 'zenkutsu_dachi_left',
    interaction: 'non_contact',
    optDist: 1.5,
  },
  {
    name: 'slide_forward',
    title: 'Цуги-аси (скольжение вперед без смены ноги)',
    category: 'locomotion',
    duration: 1.0,
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_left',
    interaction: 'non_contact',
    optDist: 1.3,
  },
  {
    name: 'slide_backward',
    title: 'Скольжение назад (разрыв дистанции)',
    category: 'locomotion',
    duration: 1.0,
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_left',
    interaction: 'non_contact',
    optDist: 1.6,
  },
  {
    name: 'turn_left',
    title: 'Разворот влево 90° (Маваттэ)',
    category: 'locomotion',
    duration: 1.4,
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_left',
    interaction: 'non_contact',
    optDist: 1.5,
  },
  {
    name: 'turn_right',
    title: 'Разворот вправо 90° (Маваттэ)',
    category: 'locomotion',
    duration: 1.4,
    stanceIn: 'zenkutsu_dachi_right',
    stanceOut: 'zenkutsu_dachi_right',
    interaction: 'non_contact',
    optDist: 1.5,
  },
  {
    name: 'enter_zenkutsu_left',
    title: 'Вход в Дзэнкуцу-дати влево',
    category: 'transition',
    duration: 1.0,
    stanceIn: 'shizentai',
    stanceOut: 'zenkutsu_dachi_left',
    interaction: 'non_contact',
  },
  {
    name: 'exit_zenkutsu_left',
    title: 'Выход из Дзэнкуцу-дати в Сидзэнтай',
    category: 'transition',
    duration: 1.0,
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'shizentai',
    interaction: 'non_contact',
  },
  {
    name: 'enter_kokutsu_left',
    title: 'Вход в Кокуцу-дати',
    category: 'transition',
    duration: 1.0,
    stanceIn: 'shizentai',
    stanceOut: 'kokutsu_dachi_left',
    interaction: 'non_contact',
  },
  {
    name: 'exit_kokutsu_left',
    title: 'Выход из Кокуцу-дати в Сидзэнтай',
    category: 'transition',
    duration: 1.0,
    stanceIn: 'kokutsu_dachi_left',
    stanceOut: 'shizentai',
    interaction: 'non_contact',
  },

  // Парные специализированные клипы бункая (Coupled Pairs)
  {
    name: 'bunkai_shuto_counter_tori',
    title: 'Тори: Защита Сюто-укэ и контрудар Гяку-цуки',
    category: 'coupled_bunkai',
    duration: 3.2,
    stanceIn: 'shizentai',
    stanceOut: 'zenkutsu_dachi_right',
    interaction: 'coupled_pair',
    optDist: 1.35,
    tolMin: 1.15,
    tolMax: 1.55,
    boneSelf: 'LowerArm.L',
    boneTarget: 'LowerArm.R',
    timeStart: 1.2,
    timeEnd: 1.8,
  },
  {
    name: 'bunkai_shuto_counter_uke',
    title: 'Укэ 1: Мощный выпад Ой-цуки и реакция на сбив',
    category: 'coupled_bunkai',
    duration: 3.2,
    stanceIn: 'shizentai',
    stanceOut: 'zenkutsu_dachi_right',
    interaction: 'coupled_pair',
    optDist: 1.35,
    tolMin: 1.15,
    tolMax: 1.55,
    boneSelf: 'Hand.R',
    boneTarget: 'Spine1',
    timeStart: 1.2,
    timeEnd: 1.8,
  },
  {
    name: 'bunkai_age_empi_tori',
    title: 'Тори: Сбив Агэ-укэ и сокрушительный локоть Эмпи',
    category: 'coupled_bunkai',
    duration: 3.2,
    stanceIn: 'shizentai',
    stanceOut: 'zenkutsu_dachi_left',
    interaction: 'coupled_pair',
    optDist: 1.15,
    tolMin: 0.95,
    tolMax: 1.35,
    boneSelf: 'LowerArm.R',
    boneTarget: 'Head',
    timeStart: 1.1,
    timeEnd: 1.7,
  },
  {
    name: 'bunkai_age_empi_uke',
    title: 'Укэ 1: Атака Дзёдан и смещение назад',
    category: 'coupled_bunkai',
    duration: 3.2,
    stanceIn: 'shizentai',
    stanceOut: 'zenkutsu_dachi_right',
    interaction: 'coupled_pair',
    optDist: 1.15,
    tolMin: 0.95,
    tolMax: 1.35,
    boneSelf: 'Hand.R',
    boneTarget: 'Head',
    timeStart: 1.1,
    timeEnd: 1.7,
  },
  {
    name: 'bunkai_gedan_counter_tori',
    title: 'Тори: Смет Гэдан-барай удара ногой и добивание Тэтцуи',
    category: 'coupled_bunkai',
    duration: 3.2,
    stanceIn: 'shizentai',
    stanceOut: 'stance_kiba',
    interaction: 'coupled_pair',
    optDist: 1.4,
    tolMin: 1.2,
    tolMax: 1.6,
    boneSelf: 'LowerArm.L',
    boneTarget: 'Foot.R',
    timeStart: 1.1,
    timeEnd: 1.6,
  },
  {
    name: 'bunkai_gedan_counter_uke',
    title: 'Укэ 1: Атака ногой Маэ-гэри и потеря устойчивости',
    category: 'coupled_bunkai',
    duration: 3.2,
    stanceIn: 'shizentai',
    stanceOut: 'zenkutsu_dachi_left',
    interaction: 'coupled_pair',
    optDist: 1.4,
    tolMin: 1.2,
    tolMax: 1.6,
    boneSelf: 'Foot.R',
    boneTarget: 'Spine',
    timeStart: 1.1,
    timeEnd: 1.6,
  },
  {
    name: 'bunkai_flank_distraction_uke2',
    title: 'Укэ 2: Фланговая отвлекающая атака Дзёдан',
    category: 'coupled_bunkai',
    duration: 3.2,
    stanceIn: 'zenkutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_left',
    interaction: 'local_contact',
    optDist: 1.3,
    tolMin: 1.0,
    tolMax: 1.6,
    boneSelf: 'Hand.L',
    boneTarget: 'Head',
    timeStart: 1.4,
    timeEnd: 1.9,
  },
  {
    name: 'bunkai_kuzushi_sweep_tori',
    title: 'Тори: Захват запястья, подсечка и бросок на татами',
    category: 'coupled_bunkai',
    duration: 3.6,
    stanceIn: 'kokutsu_dachi_left',
    stanceOut: 'zenkutsu_dachi_left',
    interaction: 'coupled_pair',
    optDist: 0.95,
    tolMin: 0.8,
    tolMax: 1.15,
    boneSelf: 'Hand.L',
    boneTarget: 'Hand.R',
    timeStart: 1.2,
    timeEnd: 2.4,
  },
  {
    name: 'bunkai_kuzushi_sweep_uke',
    title: 'Укэ 1: Сваливание Кудзуси и падение на татами',
    category: 'coupled_bunkai',
    duration: 3.6,
    stanceIn: 'zenkutsu_dachi_right',
    stanceOut: 'shizentai',
    interaction: 'coupled_pair',
    optDist: 0.95,
    tolMin: 0.8,
    tolMax: 1.15,
    boneSelf: 'Foot.R',
    boneTarget: 'Foot.L',
    timeStart: 1.2,
    timeEnd: 2.4,
  },
];

async function seed() {
  const pool = await poolPromise;
  console.log('--- Наполнение таблицы AnimationClips ---');

  for (const c of CORE_CLIPS) {
    const q = `
      IF NOT EXISTS (SELECT 1 FROM dbo.AnimationClips WHERE Clip_Name = @name)
      BEGIN
        INSERT INTO dbo.AnimationClips (
          Clip_Name, Display_Name, Category, Duration, Stance_In, Stance_Out,
          Lead_In, Lead_Out, Interaction_Type, Optimal_Distance, Tolerance_Min, Tolerance_Max,
          Contact_Bone_Self, Contact_Bone_Target, Contact_Time_Start, Contact_Time_End
        ) VALUES (
          @name, @title, @category, @duration, @stanceIn, @stanceOut,
          @leadIn, @leadOut, @interaction, @optDist, @tolMin, @tolMax,
          @boneSelf, @boneTarget, @timeStart, @timeEnd
        );
      END
    `;
    const req = pool.request();
    req.input('name', c.name);
    req.input('title', c.title);
    req.input('category', c.category);
    req.input('duration', c.duration);
    req.input('stanceIn', c.stanceIn);
    req.input('stanceOut', c.stanceOut);
    req.input('leadIn', c.leadIn || null);
    req.input('leadOut', c.leadOut || null);
    req.input('interaction', c.interaction || 'non_contact');
    req.input('optDist', c.optDist || null);
    req.input('tolMin', c.tolMin || null);
    req.input('tolMax', c.tolMax || null);
    req.input('boneSelf', c.boneSelf || null);
    req.input('boneTarget', c.boneTarget || null);
    req.input('timeStart', c.timeStart || null);
    req.input('timeEnd', c.timeEnd || null);
    await req.query(q);
  }
  console.log(`✔ Вставлено/проверено ${CORE_CLIPS.length} анимационных клипов.`);

  // Заполняем ClipTransitions
  console.log('--- Наполнение таблицы ClipTransitions ---');
  const transitions = [
    { from: 'shizentai', to: 'zenkutsu_dachi_left', clip: 'enter_zenkutsu_left', direct: 1 },
    { from: 'zenkutsu_dachi_left', to: 'shizentai', clip: 'exit_zenkutsu_left', direct: 1 },
    { from: 'shizentai', to: 'kokutsu_dachi_left', clip: 'enter_kokutsu_left', direct: 1 },
    { from: 'kokutsu_dachi_left', to: 'shizentai', clip: 'exit_kokutsu_left', direct: 1 },
    { from: 'zenkutsu_dachi_left', to: 'zenkutsu_dachi_right', clip: 'step_forward', direct: 1 },
    { from: 'zenkutsu_dachi_right', to: 'zenkutsu_dachi_left', clip: 'step_backward', direct: 1 },
    { from: 'zenkutsu_dachi_left', to: 'kokutsu_dachi_left', direct: 1, blend: 0.35 },
    { from: 'kokutsu_dachi_left', to: 'zenkutsu_dachi_right', direct: 1, blend: 0.35 },
    { from: 'shizentai', to: 'stance_kiba', direct: 1, blend: 0.3 },
    { from: 'stance_kiba', to: 'shizentai', direct: 1, blend: 0.3 },
  ];

  for (const t of transitions) {
    const q = `
      DECLARE @tClipId INT = (SELECT Clip_ID FROM dbo.AnimationClips WHERE Clip_Name = @clip);
      IF NOT EXISTS (SELECT 1 FROM dbo.ClipTransitions WHERE From_Stance = @from AND To_Stance = @to)
      BEGIN
        INSERT INTO dbo.ClipTransitions (From_Stance, To_Stance, Transition_Clip_ID, Blending_Duration, Is_Direct_Blend_Allowed)
        VALUES (@from, @to, @tClipId, ISNULL(@blend, 0.25), @direct);
      END
    `;
    const req = pool.request();
    req.input('from', t.from);
    req.input('to', t.to);
    req.input('clip', t.clip || null);
    req.input('blend', t.blend || 0.25);
    req.input('direct', t.direct ? 1 : 0);
    await req.query(q);
  }
  console.log('✔ Матрица переходов стоек обновлена.');

  // Привязываем шаги Ката (KataSteps) к Clip_ID
  console.log('--- Привязка шагов Ката к анимационным клипам ---');
  await pool.request().query(`
    UPDATE s
    SET s.Clip_ID = c.Clip_ID,
        s.Stance_In = c.Stance_In,
        s.Stance_Out = c.Stance_Out
    FROM dbo.KataSteps s
    JOIN dbo.AnimationClips c ON (
      (s.Technique LIKE N'%Гэдан%' AND c.Clip_Name = 'gedan_barai_left') OR
      (s.Technique LIKE N'%Ой-цуки%' AND c.Clip_Name = 'oi_zuki_right') OR
      (s.Technique LIKE N'%Агэ-укэ%' AND c.Clip_Name = 'age_uke_left') OR
      (s.Technique LIKE N'%Сюто%' AND c.Clip_Name = 'shuto_uke') OR
      (s.Technique LIKE N'%Тэтцуи%' AND c.Clip_Name = 'tetsui_uchi') OR
      (s.Technique LIKE N'%Маэ-гэри%' AND c.Clip_Name = 'mae_geri_right')
    )
    WHERE s.Clip_ID IS NULL;
  `);

  // Обновляем шаги по умолчанию для тех, где техника нейтральная
  await pool.request().query(`
    DECLARE @yoiId INT = (SELECT Clip_ID FROM dbo.AnimationClips WHERE Clip_Name = 'idle_shizentai');
    UPDATE dbo.KataSteps
    SET Clip_ID = @yoiId, Stance_In = 'shizentai', Stance_Out = 'shizentai'
    WHERE Clip_ID IS NULL;
  `);
  console.log('✔ Шаги Ката успешно связаны с AnimationClips.');

  // Создаем стандартные бункаи для всех 26 Ката (если отсутствуют)
  console.log('--- Проверка и создание 26 стандартных Бункаев с шагами ---');
  const katas = (await pool.request().query('SELECT Kata_ID, Title FROM dbo.Kata ORDER BY Kata_ID')).recordset;
  const adminId = (await pool.request().query("SELECT TOP 1 User_ID FROM dbo.Users WHERE Role_ID = (SELECT Role_ID FROM dbo.Roles WHERE Role_Name = 'admin')")).recordset[0]?.User_ID || 1;

  for (const k of katas) {
    const existing = (await pool.request().input('kataId', k.Kata_ID).query('SELECT Bunkai_ID FROM dbo.Bunkai WHERE Kata_ID = @kataId')).recordset;
    let bunkaiId;

    if (existing.length === 0) {
      const insReq = pool.request();
      insReq.input('authorId', adminId);
      insReq.input('kataId', k.Kata_ID);
      insReq.input('title', `Канонический Бункай: ${k.Title}`);
      insReq.input('desc', `Официальный тактический разбор боевого применения канонических техник ката ${k.Title}. Содержит сценарии для парной работы (Тори и Укэ) и соревновательного командного бункая с тремя участниками.`);
      insReq.input('app', `Парное боевое применение ключевых связок ката ${k.Title} в ближнем и среднем бою против 1-2 атакующих соперников.`);
      const res = await insReq.query(`
        INSERT INTO dbo.Bunkai (Author_ID, Kata_ID, Title, Description, Application, Difficulty, Status)
        VALUES (@authorId, @kataId, @title, @desc, @app, N'intermediate', N'approved');
        SELECT SCOPE_IDENTITY() AS NewId;
      `);
      bunkaiId = res.recordset[0].NewId;
    } else {
      bunkaiId = existing[0].Bunkai_ID;
    }

    // Проверяем наличие шагов для этого бункая
    const stepCount = (await pool.request().input('bId', bunkaiId).query('SELECT COUNT(*) AS c FROM dbo.BunkaiSteps WHERE Bunkai_ID = @bId')).recordset[0].c;

    if (stepCount === 0) {
      // Создаем 3 канонических эпизода:
      // Эпизод 1: Защита Сюто-укэ от выпада Ой-цуки (2 участника)
      // Эпизод 2: Вход Агэ-укэ и локоть Эмпи (2 участника)
      // Эпизод 3: Командный соревновательный бункай против двух нападающих (3 участника: Тори, Укэ 1, Укэ 2)
      const shutoToriClip = (await pool.request().query("SELECT Clip_ID FROM dbo.AnimationClips WHERE Clip_Name = 'bunkai_shuto_counter_tori'")).recordset[0]?.Clip_ID;
      const shutoUkeClip = (await pool.request().query("SELECT Clip_ID FROM dbo.AnimationClips WHERE Clip_Name = 'bunkai_shuto_counter_uke'")).recordset[0]?.Clip_ID;
      const ageToriClip = (await pool.request().query("SELECT Clip_ID FROM dbo.AnimationClips WHERE Clip_Name = 'bunkai_age_empi_tori'")).recordset[0]?.Clip_ID;
      const ageUkeClip = (await pool.request().query("SELECT Clip_ID FROM dbo.AnimationClips WHERE Clip_Name = 'bunkai_age_empi_uke'")).recordset[0]?.Clip_ID;
      const uke2FlankClip = (await pool.request().query("SELECT Clip_ID FROM dbo.AnimationClips WHERE Clip_Name = 'bunkai_flank_distraction_uke2'")).recordset[0]?.Clip_ID;
      const sweepToriClip = (await pool.request().query("SELECT Clip_ID FROM dbo.AnimationClips WHERE Clip_Name = 'bunkai_kuzushi_sweep_tori'")).recordset[0]?.Clip_ID;
      const sweepUkeClip = (await pool.request().query("SELECT Clip_ID FROM dbo.AnimationClips WHERE Clip_Name = 'bunkai_kuzushi_sweep_uke'")).recordset[0]?.Clip_ID;

      // Шаг 1: Защита и контратака Сюто-укэ
      let s1 = await pool.request()
        .input('bId', bunkaiId)
        .input('num', 1)
        .input('title', 'Эпизод 1: Сюто-укэ тай-сабаки против выпада Ой-цуки')
        .input('desc', 'Укэ наносит мощный прямой удар в корпус. Тори уходит с линии атаки в Кокуцу-дати, сбивает предплечье блоком Сюто-укэ и наносит контрудар Гяку-цуки.')
        .input('dur', 3.2)
        .input('pCount', 2)
        .input('dist', 1.35)
        .input('angle', 0.0)
        .query(`
          INSERT INTO dbo.BunkaiSteps (Bunkai_ID, Step_Number, Title, Description, Duration, Participant_Count, Target_Distance, Target_Angle)
          VALUES (@bId, @num, @title, @desc, @dur, @pCount, @dist, @angle);
          SELECT SCOPE_IDENTITY() AS Id;
        `);
      const s1Id = s1.recordset[0].Id;

      await pool.request().query(`
        INSERT INTO dbo.BunkaiStepParticipants (Step_ID, Role, Clip_ID, Initial_Stance, Offset_X, Offset_Z, Rotation_Y)
        VALUES
          (${s1Id}, 'tori', ${shutoToriClip}, 'shizentai', 0, 0, 0),
          (${s1Id}, 'uke', ${shutoUkeClip}, 'shizentai', 0, 1.35, 3.14159);
      `);

      // Шаг 2: Вход под удар с Агэ-укэ и сокрушительный локоть
      let s2 = await pool.request()
        .input('bId', bunkaiId)
        .input('num', 2)
        .input('title', 'Эпизод 2: Восходящий блок Агэ-укэ и сокрушительный локоть Эмпи')
        .input('desc', 'Отражение удара в голову. Тори поднимает Агэ-укэ, закручивает атакующую руку и сближается для удара локтем Эмпи-учи в челюсть.')
        .input('dur', 3.2)
        .input('pCount', 2)
        .input('dist', 1.15)
        .input('angle', 0.0)
        .query(`
          INSERT INTO dbo.BunkaiSteps (Bunkai_ID, Step_Number, Title, Description, Duration, Participant_Count, Target_Distance, Target_Angle)
          VALUES (@bId, @num, @title, @desc, @dur, @pCount, @dist, @angle);
          SELECT SCOPE_IDENTITY() AS Id;
        `);
      const s2Id = s2.recordset[0].Id;

      await pool.request().query(`
        INSERT INTO dbo.BunkaiStepParticipants (Step_ID, Role, Clip_ID, Initial_Stance, Offset_X, Offset_Z, Rotation_Y)
        VALUES
          (${s2Id}, 'tori', ${ageToriClip}, 'shizentai', 0, 0, 0),
          (${s2Id}, 'uke', ${ageUkeClip}, 'shizentai', 0, 1.15, 3.14159);
      `);

      // Шаг 3: Соревновательный командный Бункай (3 бойца: Тори, Укэ 1, Укэ 2)
      let s3 = await pool.request()
        .input('bId', bunkaiId)
        .input('num', 3)
        .input('title', 'Эпизод 3: Командный Бункай — отражение фланговой атаки и бросок Кудзуси')
        .input('desc', 'Укэ 2 атакует с фланга, Укэ 1 атакует прямо. Тори нейтрализует фланговую атаку, выводит Укэ 1 из равновесия и проводит бросок на татами.')
        .input('dur', 3.6)
        .input('pCount', 3)
        .input('dist', 1.25)
        .input('angle', 0.0)
        .query(`
          INSERT INTO dbo.BunkaiSteps (Bunkai_ID, Step_Number, Title, Description, Duration, Participant_Count, Target_Distance, Target_Angle)
          VALUES (@bId, @num, @title, @desc, @dur, @pCount, @dist, @angle);
          SELECT SCOPE_IDENTITY() AS Id;
        `);
      const s3Id = s3.recordset[0].Id;

      await pool.request().query(`
        INSERT INTO dbo.BunkaiStepParticipants (Step_ID, Role, Clip_ID, Initial_Stance, Offset_X, Offset_Z, Rotation_Y)
        VALUES
          (${s3Id}, 'tori', ${sweepToriClip}, 'kokutsu_dachi_left', 0, 0, 0),
          (${s3Id}, 'uke', ${sweepUkeClip}, 'zenkutsu_dachi_right', 0, 1.25, 3.14159),
          (${s3Id}, 'uke2', ${uke2FlankClip}, 'zenkutsu_dachi_left', -1.3, 0.75, 1.41);
      `);
    }
  }

  console.log(`✔ Все 26 стандартных Бункаев снабжены структурированными 3D-шагами для 2 и 3 участников.`);
  console.log('=== СИДИРОВАНИЕ СИСТЕМЫ АНИМАЦИЙ УСПЕШНО ЗАВЕРШЕНО ===');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Ошибка сидирования:', err);
  process.exit(1);
});
