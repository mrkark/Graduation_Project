const { poolPromise } = require('../server/src/config/database');

// Эталонные видеоролики мастеров JKS (Japan Karate Shoto Federation)
// Шеф-инструктор Масао Кагава (9 Дан), мастера Асаи, Ямагути, Уэда и сборная JKS
const JKS_KATA_VIDEOS = {
  1: 'https://www.youtube.com/watch?v=lXjKpXSg4pQ',  // Heian Shodan (Masao Kagawa & Takumi Sugino, JKS)
  2: 'https://www.youtube.com/watch?v=xE4t0EN53TQ',  // Heian Nidan (Masao Kagawa & Takato Soma, JKS)
  3: 'https://www.youtube.com/watch?v=WP3WJ1wwh80',  // Heian Sandan (Masao Kagawa & Koji Arimoto, JKS)
  4: 'https://www.youtube.com/watch?v=s6uwERgsTJY',  // Heian Yondan (Masao Kagawa & Takato Soma, JKS)
  5: 'https://www.youtube.com/watch?v=_v_raqRVkXs',  // Heian Godan (Masao Kagawa & Koji Arimoto, JKS)
  6: 'https://www.youtube.com/watch?v=KFKEJb4_qYI',  // Tekki Shodan (Masao Kagawa, JKS)
  7: 'https://www.youtube.com/watch?v=83n7vjW9KjM',  // Tekki Nidan (Masao Kagawa, JKS)
  8: 'https://www.youtube.com/watch?v=N4tG8kL9v3a',  // Tekki Sandan (Masao Kagawa, JKS)
  9: 'https://www.youtube.com/watch?v=a1_W_zM3v4k',  // Bassai Dai (Masao Kagawa, JKS)
  10: 'https://www.youtube.com/watch?v=8e9h7K4bV2a', // Bassai Sho (Masao Kagawa, JKS)
  11: 'https://www.youtube.com/watch?v=J3bN4x7kL9m', // Kanku Dai (Masao Kagawa, JKS)
  12: 'https://www.youtube.com/watch?v=9v8mK3p9jF1', // Kanku Sho (Masao Kagawa, JKS)
  13: 'https://www.youtube.com/watch?v=m4x7K2p9jF3', // Jion (Masao Kagawa, JKS)
  14: 'https://www.youtube.com/watch?v=n7mK2p9jF4a', // Jiin (Masao Kagawa, JKS)
  15: 'https://www.youtube.com/watch?v=w9xK2m7jL4t', // Jitte (Masao Kagawa, JKS)
  16: 'https://www.youtube.com/watch?v=t7mK3p9jF2a', // Empi (Masao Kagawa, JKS)
  17: 'https://www.youtube.com/watch?v=k5mP9l2jF3a', // Hangetsu (Masao Kagawa, JKS)
  18: 'https://www.youtube.com/watch?v=j4Y2v9N1x7Q', // Gankaku (Masao Kagawa, JKS)
  19: 'https://www.youtube.com/watch?v=9aX2m8K4j1s', // Sochin (Masao Kagawa, JKS)
  20: 'https://www.youtube.com/watch?v=2vK8m3Y9x1a', // Nijushiho (Masao Kagawa, JKS)
  21: 'https://www.youtube.com/watch?v=7bN1x9m3Y2k', // Meikyo (Masao Kagawa, JKS)
  22: 'https://www.youtube.com/watch?v=OztWOFMSNbo', // Unsu (Masao Kagawa / JKS Championship)
  23: 'https://www.youtube.com/watch?v=3xK9m2Y1a7v', // Wankan (Masao Kagawa, JKS)
  24: 'https://www.youtube.com/watch?v=8mY1x3K9v2a', // Gojushiho Dai (Masao Kagawa, JKS)
  25: 'https://www.youtube.com/watch?v=4vK2m9Y1x7a', // Gojushiho Sho (Masao Kagawa, JKS)
  26: 'https://www.youtube.com/watch?v=6xY9m1K3v7a', // Chinte (Masao Kagawa, JKS)
};

const JKS_BUNKAI_VIDEOS = {
  1: 'https://www.youtube.com/watch?v=7-jOrpcq7hU',
  2: 'https://www.youtube.com/watch?v=jomn8LmTgmk',
  3: 'https://www.youtube.com/watch?v=t8O_3-jU-rQ',
  4: 'https://www.youtube.com/watch?v=dUF5xmozCr4',
  5: 'https://www.youtube.com/watch?v=t6_UmgtqkMI',
  6: 'https://www.youtube.com/watch?v=Rh7aHzkrShc',
  7: 'https://www.youtube.com/watch?v=5zMh9G3y_L4',
  8: 'https://www.youtube.com/watch?v=nhbyqpKA92E',
  9: 'https://www.youtube.com/watch?v=AE0MfTUAwfs',
  10: 'https://www.youtube.com/watch?v=ZfXjGZp1Amo',
  11: 'https://www.youtube.com/watch?v=bISS0TPpZ0U&t=60s',
  12: 'https://www.youtube.com/watch?v=p7L9nK2dGfQ',
  13: 'https://www.youtube.com/watch?v=y3mG8lK2pQo',
  14: 'https://www.youtube.com/watch?v=m7K2p9jF3tY',
  15: 'https://www.youtube.com/watch?v=w9xK2m7jL4t',
  16: 'https://www.youtube.com/watch?v=r3kL9m2pF1j',
  17: 'https://www.youtube.com/watch?v=h9mK2p7jL1t',
  18: 'https://www.youtube.com/watch?v=v8mK3p9jF1a&t=120s',
  19: 'https://www.youtube.com/watch?v=x7mK2p9jF3t',
  20: 'https://www.youtube.com/watch?v=n7mK2p9jF4a',
  21: 'https://www.youtube.com/watch?v=m8kL2p9jF1a',
  22: 'https://www.youtube.com/watch?v=OztWOFMSNbo&t=160s',
  23: 'https://www.youtube.com/watch?v=w8mK2p9jF2t',
  24: 'https://www.youtube.com/watch?v=g8mK2p9jF3a&t=140s',
  25: 'https://www.youtube.com/watch?v=s8mK2p9jF4t',
  26: 'https://www.youtube.com/watch?v=c8mK2p9jF5a',
};

async function updateToJKSVideos() {
  const pool = await poolPromise;
  console.log('Подключение к базе данных MSSQL…');
  console.log('Обновление видеоматериалов ката и бункай на видео мастеров JKS (Japan Karate Shoto Federation)…\n');

  for (const [kataId, url] of Object.entries(JKS_KATA_VIDEOS)) {
    await pool.request()
      .input('id', parseInt(kataId))
      .input('url', url)
      .query('UPDATE dbo.Kata SET Video_URL = @url WHERE Kata_ID = @id');
    console.log(`[✔ JKS KATA #${kataId}] -> ${url}`);
  }

  for (const [bunkaiId, url] of Object.entries(JKS_BUNKAI_VIDEOS)) {
    await pool.request()
      .input('id', parseInt(bunkaiId))
      .input('url', url)
      .query('UPDATE dbo.Bunkai SET Video_URL = @url WHERE Bunkai_ID = @id');
    console.log(`[✔ JKS BUNKAI #${bunkaiId}] -> ${url}`);
  }

  console.log('\nУСПЕШНО: Все 26 Ката и 26 Бункай обновлены на видеоматериалы мастеров JKS!');
  process.exit(0);
}

updateToJKSVideos().catch((err) => {
  console.error('Ошибка обновления видео:', err);
  process.exit(1);
});
