import { useState, useRef, useMemo, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import KarateMasterModel from '../three/KarateMasterModel';
import { SHOTOKAN_STANCES } from '../three/KaratekaAvatar';
import TraditionalDojo from '../three/TraditionalDojo';
import MocapStudio from '../components/mocap/MocapStudio';
import './MotionLabPage.css';

// Расширенный словарь канонических техник Шотокан
const TECHNIQUE_DESCRIPTIONS = {
  choku_zuki: {
    label: '👊 Чоку-цуки (Прямой удар кулаком на месте)',
    jp: '直突き · Choku-Zuki',
    level: 'Чудан / Дзёдан',
    desc: 'Базовый прямой удар кулаком со спиральным вращением предплечья (кимэ) и одновременным мощным отводом второй руки в хикитэ у ребер.',
    category: 'tsuki',
  },
  oi_zuki: {
    label: '👊 Ой-цуки (Прямой удар с выпадом в чудан)',
    jp: '追い突き · Oi-Zuki',
    level: 'Чудан',
    desc: 'Базовый пробивающий удар с шагом вперед из стойки Йой в Дзэнкуцу-дати. Ударная рука наносит прямой удар с вращением кулака, вторая рука резко срывается в хикитэ у бедра.',
    category: 'tsuki',
  },
  gyaku_zuki: {
    label: '💥 Гяку-цуки (Обратный реверсивный удар от бедра)',
    jp: '逆突き · Gyaku-Zuki',
    level: 'Чудан / Дзёдан',
    desc: 'Один из самых мощных и фундаментальных ударов каратэ. Наносится разноименной рукой от бедра с максимальным взрывным вращением таза и фиксацией кимэ.',
    category: 'tsuki',
  },
  kizami_zuki: {
    label: '⚡ Кизами-цуки (Быстрый передний удар — джеб каратэ)',
    jp: '刻み突き · Kizami-Zuki',
    level: 'Дзёдан',
    desc: 'Хлесткий жалящий удар передней рукой в верхний уровень (дзёдан) с микро-подшагом и мгновенным возвратом в стойку готовности Йой.',
    category: 'tsuki',
  },
  ren_zuki: {
    label: '🔄 Рэн-цуки (Связка «двойка»: левый джеб + правый прямой)',
    jp: '連突き · Ren-Zuki',
    level: 'Дзёдан + Чудан',
    desc: 'Классическая серия из двух непрерывных ударов руками: первый удар открывает оборону соперника, второй наносит сокрушительный урон.',
    category: 'tsuki',
  },
  sanbon_zuki: {
    label: '👊 Санбон-цуки (Тройная связка ударов руками)',
    jp: '三本突き · Sanbon-Zuki',
    level: 'Дзёдан + Чудан + Чудан',
    desc: 'Каноническая серия из трех ударов: Ой-цуки в голову (дзёдан) + Гяку-цуки в корпус (чудан) + завершающий акцентированный Ой-цуки с максимальным кимэ.',
    category: 'combo',
  },
  uraken_uchi: {
    label: '🥊 Уракэн-учи (Хлесткий удар тыльной стороной кулака)',
    jp: '裏拳打ち · Uraken-Uchi',
    level: 'Дзёдан',
    desc: 'Круговой удар тыльной стороной кулака в висок или нос. Выполняется за счет резкого щелчка локтевого сустава и запястья.',
    category: 'uchi',
  },
  tetsui_uchi: {
    label: '🔨 Тэтцуи-учи (Удар кулаком-молотом сверху-вниз)',
    jp: '鉄槌打ち · Tetsui-Uchi',
    level: 'Дзёдан / Чудан',
    desc: 'Нисходящий сокрушительный удар основанием сжатого кулака (молот) по ключице или затылку противника.',
    category: 'uchi',
  },
  empi_uchi: {
    label: '💥 Эмпи-учи / Хидзи-атэ (Сокрушительный удар локтем)',
    jp: '猿臂打ち · Empi-Uchi',
    level: 'Чудан / Дзёдан',
    desc: 'Круговой удар локтем (маваси-эмпи) на короткой дистанции. Ладонь второй руки встречает кулак для максимального концентрированного импульса.',
    category: 'uchi',
  },
  shuto_uchi: {
    label: '✋ Сюто-учи (Рубящий удар ребром открытой ладони)',
    jp: '手刀打ち · Shuto-Uchi',
    level: 'Дзёдан (шея/ключица)',
    desc: 'Диагональный рубящий удар ребром ладони (рука-меч) в область шеи или ключицы, с взведением ладони от противоположного уха.',
    category: 'uchi',
  },
  morote_zuki: {
    label: '⚡ Моротэ-цуки (Двойной параллельный удар двумя кулаками)',
    jp: '諸手突き · Morote-Zuki',
    level: 'Чудан',
    desc: 'Одновременный пробивающий удар обоими кулаками вперед на уровне груди из двойного хикитэ. Пробивает блок противника.',
    category: 'tsuki',
  },
  hook: {
    label: '🥊 Каги-цуки (Боковой крюк кулаком в корпус)',
    jp: '鉤突き · Kagi-Zuki',
    level: 'Чудан',
    desc: 'Боковой крюк согнутой рукой в подреберье в низкой укорененной стойке Киба-дати.',
    category: 'tsuki',
  },
  age_uke: {
    label: '🛡️ Агэ-укэ (Верхний восходящий блок головы)',
    jp: '上げ受け · Age-Uke',
    level: 'Дзёдан',
    desc: 'Восходящий блок предплечьем под углом 45° над лбом для отражения атак сверху.',
    category: 'uke',
  },
  soto_uke: {
    label: '🛡️ Сото-укэ (Блок предплечьем снаружи-внутрь)',
    jp: '外受け · Soto-Uke',
    level: 'Чудан',
    desc: 'Мощный сбивающий блок предплечьем снаружи-внутрь от уха к центральной линии корпуса в стойке Дзэнкуцу-дати.',
    category: 'uke',
  },
  uchi_uke: {
    label: '🛡️ Ути-укэ (Блок предплечьем изнутри-наружу)',
    jp: '内受け · Uchi-Uke',
    level: 'Чудан',
    desc: 'Защитный блок предплечьем снизу-вверх и наружу из-под противоположного локтя со сжатым кулаком.',
    category: 'uke',
  },
  gedan_barai: {
    label: '🥋 Гэдан-барай (Нижний смет предплечьем)',
    jp: '下段払い · Gedan-Barai',
    level: 'Гэдан',
    desc: 'Канонический нижний смет атакующих ударов в пах или средний уровень с отводом второй руки в хикитэ.',
    category: 'uke',
  },
  shuto_uke: {
    label: '✋ Сюто-укэ (Блок ребром ладони в Кокуцу-дати)',
    jp: '手刀受け · Shuto-Uke',
    level: 'Чудан / Дзёдан',
    desc: 'Защитный блок открытой ладонью с распределением 70% веса на согнутой задней ноге.',
    category: 'uke',
  },
  manji_uke: {
    label: '卍 Маньдзи-укэ (Двойной вихревой блок верх/низ)',
    jp: '卍受け · Manji-Uke',
    level: 'Дзёдан + Гэдан',
    desc: 'Канонический двойной блок в стойке кокуцу-дати из высших ката (Хэйан Годан, Дзион): верхний дзёдан-ути-укэ назад и нижний гэдан-барай вперед.',
    category: 'uke',
  },
  mae_geri: {
    label: '🦶 Маэ-гэри (Прямой хлесткий удар ногой)',
    jp: '前蹴り · Mae-Geri',
    level: 'Чудан / Дзёдан',
    desc: 'Прямой удар подушечками пальцев стопы (коси) в корпус с подъемом колена и резким щелчком.',
    category: 'geri',
  },
  yoko_geri: {
    label: '🦶 Ёко-гэри кэкоми (Боковой проникающий удар ногой)',
    jp: '横蹴り · Yoko-Geri',
    level: 'Чудан',
    desc: 'Сокрушительный линейный удар ребром стопы (сокуто) с высоким подъемом колена к груди и полным включением таза.',
    category: 'geri',
  },
  mawashi_geri: {
    label: '🔄 Маваси-гэри (Круговой удар ногой)',
    jp: '回し蹴り · Mawashi-Geri',
    level: 'Чудан / Дзёдан',
    desc: 'Взрывной круговой удар ногой по дуге с доворотом опорной стопы на 180°.',
    category: 'geri',
  },
  ushiro_geri: {
    label: '🦶 Усиро-гэри (Удар ногой назад пяткой)',
    jp: '後ろ蹴り · Ushiro-Geri',
    level: 'Чудан',
    desc: 'Прямолинейный удар пяткой (какато) назад с поворотом головы через плечо для контроля цели и балансирующим наклоном корпуса.',
    category: 'geri',
  },
  mae_geri_gyaku_zuki: {
    label: '⚡ Маэ-гэри + Гяку-цуки (Удар ногой с выпадом и контрударом)',
    jp: '前蹴り・逆突き · Mae-Geri Gyaku-Zuki',
    level: 'Чудан',
    desc: 'Взрывная связка: прямой проникающий удар ногой маэ-гэри вперед с мгновенным приземлением в стойку дзэнкуцу-дати и сокрушительным реверсивным ударом гяку-цуки от бедра.',
    category: 'combo',
  },
  age_uke_gyaku_zuki: {
    label: '🛡️ Агэ-укэ + Гяку-цуки (Защита верхним блоком и контратака)',
    jp: '上げ受け・逆突き · Age-Uke Gyaku-Zuki',
    level: 'Дзёдан + Чудан',
    desc: 'Классическая комбинация кихон-иппон: сбив атакующей руки блоком агэ-укэ над головой и мгновенный пробивающий контрудар гяку-цуки в ребра противника.',
    category: 'combo',
  },
  gankaku_shuto: {
    label: '🦩 Ганкаку-Сюто (Стойка журавля Цуру-аси-дати и удар Сюто)',
    jp: '岩鶴・手刀 · Gankaku-Shuto',
    level: 'Дзёдан / Баланс',
    desc: 'Визитная карточка ката Ганкаку: балансирование на одной ноге в стойке журавля Цуру-аси-дати с одновременным рубящим ударом ребром ладони сюто-учи.',
    category: 'combo',
  },
  step: {
    label: '🥋 Цуги-аси (Скользящий подшаг)',
    jp: '継ぎ足 · Tsugi-Ashi',
    level: 'Перемещение',
    desc: 'Быстрое сокращение дистанции (ма-ай) для входа в атаку без потери равновесия.',
    category: 'combo',
  },
  heian_shodan: {
    label: '📜 Хэйан Шодан (Ката целиком)',
    jp: '平安初段 · Heian Shodan',
    level: 'Форма 21 движение',
    desc: 'Фундаментальное базовое ката стиля Шотокан: геометрия эмбусэн, отработка стойки Дзэнкуцу-дати, блоков Гэдан-барай, Агэ-укэ, ударов Ой-цуки и Сюто-укэ.',
    category: 'kata',
  },

  // --- НОВАЯ МОДУЛЬНАЯ БИБЛИОТЕКА ШОТОКАН (87 ACTIONS ИЗ GLB) ---
  oi_zuki_right: {
    label: '👊 Ой-цуки правый (Прямой с выпадом в чудан)',
    jp: '右追い突き · Right Oi-Zuki',
    level: 'Чудан',
    desc: 'Удар с выпадом правой ногой и рукой в Дзэнкуцу-дати, левая в хикитэ у ребер.',
    category: 'tsuki',
  },
  oi_zuki_left: {
    label: '👊 Ой-цуки левый (Прямой с выпадом в чудан)',
    jp: '左追い突き · Left Oi-Zuki',
    level: 'Чудан',
    desc: 'Удар с выпадом левой ногой и рукой в Дзэнкуцу-дати, правая в хикитэ у ребер.',
    category: 'tsuki',
  },
  gyaku_zuki_right: {
    label: '💥 Гяку-цуки правый (Реверсивный удар от бедра)',
    jp: '右逆突き · Right Gyaku-Zuki',
    level: 'Чудан',
    desc: 'Мощнейший реверсивный удар правой рукой с взрывным вращением таза Koshi.',
    category: 'tsuki',
  },
  gyaku_zuki_left: {
    label: '💥 Гяку-цуки левый (Реверсивный удар от бедра)',
    jp: '左逆突き · Left Gyaku-Zuki',
    level: 'Чудан',
    desc: 'Реверсивный удар левой рукой от бедра с взрывным вращением таза Koshi.',
    category: 'tsuki',
  },
  chudan_zuki_right: {
    label: '👊 Чудан-цуки (Прямой удар в солнечное сплетение)',
    jp: '中段突き · Chudan-Zuki',
    level: 'Чудан',
    desc: 'Прямой удар в средний уровень с полным оборотом кулака на 180° и фиксацией кимэ.',
    category: 'tsuki',
  },
  jodan_zuki_right: {
    label: '🎯 Дзёдан-цуки (Прямой удар в верхний уровень)',
    jp: '上段突き · Jodan-Zuki',
    level: 'Дзёдан',
    desc: 'Прямой удар в челюсть/подбородок из стойки Дзэнкуцу-дати.',
    category: 'tsuki',
  },
  gedan_barai_left: {
    label: '🥋 Гэдан-барай левый (Нижний смет предплечьем)',
    jp: '左下段払い · Left Gedan-Barai',
    level: 'Гэдан',
    desc: 'Канонический нижний смет левым предплечьем под 45° над передним бедром.',
    category: 'uke',
  },
  gedan_barai_right: {
    label: '🥋 Гэдан-барай правый (Нижний смет предплечьем)',
    jp: '右下段払い · Right Gedan-Barai',
    level: 'Гэдан',
    desc: 'Канонический нижний смет правым предплечьем под 45° над передним бедром.',
    category: 'uke',
  },
  age_uke_left: {
    label: '🛡️ Агэ-укэ левый (Верхний восходящий блок головы)',
    jp: '左上げ受け · Left Age-Uke',
    level: 'Дзёдан',
    desc: 'Восходящий блок левым предплечьем под 45° над лбом, кулак наружу, правый в хикитэ.',
    category: 'uke',
  },
  age_uke_right: {
    label: '🛡️ Агэ-укэ правый (Верхний восходящий блок головы)',
    jp: '右上げ受け · Right Age-Uke',
    level: 'Дзёдан',
    desc: 'Восходящий блок правым предплечьем под 45° над лбом, кулак наружу, левый в хикитэ.',
    category: 'uke',
  },
  mae_geri_right: {
    label: '🦶 Маэ-гэри правый (Прямой удар подушечками стопы коси)',
    jp: '右前蹴り · Right Mae-Geri',
    level: 'Чудан',
    desc: 'Взрывной подъем правого колена, хлесткий выброс голени и мгновенный возврат (хикиаси).',
    category: 'geri',
  },
  mae_geri_left: {
    label: '🦶 Маэ-гэри левый (Прямой удар подушечками стопы коси)',
    jp: '左前蹴り · Left Mae-Geri',
    level: 'Чудан',
    desc: 'Взрывной подъем левого колена, хлесткий выброс голени и мгновенный возврат (хикиаси).',
    category: 'geri',
  },
  mae_geri_chamber_right: {
    label: '🦵 Камаэ колена Маэ-гэри (Взведение)',
    jp: '前蹴り構え · Mae-Geri Chamber',
    level: 'Баланс',
    desc: 'Высокий подъем согнутого колена и прижатие пятки перед ударом.',
    category: 'geri',
  },
  step_forward: {
    label: '👣 Шаг вперед (Сури-аси дугой по полу)',
    jp: '前進 · Step Forward',
    level: 'Локомоция',
    desc: 'Канонический шаг вперед с дугообразным сближением стоп без отрыва от татами.',
    category: 'loco',
  },
  step_backward: {
    label: '👣 Шаг назад (Сури-аси)',
    jp: '後退 · Step Backward',
    level: 'Локомоция',
    desc: 'Шаг назад с понижением центра тяжести и контролем баланса.',
    category: 'loco',
  },
  slide_forward: {
    label: '🥋 Цуги-аси (Скользящий подшаг вперед)',
    jp: '継ぎ足 · Tsugi-Ashi Forward',
    level: 'Локомоция',
    desc: 'Взрывное сокращение дистанции скольжением обеих стоп.',
    category: 'loco',
  },
  slide_backward: {
    label: '🥋 Скольжение назад (Цуги-аси)',
    jp: '後方継ぎ足 · Tsugi-Ashi Back',
    level: 'Локомоция',
    desc: 'Быстрый разрыв дистанции со скольжением.',
    category: 'loco',
  },
  turn_left: {
    label: '🔄 Поворот влево (45°)',
    jp: '左転回 · Turn Left',
    level: 'Поворот',
    desc: 'Локальный разворот корпуса и стоп влево.',
    category: 'turns',
  },
  turn_right: {
    label: '🔄 Поворот вправо (45°)',
    jp: '右転回 · Turn Right',
    level: 'Поворот',
    desc: 'Локальный разворот корпуса и стоп вправо.',
    category: 'turns',
  },
  pivot_left: {
    label: '📐 Пивот таза Koshi влево',
    jp: '左腰捻り · Hip Pivot Left',
    level: 'Koshi drive',
    desc: 'Скручивание таза на подушечках стоп для инициации защиты или удара.',
    category: 'turns',
  },
  pivot_right: {
    label: '📐 Пивот таза Koshi вправо',
    jp: '右腰捻り · Hip Pivot Right',
    level: 'Koshi drive',
    desc: 'Скручивание таза на подушечках стоп вправо.',
    category: 'turns',
  },
  turn_with_step_left: {
    label: '👣 Разворот с шагом влево (90°)',
    jp: '踏み込み転回 · Turn with Step',
    level: 'Поворот',
    desc: 'Разворот с подшагом ноги по дуге эмбусэн.',
    category: 'turns',
  },
  hikite_right: {
    label: '⚡ Хикитэ правой руки к ребрам',
    jp: '右引き手 · Right Hikite',
    level: 'Кихон',
    desc: 'Взрывной отвод правого кулака к плавающим ребрам ладонью вверх.',
    category: 'kihon',
  },
  hikite_left: {
    label: '⚡ Хикитэ левой руки к ребрам',
    jp: '左引き手 · Left Hikite',
    level: 'Кихон',
    desc: 'Взрывной отвод левого кулака к плавающим ребрам ладонью вверх.',
    category: 'kihon',
  },
  chamber_left: {
    label: '🛡️ Замах на блок (Чембер у уха)',
    jp: '構え · Chamber Left',
    level: 'Кихон',
    desc: 'Взведение кулака к противоположному уху перед нижним сметом гэдан-барай.',
    category: 'kihon',
  },
  heian_shodan_preview: {
    label: '📜 Хэйан Шодан (Превью формы ката)',
    jp: '平安初段 · Heian Shodan Preview',
    level: 'Ката Шотокан',
    desc: 'Слитная цепочка движений формы: Йой -> Гэдан-барай -> Ой-цуки -> Агэ-укэ -> Ой-цуки -> Ямэ.',
    category: 'kata',
  },
};

// Категории техник для удобной фильтрации
const TECHNIQUE_CATEGORIES = [
  { id: 'all', label: '✨ Все техники', icon: '🥋' },
  { id: 'tsuki', label: 'Цуки (Кулак)', icon: '👊' },
  { id: 'uchi', label: 'Учи (Секущие)', icon: '🥊' },
  { id: 'uke', label: 'Укэ (Блоки)', icon: '🛡️' },
  { id: 'geri', label: 'Гэри (Ноги)', icon: '🦶' },
  { id: 'loco', label: 'Локомоция (Шаги)', icon: '👣' },
  { id: 'turns', label: 'Повороты (Koshi)', icon: '🔄' },
  { id: 'kihon', label: 'Хикитэ / Взведение', icon: '⚡' },
  { id: 'combo', label: 'Связки (Рэндзоку)', icon: '💥' },
  { id: 'kata', label: 'Ката (Форма)', icon: '📜' },
];

// Канонические стойки Шотокан
const STANCES_DECK = [
  { id: 'ready', label: 'Йой (Хэйко)', jp: '自然体 · Yoi', icon: '🧘', desc: 'Стойка готовности, ноги на ширине плеч, руки опущены' },
  { id: 'zenkutsu', label: 'Дзэнкуцу-дати (Левая)', jp: '前屈立ち · Zenkutsu', icon: '🥋', desc: 'Передняя наступательная стойка, 70% веса впереди' },
  { id: 'zenkutsu_dachi_right', label: 'Дзэнкуцу-дати (Правая)', jp: '右前屈立ち · Zenkutsu R', icon: '🥋', desc: 'Правосторонняя передняя наступательная стойка' },
  { id: 'kokutsu', label: 'Кокуцу-дати (Левая)', jp: '後屈立ち · Kokutsu', icon: '🛡️', desc: 'Защитная задняя стойка, 70% веса на задней ноге' },
  { id: 'kokutsu_dachi_right', label: 'Кокуцу-дати (Правая)', jp: '右後屈立ち · Kokutsu R', icon: '🛡️', desc: 'Правосторонняя задняя защитная стойка' },
  { id: 'heiko_dachi', label: 'Хэйко-дати', jp: '平行立ち · Heiko', icon: '🧘', desc: 'Параллельная стойка на ширине плеч' },
  { id: 'fudo_dachi', label: 'Фудо-дати', jp: '不動立ち · Fudo', icon: '🗿', desc: 'Непоколебимая укоренённая боевая стойка' },
  { id: 'kiba', label: 'Киба-дати', jp: '騎馬立ち · Kiba', icon: '🐎', desc: 'Стойка всадника, глубокая посадка и разведение колен' },
  { id: 'gankaku', label: 'Ганкаку-дати', jp: '鶴足立ち · Crane', icon: '🦩', desc: 'Стойка журавля: баланс на одной ноге' },
];

export default function MotionLabPage() {
  const [activeTab, setActiveTab] = useState('mocap'); // 'mocap' | 'dojo'
  const [mode, setMode] = useState('bunkai-2'); // 'kata' | 'bunkai-2' | 'bunkai-3'
  const [masterStance, setMasterStance] = useState('ready');
  const [activeClip, setActiveClip] = useState(null);
  const [performer, setPerformer] = useState('all'); // 'all' | 'tori' | 'uke'
  const [cameraView, setCameraView] = useState('free'); // 'free' | 'front' | 'side' | 'top'
  const [speed, setSpeed] = useState(1.0); // 0.25 | 0.5 | 1.0
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const controlsRef = useRef();

  // Запуск динамического приема
  function triggerTechnique(clipId) {
    setActiveClip(null);
    setTimeout(() => {
      setActiveClip(clipId);
    }, 30);
  }

  // Сброс в исходную стойку Йой
  function resetToYoi() {
    setMasterStance('ready');
    setActiveClip(null);
  }

  // Повтор текущего приема
  function replayActive() {
    if (activeClip) {
      triggerTechnique(activeClip);
    }
  }

  function setView(view) {
    setCameraView(view);
    if (!controlsRef.current) return;
    if (view === 'front') {
      controlsRef.current.object.position.set(0, 1.15, 2.6);
      controlsRef.current.target.set(0, 0.95, 0);
    } else if (view === 'side') {
      controlsRef.current.object.position.set(2.8, 1.15, 0);
      controlsRef.current.target.set(0, 0.95, 0);
    } else if (view === 'top') {
      controlsRef.current.object.position.set(0, 4.2, 0.1);
      controlsRef.current.target.set(0, 0, 0);
    } else {
      controlsRef.current.object.position.set(1.6, 1.25, 2.4);
      controlsRef.current.target.set(0, 0.95, 0);
    }
  }

  // Фильтрация техник по категории и поисковому запросу
  const filteredTechniques = useMemo(() => {
    return Object.entries(TECHNIQUE_DESCRIPTIONS).filter(([id, tech]) => {
      const matchCategory = activeCategory === 'all' || tech.category === activeCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        tech.label.toLowerCase().includes(q) ||
        tech.desc.toLowerCase().includes(q) ||
        (tech.jp && tech.jp.toLowerCase().includes(q)) ||
        id.toLowerCase().includes(q);
      return matchCategory && matchSearch;
    });
  }, [activeCategory, searchQuery]);

  // Определение информации для карточки текущего движения
  const currentActionInfo = activeClip
    ? TECHNIQUE_DESCRIPTIONS[activeClip] || { label: activeClip, desc: 'Техника в исполнении мастера' }
    : SHOTOKAN_STANCES[masterStance] || SHOTOKAN_STANCES.ready;

  return (
    <div className="container motion-lab-page fade-in">
      {/* Заголовок страницы */}
      <div className="motion-lab__header">
        <span className="section-kicker" style={{ marginBottom: '0.4rem' }}>
          松濤館流 · AI ДОДЗЁ БИОМЕХАНИКА
        </span>
        <div className="motion-lab__title-wrap">
          <span style={{ fontSize: '2.4rem' }}>🥋</span>
          <div>
            <h1>3D Додзё Лаборатория (Aimokap)</h1>
            <p className="motion-lab__desc">
              Интерактивная среда тестирования биомеханики, канонических техник и стоек каратэ Шотокан. Отрабатывайте удары руками (цуки, учи), блоки, удары ногами и боевые связки со замедленной съёмкой в реальном времени.
            </p>
          </div>
        </div>
      </div>

      {/* Главные вкладки модуля: Mocap Studio vs 3D Додзё Ката */}
      <div style={{ display: 'flex', gap: '0.85rem', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.85rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`btn ${activeTab === 'mocap' ? 'btn-primary' : ''}`}
          onClick={() => setActiveTab('mocap')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 22px', fontSize: '1rem', fontWeight: 800 }}
        >
          <span>📹</span>
          <span>AI Захват движений с камеры (Mocap Studio)</span>
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'dojo' ? 'btn-gold' : ''}`}
          onClick={() => setActiveTab('dojo')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 22px', fontSize: '1rem', fontWeight: 800 }}
        >
          <span>🥋</span>
          <span>3D Додзё Ката & Техники (Библиотека 87 приёмов)</span>
        </button>
      </div>

      {activeTab === 'mocap' ? (
        <MocapStudio />
      ) : (
        <>
          {/* Верхняя панель конфигурации поединка и камеры */}
          <div className="motion-lab__config-panel">
        {/* Формат демонстрации */}
        <div className="config-group">
          <label>Формат демонстрации в Додзё</label>
          <div className="mode-toggle">
            <button
              type="button"
              className={`mode-btn ${mode === 'kata' ? 'active' : ''}`}
              onClick={() => setMode('kata')}
            >
              🥋 Одиночное Ката
            </button>
            <button
              type="button"
              className={`mode-btn ${mode === 'bunkai-2' ? 'active' : ''}`}
              onClick={() => setMode('bunkai-2')}
            >
              ⚔️ Дуэль (2 Мастера)
            </button>
            <button
              type="button"
              className={`mode-btn ${mode === 'bunkai-3' ? 'active' : ''}`}
              onClick={() => setMode('bunkai-3')}
            >
              👥 Бункай (3 Мастера)
            </button>
          </div>
        </div>

        {/* Исполнитель техники (если в зале больше 1 мастера) */}
        {mode !== 'kata' && (
          <div className="config-group">
            <label>Исполнитель техники</label>
            <div className="mode-toggle">
              <button
                type="button"
                className={`mode-btn ${performer === 'all' ? 'active' : ''}`}
                onClick={() => setPerformer('all')}
                title="Все мастера выполняют технику синхронно"
              >
                👥 Синхронно
              </button>
              <button
                type="button"
                className={`mode-btn ${performer === 'tori' ? 'active' : ''}`}
                onClick={() => setPerformer('tori')}
                title="Главный мастер Тори"
              >
                🥋 Тори (Белое)
              </button>
              <button
                type="button"
                className={`mode-btn ${performer === 'uke' ? 'active' : ''}`}
                onClick={() => setPerformer('uke')}
                title="Атакующий Укэ"
              >
                ⚔️ Укэ (Синее)
              </button>
            </div>
          </div>
        )}

        {/* Ракурс камеры */}
        <div className="config-group">
          <label>Ракурс камеры</label>
          <div className="mode-toggle">
            <button
              type="button"
              className={`mode-btn ${cameraView === 'free' ? 'active' : ''}`}
              onClick={() => setView('free')}
            >
              🔄 360°
            </button>
            <button
              type="button"
              className={`mode-btn ${cameraView === 'front' ? 'active' : ''}`}
              onClick={() => setView('front')}
            >
              👁 Спереди
            </button>
            <button
              type="button"
              className={`mode-btn ${cameraView === 'side' ? 'active' : ''}`}
              onClick={() => setView('side')}
            >
              📐 Профиль
            </button>
            <button
              type="button"
              className={`mode-btn ${cameraView === 'top' ? 'active' : ''}`}
              onClick={() => setView('top')}
            >
              🧭 Сверху
            </button>
          </div>
        </div>

        {/* Скорость анимации (Slow-Mo) */}
        <div className="config-group">
          <label>Скорость воспроизведения</label>
          <div className="mode-toggle">
            <button
              type="button"
              className={`mode-btn ${speed === 0.25 ? 'active' : ''}`}
              onClick={() => setSpeed(0.25)}
              title="Замедление 4x для детального анализа траектории"
            >
              🐌 0.25x
            </button>
            <button
              type="button"
              className={`mode-btn ${speed === 0.5 ? 'active' : ''}`}
              onClick={() => setSpeed(0.5)}
              title="Замедление 2x для изучения баланса и кимэ"
            >
              ⏯️ 0.5x
            </button>
            <button
              type="button"
              className={`mode-btn ${speed === 1.0 ? 'active' : ''}`}
              onClick={() => setSpeed(1.0)}
              title="Нормальная боевая скорость каратэ"
            >
              ⚡ 1.0x
            </button>
          </div>
        </div>
      </div>

      {/* СЕКЦИЯ 1: Канонические стойки Шотокан */}
      <div className="motion-lab__stances-section">
        <div className="section-title-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>🥋</span>
            <span style={{ fontWeight: 700, color: 'var(--color-gold)' }}>Базовые стойки (Дати)</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              Фундамент перемещений и баланса
            </span>
          </div>
          <button
            type="button"
            className="btn-yoi-quick"
            onClick={resetToYoi}
            title="Сбросить всех бойцов в исходную стойку Йой"
          >
            🧘 Сброс в Йой (Исходная)
          </button>
        </div>

        <div className="stances-grid">
          {STANCES_DECK.map((st) => {
            const isSelected = masterStance === st.id && !activeClip;
            return (
              <button
                key={st.id}
                type="button"
                className={`stance-card ${isSelected ? 'active' : ''}`}
                onClick={() => {
                  setMasterStance(st.id);
                  setActiveClip(null);
                }}
              >
                <div className="stance-card__icon">{st.icon}</div>
                <div className="stance-card__info">
                  <div className="stance-card__label">{st.label}</div>
                  <div className="stance-card__jp">{st.jp}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* СЕКЦИЯ 2: Интерактивный выбор приёмов и техник */}
      <div className="motion-lab__techniques-section">
        <div className="section-title-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>⚡</span>
            <span style={{ fontWeight: 700, color: 'var(--color-gold)' }}>Каталог техник и связок</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              ({filteredTechniques.length} доступно)
            </span>
          </div>

          {/* Быстрый поиск */}
          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Поиск удара или блока (напр. гяку, маэ, блок)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button type="button" className="search-clear" onClick={() => setSearchQuery('')}>
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Категории (Табы) */}
        <div className="technique-tabs">
          {TECHNIQUE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`tech-tab ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Сетка кнопок приемов */}
        <div className="techniques-grid">
          {filteredTechniques.map(([id, tech]) => {
            const isPlaying = activeClip === id;
            return (
              <button
                key={id}
                type="button"
                className={`tech-btn ${isPlaying ? 'active' : ''}`}
                onClick={() => triggerTechnique(id)}
              >
                <div className="tech-btn__header">
                  <span className="tech-btn__name">{tech.label}</span>
                  {isPlaying && <span className="tech-btn__playing-pulse">● PLAY</span>}
                </div>
                {tech.jp && <div className="tech-btn__jp">{tech.jp}</div>}
                {tech.level && <div className="tech-btn__level">🎯 {tech.level}</div>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Полноэкранная интерактивная 3D-сцена Додзё */}
      <div className="motion-lab__workspace">
        <div className="workspace-panel scene-3d-panel">
          <div className="scene-container" style={{ position: 'relative', width: '100%', height: '580px', borderRadius: 12, overflow: 'hidden' }}>
            <Canvas shadows camera={{ position: [1.6, 1.25, 2.4], fov: 44 }}>
              <color attach="background" args={['#140f0c']} />

              {/* Потолочное и рассеянное освещение зала Додзё */}
              <ambientLight intensity={0.50} color="#fff4e8" />
              <directionalLight
                position={[0.5, 8.5, 1.2]}
                intensity={0.75}
                color="#fffcf5"
                castShadow
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
                shadow-bias={-0.0002}
                shadow-normalBias={0.03}
              />
              <hemisphereLight
                skyColor="#fff0e0"
                groundColor="#5c4432"
                intensity={0.35}
              />

              {/* Традиционное 3D Додзё: 18x18м, татами, сёдзи, камидза, свиток и фонари */}
              <TraditionalDojo />

              {/* Мастера в кимоно, стоящие прямо на татами Y = 0 */}
              <Suspense fallback={null}>
                {/* Главный мастер (Тори) в белоснежном доги с черным поясом */}
                <group position={[0, 0, 0]}>
                  <KarateMasterModel
                    role="tori"
                    stance={masterStance}
                    speed={speed}
                    activeClip={(performer === 'all' || performer === 'tori') ? activeClip : null}
                  />
                </group>

                {/* Первый спарринг-партнер (Укэ) в темно-синем доги */}
                {(mode === 'bunkai-2' || mode === 'bunkai-3') && (
                  <group position={[1.4, 0, 0.2]} rotation={[0, -Math.PI * 0.75, 0]}>
                    <KarateMasterModel
                      role="uke"
                      stance={masterStance}
                      speed={speed}
                      activeClip={(performer === 'all' || performer === 'uke') ? activeClip : null}
                    />
                  </group>
                )}

                {/* Второй нападающий (Укэ-2) в графитовом доги */}
                {mode === 'bunkai-3' && (
                  <group position={[-1.3, 0, 0.75]} rotation={[0, Math.PI * 0.45, 0]}>
                    <KarateMasterModel
                      role="uke2"
                      stance={masterStance}
                      speed={speed}
                      activeClip={performer === 'all' ? activeClip : null}
                    />
                  </group>
                )}
              </Suspense>

              {/* Мягкие естественные тени на татами */}
              <ContactShadows position={[0, 0.003, 0]} opacity={0.75} scale={8} blur={2.0} far={2.2} />

              <OrbitControls
                ref={controlsRef}
                minDistance={1.3}
                maxDistance={6.5}
                maxPolarAngle={Math.PI / 2 - 0.03}
                target={[0, 0.95, 0]}
              />
            </Canvas>
          </div>

          {/* Информационная панель текущей техники/стойки под сценой */}
          <div className="scene-controls">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ flex: 1, minWidth: '280px' }}>
                <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-gold)' }}>
                  {activeClip ? 'Текущее движение мастера' : 'Текущая стойка (Базовое положение)'}
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-washi)', marginTop: 2 }}>
                  {currentActionInfo.label}
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginTop: 4, lineHeight: 1.45 }}>
                  {currentActionInfo.desc}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {activeClip && (
                  <button
                    type="button"
                    className="mode-btn active"
                    onClick={replayActive}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px' }}
                    title="Запустить приём повторно"
                  >
                    <span>🔄</span>
                    <span>Повтор приёма</span>
                  </button>
                )}
                <button
                  type="button"
                  className="mode-btn btn-yoi-reset"
                  onClick={resetToYoi}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px' }}
                >
                  <span>🧘</span>
                  <span>Вернуться в Йой</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
