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
    title: 'Шаг 7: Выпад Тори Ой-дзуки дзёдан — Восходящий блок Укэ Агэ-укэ',
    description: '1 (Тори): Шаг вперед и мощный выпад кулаком Ой-дзуки дзёдан в голову противника. 2 (Укэ): Шаг вперед навстречу и жесткий восходящий блок Агэ-укэ левой рукой, сбивающий бьющую руку вверх (высота перехвата 1.46м).',
    duration: 2.6,
    participantCount: 2,
    targetDistance: 1.02,
    targetAngle: 0.0,
    participants: [
      { role: 'tori', clipName: 'tech_oi_zuki_right', initialStance: 'zenkutsu_dachi_right', offsetX: 0.0, offsetZ: 0.70, rotationY: 0.0, delaySeconds: 0.0 },
      { role: 'uke1', clipName: 'tech_age_uke_left', initialStance: 'zenkutsu_dachi_left', offsetX: 0.0, offsetZ: 1.72, rotationY: 180.0, delaySeconds: 0.05 },
    ],
  },
  {
    stepNumber: 8,
    title: 'Шаг 8: Болевой приём — Удар второй рукой выше локтя бьющей руки Тори',
    description: '1 (Тори): Правая рука удерживается выпрямленной после выпада. 2 (Укэ): Сохраняя верхний блок Агэ-укэ левой рукой, правой рукой наносит акцентированный сокрушительный удар в плечевую кость выше локтевого сустава Тори (болевой приём / нейтрализация руки без захвата).',
    duration: 2.4,
    participantCount: 2,
    targetDistance: 0.96,
    targetAngle: 0.0,
    participants: [
      { role: 'tori', clipName: 'zenkutsu_dachi_right', initialStance: 'zenkutsu_dachi_right', offsetX: 0.0, offsetZ: 0.70, rotationY: 0.0, delaySeconds: 0.0 },
      { role: 'uke1', clipName: 'strike_above_elbow', initialStance: 'zenkutsu_dachi_left', offsetX: 0.0, offsetZ: 1.66, rotationY: 180.0, delaySeconds: 0.04 },
    ],
  },
  {
    stepNumber: 9,
    title: 'Шаг 9: Разворот Тори на 180° — смещение Укэ под углом 35° во фланг',
    description: '1 (Тори): Шаг левой ногой с разворотом в обратную сторону в Миги дзэнкуцу дати. 2 (Укэ): Шаг вперед-вбок под углом 35° с разворотом в стойку лицом к Тори.',
    duration: 2.6,
    participantCount: 2,
    targetDistance: 1.40,
    targetAngle: 35.0,
    participants: [
      { role: 'tori', clipName: 'turn_into_zenkutsu_right', initialStance: 'zenkutsu_dachi_right', offsetX: 0.0, offsetZ: 0.70, rotationY: 180.0, delaySeconds: 0.0 },
      { role: 'uke1', clipName: 'turn_into_zenkutsu_left', initialStance: 'zenkutsu_dachi_left', offsetX: -0.25, offsetZ: -0.45, rotationY: 180.0, delaySeconds: 0.05 },
    ],
  },
  {
    stepNumber: 10,
    title: 'Шаг 10: Атака Тори Маэ-гэри — отступление Укэ с блоком Хайван-укэ (спиной к Тори)',
    description: '1 (Тори): Прямой удар правой ногой Маэ-гэри вдогонку на вытянутую ногу. 2 (Укэ): Хидари хайван укэ левой рукой, полшага назад в Хэйсоку-дати (спиной к 1).',
    duration: 2.6,
    participantCount: 2,
    targetDistance: 1.14,
    targetAngle: 0.0,
    participants: [
      { role: 'tori', clipName: 'kick_mae_geri_right', initialStance: 'zenkutsu_dachi_right', offsetX: 0.0, offsetZ: 0.70, rotationY: 180.0, delaySeconds: 0.0 },
      { role: 'uke1', clipName: 'tech_gedan_barai_left', initialStance: 'stance_heisoku', offsetX: -0.20, offsetZ: -0.42, rotationY: 180.0, delaySeconds: 0.08 },
    ],
  },
  {
    stepNumber: 11,
    title: 'Шаг 11: Разворот Укэ в Миги дзэнкуцу-дати и контрудар Гяку-дзуки',
    description: '1 (Тори): Сохраняет стойку Дзэнкуцу дати. 2 (Укэ): Резкий разворот лицом к Тори в Миги дзэнкуцу дати и мощный контрудар кулаком Гяку-дзуки правой рукой в корпус на вытянутую руку.',
    duration: 2.6,
    participantCount: 2,
    targetDistance: 0.98,
    targetAngle: 0.0,
    participants: [
      { role: 'tori', clipName: 'zenkutsu_dachi_right', initialStance: 'zenkutsu_dachi_right', offsetX: 0.0, offsetZ: 0.70, rotationY: 180.0, delaySeconds: 0.0 },
      { role: 'uke1', clipName: 'tech_gyaku_zuki_right', initialStance: 'zenkutsu_dachi_right', offsetX: -0.10, offsetZ: -0.27, rotationY: 0.0, delaySeconds: 0.06 },
    ],
  },
  {
    stepNumber: 12,
    title: 'Шаг 12: Кидзами-дзуки с выпадом — защита Сюто-укэ в Миги кокуцу-дати',
    description: '1 (Тори): Встречный резкий джеб Кидзами-дзуки левой рукой с выпадом вперед. 2 (Укэ): Перестроение шагом назад в Миги кокуцу дати с защитным блоком ребром ладони Сюто-укэ левой рукой.',
    duration: 2.4,
    participantCount: 2,
    targetDistance: 1.02,
    targetAngle: 0.0,
    participants: [
      { role: 'tori', clipName: 'jodan_zuki_left', initialStance: 'zenkutsu_dachi_left', offsetX: -0.05, offsetZ: 0.58, rotationY: 180.0, delaySeconds: 0.0 },
      { role: 'uke1', clipName: 'tech_shuto_uke_left', initialStance: 'kokutsu_dachi_right', offsetX: -0.12, offsetZ: -0.44, rotationY: 0.0, delaySeconds: 0.05 },
    ],
  },
  {
    stepNumber: 13,
    title: 'Шаг 13: Шаг вперёд в Кокуцу-дати и Дзёдан Сюто-учи в область горла',
    description: '1 (Тори): Раскрыт после парированного выпада в Кокуцу дати. 2 (Укэ): Шаг вперед с сохранением стойки Кокуцу дати и нанесение рубящего удара ребром ладони Сюто-учи правой рукой в область шеи/горла Тори на вытянутую руку.',
    duration: 2.2,
    participantCount: 2,
    targetDistance: 0.91,
    targetAngle: 0.0,
    participants: [
      { role: 'tori', clipName: 'kokutsu_dachi_left', initialStance: 'kokutsu_dachi_left', offsetX: -0.05, offsetZ: 0.58, rotationY: 180.0, delaySeconds: 0.0 },
      { role: 'uke1', clipName: 'tech_shuto_uchi_right', initialStance: 'kokutsu_dachi_left', offsetX: -0.08, offsetZ: -0.33, rotationY: 0.0, delaySeconds: 0.05 },
    ],
  },
  {
    stepNumber: 14,
    title: 'Шаг 14: Подсечка Аши-барай — сваливание Тори в партер со страховкой Укэми (без захвата)',
    description: '1 (Тори): Падает со страховкой левой рукой на татами (укэми), правая нога лежит скрестно поверх левой. 2 (Укэ): Сметающая подсечка стопой Аси-барай под опорную ногу противника (без захвата руки) и вход в широкую стойку Сико-дати.',
    duration: 3.2,
    participantCount: 2,
    targetDistance: 0.80,
    targetAngle: 0.0,
    participants: [
      { role: 'tori', clipName: 'idle_shizentai', initialStance: 'fallen_ukemi', offsetX: -0.05, offsetZ: 0.58, rotationY: 180.0, delaySeconds: 0.15 },
      { role: 'uke1', clipName: 'stance_shiko', initialStance: 'stance_shiko', offsetX: 0.10, offsetZ: 0.05, rotationY: 0.0, delaySeconds: 0.0 },
    ],
  },
  {
    stepNumber: 15,
    title: 'Шаг 15: Добивающий удар Отоши-дзуки (Татэ-цуки) в стойке Сико-дати',
    description: '1 (Тори): Лежит на татами в страховке Укэми. 2 (Укэ): Из глубокой стойки Сико-дати наносит вертикальный добивающий удар кулаком сверху-вниз Отоши-дзуки (Татэ-цуки) в область солнечного сплетения противника.',
    duration: 2.6,
    participantCount: 2,
    targetDistance: 0.65,
    targetAngle: 0.0,
    participants: [
      { role: 'tori', clipName: 'idle_shizentai', initialStance: 'fallen_ukemi', offsetX: -0.05, offsetZ: 0.58, rotationY: 180.0, delaySeconds: 0.0 },
      { role: 'uke1', clipName: 'tech_tate_zuki_left', initialStance: 'stance_shiko', offsetX: 0.10, offsetZ: 0.05, rotationY: 0.0, delaySeconds: 0.04 },
    ],
  },
  {
    stepNumber: 16,
    title: 'Шаг 16: Разрыв дистанции и отход в Хидари дзэнкуцу-дати — Дзансин',
    description: '1 (Тори): Лежит на татами после падения в позиции контроля. 2 (Укэ): Делает шаг правой ногой назад и становится в стойку Хидари дзэнкуцу дати, сохраняя боевую бдительность над противником.',
    duration: 2.2,
    participantCount: 2,
    targetDistance: 1.60,
    targetAngle: 0.0,
    participants: [
      { role: 'tori', clipName: 'idle_shizentai', initialStance: 'fallen_ukemi', offsetX: -0.05, offsetZ: 0.58, rotationY: 180.0, delaySeconds: 0.0 },
      { role: 'uke1', clipName: 'zenkutsu_dachi_left', initialStance: 'zenkutsu_dachi_left', offsetX: -0.10, offsetZ: -0.95, rotationY: 0.0, delaySeconds: 0.0 },
    ],
  },
  {
    stepNumber: 17,
    title: 'Шаг 17: Подъем Тори с татами в Миги дзэнкуцу-дати',
    description: '1 (Тори): Через паузу встаёт с татами в стойку миги дзэнкуцу дати. 2 (Укэ): Удерживает позицию Хидари дзэнкуцу дати, контролируя движения Тори.',
    duration: 2.6,
    participantCount: 2,
    targetDistance: 1.60,
    targetAngle: 0.0,
    participants: [
      { role: 'tori', clipName: 'zenkutsu_dachi_right', initialStance: 'zenkutsu_dachi_right', offsetX: -0.05, offsetZ: 0.58, rotationY: 180.0, delaySeconds: 0.20 },
      { role: 'uke1', clipName: 'zenkutsu_dachi_left', initialStance: 'zenkutsu_dachi_left', offsetX: -0.10, offsetZ: -0.95, rotationY: 0.0, delaySeconds: 0.0 },
    ],
  },
  {
    stepNumber: 18,
    title: 'Шаг 18: Возврат обоих участников шагом назад в Хэйко-дати (Сидзэнтай)',
    description: '1 (Тори): Шагом назад становится в хэйко дати. 2 (Укэ): Шагом назад становится в хэйко дати. Возврат на безопасную начальную дистанцию (2.10м). Комплекс Бункай Хэйан Шодан завершен.',
    duration: 2.0,
    participantCount: 2,
    targetDistance: 2.10,
    targetAngle: 0.0,
    participants: [
      { role: 'tori', clipName: 'heiko_dachi', initialStance: 'heiko_dachi', offsetX: 0.0, offsetZ: 1.05, rotationY: 180.0, delaySeconds: 0.0 },
      { role: 'uke1', clipName: 'heiko_dachi', initialStance: 'heiko_dachi', offsetX: 0.0, offsetZ: -1.05, rotationY: 0.0, delaySeconds: 0.0 },
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
