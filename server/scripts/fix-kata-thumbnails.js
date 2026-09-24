/**
 * Скрипт точной привязки превью ката и шагов к реальным техникам каратэ.
 * Никаких случайных подстановок:
 * - Тэкки 1, 2, 3 -> только Киба-дати (стойка всадника)!
 * - Ката со стойкой Кокуцу / Сюто-укэ -> только Сюто-укэ!
 * - Ката с первым движением Гэдан-барай (Хэйан Шодан) -> Гэдан-барай!
 * - Мастерские ката с уникальными стойками (Ганкаку, Хангэцу, Сочин, Чинтэ, Унсу) -> аутентичный портрет Сенсея в Додзё!
 */
require('dotenv').config();
const { callProcedure } = require('../src/db/execProc');

const IMAGES = {
  preview: '/uploads/thumbnails/sensei-preview.jpg',
  gedan: '/uploads/thumbnails/step-gedan-barai.jpg',
  oitsuki: '/uploads/thumbnails/step-oi-tsuki.jpg',
  ageuke: '/uploads/thumbnails/step-age-uke.jpg',
  shutouke: '/uploads/thumbnails/step-shuto-uke.jpg',
  kibatettsui: '/uploads/thumbnails/step-kiba-tettsui.jpg',
};

// Точное каноническое соответствие для 26 ката Шотокан
const KATA_CANON_THUMBNAILS = {
  1: IMAGES.gedan,       // Хэйан Шодан: Гэдан-барай в Дзэнкуцу-дати (визитная карточка)
  2: IMAGES.shutouke,    // Хэйан Нидан: Сюто-укэ в Кокуцу-дати
  3: IMAGES.kibatettsui, // Хэйан Сандан: Первое появление Киба-дати + Тэтцуи
  4: IMAGES.shutouke,    // Хэйан Ёндан: Двойной Сюто-укэ в Кокуцу-дати
  5: IMAGES.oitsuki,     // Хэйан Годан: Выпад Ой-цуки
  6: IMAGES.kibatettsui, // Тэкки Шодан: Исключительно Киба-дати
  7: IMAGES.kibatettsui, // Тэкки Нидан: Исключительно Киба-дати
  8: IMAGES.kibatettsui, // Тэкки Сандан: Исключительно Киба-дати
  9: IMAGES.shutouke,    // Бассай Дай: 4 мощных Сюто-укэ в Кокуцу-дати
  10: IMAGES.shutouke,   // Бассай Шо: Сюто-укэ и Бо-укэ
  11: IMAGES.preview,    // Канку Дай: Ритуал созерцания неба сенсеем
  12: IMAGES.oitsuki,    // Канку Шо: Ой-цуки в Дзэнкуцу-дати
  13: IMAGES.kibatettsui,// Дзион: Киба-дати + Какивакэ-укэ
  14: IMAGES.kibatettsui,// Дзи'ин: Киба-дати
  15: IMAGES.gedan,      // Джиттэ: Смет Гэдан / захват Бо
  16: IMAGES.gedan,      // Эмпи: Нижний смет перед прыжком
  17: IMAGES.preview,    // Хангэцу: Уникальная полулунная стойка Хангэцу-дати
  18: IMAGES.preview,    // Ганкаку: Стойка журавля Цуруаси-дати на одной ноге
  19: IMAGES.preview,    // Сочин: Несокрушимая стойка Фудо-дати (Сочин-дати)
  20: IMAGES.preview,    // Нидзюсихо: Авасэ-укэ
  21: IMAGES.preview,    // Мэйкё: Ритуал зеркала
  22: IMAGES.preview,    // Унсу: «Облачные руки»
  23: IMAGES.oitsuki,    // Ванкан: Мощный выпад Ой-цуки
  24: IMAGES.shutouke,   // Годзюсихо Дай: Сюто-укэ в Кокуцу-дати
  25: IMAGES.preview,    // Годзюсихо Шо: Нукитэ
  26: IMAGES.preview,    // Чинтэ: Нихон-нукитэ (двупалый удар)
};

function pickStrictStepImage(step) {
  const text = `${step.Technique || ''} ${step.Title || ''} ${step.Description || ''}`.toLowerCase();

  // 1. Киба-дати и Тэтцуи — строгая проверка
  if (text.includes('киба') || text.includes('kiba') || text.includes('тэтцуи') || text.includes('тэкки')) {
    return IMAGES.kibatettsui;
  }
  // 2. Сюто-укэ и Кокуцу-дати — строгая проверка
  if (text.includes('сюто') || text.includes('shuto') || text.includes('кокуцу') || text.includes('kokutsu')) {
    return IMAGES.shutouke;
  }
  // 3. Агэ-укэ (верхний блок)
  if (text.includes('агэ') || text.includes('age-uke') || text.includes('верхний блок')) {
    return IMAGES.ageuke;
  }
  // 4. Гэдан-барай (нижний смет)
  if (text.includes('гэдан') || text.includes('gedan') || text.includes('нижний блок') || text.includes('смет')) {
    return IMAGES.gedan;
  }
  // 5. Ой-цуки (прямой пробивающий выпад кулаком)
  if (text.includes('ой-цуки') || text.includes('oi-tsuki') || text.includes('прямой выпад') || text.includes('выпад')) {
    return IMAGES.oitsuki;
  }

  // Если движение уникальное (например, прыжок, удар локтем, удар двумя пальцами),
  // ставим универсальный фото-канон Сенсея в Додзё
  return IMAGES.preview;
}

async function run() {
  console.log('🥋 Исправление привязок превью ката и шагов под канонические техники...');

  const katas = await callProcedure('sp_Kata_List', {
    UserId: 1,
    UserRole: 'admin',
    Search: null,
    Difficulty: null,
    Style: null,
    Status: null,
    Sort: 'oldest',
    Offset: 0,
    Limit: 100,
  });

  for (const k of katas) {
    const thumb = KATA_CANON_THUMBNAILS[k.Kata_ID] || IMAGES.preview;

    const rawSteps = await callProcedure('sp_KataStep_ListByKata', { KataId: k.Kata_ID });
    const mappedSteps = rawSteps.map((s) => ({
      stepNumber: s.Step_Number,
      title: s.Title,
      description: s.Description,
      technique: s.Technique,
      direction: s.Direction,
      duration: s.Duration,
      imageUrl: pickStrictStepImage(s),
      videoUrl: s.Video_URL,
    }));

    await callProcedure('sp_Kata_Update', {
      KataId: k.Kata_ID,
      UserId: 1,
      UserRole: 'admin',
      ThumbnailUrl: thumb,
      SetThumbnailUrl: 1,
      StepsJson: JSON.stringify(mappedSteps),
    });

    console.log(`✔ Ката #${k.Kata_ID} "${k.Title}" -> превью: ${thumb.split('/').pop()}`);
  }

  console.log('\n🎉 Все 26 ката и их шаги успешно синхронизированы со своими реальными техниками!');
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Ошибка:', e);
    process.exit(1);
  });
