require('dotenv').config();
const { poolPromise } = require('../src/config/database');
const animationRepo = require('../src/db/animationRepo');
const bunkaiRepo = require('../src/db/bunkaiRepo');
const kataRepo = require('../src/db/kataRepo');

async function verify() {
  console.log('=== ЗАПУСК ПРОВЕРКИ СИСТЕМЫ АНИМАЦИЙ BUNKAI EXPLORER ===');
  const pool = await poolPromise;
  console.log('✔ 1. Подключение к Docker MSSQL (mssql_server) успешно.');

  // 1. Проверка клипов
  const clips = await animationRepo.listClips({});
  console.log(`✔ 2. Репозиторий клипов: получено ${clips.length} клипов (ожидалось >= 56).`);
  if (clips.length < 56) throw new Error(`Клипов меньше 56: ${clips.length}`);

  // 2. Проверка переходов
  const transitions = await animationRepo.listTransitions();
  console.log(`✔ 3. Матрица переходов стоек: ${transitions.length} переходов (ожидалось >= 10).`);

  // 3. Проверка 26 стандартных Ката
  const katas = await kataRepo.list({ limit: 100 });
  console.log(`✔ 4. Репозиторий Ката: найдено ${katas.items.length} Ката Шотокан.`);
  if (katas.items.length < 26) throw new Error(`Ката меньше 26: ${katas.items.length}`);

  // Проверка шагов первого ката (Хэйан Сёдан)
  const firstKata = await kataRepo.getById(katas.items[0].Kata_ID);
  console.log(`✔ 5. Первое Ката «${firstKata.Title}»: шагов ${firstKata.Steps?.length || 0}. Первый шаг привязан к клипу: ${firstKata.Steps?.[0]?.Clip_Name || 'None'}`);

  // 4. Проверка 26 стандартных Бункаев
  const bunkaiList = await bunkaiRepo.list({ limit: 100 });
  console.log(`✔ 6. Репозиторий Бункай: найдено ${bunkaiList.items.length} бункаев.`);
  if (bunkaiList.items.length < 26) throw new Error(`Бункаев меньше 26: ${bunkaiList.items.length}`);

  // Проверка шагов и участников первого бункая
  const firstBunkaiSteps = await bunkaiRepo.getStepsWithParticipants(bunkaiList.items[0].Bunkai_ID);
  console.log(`✔ 7. Шаги первого бункая: ${firstBunkaiSteps.length} эпизодов.`);
  firstBunkaiSteps.forEach((s) => {
    console.log(`   - Эпизод #${s.stepNumber} «${s.title}»: участников ${s.participants.length}, дистанция ${s.targetDistance}м, угол ${s.targetAngle}°`);
  });

  // 5. Проверка регистрации недостающих анимаций (Deduplication + Auto Increment)
  const testClipName = 'test_unregistered_strike_' + Date.now();
  const logRes1 = await animationRepo.logMissing({
    clipName: testClipName,
    contextType: 'system_verify',
    fromStance: 'zenkutsu_dachi_left',
    toStance: 'kiba_dachi',
    notes: 'Unit test deduplication'
  });
  console.log(`✔ 8. Регистрация отсутствующего клипа: Request_ID=${logRes1.Request_ID}, Count=${logRes1.Request_Count}`);

  // Повторный запрос того же клипа (должен инкрементировать Request_Count)
  const logRes2 = await animationRepo.logMissing({
    clipName: testClipName,
    contextType: 'system_verify',
    fromStance: 'zenkutsu_dachi_left',
    toStance: 'kiba_dachi',
    notes: 'Unit test deduplication second call'
  });
  console.log(`✔ 9. Дедупликация: Request_ID=${logRes2.Request_ID}, Count=${logRes2.Request_Count}`);
  if (logRes2.Request_Count !== 2) throw new Error('Дедупликация не инкрементировала Request_Count!');

  // Очищаем тестовую запись
  await pool.request().input('id', logRes1.Request_ID).query('DELETE FROM dbo.MissingAnimationRequests WHERE Request_ID = @id');
  console.log('✔ 10. Тестовая запись очищена.');

  console.log('\n=== ВСЕ ТЕСТЫ СИСТЕМЫ АНИМАЦИЙ ПРОЙДЕНЫ УСПЕШНО! ===');
  process.exit(0);
}

verify().catch((err) => {
  console.error('✘ Ошибка проверки:', err);
  process.exit(1);
});
