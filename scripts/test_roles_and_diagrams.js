const http = require('http');

const BASE_URL = 'http://localhost:5000';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    if (options.query) {
      Object.entries(options.query).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.set(k, v);
      });
    }

    const reqOptions = {
      method: options.method || 'GET',
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...options.headers,
      },
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed,
        });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function login(username, password) {
  const res = await request('/api/auth/login', {
    method: 'POST',
    body: { username, password },
  });
  if (res.status === 200 && res.data.success) {
    return {
      token: res.data.data.accessToken,
      user: res.data.data.user,
      role: res.data.data.role,
    };
  }
  throw new Error(`Login failed for ${username}: ${JSON.stringify(res.data)}`);
}

async function runTests() {
  console.log('====================================================');
  console.log('   BUNKAI EXPLORER — АУДИТ И ТЕСТИРОВАНИЕ РОЛЕЙ     ');
  console.log('====================================================\n');

  const results = [];
  function logResult(suite, name, passed, details = '') {
    results.push({ suite, name, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} [${suite}] ${name}${details ? ' -> ' + details : ''}`);
  }

  // 1. АВТОРИЗАЦИЯ
  let admin, moderator, user;
  try {
    admin = await login('admin', 'Admin#12345');
    logResult('AUTH', 'Вход Администратора (admin)', true, `Role: ${admin.role}`);
  } catch (e) {
    logResult('AUTH', 'Вход Администратора (admin)', false, e.message);
  }

  try {
    moderator = await login('moderator', 'Moderator#12345');
    logResult('AUTH', 'Вход Модератора (moderator)', true, `Role: ${moderator.role}`);
  } catch (e) {
    logResult('AUTH', 'Вход Модератора (moderator)', false, e.message);
  }

  try {
    user = await login('demo_user', 'Demo#12345');
    logResult('AUTH', 'Вход Пользователя (demo_user)', true, `Role: ${user.role}`);
  } catch (e) {
    logResult('AUTH', 'Вход Пользователя (demo_user)', false, e.message);
  }

  // Guest gating
  const guestRes = await request('/api/kata');
  logResult('SECURITY', 'Guest-Gating: запрет неавторизованным (/api/kata)', guestRes.status === 401, `Status: ${guestRes.status}`);

  if (!admin || !moderator || !user) {
    console.error('Критические аккаунты недоступны, остановка тестов.');
    return;
  }

  // 2. ДИАГРАММА АДМИНИСТРАТОРА: Управление учетными записями
  console.log('\n--- Проверка прецедентов Администратора ---');
  // Список пользователей
  const usersRes = await request('/api/users', { token: admin.token });
  logResult('ADMIN: USERS', 'Просмотр списка пользователей', usersRes.status === 200, `Total: ${usersRes.data?.meta?.total}`);

  // Модератор не должен иметь доступ к управлению ролями пользователей
  const modUsersRoleRes = await request(`/api/users/${user.user.User_ID}/role`, {
    method: 'PATCH',
    token: moderator.token,
    body: { roleName: 'moderator' },
  });
  logResult('SECURITY: RBAC', 'Модератор не может менять роли пользователей (ожидается 403)', modUsersRoleRes.status === 403, `Status: ${modUsersRoleRes.status}`);

  // Модератор не должен иметь доступ к блокировке пользователей
  const modBlockRes = await request(`/api/users/${user.user.User_ID}/block`, {
    method: 'POST',
    token: moderator.token,
  });
  logResult('SECURITY: RBAC', 'Модератор не может блокировать пользователей (ожидается 403)', modBlockRes.status === 403, `Status: ${modBlockRes.status}`);

  // Администратор: Добавление модератора (User -> Moderator)
  // Найдем тестового пользователя Test_User
  const testUserFound = (usersRes.data?.data || []).find((u) => u.Username === 'Test_User');
  const targetUserId = testUserFound ? testUserFound.User_ID : user.user.User_ID;

  const makeModRes = await request(`/api/users/${targetUserId}/role`, {
    method: 'PATCH',
    token: admin.token,
    body: { roleName: 'moderator' },
  });
  logResult('ADMIN: USERS', 'Добавление модератора (назначение роли moderator)', makeModRes.status === 200, `Status: ${makeModRes.status}`);

  // Администратор: Удаление модератора (Moderator -> User)
  const removeModRes = await request(`/api/users/${targetUserId}/role`, {
    method: 'PATCH',
    token: admin.token,
    body: { roleName: 'user' },
  });
  logResult('ADMIN: USERS', 'Удаление модератора (снятие роли moderator -> user)', removeModRes.status === 200, `Status: ${removeModRes.status}`);

  // Администратор: Блокировка учетной записи
  const blockRes = await request(`/api/users/${targetUserId}/block`, {
    method: 'POST',
    token: admin.token,
  });
  logResult('ADMIN: USERS', 'Блокировка учетной записи', blockRes.status === 200, `Status: ${blockRes.status}`);

  // Администратор: Разблокировка учетной записи
  const unblockRes = await request(`/api/users/${targetUserId}/unblock`, {
    method: 'POST',
    token: admin.token,
  });
  logResult('ADMIN: USERS', 'Разблокировка учетной записи', unblockRes.status === 200, `Status: ${unblockRes.status}`);

  // 3. ДИАГРАММА АДМИНИСТРАТОРА: Мониторинг журнала системного аудита и фильтрация событий
  console.log('\n--- Проверка мониторинга аудита ---');
  const logsRes = await request('/api/admin/logs', { token: admin.token });
  logResult('ADMIN: AUDIT', 'Просмотр журнала системного аудита', logsRes.status === 200, `Items: ${logsRes.data?.data?.length}`);

  // Модератор не имеет доступа к журналу аудита
  const modLogsRes = await request('/api/admin/logs', { token: moderator.token });
  logResult('SECURITY: RBAC', 'Модератор не имеет доступа к журналу аудита (ожидается 403)', modLogsRes.status === 403, `Status: ${modLogsRes.status}`);

  // Фильтрация событий: По коду действия
  const logFilterAction = await request('/api/admin/logs', { token: admin.token, query: { action: 'block_user' } });
  const allMatchAction = logFilterAction.data?.data?.every((l) => l.Action === 'block_user');
  logResult('ADMIN: AUDIT', 'Фильтрация событий: По коду действия', logFilterAction.status === 200 && allMatchAction, `Matches: ${logFilterAction.data?.data?.length}`);

  // Фильтрация событий: По пользователю
  const logFilterUser = await request('/api/admin/logs', { token: admin.token, query: { userId: admin.user.User_ID } });
  const allMatchUser = logFilterUser.data?.data?.every((l) => l.User_ID === admin.user.User_ID);
  logResult('ADMIN: AUDIT', 'Фильтрация событий: По пользователю', logFilterUser.status === 200 && allMatchUser, `Matches: ${logFilterUser.data?.data?.length}`);

  // Фильтрация событий: По IP адресу
  const sampleIp = logsRes.data?.data?.[0]?.Ip_Address || '127.0.0.1';
  const cleanIp = sampleIp.replace(/^::ffff:/, '').split('.')[0]; // e.g. "172"
  const logFilterIp = await request('/api/admin/logs', { token: admin.token, query: { ip: cleanIp } });
  const allMatchIp = (logFilterIp.data?.data || []).every((l) => l.Ip_Address.includes(cleanIp));
  logResult('ADMIN: AUDIT', 'Фильтрация событий: По IP адресу', logFilterIp.status === 200 && (logFilterIp.data?.data?.length || 0) > 0 && allMatchIp, `Found: ${logFilterIp.data?.data?.length} for ${cleanIp}`);

  // Фильтрация событий: По дате
  const today = new Date().toISOString().split('T')[0];
  const logFilterDate = await request('/api/admin/logs', { token: admin.token, query: { dateFrom: today, dateTo: today } });
  const allMatchDate = (logFilterDate.data?.data || []).every((l) => l.Created_At.startsWith(today));
  logResult('ADMIN: AUDIT', 'Фильтрация событий: По дате', logFilterDate.status === 200 && (logFilterDate.data?.data?.length || 0) > 0 && allMatchDate, `Found: ${logFilterDate.data?.data?.length} for ${today}`);

  // 4. ДИАГРАММА АДМИНИСТРАТОРА: Создание резервных копий базы данных
  console.log('\n--- Проверка резервного копирования БД ---');
  const backupListRes = await request('/api/admin/backups', { token: admin.token });
  logResult('ADMIN: BACKUP', 'Просмотр списка резервных копий', backupListRes.status === 200, `Count: ${backupListRes.data?.data?.length}`);

  const backupCreateRes = await request('/api/admin/backups', { method: 'POST', token: admin.token });
  const backupSuccess = backupCreateRes.status === 201 && backupCreateRes.data?.data?.Status === 'success';
  logResult('ADMIN: BACKUP', 'Создание резервной копии базы данных', backupSuccess, `Status: ${backupCreateRes.status}, DB Status: ${backupCreateRes.data?.data?.Status}`);

  // 5. ДИАГРАММА МОДЕРАТОРА: Модерация бункай
  console.log('\n--- Проверка прецедентов Модератора: Бункай ---');
  // Создадим тестовый бункай от имени обычного пользователя
  const createBunkaiRes = await request('/api/bunkai', {
    method: 'POST',
    token: user.token,
    body: {
      kataId: 1,
      title: 'Тестовый бункай для проверки модерации',
      description: 'Описание тестового бункая',
      difficulty: 'beginner',
    },
  });
  const createdBunkai = createBunkaiRes.data?.data;
  logResult('USER: BUNKAI', 'Создание бункай пользователем', createBunkaiRes.status === 201, `ID: ${createdBunkai?.Bunkai_ID}, Status: ${createdBunkai?.Status}`);

  if (createdBunkai) {
    // Модератор: Утверждение публикации бункай
    const approveRes = await request(`/api/bunkai/${createdBunkai.Bunkai_ID}/approve`, {
      method: 'POST',
      token: moderator.token,
    });
    logResult('MODERATOR: BUNKAI', 'Утверждение публикации бункай модератором', approveRes.status === 200 && approveRes.data?.data?.Status === 'approved', `Status: ${approveRes.data?.data?.Status}`);

    // Модератор: Отклонение публикации бункай
    const rejectRes = await request(`/api/bunkai/${createdBunkai.Bunkai_ID}/reject`, {
      method: 'POST',
      token: moderator.token,
    });
    logResult('MODERATOR: BUNKAI', 'Отклонение публикации бункай модератором', rejectRes.status === 200 && rejectRes.data?.data?.Status === 'rejected', `Status: ${rejectRes.data?.data?.Status}`);

    // Удаление бункая
    await request(`/api/bunkai/${createdBunkai.Bunkai_ID}`, { method: 'DELETE', token: moderator.token });
  }

  // 6. ДИАГРАММА МОДЕРАТОРА: Модерация комментариев
  console.log('\n--- Проверка прецедентов Модератора: Комментарии ---');
  // Пользователь создает комментарий
  const commentCreateRes = await request('/api/comments', {
    method: 'POST',
    token: user.token,
    body: {
      kataId: 1,
      text: 'Тестовый комментарий пользователя для проверки модерации',
    },
  });
  const testComment = commentCreateRes.data?.data;
  logResult('USER: COMMENT', 'Добавление комментария пользователем', commentCreateRes.status === 201, `Comment_ID: ${testComment?.Comment_ID}`);

  // Модератор: Просмотр комментариев
  const commentsListRes = await request('/api/comments', { token: moderator.token, query: { kataId: 1 } });
  const commentFound = (commentsListRes.data?.data || []).some((c) => c.Comment_ID === testComment?.Comment_ID);
  logResult('MODERATOR: COMMENT', 'Просмотр комментариев модератором', commentsListRes.status === 200 && commentFound, `Found: ${commentFound}`);

  // Модератор: Удаление чужого комментария (Модерация комментариев)
  if (testComment) {
    const modDelCommentRes = await request(`/api/comments/${testComment.Comment_ID}`, {
      method: 'DELETE',
      token: moderator.token,
    });
    logResult('MODERATOR: COMMENT', 'Удаление чужого комментария модератором', modDelCommentRes.status === 200, `Status: ${modDelCommentRes.status}, Body: ${JSON.stringify(modDelCommentRes.data)}`);
  }

  // 7. ПОИСК И ФИЛЬТРАЦИЯ КАТА И БУНКАЙ
  console.log('\n--- Проверка поиска и фильтрации ---');
  // Поиск ката
  const searchKataRes = await request('/api/kata', { token: user.token, query: { search: 'Хэйан' } });
  logResult('KATA: SEARCH', 'Поиск ката по названию "Хэйан"', searchKataRes.status === 200 && searchKataRes.data?.data?.length > 0, `Count: ${searchKataRes.data?.data?.length}`);

  // Фильтрация ката по сложности
  const filterKataDiff = await request('/api/kata', { token: user.token, query: { difficulty: 'beginner' } });
  const allBeginner = filterKataDiff.data?.data?.every((k) => k.Difficulty === 'beginner');
  logResult('KATA: FILTER', 'Фильтрация ката по сложности beginner', filterKataDiff.status === 200 && allBeginner, `Count: ${filterKataDiff.data?.data?.length}`);

  // Поиск бункай
  const searchBunkaiRes = await request('/api/bunkai', { token: user.token, query: { search: 'Хэйан' } });
  logResult('BUNKAI: SEARCH', 'Поиск бункай по названию "Хэйан"', searchBunkaiRes.status === 200, `Count: ${searchBunkaiRes.data?.data?.length}`);

  // 8. ПРОВЕРКА НАЛИЧИЯ ССЫЛОК НА ВИДЕО В КАТА И БУНКАЙ
  console.log('\n--- Проверка ссылок на видео ---');
  const allKatas = await request('/api/kata', { token: user.token, query: { pageSize: 50 } });
  const katasWithVideo = (allKatas.data?.data || []).filter((k) => k.Video_URL);
  logResult('VIDEO: KATA', 'Ката со ссылками на видео', katasWithVideo.length === 26, `${katasWithVideo.length} из 26 ката содержат видео`);

  const allBunkai = await request('/api/bunkai', { token: user.token, query: { pageSize: 50 } });
  const bunkaiWithVideo = (allBunkai.data?.data || []).filter((b) => b.Video_URL);
  logResult('VIDEO: BUNKAI', 'Бункай со ссылками на видео', bunkaiWithVideo.length >= 26, `${bunkaiWithVideo.length} бункай содержат видео`);

  console.log('\n====================================================');
  console.log('                 ИТОГИ ТЕСТА                        ');
  console.log('====================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`ВСЕГО ТЕСТОВ: ${results.length} | УСПЕШНО: ${passedCount} | ОШИБОК: ${failedCount}\n`);
}

runTests().catch(console.error);
