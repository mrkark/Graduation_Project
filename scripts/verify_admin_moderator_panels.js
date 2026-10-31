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

async function loginUser(page, username, password) {
  console.log(`[TEST] Logging in as ${username}...`);
  try {
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.evaluate(async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch (e) {}
      localStorage.clear();
      sessionStorage.clear();
    });
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
  } catch (e) {
    console.log('[TEST] Clean session error (ignorable):', e.message);
  }

  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForSelector('#username', { timeout: 10000 });
  await page.evaluate(() => {
    document.querySelector('#username').value = '';
    document.querySelector('#password').value = '';
  });
  await page.type('#username', username);
  await page.type('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => !window.location.pathname.includes('/login'), { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1000));
}

async function run() {
  const executablePath = await getChromePath();
  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  const screenshotDir = 'd:/Studing/4k1s/Course_Project_CTCP/bunkai-explorer/scripts/screenshots';
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const results = {
    noTagsInNavbar: false,
    adminHeaderClean: false,
    adminZeroKanji: false,
    adminUsersTableUsecases: false,
    adminLogsFiltersWorking: false,
    adminBackupsWorking: false,
    moderatorPanelClean: false,
    moderatorRestrictedMenu: false,
    moderatorBunkaiTabs: false,
    moderatorCommentsList: false,
  };

  try {
    // ==========================================
    // 1. ADMIN AUDIT
    // ==========================================
    await page.setViewport({ width: 1440, height: 900 });
    await loginUser(page, 'admin', 'Admin#12345');

    // Check navbar for absence of staff pill or @handle tags
    const navbarCheck = await page.evaluate(() => {
      const userBtn = document.querySelector('.navbar__user-btn');
      const staffPill = document.querySelector('.navbar__staff-pill');
      const text = userBtn ? userBtn.textContent : '';
      return {
        hasStaffPill: !!staffPill,
        hasAtHandle: text.includes('@'),
        btnText: text.trim(),
      };
    });
    console.log('[TEST] Navbar Nick Check:', JSON.stringify(navbarCheck));
    if (!navbarCheck.hasStaffPill && !navbarCheck.hasAtHandle) {
      results.noTagsInNavbar = true;
    }

    // Navigate to Admin Dashboard
    console.log('[TEST] Navigating to http://localhost:5173/admin...');
    await page.goto('http://localhost:5173/admin', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('.admin-dashboard', { timeout: 10000 });

    const adminDashCheck = await page.evaluate(() => {
      const h1 = document.querySelector('.admin-page-header h1')?.textContent;
      const kanjiElements = document.querySelectorAll('.admin-nav__kanji');
      const allText = document.querySelector('.admin-wrapper')?.textContent || '';
      const kanjiRegex = /[\u4e00-\u9faf\u3040-\u30ff]/;
      return {
        headerTitle: h1,
        kanjiCount: kanjiElements.length,
        hasAnyKanji: kanjiRegex.test(allText),
      };
    });
    console.log('[TEST] Admin Dashboard Check:', JSON.stringify(adminDashCheck));
    if (adminDashCheck.headerTitle === 'Панель администратора') {
      results.adminHeaderClean = true;
    }
    if (adminDashCheck.kanjiCount === 0 && !adminDashCheck.hasAnyKanji) {
      results.adminZeroKanji = true;
    }

    await page.screenshot({ path: path.join(screenshotDir, 'admin_dashboard_desktop.png'), fullPage: false });

    // Navigate to Admin Users Page (Use cases: Lock/Unlock, Add/Remove moderator)
    console.log('[TEST] Navigating to http://localhost:5173/admin/users...');
    await page.goto('http://localhost:5173/admin/users', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('.admin-users-page', { timeout: 10000 });
    await page.waitForSelector('.admin-table tbody tr', { timeout: 10000 });

    const usersCheck = await page.evaluate(() => {
      const table = document.querySelector('.admin-table');
      const tableWrap = document.querySelector('.admin-table-wrap');
      const rows = document.querySelectorAll('.admin-table tbody tr');
      const controls = document.querySelector('.admin-controls-card');
      const blockBtns = document.querySelectorAll('.btn-warning, .btn-success');
      const modBtns = document.querySelectorAll('.btn-info, .btn-subtle');
      const hasHorizontalScroll = tableWrap ? tableWrap.scrollWidth > tableWrap.clientWidth : false;
      const lastTh = document.querySelector('.admin-table th:last-child');
      const computedPaddingRight = lastTh ? window.getComputedStyle(lastTh).paddingRight : '';
      const thTexts = Array.from(document.querySelectorAll('.admin-table th')).map(t => t.textContent.trim());
      const hasEmailCol = thTexts.some(t => t.toLowerCase().includes('email'));
      const hasRoleCol = thTexts.includes('Роль');
      const hasDateCol = thTexts.some(t => t.toLowerCase().includes('создания') || t.toLowerCase().includes('дата'));
      return {
        hasTable: !!table,
        rowCount: rows.length,
        hasControls: !!controls,
        hasBlockActions: blockBtns.length > 0,
        hasModeratorActions: modBtns.length > 0,
        hasHorizontalScroll,
        edgePaddingRight: computedPaddingRight,
        hasNoEmailCol: !hasEmailCol,
        hasRoleCol,
        hasDateCol,
      };
    });
    console.log('[TEST] Admin Users Check:', JSON.stringify(usersCheck));
    if (usersCheck.hasTable && usersCheck.rowCount > 0 && usersCheck.hasBlockActions && usersCheck.hasModeratorActions && !usersCheck.hasHorizontalScroll && usersCheck.hasNoEmailCol && usersCheck.hasRoleCol && usersCheck.hasDateCol) {
      results.adminUsersTableUsecases = true;
    }
    await page.screenshot({ path: path.join(screenshotDir, 'admin_users_desktop.png'), fullPage: false });

    // Navigate to Admin Logs Page (Use cases: Filtering by action, user, IP, date)
    console.log('[TEST] Navigating to http://localhost:5173/admin/logs...');
    await page.goto('http://localhost:5173/admin/logs', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('.admin-logs-page', { timeout: 10000 });
    await page.waitForSelector('.admin-table tbody tr', { timeout: 10000 });

    const logsCheck = await page.evaluate(() => {
      const actionSelect = document.querySelector('.admin-field-wrap select');
      const options = actionSelect ? Array.from(actionSelect.options).map(o => o.value) : [];
      const dateInputs = document.querySelectorAll('input[type="date"]');
      const tableRows = document.querySelectorAll('.admin-table tbody tr');
      const thTexts = Array.from(document.querySelectorAll('.admin-table th')).map(t => t.textContent.trim());
      const hasIpCol = thTexts.some(t => t.toLowerCase().includes('ip'));
      return {
        hasActionSelect: !!actionSelect,
        actionOptionsCount: options.length,
        hasDateInputs: dateInputs.length === 2,
        logRowsCount: tableRows.length,
        hasNoIpCol: !hasIpCol,
      };
    });
    console.log('[TEST] Admin Logs Check:', JSON.stringify(logsCheck));
    if (logsCheck.hasActionSelect && logsCheck.hasDateInputs && logsCheck.logRowsCount > 0 && logsCheck.hasNoIpCol) {
      results.adminLogsFiltersWorking = true;
    }
    await page.screenshot({ path: path.join(screenshotDir, 'admin_logs_desktop.png'), fullPage: false });

    // Navigate to Admin Backups Page (Use case: Database backups)
    console.log('[TEST] Navigating to http://localhost:5173/admin/backups...');
    await page.goto('http://localhost:5173/admin/backups', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('.admin-backups-page', { timeout: 10000 });
    await page.waitForSelector('.admin-table tbody tr', { timeout: 10000 });

    const backupsCheck = await page.evaluate(() => {
      const createBtn = document.querySelector('.btn-primary');
      const tableRows = document.querySelectorAll('.admin-table tbody tr');
      const metricCards = document.querySelectorAll('.admin-metric-card');
      return {
        hasCreateBtn: !!createBtn && createBtn.textContent.includes('Создать резервную копию'),
        backupsCount: tableRows.length,
        hasMetrics: metricCards.length >= 3,
      };
    });
    console.log('[TEST] Admin Backups Check:', JSON.stringify(backupsCheck));
    if (backupsCheck.hasCreateBtn && backupsCheck.backupsCount > 0) {
      results.adminBackupsWorking = true;
    }
    await page.screenshot({ path: path.join(screenshotDir, 'admin_backups_desktop.png'), fullPage: false });

    // ==========================================
    // 2. MODERATOR AUDIT
    // ==========================================
    await loginUser(page, 'moderator', 'Moderator#12345');

    console.log('[TEST] Navigating to http://localhost:5173/admin as Moderator...');
    await page.goto('http://localhost:5173/admin', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('.admin-dashboard', { timeout: 10000 });

    const modDashCheck = await page.evaluate(() => {
      const h1 = document.querySelector('.admin-page-header h1')?.textContent;
      const badge = document.querySelector('.admin-page-header__badge')?.textContent;
      const navLinks = Array.from(document.querySelectorAll('.admin-nav a')).map(a => a.textContent.trim());
      const hasUsersLink = navLinks.some(l => l.includes('Пользователи'));
      const hasLogsLink = navLinks.some(l => l.includes('Журнал'));
      const hasBackupsLink = navLinks.some(l => l.includes('Резервные'));
      return {
        h1,
        badge,
        navLinks,
        hasUsersLink,
        hasLogsLink,
        hasBackupsLink,
      };
    });
    console.log('[TEST] Moderator Dashboard Check:', JSON.stringify(modDashCheck));

    if (modDashCheck.h1 === 'Панель модератора' && modDashCheck.badge?.includes('МОДЕРАТОРА')) {
      results.moderatorPanelClean = true;
    }
    if (!modDashCheck.hasUsersLink && !modDashCheck.hasLogsLink && !modDashCheck.hasBackupsLink) {
      results.moderatorRestrictedMenu = true;
    }
    await page.screenshot({ path: path.join(screenshotDir, 'moderator_dashboard_desktop.png'), fullPage: false });

    // Navigate to Bunkai Moderation (Use case: Approve/Reject publication)
    console.log('[TEST] Navigating to http://localhost:5173/admin/bunkai as Moderator...');
    await page.goto('http://localhost:5173/admin/bunkai', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('.admin-bunkai-page', { timeout: 10000 });

    // Switch to "Одобренные" tab to verify action buttons on real items
    const tabButtons = await page.$$('.admin-status-tab');
    if (tabButtons.length >= 2) {
      await tabButtons[1].click();
      await new Promise(r => setTimeout(r, 800));
    }

    const bunkaiModCheck = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('.admin-status-tab')).map(t => t.textContent.trim());
      const searchInput = document.querySelector('.admin-search-wrap input');
      const actionBtns = Array.from(document.querySelectorAll('.admin-row-actions button, .admin-row-actions a')).map(b => b.textContent.trim());
      const hasPreview = actionBtns.some(b => b.includes('3D-просмотр'));
      const hasDeleteOrReject = actionBtns.some(b => b.includes('Отклонить') || b.includes('Удалить'));
      return {
        tabs,
        hasSearch: !!searchInput,
        hasPreview,
        hasDeleteOrReject,
      };
    });
    console.log('[TEST] Moderator Bunkai Check:', JSON.stringify(bunkaiModCheck));
    if (bunkaiModCheck.tabs.length === 3 && bunkaiModCheck.hasSearch) {
      results.moderatorBunkaiTabs = true;
    }
    await page.screenshot({ path: path.join(screenshotDir, 'moderator_bunkai_desktop.png'), fullPage: false });

    // Navigate to Comments Moderation (Use case: View/Delete comments)
    console.log('[TEST] Navigating to http://localhost:5173/admin/comments as Moderator...');
    await page.goto('http://localhost:5173/admin/comments', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('.admin-comments-page', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1000));

    const commentsModCheck = await page.evaluate(() => {
      const searchInput = document.querySelector('.admin-input');
      const select = document.querySelector('.admin-select');
      const allText = document.querySelector('.admin-comments-page')?.textContent || '';
      const hasAtHandle = allText.includes('@');
      return {
        hasSearch: !!searchInput,
        hasSelect: !!select,
        hasAtHandle,
      };
    });
    console.log('[TEST] Moderator Comments Check:', JSON.stringify(commentsModCheck));
    if (commentsModCheck.hasSearch && commentsModCheck.hasSelect && !commentsModCheck.hasAtHandle) {
      results.moderatorCommentsList = true;
    }
    await page.screenshot({ path: path.join(screenshotDir, 'moderator_comments_desktop.png'), fullPage: false });

  } catch (err) {
    console.error('[TEST ERROR]', err);
  } finally {
    await browser.close();
  }

  console.log('\n=== COMPLETE AUDIT RESULTS ===');
  console.log(JSON.stringify(results, null, 2));
  fs.writeFileSync('d:/Studing/4k1s/Course_Project_CTCP/bunkai-explorer/scripts/panel_audit_results.json', JSON.stringify(results, null, 2));
}

run();
