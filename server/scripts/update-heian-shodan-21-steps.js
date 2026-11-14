require('dotenv').config();
const { callProcedure } = require('../src/db/execProc');

const HEIAN_SHODAN_21_STEPS = [
  {
    stepNumber: 1,
    title: 'Поворот влево на 90° — Гэдан-барай',
    description: 'Взгляд влево. Поворот влево на 90° со смещением левой ноги вперед в левостороннюю стойку Дзэнкуцу-дати. Левая рука наносит сметливый нижний блок Гэдан-барай, правая рука оттягивается в хикитэ у ребер.',
    technique: 'Гэдан-барай (下段払い) в Дзэнкуцу-дати',
    direction: 'Фланг влево (270°)',
    stanceIn: 'ready',
    stanceOut: 'zenkutsu',
    duration: 2,
  },
  {
    stepNumber: 2,
    title: 'Шаг вперед — Ой-цуки тюдан',
    description: 'Продвижение вперед. Правая нога делает длинный шаг вперед в правостороннюю стойку Дзэнкуцу-дати с прямым пробивающим ударом Ой-цуки в средний уровень (солнечное сплетение).',
    technique: 'Ой-цуки тюдан (追い突き) в Дзэнкуцу-дати',
    direction: 'Фланг влево (270°)',
    stanceIn: 'zenkutsu',
    stanceOut: 'zenkutsu',
    duration: 2,
  },
  {
    stepNumber: 3,
    title: 'Разворот вправо на 180° — Гэдан-барай',
    description: 'Опора на левую ногу, правая нога отводится по дуге за спину с разворотом на 180° вправо в правостороннюю стойку Дзэнкуцу-дати. Правый нижний блок Гэдан-барай, левый кулак в хикитэ.',
    technique: 'Гэдан-барай (下段払い) в Дзэнкуцу-дати',
    direction: 'Фланг вправо (90°)',
    stanceIn: 'zenkutsu',
    stanceOut: 'zenkutsu',
    duration: 2,
  },
  {
    stepNumber: 4,
    title: 'Подтягивание ноги — Тэтцуи-учи',
    description: 'Подтягивание правой передней ноги в позицию перед левой с одновременным замахом и нанесением кругового удара кулаком-молотом Тэтцуи-учи сверху-вниз.',
    technique: 'Тэтцуи-учи (鉄槌打ち)',
    direction: 'Фланг вправо (90°)',
    stanceIn: 'zenkutsu',
    stanceOut: 'moto',
    duration: 2,
  },
  {
    stepNumber: 5,
    title: 'Шаг вперед — Ой-цуки тюдан',
    description: 'Шаг вперед левой ногой в левостороннюю стойку Дзэнкуцу-дати с прямым ударом левым кулаком Ой-цуки в средний уровень.',
    technique: 'Ой-цуки тюдан (追い突き) в Дзэнкуцу-дати',
    direction: 'Фланг вправо (90°)',
    stanceIn: 'moto',
    stanceOut: 'zenkutsu',
    duration: 2,
  },
  {
    stepNumber: 6,
    title: 'Поворот влево на 90° на центральную ось — Гэдан-барай',
    description: 'Поворот влево на 90° на центральную линию эмбусэн. Левая нога выходит вперед в Дзэнкуцу-дати с мощным блоком Гэдан-барай.',
    technique: 'Гэдан-барай (下段払い) по центральной линии',
    direction: 'Прямо вперед (0°)',
    stanceIn: 'zenkutsu',
    stanceOut: 'zenkutsu',
    duration: 2,
  },
  {
    stepNumber: 7,
    title: 'Шаг вперед — Агэ-укэ дзёдан (1-й)',
    description: 'Шаг вперед правой ногой в правостороннюю стойку Дзэнкуцу-дати с восходящим блоком головы правым предплечьем Агэ-укэ под углом 45° над лбом.',
    technique: 'Агэ-укэ дзёдан (上げ受け) в Дзэнкуцу-дати',
    direction: 'Прямо вперед (0°)',
    stanceIn: 'zenkutsu',
    stanceOut: 'zenkutsu',
    duration: 2,
  },
  {
    stepNumber: 8,
    title: 'Шаг вперед — Агэ-укэ дзёдан (2-й)',
    description: 'Шаг вперед левой ногой в левостороннюю стойку Дзэнкуцу-дати с восходящим блоком левым предплечьем Агэ-укэ.',
    technique: 'Агэ-укэ дзёдан (上げ受け) в Дзэнкуцу-дати',
    direction: 'Прямо вперед (0°)',
    stanceIn: 'zenkutsu',
    stanceOut: 'zenkutsu',
    duration: 2,
  },
  {
    stepNumber: 9,
    title: 'Шаг вперед — Агэ-укэ дзёдан (3-й с КИАЙ)',
    description: 'Третий шаг вперед правой ногой в правостороннюю стойку Дзэнкуцу-дати с восходящим блоком Агэ-укэ и мощным боевым выкриком КИАЙ (気合)!',
    technique: 'Агэ-укэ дзёдан (上げ受け) [КИАЙ]',
    direction: 'Прямо вперед (0°)',
    stanceIn: 'zenkutsu',
    stanceOut: 'zenkutsu',
    duration: 2,
  },
  {
    stepNumber: 10,
    title: 'Разворот через спину влево на 270° — Гэдан-барай',
    description: 'Взгляд влево через левое плечо. Опора на правую ногу, левая нога описывает большую дугу за спину с разворотом на 270° влево в левостороннюю Дзэнкуцу-дати. Левый блок Гэдан-барай.',
    technique: 'Гэдан-барай (下段払い) поворот 270°',
    direction: 'Фланг вправо (90°)',
    stanceIn: 'zenkutsu',
    stanceOut: 'zenkutsu',
    duration: 2,
  },
  {
    stepNumber: 11,
    title: 'Шаг вперед — Ой-цуки тюдан',
    description: 'Шаг вперед правой ногой в правостороннюю стойку Дзэнкуцу-дати с прямым пробивающим ударом Ой-цуки в средний уровень.',
    technique: 'Ой-цуки тюдан (追い突き) в Дзэнкуцу-дати',
    direction: 'Фланг вправо (90°)',
    stanceIn: 'zenkutsu',
    stanceOut: 'zenkutsu',
    duration: 2,
  },
  {
    stepNumber: 12,
    title: 'Разворот вправо на 180° — Гэдан-барай',
    description: 'Разворот корпуса вправо на 180° со смещением правой ноги в правостороннюю Дзэнкуцу-дати. Правый блок Гэдан-барай.',
    technique: 'Гэдан-барай (下段払い) в Дзэнкуцу-дати',
    direction: 'Фланг влево (270°)',
    stanceIn: 'zenkutsu',
    stanceOut: 'zenkutsu',
    duration: 2,
  },
  {
    stepNumber: 13,
    title: 'Шаг вперед — Ой-цуки тюдан',
    description: 'Шаг вперед левой ногой в левостороннюю стойку Дзэнкуцу-дати с прямым ударом левым кулаком Ой-цуки.',
    technique: 'Ой-цуки тюдан (追い突き) в Дзэнкуцу-дати',
    direction: 'Фланг влево (270°)',
    stanceIn: 'zenkutsu',
    stanceOut: 'zenkutsu',
    duration: 2,
  },
  {
    stepNumber: 14,
    title: 'Поворот влево на 90° на центральную ось — Гэдан-барай',
    description: 'Поворот влево на 90° назад по центральной оси эмбусэн. Левая нога выходит в левостороннюю Дзэнкуцу-дати с блоком Гэдан-барай.',
    technique: 'Гэдан-барай (下段払い) по центральной оси',
    direction: 'Разворот назад (180°)',
    stanceIn: 'zenkutsu',
    stanceOut: 'zenkutsu',
    duration: 2,
  },
  {
    stepNumber: 15,
    title: 'Шаг вперед — Ой-цуки тюдан (1-й)',
    description: 'Первый шаг вперед по центральной оси правой ногой в правостороннюю Дзэнкуцу-дати с прямым ударом Ой-цуки тюдан.',
    technique: 'Ой-цуки тюдан (追い突き) в Дзэнкуцу-дати',
    direction: 'Разворот назад (180°)',
    stanceIn: 'zenkutsu',
    stanceOut: 'zenkutsu',
    duration: 2,
  },
  {
    stepNumber: 16,
    title: 'Шаг вперед — Ой-цуки тюдан (2-й)',
    description: 'Второй шаг вперед по оси эмбусэн левой ногой в левостороннюю Дзэнкуцу-дати с прямым ударом Ой-цуки тюдан.',
    technique: 'Ой-цуки тюдан (追い突き) в Дзэнкуцу-дати',
    direction: 'Разворот назад (180°)',
    stanceIn: 'zenkutsu',
    stanceOut: 'zenkutsu',
    duration: 2,
  },
  {
    stepNumber: 17,
    title: 'Шаг вперед — Ой-цуки тюдан (3-й с КИАЙ)',
    description: 'Третий сокрушительный шаг вперед правой ногой в правостороннюю Дзэнкуцу-дати с ударом Ой-цуки и вторым боевым выкриком КИАЙ (気合)!',
    technique: 'Ой-цуки тюдан (追い突き) [КИАЙ]',
    direction: 'Разворот назад (180°)',
    stanceIn: 'zenkutsu',
    stanceOut: 'zenkutsu',
    duration: 2,
  },
  {
    stepNumber: 18,
    title: 'Разворот через спину влево на 270° — Сюто-укэ',
    description: 'Взгляд через левое плечо. Опора на переднюю правую ногу, левая нога описывает дугу за спину с разворотом на 270° влево (Фланг влево / Запад +90°, в ту же сторону, что и шаг 1) в левостороннюю стойку Кокуцу-дати (70% веса на правой ноге) с блоком Хидари Сюто-укэ.',
    technique: 'Сюто-укэ (手刀受け) в Кокуцу-дати',
    direction: 'Фланг влево (270°)',
    stanceIn: 'zenkutsu',
    stanceOut: 'kokutsu',
    duration: 2,
  },
  {
    stepNumber: 19,
    title: 'Шаг под 45° — Сюто-укэ',
    description: 'Шаг правой ногой вперед под углом 45° вправо (Диагональ влево / Северо-Запад +45°) в правостороннюю стойку Кокуцу-дати с блоком Миги Сюто-укэ.',
    technique: 'Сюто-укэ (手刀受け) в Кокуцу-дати',
    direction: 'Диагональ влево (315°)',
    stanceIn: 'kokutsu',
    stanceOut: 'kokutsu',
    duration: 2,
  },
  {
    stepNumber: 20,
    title: 'Разворот через спину на 135° — Сюто-укэ',
    description: 'Перенос правой ноги по дуге через спину, разворот на 135° по часовой стрелке на противоположный фланг (Фланг вправо / Восток -90°) в правостороннюю Кокуцу-дати с блоком Миги Сюто-укэ.',
    technique: 'Сюто-укэ (手刀受け) в Кокуцу-дати',
    direction: 'Фланг вправо (90°)',
    stanceIn: 'kokutsu',
    stanceOut: 'kokutsu',
    duration: 2,
  },
  {
    stepNumber: 21,
    title: 'Шаг под 45° с левой ноги — Сюто-укэ',
    description: 'Шаг вперед левой ногой под углом 45° влево (Диагональ вправо / Северо-Восток -45°) в левостороннюю стойку Кокуцу-дати с блоком Хидари Сюто-укэ. Концентрация дзансин и готовность к возврату в Йой.',
    technique: 'Сюто-укэ (手刀受け) в Кокуцу-дати',
    direction: 'Диагональ вправо (45°)',
    stanceIn: 'kokutsu',
    stanceOut: 'kokutsu',
    duration: 2,
  },
];

async function updateHeianShodan() {
  const katas = await callProcedure('sp_Kata_List', { UserId: 1, UserRole: 'admin', Search: 'Хэйан Шодан', Limit: 5 });
  if (!katas || katas.length === 0) {
    console.error('Ката Хэйан Шодан не найдено в БД');
    return;
  }

  for (const kata of katas) {
    const kataId = kata.Kata_ID;
    console.log(`Обновляем шаги для ката #${kataId} ${kata.Title}...`);
    await callProcedure('sp_Kata_Update', {
      KataId: kataId,
      UserId: 1,
      UserRole: 'admin',
      StepsJson: JSON.stringify(HEIAN_SHODAN_21_STEPS),
    });

    const updatedSteps = await callProcedure('sp_KataStep_ListByKata', { KataId: kataId });
    console.log(`Успешно обновлено! Новое число шагов: ${updatedSteps.length}`);
  }
}

updateHeianShodan()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Ошибка:', err);
    process.exit(1);
  });
