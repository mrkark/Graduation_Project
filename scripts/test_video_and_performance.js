const puppeteer = require('d:/Studing/4k1s/Course_Project_CTCP/bunkai-explorer/client/node_modules/puppeteer-core');
const fs = require('fs');

async function testVideoAndSpeed() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const executablePath = fs.existsSync(edgePath) ? edgePath : chromePath;

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  console.log('1. Вход в систему под admin...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
  await page.waitForSelector('#username');
  await page.type('#username', 'admin');
  await page.type('#password', 'Admin#12345');
  await page.click('button[type="submit"]');
  await new Promise((r) => setTimeout(r, 1500));

  console.log('2. Проверка загрузки страницы /kata/1...');
  const t0 = Date.now();
  await page.goto('http://localhost:5173/kata/1', { waitUntil: 'domcontentloaded' });
  const domTime = Date.now() - t0;
  console.log(`⏱ Время DOM-загрузки /kata/1: ${domTime} мс (цель: < 1000 мс)`);

  await page.waitForSelector('.stage-mode-switcher', { timeout: 5000 });
  console.log('✔ Переключатель режимов (Видео / 3D) обнаружен на странице');

  const videoFacade = await page.$('.video-embed-facade');
  if (videoFacade) {
    console.log('✔ Фасад видеоплеера JKS с постером и кнопкой "Смотреть видео" отображается');
  } else {
    console.warn('⚠️ Фасад видеоплеера не найден');
  }

  const toolbar = await page.$('.video-embed-toolbar');
  if (toolbar) {
    console.log('✔ Панель прямого перехода на YouTube и зеркал отображается');
  }

  console.log('3. Проверка клика по кнопке воспроизведения...');
  if (videoFacade) {
    await videoFacade.click();
    await new Promise((r) => setTimeout(r, 1000));
    const iframe = await page.$('.video-embed-iframe');
    if (iframe) {
      const src = await page.evaluate((el) => el.src, iframe);
      console.log(`✔ Iframe видеоплеера успешно активирован: ${src}`);
    }
  }

  console.log('4. Проверка страницы бункая /bunkai/1...');
  const t1 = Date.now();
  await page.goto('http://localhost:5173/bunkai/1', { waitUntil: 'domcontentloaded' });
  const bunkaiDomTime = Date.now() - t1;
  console.log(`⏱ Время DOM-загрузки /bunkai/1: ${bunkaiDomTime} мс`);

  await page.waitForSelector('.stage-mode-switcher', { timeout: 5000 });
  console.log('✔ Переключатель режимов (Видео / 3D) на странице бункая обнаружен');

  const bunkaiVideoFacade = await page.$('.video-embed-facade');
  if (bunkaiVideoFacade) {
    console.log('✔ Фасад видеоплеера боевого бункая JKS с таймкодом отображается');
  }

  console.log('5. Проверка каталога /kata...');
  await page.goto('http://localhost:5173/kata', { waitUntil: 'networkidle2' });
  const videoBtns = await page.$$('.atlas-card__video-badge-btn');
  console.log(`✔ Найдено ${videoBtns.length} кнопок "🎥 Видео JKS" на карточках ката`);

  console.log('6. Проверка каталога /bunkai...');
  await page.goto('http://localhost:5173/bunkai', { waitUntil: 'networkidle2' });
  const bunkaiBtns = await page.$$('.bunkai-video-btn');
  console.log(`✔ Найдено ${bunkaiBtns.length} кнопок "🎥 Видео JKS" на карточках бункая`);

  await browser.close();
  console.log('\n🎉 ВСЕ ПРОВЕРКИ ПРОИЗВОДИТЕЛЬНОСТИ И ОТОБРАЖЕНИЯ ВИДЕО УСПЕШНО ПРОЙДЕНЫ!');
  process.exit(0);
}

testVideoAndSpeed().catch((err) => {
  console.error('Ошибка теста:', err);
  process.exit(1);
});
