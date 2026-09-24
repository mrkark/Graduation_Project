require('dotenv').config();
const { callProcedure } = require('../src/db/execProc');

const KATA_MAP = {
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

async function syncDb() {
  console.log('🥋 Обновление превью всех 26 ката в базе данных...');
  for (const [id, url] of Object.entries(KATA_MAP)) {
    await callProcedure('sp_Kata_Update', {
      KataId: parseInt(id),
      UserId: 1,
      UserRole: 'admin',
      ThumbnailUrl: url,
      SetThumbnailUrl: 1,
    });
    console.log('✔ Ката #' + id + ' -> ' + url);
  }
  console.log('🎉 Все 26 ката успешно обновлены в базе данных!');
}

syncDb()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Ошибка:', e);
    process.exit(1);
  });
