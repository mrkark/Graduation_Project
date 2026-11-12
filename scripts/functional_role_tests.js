/**
 * Функциональные тесты Bunkai Explorer по ролям.
 *
 * Приложение поднимается через Docker Compose (см. bunkai-explorer/docker-compose.yml):
 *   API  — http://localhost:5000   (контейнер bunkai-explorer-server)
 *   UI   — http://localhost:5173   (контейнер bunkai-explorer-client)
 *
 * Роли в базе: guest (неавторизованный запрос), user, moderator, admin.
 * Учётные записи из seed: demo_user / moderator / admin.
 *
 * Запуск из каталога bunkai-explorer:
 *   npm run test:functional
 *
 * Переменные окружения:
 *   API_URL     — базовый URL API (по умолчанию http://localhost:5000)
 *   CLIENT_URL  — базовый URL клиента (по умолчанию http://localhost:5173)
 *   ADMIN_PASSWORD, MODERATOR_PASSWORD, DEMO_PASSWORD — если seed переопределён
 */

const API_URL = (process.env.API_URL || 'http://localhost:5000').replace(/\/$/, '');
const CLIENT_URL = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');

const ACCOUNTS = {
  admin: { username: 'admin', password: process.env.ADMIN_PASSWORD || 'Admin#12345' },
  moderator: { username: 'moderator', password: process.env.MODERATOR_PASSWORD || 'Moderator#12345' },
  user: { username: 'demo_user', password: process.env.DEMO_PASSWORD || 'Demo#12345' },
};

const results = [];

function logResult(role, name, passed, details = '') {
  results.push({ role, name, passed, details });
  const mark = passed ? 'PASS' : 'FAIL';
  const extra = details ? ` -> ${details}` : '';
  console.log(`[${mark}] [${role}] ${name}${extra}`);
}

async function request(path, options = {}) {
  const url = new URL(path, API_URL);
  if (options.query) {
    Object.entries(options.query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    });
  }

  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  let body;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body,
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: response.status, data };
}

async function login(account) {
  const res = await request('/api/auth/login', {
    method: 'POST',
    body: { username: account.username, password: account.password },
  });
  if (res.status !== 200 || !res.data?.success || !res.data?.data?.accessToken) {
    throw new Error(`status ${res.status}: ${JSON.stringify(res.data)}`);
  }
  return {
    token: res.data.data.accessToken,
    user: res.data.data.user,
    role: res.data.data.role || res.data.data.user?.role,
  };
}

function expectStatus(role, name, res, expected) {
  const ok = res.status === expected;
  const hint = ok ? '' : `status ${res.status}, body ${JSON.stringify(res.data)?.slice(0, 240)}`;
  logResult(role, name, ok, hint);
  return ok;
}

async function run() {
  console.log('Bunkai Explorer — функциональные тесты по ролям');
  console.log(`API (Docker):    ${API_URL}`);
  console.log(`Client (Docker): ${CLIENT_URL}`);
  console.log('');

  let health;
  try {
    health = await request('/api/health');
  } catch (err) {
    console.error(`API недоступен (${API_URL}). Поднимите стек: docker compose up -d`);
    console.error(err.message);
    process.exit(1);
  }
  expectStatus('infra', 'Docker API /api/health', health, 200);

  try {
    const ui = await fetch(CLIENT_URL);
    logResult('infra', 'Docker client отвечает', ui.status === 200, `status ${ui.status}`);
  } catch (err) {
    logResult('infra', 'Docker client отвечает', false, err.message);
  }

  const sessions = {};

  // --- guest: нет токена, роль неавторизованного посетителя ---
  console.log('\n--- guest ---');
  expectStatus('guest', 'Каталог ката закрыт', await request('/api/kata'), 401);
  expectStatus('guest', 'Каталог бункай закрыт', await request('/api/bunkai'), 401);
  expectStatus('guest', 'Профиль /api/auth/me закрыт', await request('/api/auth/me'), 401);
  expectStatus('guest', 'Список пользователей закрыт', await request('/api/users'), 401);
  expectStatus('guest', 'Журнал аудита закрыт', await request('/api/admin/logs'), 401);
  expectStatus('guest', 'Статистика модерации закрыта', await request('/api/admin/stats'), 401);
  expectStatus('guest', 'Чат закрыт', await request('/api/chat/rooms'), 401);
  expectStatus('guest', 'Избранное закрыто', await request('/api/favorites'), 401);
  const badLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { username: 'guest', password: 'wrong-password' },
  });
  logResult('guest', 'Чужой пароль не пускает в систему', badLogin.status === 400 || badLogin.status === 401, `status ${badLogin.status}`);

  // --- user ---
  console.log('\n--- user ---');
  try {
    sessions.user = await login(ACCOUNTS.user);
    logResult('user', 'Вход demo_user', sessions.user.role === 'user', `role ${sessions.user.role}`);
  } catch (err) {
    logResult('user', 'Вход demo_user', false, err.message);
  }

  if (sessions.user) {
    const token = sessions.user.token;
    const me = await request('/api/auth/me', { token });
    const meRole = me.data?.data?.role || me.data?.data?.Role_Name || me.data?.data?.user?.role;
    logResult('user', 'Профиль возвращает роль user', me.status === 200 && (meRole === 'user' || sessions.user.role === 'user'), `status ${me.status}, role ${meRole || sessions.user.role}`);

    const kataList = await request('/api/kata', { token, query: { page: 1, pageSize: 50 } });
    const kataItems = Array.isArray(kataList.data?.data) ? kataList.data.data : [];
    expectStatus('user', 'Просмотр каталога ката', kataList, 200);
    logResult('user', 'В каталоге есть формы', kataItems.length > 0, `count ${kataItems.length}`);

    const kataId = kataItems[0]?.Kata_ID || kataItems[0]?.kataId;
    if (kataId) {
      expectStatus('user', 'Открытие карточки ката', await request(`/api/kata/${kataId}`, { token }), 200);
      const comments = await request('/api/comments', { token, query: { kataId } });
      expectStatus('user', 'Чтение комментариев ката', comments, 200);

      const marker = `functional-role-test ${Date.now()}`;
      const createdComment = await request('/api/comments', {
        method: 'POST',
        token,
        body: { text: marker, kataId },
      });
      const commentId = createdComment.data?.data?.Comment_ID || createdComment.data?.data?.commentId;
      expectStatus('user', 'Создание комментария к ката', createdComment, 201);

      const favOn = await request('/api/favorites/toggle', {
        method: 'POST',
        token,
        body: { itemType: 'kata', itemId: kataId },
      });
      logResult('user', 'Переключение избранного ката', favOn.status === 200, `status ${favOn.status}`);
      const favOff = await request('/api/favorites/toggle', {
        method: 'POST',
        token,
        body: { itemType: 'kata', itemId: kataId },
      });
      logResult('user', 'Возврат избранного в исходное состояние', favOff.status === 200, `status ${favOff.status}`);

      const bunkaiTitle = `Functional test bunkai ${Date.now()}`;
      const createdBunkai = await request('/api/bunkai', {
        method: 'POST',
        token,
        body: {
          kataId,
          title: bunkaiTitle,
          description: 'Автотест роли user: создание и удаление собственного бункая.',
          difficulty: 'beginner',
        },
      });
      const bunkaiId = createdBunkai.data?.data?.Bunkai_ID || createdBunkai.data?.data?.bunkaiId;
      expectStatus('user', 'Создание собственного бункая', createdBunkai, 201);
      if (bunkaiId) {
        expectStatus('user', 'Чтение собственного бункая', await request(`/api/bunkai/${bunkaiId}`, { token }), 200);
        expectStatus('user', 'Удаление собственного бункая', await request(`/api/bunkai/${bunkaiId}`, { method: 'DELETE', token }), 200);
      }

      sessions._comment = commentId ? { commentId, kataId, marker } : null;
    }

    expectStatus('user', 'Список бункай', await request('/api/bunkai', { token, query: { page: 1, pageSize: 20 } }), 200);
    expectStatus('user', 'Список избранного', await request('/api/favorites', { token }), 200);
    expectStatus('user', 'Уведомления', await request('/api/notifications', { token }), 200);
    expectStatus('user', 'Комнаты чата', await request('/api/chat/rooms', { token }), 200);
    expectStatus('user', 'Список друзей', await request('/api/friends', { token }), 200);
    expectStatus('user', 'Свои додзё', await request('/api/dojos', { token }), 200);
    expectStatus('user', 'Нет доступа к списку пользователей', await request('/api/users', { token }), 403);
    expectStatus('user', 'Нет доступа к журналу аудита', await request('/api/admin/logs', { token }), 403);
    expectStatus('user', 'Нет доступа к резервным копиям', await request('/api/admin/backups', { token }), 403);
    expectStatus('user', 'Нет доступа к статистике модерации', await request('/api/admin/stats', { token }), 403);
    expectStatus('user', 'Нельзя создать ката', await request('/api/kata', {
      method: 'POST',
      token,
      body: { title: 'forbidden', style: 'Шотокан', difficulty: 'beginner' },
    }), 403);
  }

  // --- moderator ---
  console.log('\n--- moderator ---');
  try {
    sessions.moderator = await login(ACCOUNTS.moderator);
    logResult('moderator', 'Вход moderator', sessions.moderator.role === 'moderator', `role ${sessions.moderator.role}`);
  } catch (err) {
    logResult('moderator', 'Вход moderator', false, err.message);
  }

  if (sessions.moderator) {
    const token = sessions.moderator.token;
    expectStatus('moderator', 'Просмотр каталога ката', await request('/api/kata', { token, query: { pageSize: 5 } }), 200);
    expectStatus('moderator', 'Просмотр каталога бункай', await request('/api/bunkai', { token, query: { pageSize: 5 } }), 200);
    expectStatus('moderator', 'Статистика модерации', await request('/api/admin/stats', { token }), 200);
    expectStatus('moderator', 'Очередь комментариев', await request('/api/admin/comments', { token }), 200);

    if (sessions._comment?.commentId) {
      const removed = await request(`/api/comments/${sessions._comment.commentId}`, { method: 'DELETE', token });
      expectStatus('moderator', 'Удаление чужого комментария', removed, 200);
      sessions._comment.removed = removed.status === 200;
    } else {
      logResult('moderator', 'Удаление чужого комментария', false, 'комментарий пользователя не был создан');
    }

    expectStatus('moderator', 'Нет доступа к журналу аудита', await request('/api/admin/logs', { token }), 403);
    expectStatus('moderator', 'Нет доступа к резервным копиям', await request('/api/admin/backups', { token }), 403);
    expectStatus('moderator', 'Нет доступа к списку пользователей', await request('/api/users', { token }), 403);
    if (sessions.user?.user?.User_ID) {
      expectStatus('moderator', 'Нельзя менять роли', await request(`/api/users/${sessions.user.user.User_ID}/role`, {
        method: 'PATCH',
        token,
        body: { roleName: 'admin' },
      }), 403);
      expectStatus('moderator', 'Нельзя блокировать пользователей', await request(`/api/users/${sessions.user.user.User_ID}/block`, {
        method: 'POST',
        token,
      }), 403);
    }
    expectStatus('moderator', 'Нельзя утверждать ката', await request('/api/kata/1/approve', { method: 'POST', token }), 403);
  }

  // --- admin ---
  console.log('\n--- admin ---');
  try {
    sessions.admin = await login(ACCOUNTS.admin);
    logResult('admin', 'Вход admin', sessions.admin.role === 'admin', `role ${sessions.admin.role}`);
  } catch (err) {
    logResult('admin', 'Вход admin', false, err.message);
  }

  if (sessions.admin) {
    const token = sessions.admin.token;
    expectStatus('admin', 'Просмотр каталога ката', await request('/api/kata', { token, query: { pageSize: 5 } }), 200);
    expectStatus('admin', 'Просмотр каталога бункай', await request('/api/bunkai', { token, query: { pageSize: 5 } }), 200);
    const users = await request('/api/users', { token });
    expectStatus('admin', 'Список пользователей', users, 200);
    const userRows = Array.isArray(users.data?.data) ? users.data.data : [];
    const roleOf = (row) => row.Role_Name || row.role || row.Role?.Role_Name;
    logResult(
      'admin',
      'В списке есть роли user, moderator и admin',
      ['user', 'moderator', 'admin'].every((role) => userRows.some((row) => roleOf(row) === role)),
      `rows ${userRows.length}`
    );
    expectStatus('admin', 'Журнал аудита', await request('/api/admin/logs', { token }), 200);
    expectStatus('admin', 'Список резервных копий', await request('/api/admin/backups', { token }), 200);
    expectStatus('admin', 'Статистика модерации', await request('/api/admin/stats', { token }), 200);
    expectStatus('admin', 'Карточка ката по идентификатору', await request('/api/kata/1', { token }), 200);

    if (sessions._comment?.commentId && !sessions._comment.removed) {
      await request(`/api/comments/${sessions._comment.commentId}`, { method: 'DELETE', token });
    }
  } else if (sessions.user && sessions._comment?.commentId && !sessions._comment.removed) {
    await request(`/api/comments/${sessions._comment.commentId}`, {
      method: 'DELETE',
      token: sessions.user.token,
    });
  }

  const failed = results.filter((item) => !item.passed);
  console.log('');
  console.log(`Итого: ${results.length - failed.length}/${results.length} пройдено`);
  if (failed.length) {
    console.log('Не пройдены:');
    failed.forEach((item) => console.log(`  - [${item.role}] ${item.name}${item.details ? `: ${item.details}` : ''}`));
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
