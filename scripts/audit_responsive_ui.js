const fs = require('fs');
const path = require('path');
const puppeteer = require('d:/Studing/4k1s/Course_Project_CTCP/bunkai-explorer/client/node_modules/puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';

const VIEWPOINTS = [
  { name: 'Mobile_360x740', width: 360, height: 740 },
  { name: 'Mobile_390x844', width: 390, height: 844 },
  { name: 'Tablet_768x1024', width: 768, height: 1024 },
  { name: 'Desktop_1440x900', width: 1440, height: 900 }
];

const SCREENSHOT_DIR = 'd:/Studing/4k1s/Course_Project_CTCP/bunkai-explorer/docs/responsive_tests';

// Helper to wait
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function loginUser(page, username, password) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#username', { timeout: 5000 });
  await page.type('#username', username);
  await page.type('#password', password);
  await page.click('button[type="submit"]');
  await sleep(1500);
}

// Function to find overflowing elements on current page
async function checkOverflow(page) {
  return await page.evaluate(() => {
    const docWidth = document.documentElement.scrollWidth;
    const bodyWidth = document.body.scrollWidth;
    const winWidth = window.innerWidth;
    const hasHorizontalScroll = docWidth > winWidth + 1 || bodyWidth > winWidth + 1;

    const overflowingElements = [];
    if (hasHorizontalScroll) {
      const all = document.querySelectorAll('*');
      for (const el of all) {
        const rect = el.getBoundingClientRect();
        // Element sticks out past viewport right edge
        if (rect.right > winWidth + 2) {
          overflowingElements.push({
            tag: el.tagName.toLowerCase(),
            className: (el.className || '').toString().slice(0, 80),
            id: el.id || '',
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            scrollWidth: el.scrollWidth,
            parent: el.parentElement ? el.parentElement.tagName.toLowerCase() + '.' + (el.parentElement.className || '').toString().slice(0, 50) : null
          });
        }
      }
    }

    return {
      hasHorizontalScroll,
      docWidth,
      winWidth,
      overflowCount: overflowingElements.length,
      overflowingElements: overflowingElements.slice(0, 10) // Top 10 culprits
    };
  });
}

async function runResponsiveAudit() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  const allFindings = [];

  console.log('===============================================================');
  console.log('   BUNKAI EXPLORER — АДАПТИВНЫЙ АУДИТ UI ПОЛЬЗОВАТЕЛЕЙ И РОЛЕЙ  ');
  console.log('===============================================================\n');

  // Test definitions
  const testSuites = [
    {
      role: 'Guest (Гость)',
      user: null,
      routes: [
        { name: 'Логин', path: '/login' },
        { name: 'Регистрация', path: '/register' },
      ]
    },
    {
      role: 'User (Пользователь demo_user)',
      user: { username: 'demo_user', password: 'Demo#12345' },
      routes: [
        { name: 'Главная', path: '/' },
        { name: 'Каталог Ката', path: '/kata' },
        { name: 'Детальная Ката #1', path: '/kata/1' },
        { name: 'Каталог Бункай', path: '/bunkai' },
        { name: 'Детальная Бункай #1', path: '/bunkai/1' },
        { name: 'Конструктор Бункай', path: '/bunkai/new' },
        { name: 'Профиль', path: '/profile' },
        { name: 'Друзья', path: '/friends' },
        { name: 'Додзё', path: '/dojos' },
        { name: 'Чат', path: '/chat' },
        { name: '3D Студия Движений', path: '/studio' }
      ]
    },
    {
      role: 'Moderator (Модератор moderator)',
      user: { username: 'moderator', password: 'Moderator#12345' },
      routes: [
        { name: 'Модерация Бункай', path: '/admin/bunkai' },
        { name: 'Модерация Комментариев', path: '/admin/comments' }
      ]
    },
    {
      role: 'Administrator (Администратор admin)',
      user: { username: 'admin', password: 'Admin#12345' },
      routes: [
        { name: 'Админ: Дашборд', path: '/admin' },
        { name: 'Админ: Пользователи', path: '/admin/users' },
        { name: 'Админ: Журнал Аудита', path: '/admin/logs' },
        { name: 'Админ: Управление Ката', path: '/admin/kata' },
        { name: 'Админ: Бэкапы БД', path: '/admin/backups' },
        { name: 'Админ: Анимации', path: '/admin/animations' }
      ]
    }
  ];

  for (const suite of testSuites) {
    console.log(`\n>>> РОЛЬ: ${suite.role}`);

    // Очищаем куки и сессию перед каждой ролью
    const cdp = await page.target().createCDPSession();
    await cdp.send('Network.clearBrowserCookies');
    await cdp.send('Network.clearBrowserCache');

    // If role requires login
    if (suite.user) {
      await loginUser(page, suite.user.username, suite.user.password);
    } else {
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    }

    for (const route of suite.routes) {
      console.log(`\n  Проверка страницы: [${route.name}] (${route.path})`);

      for (const vp of VIEWPOINTS) {
        await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 });
        await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle2' }).catch(() => {});
        await sleep(600); // Allow render / transitions

        const check = await checkOverflow(page);
        const screenshotFile = `${suite.role.split(' ')[0]}_${route.name.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}_${vp.name}.png`;
        const screenshotPath = path.join(SCREENSHOT_DIR, screenshotFile);

        const status = check.hasHorizontalScroll ? '❌ ВЫЛЕЗАНЕТ/OVERFLOW' : '✅ OK';
        console.log(`    ${status} [${vp.name}]: DocW=${check.docWidth}px, WinW=${check.winWidth}px`);

        if (check.hasHorizontalScroll) {
          console.log(`       Элементы нарушители (${check.overflowCount}):`);
          check.overflowingElements.forEach((el, idx) => {
            console.log(`         #${idx+1} <${el.tag} class="${el.className}"> right=${el.right}px width=${el.width}px parent=<${el.parent}>`);
          });
          // Capture screenshot for debugging
          await page.screenshot({ path: screenshotPath, fullPage: false });
        }

        allFindings.push({
          role: suite.role,
          route: route.name,
          path: route.path,
          viewport: vp.name,
          width: vp.width,
          hasOverflow: check.hasHorizontalScroll,
          docWidth: check.docWidth,
          culprits: check.overflowingElements,
          screenshot: check.hasHorizontalScroll ? screenshotFile : null
        });
      }
    }
  }

  await browser.close();

  // Summary
  const overflows = allFindings.filter(f => f.hasOverflow);
  console.log('\n===============================================================');
  console.log(`ИТОГИ АУДИТА: Всего проверок: ${allFindings.length} | Дефектов: ${overflows.length}`);
  console.log('===============================================================');

  const reportPath = path.join(SCREENSHOT_DIR, 'audit_summary.json');
  fs.writeFileSync(reportPath, JSON.stringify({ total: allFindings.length, defects: overflows.length, details: overflows }, null, 2));
  console.log(`Сводка сохранена в: ${reportPath}`);
}

runResponsiveAudit().catch(err => {
  console.error('Ошибка аудита:', err);
  process.exit(1);
});
