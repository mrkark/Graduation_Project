require('dotenv').config();
const { poolPromise, sql } = require('../src/config/database');

const HEIAN_SHODAN_BUNKAI_18_STEPS = [
  {
    stepNumber: 1,
    title: 'Шаг 1: Исходное положение — Хэйко-дати',
    description: '1 (Тори): Хэйко дати. 2 (Укэ): Хэйко дати. Участники стоят в параллельной стойке готовности на дистанции То-ма (2.40м), сохраняя концентрацию внимания (дзансин).',
    duration: 2.0,
    participantCount: 2,
    targetDistance: 2.40,
    targetAngle: 0.0,
    participants: [
      { role: 'tori', clipName: 'heiko_dachi', initialStance: 'heiko_dachi', offsetX: 0.0, offsetZ: -1.20, rotationY: 0.0, delaySeconds: 0.0 },
      { role: 'uke1', clipName: 'heiko_dachi', initialStance: 'heiko_dachi', offsetX: 0.0, offsetZ: 1.20, rotationY: 180.0, delaySeconds: 0.0 },
    ],
  },
  {
    stepNumber: 2,
    title: 'Шаг 2: Ритуальный поклон — Мусуби-дати (Рэй)',
    description: '1 (Тори): Мусуби дати + поклон. 2 (Укэ): Мусуби дати + поклон. Соединение пяток под углом 45°, традиционный поклон уважения перед началом боевого взаимодействия.',
    duration: 2.2,
    participantCount: 2,
    targetDistance: 2.40,
    targetAngle: 0.0,
    participants: [
      { role: 'tori', clipName: 'stance_musubi', initialStance: 'stance_musubi', offsetX: 0.0, offsetZ: -1.20, rotationY: 0.0, delaySeconds: 0.0 },
      { role: 'uke1', clipName: 'stance_musubi', initialStance: 'stance_musubi', offsetX: 0.0, offsetZ: 1.20, rotationY: 180.0, delaySeconds: 0.0 },
    ],
  },
  {
    stepNumber: 3,
    title: 'Шаг 3: Возврат в стойку готовности — Хэйко-дати',
    description: '1 (Тори): Хэйко дати. 2 (Укэ): Хэйко дати. Возврат в параллельную стойку ожидания, готовность к переходу в боевые стойки.',
    duration: 1.8,
    participantCount: 2,
    targetDistance: 2.40,
    targetAngle: 0.0,
    participants: [
      { role: 'tori', clipName: 'heiko_dachi', initialStance: 'heiko_dachi', offsetX: 0.0, offsetZ: -1.20, rotationY: 0.0, delaySeconds: 0.0 },
      { role: 'uke1', clipName: 'heiko_dachi', initialStance: 'heiko_dachi', offsetX: 0.0, offsetZ: 1.20, rotationY: 180.0, delaySeconds: 0.0 },
    ],
  },
  {
    stepNumber: 4,
    title: 'Шаг 4: Принятие боевых стоек — Дзэнкуцу-дати',
    description: '1 (Тори): Шаг левой ногой вперед в Хидари дзэнкуцу дати. 2 (Укэ): Шаг правой ногой назад в Миги дзэнкуцу дати. Сокращение дистанции до боевой (2.05м).',
    duration: 2.2,
    participantCount: 2,
    targetDistance: 2.05,
    targetAngle: 0.0,
    participants: [
      { role: 'tori', clipName: 'turn_into_zenkutsu_left', initialStance: 'zenkutsu_dachi_left', offsetX: 0.0, offsetZ: -0.75, rotationY: 0.0, delaySeconds: 0.0 },
      { role: 'uke1', clipName: 'step_backward_right', initialStance: 'zenkutsu_dachi_right', offsetX: 0.0, offsetZ: 1.30, rotationY: 180.0, delaySeconds: 0.0 },
    ],
  },
  {
    stepNumber: 5,
    title: 'Шаг 5: Атака Маэ-гэри — уход под 35°, Гэдан-барай и Гяку-дзуки',
    description: '1 (Тори): Маэ-гэри с шагом вперед и приходом в дзэнкуцу дати. 2 (Укэ): Шаг назад под углом 30-45° дзэнкуцу дати гэдан-барай гяку-дзуки (юри-аши челнок).',
    duration: 2.6,
    participantCount: 2,
    targetDistance: 1.32,
    targetAngle: -35.0,
    participants: [
      { role: 'tori', clipName: 'kick_mae_geri_right', initialStance: 'zenkutsu_dachi_left', offsetX: 0.0, offsetZ: -0.20, rotationY: 0.0, delaySeconds: 0.0 },
      { role: 'uke1', clipName: 'tech_gedan_barai_left', initialStance: 'zenkutsu_dachi_right', offsetX: -0.25, offsetZ: 1.10, rotationY: 145.0, delaySeconds: 0.12 },
    ],
  },
  {
    stepNumber: 6,
    title: 'Шаг 6: Маэ-гэри + Гяку-дзуки — возврат на ось, Хайван-укэ, Тэтцуи и Гяку-дзуки',
    description: '1 (Тори): Маэ-гэри гяку-дзуки приход в дзэнкуцу дати под углом 10-15°. 2 (Укэ): Шаг назад (возвращение на осевую линию) дзэнкуцу дати гэдан-барай, Фудо дати хайван укэ, Дзэнкуцу дати тэтцуи (рука-молот) гяку-дзуки.',
    duration: 2.8,
    participantCount: 2,
    targetDistance: 1.25,
    targetAngle: 12.0,
    participants: [
      { role: 'tori', clipName: 'mae_geri_gyaku_zuki', initialStance: 'zenkutsu_dachi_left', offsetX: 0.15, offsetZ: 0.25, rotationY: 12.0, delaySeconds: 0.0 },
      { role: 'uke1', clipName: 'tech_tettsui_right', initialStance: 'fudo_dachi', offsetX: 0.0, offsetZ: 1.50, rotationY: 192.0, delaySeconds: 0.10 },
    ],
  },
  {
    stepNumber: 7,
    title: 'Шаг 7: Выпад Ой-дзуки — Агэ-укэ и болевой приём на руку (Кансэцу-вадза)',
    description: '1 (Тори): Шаг назад дзэнкуцу дати + шаг вперёд Маэ-гэри ой-дзуки. 2 (Укэ): Шаг назад дзэнкуцу дати гэдан-барай агэ-укэ гяку агэ-укэ с выпадом вперёд. Выполняется жесткий болевой приём на локтевой сустав/плечо (Кансэцу-вадза) при плотном сближении.',
    duration: 3.0,
    participantCount: 2,
    targetDistance: 0.88,
    targetAngle: 0.0,
    participants: [
      { role: 'tori', clipName: 'tech_oi_zuki_right', initialStance: 'zenkutsu_dachi_right', offsetX: 0.0, offsetZ: 0.50, rotationY: 0.0, delaySeconds: 0.15 },
      { role: 'uke1', clipName: 'tech_age_uke_right', initialStance: 'zenkutsu_dachi_right', offsetX: 0.0, offsetZ: 1.38, rotationY: 180.0, delaySeconds: 0.05 },
    ],
  },
  {
    stepNumber: 8,
    title: 'Шаг 8: Разворот Тори — смещение Укэ под углом 35-45° (Тай-сабаки)',
    description: '1 (Тори): Шаг левой ногой с разворотом в обратную сторону в миги дзэнкуцу дати (высвобождение из захвата). 2 (Укэ): Шаг вперёд в сторону миги дзэнкуцу дати угол 30-45° с последующим разворотом в хидари дзэнкуцу дати.',
    duration: 2.5,
    participantCount: 2,
    targetDistance: 1.60,
    targetAngle: 40.0,
    participants: [
      { role: 'tori', clipName: 'turn_with_step_left', initialStance: 'zenkutsu_dachi_right', offsetX: -0.30, offsetZ: 0.20, rotationY: 180.0, delaySeconds: 0.0 },
      { role: 'uke1', clipName: 'turn_into_zenkutsu_left', initialStance: 'zenkutsu_dachi_left', offsetX: 0.35, offsetZ: 1.65, rotationY: 220.0, delaySeconds: 0.05 },
    ],
  },
  {
    stepNumber: 9,
    title: 'Шаг 9: Атака Маэ-гэри — Хайван-укэ, поворот через Хэйсоку-дати и Гяку-дзуки',
    description: '1 (Тори): Маэ-гэри. 2 (Укэ): Хидари хайван укэ, полшага назад хейсоку дати (спиной к 1), разворот в миги дзэнкуцу дати гэдан-барай гяку-дзуки.',
    duration: 2.8,
    participantCount: 2,
    targetDistance: 1.35,
    targetAngle: -10.0,
    participants: [
      { role: 'tori', clipName: 'kick_mae_geri_right', initialStance: 'zenkutsu_dachi_right', offsetX: 0.0, offsetZ: 0.45, rotationY: 0.0, delaySeconds: 0.0 },
      { role: 'uke1', clipName: 'tech_gedan_barai_right', initialStance: 'stance_heisoku', offsetX: 0.10, offsetZ: 1.80, rotationY: 170.0, delaySeconds: 0.10 },
    ],
  },
  {
    stepNumber: 10,
    title: 'Шаг 10: Отступление Тори — сдвоенный контрудар Гяку-дзуки',
    description: '1 (Тори): Шаг назад в миги дзэнкуцу дати. 2 (Укэ): Гяку-дзуки/гяку-дзуки (сдвоенный удар Рэн-дзуки) с шагом вперед в хидари дзэнкуцу дати.',
    duration: 2.4,
    participantCount: 2,
    targetDistance: 1.25,
    targetAngle: 0.0,
    participants: [
      { role: 'tori', clipName: 'step_backward_right', initialStance: 'zenkutsu_dachi_right', offsetX: 0.0, offsetZ: 0.0, rotationY: 0.0, delaySeconds: 0.0 },
      { role: 'uke1', clipName: 'ren_zuki', initialStance: 'zenkutsu_dachi_left', offsetX: 0.0, offsetZ: 1.25, rotationY: 180.0, delaySeconds: 0.08 },
    ],
  },
  {
    stepNumber: 11,
    title: 'Шаг 11: Джеб Кидзами-дзуки — защита Нагаси-укэ и Сюто-укэ в Кокуцу-дати',
    description: '1 (Тори): Кидзами-дзуки с выпадом вперёд. 2 (Укэ): Перестроение в миги кокуцу дати с выполнением нагаши укэ + сюто-укэ.',
    duration: 2.4,
    participantCount: 2,
    targetDistance: 1.30,
    targetAngle: 0.0,
    participants: [
      { role: 'tori', clipName: 'jodan_zuki_left', initialStance: 'zenkutsu_dachi_left', offsetX: 0.0, offsetZ: 0.40, rotationY: 0.0, delaySeconds: 0.0 },
      { role: 'uke1', clipName: 'tech_shuto_uke_left', initialStance: 'kokutsu_dachi_right', offsetX: 0.0, offsetZ: 1.70, rotationY: 180.0, delaySeconds: 0.06 },
    ],
  },
  {
    stepNumber: 12,
    title: 'Шаг 12: Решающий удар ребром ладони в область горла — Сюто-учи',
    description: '1 (Тори): Оглушен и раскрыт после защиты. 2 (Укэ): Шаг вперёд в кокуцу дати дзёдан сюто-учи. Направленный удар ребром ладони в область шеи/горла.',
    duration: 2.2,
    participantCount: 2,
    targetDistance: 1.10,
    targetAngle: 0.0,
    participants: [
      { role: 'tori', clipName: 'kokutsu_dachi_left', initialStance: 'kokutsu_dachi_left', offsetX: 0.0, offsetZ: 0.40, rotationY: 0.0, delaySeconds: 0.0 },
      { role: 'uke1', clipName: 'tech_shuto_uchi_right', initialStance: 'kokutsu_dachi_right', offsetX: 0.0, offsetZ: 1.50, rotationY: 180.0, delaySeconds: 0.05 },
    ],
  },
  {
    stepNumber: 13,
    title: 'Шаг 13: Подсечка Аши-барай, падение со страховкой и добивание в Сико-дати',
    description: '1 (Тори): Падает со страховкой левой рукой на татами (укэми), правая нога лежит поверх левой скрестно. 2 (Укэ): Захват за рукав, подсечка аши-барай, постановка ноги в стойку шико дати + добивающий удар отоши-дзуки (2 левой рукой держит и выпрямляет правую руку 1).',
    duration: 3.5,
    participantCount: 2,
    targetDistance: 0.75,
    targetAngle: 0.0,
    participants: [
      { role: 'tori', clipName: 'idle_shizentai', initialStance: 'fallen_ukemi', offsetX: 0.0, offsetZ: 0.50, rotationY: 0.0, delaySeconds: 0.15 },
      { role: 'uke1', clipName: 'stance_shiko', initialStance: 'stance_shiko', offsetX: 0.0, offsetZ: 1.25, rotationY: 180.0, delaySeconds: 0.0 },
    ],
  },
  {
    stepNumber: 14,
    title: 'Шаг 14: Разрыв захвата и отход в Дзэнкуцу-дати — Дзансин',
    description: '1 (Тори): Лежит на татами после падения в позиции контроля. 2 (Укэ): Делает шаг правой ногой назад и становится в стойку хидари дзэнкуцу дати, сохраняя боевую бдительность над противником.',
    duration: 2.2,
    participantCount: 2,
    targetDistance: 1.60,
    targetAngle: 0.0,
    participants: [
      { role: 'tori', clipName: 'idle_shizentai', initialStance: 'fallen_ukemi', offsetX: 0.0, offsetZ: 0.50, rotationY: 0.0, delaySeconds: 0.0 },
      { role: 'uke1', clipName: 'zenkutsu_dachi_left', initialStance: 'zenkutsu_dachi_left', offsetX: 0.0, offsetZ: 2.10, rotationY: 180.0, delaySeconds: 0.0 },
    ],
  },
  {
    stepNumber: 15,
    title: 'Шаг 15: Подъем Тори с татами в Миги дзэнкуцу-дати',
    description: '1 (Тори): Через паузу встаёт с татами в стойку миги дзэнкуцу дати. 2 (Укэ): Удерживает позицию Хидари дзэнкуцу дати, контролируя движения Тори.',
    duration: 2.6,
    participantCount: 2,
    targetDistance: 1.95,
    targetAngle: 0.0,
    participants: [
      { role: 'tori', clipName: 'zenkutsu_dachi_right', initialStance: 'zenkutsu_dachi_right', offsetX: 0.0, offsetZ: 0.30, rotationY: 0.0, delaySeconds: 0.20 },
      { role: 'uke1', clipName: 'zenkutsu_dachi_left', initialStance: 'zenkutsu_dachi_left', offsetX: 0.0, offsetZ: 2.25, rotationY: 180.0, delaySeconds: 0.0 },
    ],
  },
  {
    stepNumber: 16,
    title: 'Шаг 16: Синхронный шаг назад в Хэйко-дати',
    description: '1 (Тори): Шагом назад становится в хэйко дати. 2 (Укэ): Шагом назад становится в хэйко дати. Синхронный разрыв дистанции до безопасной (2.40м).',
    duration: 2.0,
    participantCount: 2,
    targetDistance: 2.40,
    targetAngle: 0.0,
    participants: [
      { role: 'tori', clipName: 'heiko_dachi', initialStance: 'heiko_dachi', offsetX: 0.0, offsetZ: -0.10, rotationY: 0.0, delaySeconds: 0.0 },
      { role: 'uke1', clipName: 'heiko_dachi', initialStance: 'heiko_dachi', offsetX: 0.0, offsetZ: 2.30, rotationY: 180.0, delaySeconds: 0.0 },
    ],
  },
  {
    stepNumber: 17,
    title: 'Шаг 17: Заключительный поклон — Мусуби-дати (Рэй)',
    description: '1 (Тори): Мусуби дати поклон. 2 (Укэ): Мусуби дати поклон. Традиционный поклон уважения и благодарности за совместную практику бункая.',
    duration: 2.2,
    participantCount: 2,
    targetDistance: 2.40,
    targetAngle: 0.0,
    participants: [
      { role: 'tori', clipName: 'stance_musubi', initialStance: 'stance_musubi', offsetX: 0.0, offsetZ: -0.10, rotationY: 0.0, delaySeconds: 0.0 },
      { role: 'uke1', clipName: 'stance_musubi', initialStance: 'stance_musubi', offsetX: 0.0, offsetZ: 2.30, rotationY: 180.0, delaySeconds: 0.0 },
    ],
  },
  {
    stepNumber: 18,
    title: 'Шаг 18: Завершение комплекса — Хэйко-дати (Сидзэнтай)',
    description: '1 (Тори): Хэйко дати. 2 (Укэ): Хэйко дати. Возврат в естественную стойку готовности Сидзэнтай. Комплекс Бункай Хэйан Шодан завершен.',
    duration: 2.0,
    participantCount: 2,
    targetDistance: 2.40,
    targetAngle: 0.0,
    participants: [
      { role: 'tori', clipName: 'heiko_dachi', initialStance: 'heiko_dachi', offsetX: 0.0, offsetZ: -0.10, rotationY: 0.0, delaySeconds: 0.0 },
      { role: 'uke1', clipName: 'heiko_dachi', initialStance: 'heiko_dachi', offsetX: 0.0, offsetZ: 2.30, rotationY: 180.0, delaySeconds: 0.0 },
    ],
  },
];

async function seedBunkaiHeianShodan() {
  try {
    const pool = await poolPromise;
    console.log('Подключение к БД успешно.');

    // 1. Находим Ката Хэйан Шодан
    const kataRes = await pool.request().query(`
      SELECT Kata_ID, Title FROM dbo.Kata
      WHERE Title LIKE N'%Хэйан Шодан%' OR Title LIKE N'%Хейан Шодан%' OR Title LIKE N'%Heian Shodan%'
    `);

    if (!kataRes.recordset || kataRes.recordset.length === 0) {
      console.warn('Ката Хэйан Шодан не найдено в БД, пропускаем сид БД.');
      return;
    }

    const kataId = kataRes.recordset[0].Kata_ID;
    console.log(`Найдено ката: #${kataId} ${kataRes.recordset[0].Title}`);

    // 2. Находим или создаем Бункай для Хэйан Шодан
    let bunkaiRes = await pool.request().input('kId', kataId).query(`
      SELECT Bunkai_ID FROM dbo.Bunkai WHERE Kata_ID = @kId
    `);

    let bunkaiId;
    if (bunkaiRes.recordset && bunkaiRes.recordset.length > 0) {
      bunkaiId = bunkaiRes.recordset[0].Bunkai_ID;
      await pool.request().input('bId', bunkaiId).query(`
        UPDATE dbo.Bunkai
        SET Title = N'Канонический Бункай: Хэйан Шодан (18 шагов)',
            Description = N'Официальный пошаговый бункай ката Хэйан Шодан: 1 — Тори (атакующий), 2 — Укэ (защищающийся). Разбор боевого взаимодействия на реальной боевой дистанции с непрерывными переходами и контролем анти-проникновения.',
            Status = N'approved'
        WHERE Bunkai_ID = @bId
      `);
      console.log(`Обновлена запись Bunkai #${bunkaiId}`);
    } else {
      const insRes = await pool.request().input('kId', kataId).query(`
        INSERT INTO dbo.Bunkai (Author_ID, Kata_ID, Title, Description, Application, Difficulty, Status)
        VALUES (1, @kId, N'Канонический Бункай: Хэйан Шодан (18 шагов)',
          N'Официальный пошаговый бункай ката Хэйан Шодан: 1 — Тори (атакующий), 2 — Укэ (защищающийся).',
          N'Парное боевое применение ключевых связок ката Хэйан Шодан на реальной дистанции.',
          N'beginner', N'approved');
        SELECT SCOPE_IDENTITY() AS NewId;
      `);
      bunkaiId = insRes.recordset[0].NewId;
      console.log(`Создана запись Bunkai #${bunkaiId}`);
    }

    // 3. Получаем список Clip_ID по названиям
    const clipsMap = new Map();
    const allClipsRes = await pool.request().query('SELECT Clip_ID, Clip_Name FROM dbo.AnimationClips');
    allClipsRes.recordset.forEach((c) => clipsMap.set(c.Clip_Name, c.Clip_ID));

    // 4. Очищаем старые шаги для этого бункая
    await pool.request().input('bId', bunkaiId).query(`
      DELETE FROM dbo.BunkaiStepParticipants
      WHERE Step_ID IN (SELECT Step_ID FROM dbo.BunkaiSteps WHERE Bunkai_ID = @bId);
      DELETE FROM dbo.BunkaiSteps WHERE Bunkai_ID = @bId;
    `);

    // 5. Вставляем все 18 шагов и участников
    for (const step of HEIAN_SHODAN_BUNKAI_18_STEPS) {
      const sIns = await pool.request()
        .input('bId', bunkaiId)
        .input('num', step.stepNumber)
        .input('title', step.title)
        .input('desc', step.description)
        .input('dur', step.duration)
        .input('pCount', step.participantCount)
        .input('dist', step.targetDistance)
        .input('angle', step.targetAngle)
        .query(`
          INSERT INTO dbo.BunkaiSteps (Bunkai_ID, Step_Number, Title, Description, Duration, Participant_Count, Target_Distance, Target_Angle)
          VALUES (@bId, @num, @title, @desc, @dur, @pCount, @dist, @angle);
          SELECT SCOPE_IDENTITY() AS Id;
        `);
      const stepId = sIns.recordset[0].Id;

      for (const p of step.participants) {
        const cId = clipsMap.get(p.clipName) || null;
        await pool.request()
          .input('sId', stepId)
          .input('role', p.role)
          .input('cId', cId)
          .input('st', p.initialStance)
          .input('ox', p.offsetX)
          .input('oz', p.offsetZ)
          .input('ry', p.rotationY)
          .input('delay', p.delaySeconds)
          .query(`
            INSERT INTO dbo.BunkaiStepParticipants (Step_ID, Role, Clip_ID, Initial_Stance, Offset_X, Offset_Z, Rotation_Y, Delay_Seconds)
            VALUES (@sId, @role, @cId, @st, @ox, @oz, @ry, @delay);
          `);
      }
    }

    console.log(`✔ Успешно сохранены все 18 шагов бункая для Хэйан Шодан!`);
  } catch (err) {
    console.warn('База данных недоступна или произошла ошибка:', err.message);
  }
}

seedBunkaiHeianShodan().then(() => process.exit(0));
