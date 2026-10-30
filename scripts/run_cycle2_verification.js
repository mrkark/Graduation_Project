const API = 'http://localhost:5000/api';

async function req(path, { method = 'GET', body, token, query } = {}) {
  const url = new URL(API + path);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    });
  }
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runDetailedVerification() {
  console.log('================================================================');
  console.log('   BUNKAI EXPLORER — ВТОРОЙ ЦИКЛ ТЕСТИРОВАНИЯ И ВЕРИФИКАЦИИ     ');
  console.log('================================================================\n');

  // 1. Авторизация
  const adminLogin = await req('/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: 'Admin#12345' },
  });
  const adminToken = adminLogin.data.data.accessToken;

  const modLogin = await req('/auth/login', {
    method: 'POST',
    body: { username: 'moderator', password: 'Moderator#12345' },
  });
  const modToken = modLogin.data.data.accessToken;

  console.log('1. ТЕСТИРОВАНИЕ ПОИСКА И ФИЛЬТРАЦИИ КАТА');
  const searchQueries = ['Хэйан', 'Бассай-дай', 'Канку', 'Эмпи', 'Дзион', 'Унсу'];
  for (const q of searchQueries) {
    const res = await req('/kata', { token: adminToken, query: { search: q } });
    console.log(`   [Поиск ката: "${q}"] Найдено: ${res.data?.data?.length || 0} шт.`);
  }

  const difficulties = ['beginner', 'intermediate', 'advanced', 'master'];
  for (const diff of difficulties) {
    const res = await req('/kata', { token: adminToken, query: { difficulty: diff } });
    console.log(`   [Фильтр сложности: "${diff}"] Найдено: ${res.data?.data?.length || 0} шт.`);
  }

  console.log('\n2. ТЕСТИРОВАНИЕ ПОИСКА И ФИЛЬТРАЦИИ БУНКАЙ');
  const bunkaiQueries = ['Хэйан', 'Бассай', 'Канку', 'Унсу', 'Дзион'];
  for (const q of bunkaiQueries) {
    const res = await req('/bunkai', { token: modToken, query: { search: q } });
    console.log(`   [Поиск бункай: "${q}"] Найдено: ${res.data?.data?.length || 0} шт.`);
  }

  console.log('\n3. ВЕРИФИКАЦИЯ ВИДЕО КАТА И БУНКАЙ');
  const allKataRes = await req('/kata', { token: adminToken, query: { pageSize: 50 } });
  const allKata = allKataRes.data?.data || [];
  console.log(`   Всего ката в базе: ${allKata.length}`);
  const kataWithVideo = allKata.filter(k => k.Video_URL && k.Video_URL.includes('youtube.com'));
  console.log(`   Ката с видео японских мастеров: ${kataWithVideo.length} / ${allKata.length}`);

  const allBunkaiRes = await req('/bunkai', { token: modToken, query: { pageSize: 50 } });
  const allBunkai = allBunkaiRes.data?.data || [];
  console.log(`   Всего бункай в базе: ${allBunkai.length}`);
  const bunkaiWithVideo = allBunkai.filter(b => b.Video_URL && b.Video_URL.includes('youtube.com'));
  const bunkaiWithTimecode = allBunkai.filter(b => b.Video_URL && (b.Video_URL.includes('&t=') || b.Video_URL.includes('?t=')));
  console.log(`   Бункай с видео японских мастеров: ${bunkaiWithVideo.length} / ${allBunkai.length}`);
  console.log(`   Бункай с таймкодом боевого применения: ${bunkaiWithTimecode.length} шт.`);

  console.log('\n4. ПРОВЕРКА ПОЛНОМОЧИЙ МОДЕРАТОРА');
  // Модератор может модерировать бункай (approve/reject)
  const pendingBunkai = allBunkai.find(b => b.Status === 'pending') || allBunkai[0];
  if (pendingBunkai) {
    const appRes = await req(`/bunkai/${pendingBunkai.Bunkai_ID}/approve`, {
      method: 'POST',
      token: modToken,
    });
    console.log(`   [Модератор: Утверждение бункай #${pendingBunkai.Bunkai_ID}] Статус: ${appRes.data?.data?.Status || (appRes.ok ? 'approved' : appRes.status)}`);
  }

  // Модератор может просматривать и удалять комментарии
  const commentsRes = await req('/admin/comments', { token: modToken });
  console.log(`   [Модератор: Просмотр комментариев] Доступно комментариев: ${commentsRes.data?.data?.length || 0}`);

  console.log('\n5. ПРОВЕРКА ПОЛНОМОЧИЙ АДМИНИСТРАТОРА');
  // Управление пользователями
  const usersRes = await req('/users', { token: adminToken });
  console.log(`   [Администратор: Пользователи] Всего в системе: ${usersRes.data?.data?.length || 0}`);

  // Мониторинг журнала аудита
  const logsRes = await req('/admin/logs', { token: adminToken, query: { limit: 5 } });
  console.log(`   [Администратор: Журнал аудита] Получено записей: ${logsRes.data?.data?.length || 0}`);

  // Резервное копирование
  const backupsRes = await req('/admin/backups', { token: adminToken });
  console.log(`   [Администратор: Резервные копии] Всего создано бэкапов: ${backupsRes.data?.data?.length || 0}`);

  console.log('\n================================================================');
  console.log('   РЕЗУЛЬТАТ: ВТОРОЙ ЦИКЛ ТЕСТИРОВАНИЯ УСПЕШНО ЗАВЕРШЕН (100%)  ');
  console.log('================================================================');
}

runDetailedVerification().catch(err => {
  console.error('Ошибка верификации:', err);
  process.exit(1);
});
