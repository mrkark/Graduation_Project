/**
 * Скрипт обновления превью (Thumbnail_URL) для всех Ката
 * и пошаговых картинок (Image_URL) для шагов ката.
 * Запуск: node scripts/update-kata-thumbnails.js (из папки server/)
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

function pickStepImage(step) {
  const text = `${step.Technique || ''} ${step.Title || ''} ${step.Description || ''}`.toLowerCase();
  if (text.includes('гэдан') || text.includes('gedan')) return IMAGES.gedan;
  if (text.includes('агэ') || text.includes('age-uke') || text.includes('верхний')) return IMAGES.ageuke;
  if (text.includes('сюто') || text.includes('shuto') || text.includes('кокуцу')) return IMAGES.shutouke;
  if (text.includes('тэтцуи') || text.includes('киба') || text.includes('тэкки')) return IMAGES.kibatettsui;
  if (text.includes('цуки') || text.includes('дзэнкуцу') || text.includes('выпад')) return IMAGES.oitsuki;
  return IMAGES.preview;
}

const KATA_THUMBNAILS = {
  1: '/uploads/thumbnails/kata_heian_shodan.jpg',
  2: '/uploads/thumbnails/kata_heian_nidan.jpg',
  3: '/uploads/thumbnails/kata_heian_sandan.jpg',
  4: '/uploads/thumbnails/kata_heian_yondan.jpg',
  5: '/uploads/thumbnails/kata_heian_godan.jpg',
  6: '/uploads/thumbnails/kata_tekki_shodan.jpg',
  7: '/uploads/thumbnails/kata_tekki_nidan.jpg',
  8: '/uploads/thumbnails/kata_tekki_sandan.jpg',
  9: '/uploads/thumbnails/kata_bassai_dai.jpg',
  10: '/uploads/thumbnails/kata_bassai_sho.jpg',
  11: '/uploads/thumbnails/kata_kanku_dai.jpg',
  12: '/uploads/thumbnails/kata_kanku_sho.jpg',
  13: '/uploads/thumbnails/kata_jion.jpg',
  14: '/uploads/thumbnails/kata_jiin.jpg',
  15: '/uploads/thumbnails/kata_jitte.jpg',
  16: '/uploads/thumbnails/kata_empi.jpg',
  17: '/uploads/thumbnails/kata_hangetsu.jpg',
  18: '/uploads/thumbnails/kata_gankaku.jpg',
  19: '/uploads/thumbnails/kata_sochin.jpg',
  20: '/uploads/thumbnails/kata_nijushiho.jpg',
  21: '/uploads/thumbnails/kata_meikyo.jpg',
  22: '/uploads/thumbnails/kata_unsu.jpg',
  23: '/uploads/thumbnails/kata_wankan.jpg',
  24: '/uploads/thumbnails/kata_gojushiho_dai.jpg',
  25: '/uploads/thumbnails/kata_gojushiho_sho.jpg',
  26: '/uploads/thumbnails/kata_chinte.jpg',
};

function pickKataThumbnail(kata) {
  if (KATA_THUMBNAILS[kata.Kata_ID]) {
    return KATA_THUMBNAILS[kata.Kata_ID];
  }
  const t = (kata.Title || '').toLowerCase();
  if (t.includes('шодан') && t.includes('хэйан')) return KATA_THUMBNAILS[1];
  if (t.includes('нидан') && t.includes('хэйан')) return KATA_THUMBNAILS[2];
  if (t.includes('сандан') && t.includes('хэйан')) return KATA_THUMBNAILS[3];
  if (t.includes('ёндан') && t.includes('хэйан')) return KATA_THUMBNAILS[4];
  if (t.includes('годан') && t.includes('хэйан')) return KATA_THUMBNAILS[5];
  if (t.includes('тэкки') && t.includes('шодан')) return KATA_THUMBNAILS[6];
  if (t.includes('тэкки') && t.includes('нидан')) return KATA_THUMBNAILS[7];
  if (t.includes('тэкки') && t.includes('сандан')) return KATA_THUMBNAILS[8];
  if (t.includes('бассай') && t.includes('дай')) return KATA_THUMBNAILS[9];
  if (t.includes('бассай') && t.includes('шо')) return KATA_THUMBNAILS[10];
  if (t.includes('канку') && t.includes('дай')) return KATA_THUMBNAILS[11];
  if (t.includes('канку') && t.includes('шо')) return KATA_THUMBNAILS[12];
  if (t.includes('дзион')) return KATA_THUMBNAILS[13];
  if (t.includes('дзи\'ин') || t.includes('дзиин')) return KATA_THUMBNAILS[14];
  if (t.includes('джиттэ')) return KATA_THUMBNAILS[15];
  if (t.includes('эмпи')) return KATA_THUMBNAILS[16];
  if (t.includes('хангэцу')) return KATA_THUMBNAILS[17];
  if (t.includes('ганкаку')) return KATA_THUMBNAILS[18];
  if (t.includes('сочин')) return KATA_THUMBNAILS[19];
  if (t.includes('нидзюсихо')) return KATA_THUMBNAILS[20];
  if (t.includes('мэйкё')) return KATA_THUMBNAILS[21];
  if (t.includes('унсу')) return KATA_THUMBNAILS[22];
  if (t.includes('ванкан')) return KATA_THUMBNAILS[23];
  if (t.includes('годзюсихо') && t.includes('дай')) return KATA_THUMBNAILS[24];
  if (t.includes('годзюсихо') && t.includes('шо')) return KATA_THUMBNAILS[25];
  if (t.includes('чинтэ')) return KATA_THUMBNAILS[26];

  return '/uploads/thumbnails/kata_heian_shodan.jpg';
}

async function run() {
  console.log('🥋 Обновление превью ката и картинок шагов...');

  const katas = await callProcedure('sp_Kata_List', {
    UserId: 1,
    UserRole: 'admin',
    Search: null,
    Difficulty: null,
    Style: null,
    Status: null,
    Sort: 'newest',
    Offset: 0,
    Limit: 100,
  });

  console.log(`Найдено ката: ${katas.length}`);

  for (let i = 0; i < katas.length; i++) {
    const k = katas[i];
    const thumb = pickKataThumbnail(k, i);

    // Получаем текущие шаги ката
    const rawSteps = await callProcedure('sp_KataStep_ListByKata', { KataId: k.Kata_ID });
    const mappedSteps = rawSteps.map((s) => ({
      stepNumber: s.Step_Number,
      title: s.Title,
      description: s.Description,
      technique: s.Technique,
      direction: s.Direction,
      duration: s.Duration,
      imageUrl: pickStepImage(s),
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

    console.log(`✔ Обновлено Ката #${k.Kata_ID} "${k.Title}" (шагов с картинками: ${mappedSteps.length})`);
  }

  console.log('\n🎉 Все превью ката и шагов успешно обновлены в базе данных!');
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Ошибка:', e);
    process.exit(1);
  });
