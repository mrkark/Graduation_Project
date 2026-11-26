require('../server/node_modules/dotenv').config({ path: require('path').resolve(__dirname, '../server/.env') });
const { poolPromise } = require('../server/src/config/database');

// Эталонные видеоролики Ката и Бункай Шотокан с официальных японских каналов
// (全日本空手道連盟 JKF, 日本空手松涛連盟総本部 JKS Headquarters, BUDO JAPAN CHANNEL, kuro-obi world,
//  松濤空手道飛翔館, JKA-Ueda Dojo, 岡本拳 OkaKen, 大阪谷町58, shotokankaratedo0) и JKS Belarus
const JKS_KATA_VIDEOS = {
  1: 'https://www.youtube.com/watch?v=_TKccmdk-wc',  // Heian Shodan (全日本空手道連盟 JKF 公式チャンネル)
  2: 'https://www.youtube.com/watch?v=Ol2a-k-jaPQ',  // Heian Nidan (全日本空手道連盟 JKF 公式チャンネル)
  3: 'https://www.youtube.com/watch?v=6J5aPAWWHZg',  // Heian Sandan (全日本空手道連盟 JKF 公式チャンネル)
  4: 'https://www.youtube.com/watch?v=JHmsIaJP7RI',  // Heian Yondan (全日本空手道連盟 JKF 公式チャンネル)
  5: 'https://www.youtube.com/watch?v=h1XeDIABQNc',  // Heian Godan (全日本空手道連盟 JKF 公式チャンネル)
  6: 'https://www.youtube.com/watch?v=yfAkPxIvY34',  // Tekki Shodan (kuro-obi world)
  7: 'https://www.youtube.com/watch?v=R21PpYpQTmc',  // Tekki Nidan (shotokankaratedo0 - JKA Shotokan)
  8: 'https://www.youtube.com/watch?v=gdYEUhGFM8Q',  // Tekki Sandan (shotokankaratedo0 - JKA Shotokan)
  9: 'https://www.youtube.com/watch?v=Ws6IuLfONYg',  // Bassai Dai (BUDO JAPAN CHANNEL - Масао Кагава, JKS)
  10: 'https://www.youtube.com/watch?v=eC7d_m8pwyM', // Bassai Sho (JKA-Ueda Dojo-空手道ちゃんねる)
  11: 'https://www.youtube.com/watch?v=q4CirEcx5bc', // Kanku Dai (全日本空手道連盟 JKF 公式チャンネル)
  12: 'https://www.youtube.com/watch?v=h5Gg8gXzjpk', // Kanku Sho (全日本空手道連盟 JKF 公式チャンネル)
  13: 'https://www.youtube.com/watch?v=R_fH5ABmi84', // Jion (全日本空手道連盟 JKF 公式チャンネル)
  14: 'https://www.youtube.com/watch?v=WoVZeE6Jtnc', // Ji'in (JKS Belarus)
  15: 'https://www.youtube.com/watch?v=AqkNX7HugT8', // Jitte (kuro-obi world - Кэйсукэ Нэмото, JKA)
  16: 'https://www.youtube.com/watch?v=6E020F9wPBM', // Empi (全日本空手道連盟 JKF 公式チャンネル)
  17: 'https://www.youtube.com/watch?v=HuO3Sqyrd_U', // Hangetsu (松濤空手道飛翔館)
  18: 'https://www.youtube.com/watch?v=3dut0mziO_4', // Gankaku (kuro-obi world)
  19: 'https://www.youtube.com/watch?v=hEz6LH-uMNw', // Sochin (岡本拳 OkaKen 空手道)
  20: 'https://www.youtube.com/watch?v=YDSLPJPRfwg', // Nijushiho (大阪谷町58)
  21: 'https://www.youtube.com/watch?v=HUyLXUagbFs', // Meikyo (JKA-Ueda Dojo-空手道ちゃんねる)
  22: 'https://www.youtube.com/watch?v=ReiZhF0Reuo', // Unsu (kuro-obi world - JKA World Tournament)
  23: 'https://www.youtube.com/watch?v=tvAsvziM1LM', // Wankan (Shotokan Karate)
  24: 'https://www.youtube.com/watch?v=P1jxO5JB-F0', // Gojushiho Dai (岡本拳 OkaKen 空手道)
  25: 'https://www.youtube.com/watch?v=DZrjy7O_IbU', // Gojushiho Sho (kuro-obi world)
  26: 'https://www.youtube.com/watch?v=t_iklmO60iA', // Chinte (松濤空手道飛翔館)
};

const JKS_BUNKAI_VIDEOS = {
  1: 'https://www.youtube.com/watch?v=9vaFywYXYmA',  // Bunkai Heian Shodan (松濤空手道飛翔館)
  2: 'https://www.youtube.com/watch?v=gUc_Uebelz4',  // Bunkai Heian Nidan (松濤空手道飛翔館)
  3: 'https://www.youtube.com/watch?v=42KNm3B-zeo',  // Bunkai Heian Sandan (松濤空手道飛翔館)
  4: 'https://www.youtube.com/watch?v=jobj555Wc9E',  // Bunkai Heian Yondan (松濤空手道飛翔館)
  5: 'https://www.youtube.com/watch?v=E0uHPbI7f3M',  // Bunkai Heian Godan (松濤空手道飛翔館)
  6: 'https://www.youtube.com/watch?v=0Cq93gZI7tI',  // Bunkai Tekki Shodan (JKS Belarus)
  7: 'https://www.youtube.com/watch?v=F1h4SElvMSA',  // Bunkai Tekki Nidan (JKS Belarus)
  8: 'https://www.youtube.com/watch?v=GknSP0SOcyE',  // Bunkai Tekki Sandan (JKS Belarus)
  9: 'https://www.youtube.com/watch?v=ObxoS71MuIo',  // Bunkai Bassai Dai (松濤空手道飛翔館)
  10: 'https://www.youtube.com/watch?v=iz5J6m9Q5Vs', // Bunkai Bassai Sho (大阪谷町58)
  11: 'https://www.youtube.com/watch?v=SbXaiyWvmHY', // Bunkai Kanku Dai (日本空手松涛連盟総本部 JKS Headquarters)
  12: 'https://www.youtube.com/watch?v=01Z_vtsQuk0', // Bunkai Kanku Sho (能登島道場)
  13: 'https://www.youtube.com/watch?v=L2Sc5nURwh4', // Bunkai Jion (全日本空手道連盟 JKF 公式チャンネル)
  14: 'https://www.youtube.com/watch?v=nxAaJSViiQc', // Bunkai Ji'in (Karate_GK 空手義気)
  15: 'https://www.youtube.com/watch?v=_N3VLgs4l64', // Bunkai Jitte (JKA-Ueda Dojo-空手道ちゃんねる)
  16: 'https://www.youtube.com/watch?v=_-SeAxvVU6Y', // Bunkai Empi (瀬茂内の空手と筋トレ倶楽部)
  17: 'https://www.youtube.com/watch?v=AxvwVaUtxIY', // Bunkai Hangetsu (tsuruhimeja - Кадзуаки Курихара)
  18: 'https://www.youtube.com/watch?v=o0sK_azlzXU', // Bunkai Gankaku (BUDO JAPAN CHANNEL)
  19: 'https://www.youtube.com/watch?v=CvoZBCQO5F8', // Bunkai Sochin (kuro-obi world - Кадзуаки Курихара)
  20: 'https://www.youtube.com/watch?v=KaOZK00j940', // Bunkai Nijushiho (BUDO JAPAN CHANNEL - Масао Кагава, JKS)
  21: 'https://www.youtube.com/watch?v=YVTR5z1RIlA', // Bunkai Meikyo (日本空手松涛連盟総本部 JKS Headquarters)
  22: 'https://www.youtube.com/watch?v=ZFHX0OmjynI', // Bunkai Unsu (BUDO JAPAN CHANNEL - Масао Кагава, JKS)
  23: 'https://www.youtube.com/watch?v=tvAsvziM1LM', // Bunkai Wankan (Shotokan Karate)
  24: 'https://www.youtube.com/watch?v=8V9bebLkAOM', // Bunkai Gojushiho Dai (Sakugawa Sanchin)
  25: 'https://www.youtube.com/watch?v=tVO8oAMYqcI', // Bunkai Gojushiho Sho (kuro-obi world)
  26: 'https://www.youtube.com/watch?v=4IrHtVXugHs', // Bunkai Chinte (松濤空手道飛翔館)
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
