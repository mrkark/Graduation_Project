const fs = require('fs');
const path = require('path');
const puppeteer = require('d:/Studing/4k1s/Course_Project_CTCP/bunkai-explorer/client/node_modules/puppeteer-core');

async function getChromePath() {
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Users\\user\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('No Chrome or Edge binary found');
}

async function run() {
  const executablePath = await getChromePath();
  console.log(`[TEST] Using browser executable: ${executablePath}`);

  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  page.on('console', msg => console.log('[BROWSER LOG]', msg.text()));
  page.on('pageerror', err => console.log('[BROWSER PAGE ERROR]', err.message));
  const screenshotDir = 'd:/Studing/4k1s/Course_Project_CTCP/bunkai-explorer/scripts/screenshots';
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const results = {
    searchIconInsideField: false,
    noHorizontalScrollDesktop: false,
    noHorizontalScrollMobile: false,
    favoritesToggleWorking: false,
    difficultyFiltersWorking: false,
    bunkaiDetail3DTop: false,
    bunkaiDetailVideoBottom: false,
  };

  try {
    // 0. AUTHENTICATION (Login as admin)
    console.log('[TEST] Logging in as admin...');
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('#username', { timeout: 10000 });
    await page.type('#username', 'admin');
    await page.type('#password', 'Admin#12345');
    await page.click('button[type="submit"]');
    await new Promise(r => setTimeout(r, 2000));
    console.log('[TEST] Post-login URL:', page.url());

    // 1. DESKTOP TEST - Bunkai List Page
    console.log('[TEST] Navigating to http://localhost:5173/bunkai (Desktop 1440x900)...');
    await page.goto('http://localhost:5173/bunkai', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('.bunkai-search-card', { timeout: 10000 });

    // Check bounds of search input and search icon
    const iconAndInputBounds = await page.evaluate(() => {
      const input = document.querySelector('.bunkai-search-input');
      const icon = document.querySelector('.bunkai-search-icon-box');
      if (!input || !icon) return null;
      const rInput = input.getBoundingClientRect();
      const rIcon = icon.getBoundingClientRect();
      return {
        input: { left: rInput.left, top: rInput.top, right: rInput.right, bottom: rInput.bottom, width: rInput.width, height: rInput.height },
        icon: { left: rIcon.left, top: rIcon.top, right: rIcon.right, bottom: rIcon.bottom, width: rIcon.width, height: rIcon.height },
        isInside: (rIcon.left >= rInput.left && rIcon.right <= rInput.right && rIcon.top >= rInput.top && rIcon.bottom <= rInput.bottom),
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    });

    console.log('[TEST] Desktop Bounds:', JSON.stringify(iconAndInputBounds, null, 2));
    if (iconAndInputBounds && iconAndInputBounds.isInside) {
      results.searchIconInsideField = true;
    }
    if (iconAndInputBounds && iconAndInputBounds.scrollWidth <= iconAndInputBounds.clientWidth + 2) {
      results.noHorizontalScrollDesktop = true;
    }

    // Test Favorites Toggle Button
    console.log('[TEST] Testing favorites toggle click...');
    const favBtn = await page.$('.bunkai-fav-toggle-btn');
    if (favBtn) {
      await favBtn.click();
      await new Promise(r => setTimeout(r, 400));
      const isFavActive = await page.evaluate(() => {
        const btn = document.querySelector('.bunkai-fav-toggle-btn');
        return btn && btn.classList.contains('active');
      });
      console.log('[TEST] Favorites toggle active after click:', isFavActive);
      results.favoritesToggleWorking = isFavActive;
      // Toggle back
      await favBtn.click();
      await new Promise(r => setTimeout(r, 300));
    }

    // Test Difficulty filter pills
    console.log('[TEST] Testing difficulty filter pill click...');
    const diffPills = await page.$$('.bunkai-diff-pill');
    if (diffPills.length > 1) {
      await diffPills[1].click(); // Click beginner
      await new Promise(r => setTimeout(r, 400));
      const activeDiff = await page.evaluate(() => {
        const active = document.querySelector('.bunkai-diff-pill.active');
        return active ? active.textContent.trim() : null;
      });
      console.log('[TEST] Active difficulty pill:', activeDiff);
      if (activeDiff) results.difficultyFiltersWorking = true;
      // Click All back
      await diffPills[0].click();
      await new Promise(r => setTimeout(r, 300));
    }

    await page.screenshot({ path: path.join(screenshotDir, 'bunkai_list_desktop.png'), fullPage: false });
    console.log('[TEST] Saved bunkai_list_desktop.png');

    // 2. MOBILE TEST - Bunkai List Page (390x844 iPhone 14)
    console.log('[TEST] Navigating on Mobile (390x844)...');
    await page.setViewport({ width: 390, height: 844 });
    await new Promise(r => setTimeout(r, 500));

    const mobileBounds = await page.evaluate(() => {
      const input = document.querySelector('.bunkai-search-input');
      const icon = document.querySelector('.bunkai-search-icon-box');
      if (!input || !icon) return null;
      const rInput = input.getBoundingClientRect();
      const rIcon = icon.getBoundingClientRect();
      return {
        input: { left: rInput.left, top: rInput.top, right: rInput.right, bottom: rInput.bottom, width: rInput.width, height: rInput.height },
        icon: { left: rIcon.left, top: rIcon.top, right: rIcon.right, bottom: rIcon.bottom, width: rIcon.width, height: rIcon.height },
        isInside: (rIcon.left >= rInput.left && rIcon.right <= rInput.right && rIcon.top >= rInput.top && rIcon.bottom <= rInput.bottom),
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    });

    console.log('[TEST] Mobile Bounds:', JSON.stringify(mobileBounds, null, 2));
    if (mobileBounds && mobileBounds.scrollWidth <= mobileBounds.clientWidth + 2) {
      results.noHorizontalScrollMobile = true;
    }

    await page.screenshot({ path: path.join(screenshotDir, 'bunkai_list_mobile.png'), fullPage: false });
    console.log('[TEST] Saved bunkai_list_mobile.png');

    // 3. BUNKAI DETAIL PAGE TEST
    console.log('[TEST] Navigating to http://localhost:5173/bunkai/1 (Desktop 1440x900)...');
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://localhost:5173/bunkai/1', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('.bunkai-detail', { timeout: 10000 });

    // Verify 3D arena is at the top
    const detailCheck = await page.evaluate(() => {
      const arena = document.querySelector('.bunkai-detail__arena-wrap');
      const videoSection = document.querySelector('.bunkai-detail__video-section');
      const arenaHeader = document.querySelector('.bunkai-detail__arena-badge');
      const modeSwitcher = document.querySelector('.stage-mode-switcher');
      const tacticalNotes = document.querySelector('.bunkai-notes');

      const arenaTop = arena ? arena.getBoundingClientRect().top : -1;
      const notesTop = tacticalNotes ? tacticalNotes.getBoundingClientRect().top : -1;
      const videoTop = videoSection ? videoSection.getBoundingClientRect().top : -1;

      return {
        hasArena: !!arena,
        hasVideoSection: !!videoSection,
        noTopModeSwitcher: !modeSwitcher,
        arenaBadgeText: arenaHeader ? arenaHeader.textContent.trim() : null,
        isOrderedCorrectly: (arenaTop < notesTop && notesTop < videoTop),
        videoTitle: videoSection ? videoSection.querySelector('.bunkai-detail__video-section-title')?.textContent.trim() : null,
      };
    });

    console.log('[TEST] Detail Page Structure:', JSON.stringify(detailCheck, null, 2));

    if (detailCheck.hasArena && detailCheck.noTopModeSwitcher) {
      results.bunkaiDetail3DTop = true;
    }
    if (detailCheck.hasVideoSection && detailCheck.isOrderedCorrectly) {
      results.bunkaiDetailVideoBottom = true;
    }

    await page.screenshot({ path: path.join(screenshotDir, 'bunkai_detail_desktop.png'), fullPage: false });
    console.log('[TEST] Saved bunkai_detail_desktop.png');

    // Scroll to bottom video section to capture screenshot
    await page.evaluate(() => {
      const v = document.querySelector('.bunkai-detail__video-section');
      if (v) v.scrollIntoView();
    });
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(screenshotDir, 'bunkai_detail_video_bottom.png'), fullPage: false });
    console.log('[TEST] Saved bunkai_detail_video_bottom.png');

  } catch (err) {
    console.error('[TEST ERROR]', err);
  } finally {
    await browser.close();
  }

  console.log('=== TEST VERIFICATION RESULTS ===');
  console.log(JSON.stringify(results, null, 2));
  fs.writeFileSync('d:/Studing/4k1s/Course_Project_CTCP/bunkai-explorer/scripts/test_results.json', JSON.stringify(results, null, 2));
}

run();
