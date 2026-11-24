require('dotenv').config();
const { poolPromise, sql } = require('../src/config/database');

const HEIAN_SHODAN_BUNKAI_18_STEPS = [
  {
    stepNumber: 1,
    title: 'Шаг 1: Хэйко-дати',
    description: '1 (Тори): heiko_dachi. 2 (Укэ): heiko_dachi.',
    duration: 1.6,
    participantCount: 2,
    targetDistance: 2.1,
    targetAngle: 0,
    participants: [
      { role: 'tori', clipName: 'heiko_dachi', initialStance: 'heiko_dachi', offsetX: 0, offsetZ: -1.05, rotationY: 0, delaySeconds: 0 },
      { role: 'uke1', clipName: 'heiko_dachi', initialStance: 'heiko_dachi', offsetX: 0, offsetZ: 1.05, rotationY: 180, delaySeconds: 0 },
    ],
  },
  {
    stepNumber: 2,
    title: 'Шаг 2: Вход в Дзэнкуцу-дати',
    description: '1 (Тори): enter_zenkutsu_left. 2 (Укэ): step_backward_right.',
    duration: 2,
    participantCount: 2,
    targetDistance: 1.7,
    targetAngle: 0,
    participants: [
      { role: 'tori', clipName: 'enter_zenkutsu_left', initialStance: 'heiko_dachi', offsetX: 0, offsetZ: -0.45, rotationY: 0, delaySeconds: 0 },
      { role: 'uke1', clipName: 'step_backward_right', initialStance: 'heiko_dachi', offsetX: 0, offsetZ: 1.25, rotationY: 180, delaySeconds: 0 },
    ],
  },
  {
    stepNumber: 3,
    title: 'Шаг 3: Маэ-гэри — уход 35° (юри-аши) и блок Гэдан-барай',
    description: '1 (Тори): kick_mae_geri_right. 2 (Укэ): tech_gedan_barai_left.',
    duration: 2.2,
    participantCount: 2,
    targetDistance: 1.2,
    targetAngle: 0,
    participants: [
      { role: 'tori', clipName: 'kick_mae_geri_right', initialStance: 'zenkutsu_dachi_left', offsetX: 0, offsetZ: 0.2, rotationY: 0, delaySeconds: 0 },
      { role: 'uke1', clipName: 'tech_gedan_barai_left', initialStance: 'zenkutsu_dachi_right', offsetX: 0.35, offsetZ: 1.35, rotationY: -163.1, delaySeconds: 0.12 },
    ],
  },
  {
    stepNumber: 4,
    title: 'Шаг 4: Контрудар Укэ Гяку-дзуки в корпус',
    description: '1 (Тори): zenkutsu_dachi_right. 2 (Укэ): tech_gyaku_zuki_right.',
    duration: 2,
    participantCount: 2,
    targetDistance: 1.06,
    targetAngle: 0,
    participants: [
      { role: 'tori', clipName: 'zenkutsu_dachi_right', initialStance: 'zenkutsu_dachi_right', offsetX: 0, offsetZ: 0.2, rotationY: 0, delaySeconds: 0 },
      { role: 'uke1', clipName: 'tech_gyaku_zuki_right', initialStance: 'zenkutsu_dachi_left', offsetX: 0.3, offsetZ: 1.22, rotationY: -163.6, delaySeconds: 0.06 },
    ],
  },
  {
    stepNumber: 5,
    title: 'Шаг 5: Маэ-гэри (12°) — возврат на осевую линию и блок Гэдан-барай',
    description: '1 (Тори): kick_mae_geri_right. 2 (Укэ): tech_gedan_barai_left.',
    duration: 2.2,
    participantCount: 2,
    targetDistance: 1.1,
    targetAngle: 12,
    participants: [
      { role: 'tori', clipName: 'kick_mae_geri_right', initialStance: 'zenkutsu_dachi_right', offsetX: 0.1, offsetZ: 0.65, rotationY: 12, delaySeconds: 0 },
      { role: 'uke1', clipName: 'tech_gedan_barai_left', initialStance: 'zenkutsu_dachi_left', offsetX: 0.18, offsetZ: 1.75, rotationY: -175.8, delaySeconds: 0.1 },
    ],
  },
  {
    stepNumber: 6,
    title: 'Шаг 6: Гяку-дзуки (12°) — защита Фудо-дати Хайван-укэ',
    description: '1 (Тори): tech_gyaku_zuki_right. 2 (Укэ): tech_haishu_uke_left.',
    duration: 2,
    participantCount: 2,
    targetDistance: 1.03,
    targetAngle: 12,
    participants: [
      { role: 'tori', clipName: 'tech_gyaku_zuki_right', initialStance: 'zenkutsu_dachi_right', offsetX: 0.14, offsetZ: 0.85, rotationY: 12, delaySeconds: 0 },
      { role: 'uke1', clipName: 'tech_haishu_uke_left', initialStance: 'zenkutsu_dachi_left', offsetX: 0.2, offsetZ: 1.88, rotationY: -176.7, delaySeconds: 0.08 },
    ],
  },
  {
    stepNumber: 7,
    title: 'Шаг 7: Контрудар Укэ Тэтцуи (рука-молот)',
    description: '1 (Тори): zenkutsu_dachi_left. 2 (Укэ): tech_tettsui_right.',
    duration: 2,
    participantCount: 2,
    targetDistance: 0.95,
    targetAngle: 12,
    participants: [
      { role: 'tori', clipName: 'zenkutsu_dachi_left', initialStance: 'zenkutsu_dachi_left', offsetX: 0.14, offsetZ: 0.85, rotationY: 12, delaySeconds: 0 },
      { role: 'uke1', clipName: 'tech_tettsui_right', initialStance: 'fudo_dachi', offsetX: 0.18, offsetZ: 1.8, rotationY: -177.6, delaySeconds: 0.05 },
    ],
  },
  {
    stepNumber: 8,
    title: 'Шаг 8: Контрудар Укэ Гяку-дзуки',
    description: '1 (Тори): zenkutsu_dachi_left. 2 (Укэ): tech_gyaku_zuki_right.',
    duration: 2,
    participantCount: 2,
    targetDistance: 0.95,
    targetAngle: 12,
    participants: [
      { role: 'tori', clipName: 'zenkutsu_dachi_left', initialStance: 'zenkutsu_dachi_left', offsetX: 0.14, offsetZ: 0.85, rotationY: 12, delaySeconds: 0 },
      { role: 'uke1', clipName: 'tech_gyaku_zuki_right', initialStance: 'zenkutsu_dachi_left', offsetX: 0.18, offsetZ: 1.8, rotationY: -177.6, delaySeconds: 0.05 },
    ],
  },
  {
    stepNumber: 9,
    title: 'Шаг 9: Атака Тори Маэ-гэри — шаг назад Укэ и блок Гэдан-барай',
    description: '1 (Тори): kick_mae_geri_right. 2 (Укэ): tech_gedan_barai_left.',
    duration: 2.2,
    participantCount: 2,
    targetDistance: 1.05,
    targetAngle: 12,
    participants: [
      { role: 'tori', clipName: 'kick_mae_geri_right', initialStance: 'zenkutsu_dachi_left', offsetX: 0.18, offsetZ: 1.05, rotationY: 12, delaySeconds: 0 },
      { role: 'uke1', clipName: 'tech_gedan_barai_left', initialStance: 'zenkutsu_dachi_left', offsetX: 0.24, offsetZ: 2.1, rotationY: -176.7, delaySeconds: 0.08 },
    ],
  },
  {
    stepNumber: 10,
    title: 'Шаг 10: Выпад Тори Ой-дзуки — восходящий блок Укэ Агэ-укэ',
    description: '1 (Тори): tech_oi_zuki_right. 2 (Укэ): tech_age_uke_left.',
    duration: 2.2,
    participantCount: 2,
    targetDistance: 0.99,
    targetAngle: 12,
    participants: [
      { role: 'tori', clipName: 'tech_oi_zuki_right', initialStance: 'zenkutsu_dachi_left', offsetX: 0.24, offsetZ: 1.32, rotationY: 12, delaySeconds: 0 },
      { role: 'uke1', clipName: 'tech_age_uke_left', initialStance: 'zenkutsu_dachi_left', offsetX: 0.38, offsetZ: 2.3, rotationY: -171.9, delaySeconds: 0.08 },
    ],
  },
  {
    stepNumber: 11,
    title: 'Шаг 11: Гяку Агэ-укэ с выпадом вперёд (вместо захвата руки)',
    description: '1 (Тори): zenkutsu_dachi_right. 2 (Укэ): tech_age_uke_right.',
    duration: 2,
    participantCount: 2,
    targetDistance: 0.92,
    targetAngle: 12,
    participants: [
      { role: 'tori', clipName: 'zenkutsu_dachi_right', initialStance: 'zenkutsu_dachi_right', offsetX: 0.24, offsetZ: 1.32, rotationY: 12, delaySeconds: 0 },
      { role: 'uke1', clipName: 'tech_age_uke_right', initialStance: 'zenkutsu_dachi_left', offsetX: 0.42, offsetZ: 2.22, rotationY: -168.7, delaySeconds: 0.05 },
    ],
  },
  {
    stepNumber: 12,
    title: 'Шаг 12: Разворот Тори на 180° — смещение Укэ в Миги дзэнкуцу-дати (35°)',
    description: '1 (Тори): turn_into_zenkutsu_right. 2 (Укэ): step_forward_right.',
    duration: 2.4,
    participantCount: 2,
    targetDistance: 1.29,
    targetAngle: 0,
    participants: [
      { role: 'tori', clipName: 'turn_into_zenkutsu_right', initialStance: 'zenkutsu_dachi_right', offsetX: 0.24, offsetZ: 1.32, rotationY: -168, delaySeconds: 0 },
      { role: 'uke1', clipName: 'step_forward_right', initialStance: 'zenkutsu_dachi_left', offsetX: 0, offsetZ: 0.05, rotationY: 10.7, delaySeconds: 0.05 },
    ],
  },
  {
    stepNumber: 13,
    title: 'Шаг 13: Разворот Укэ в Хидари дзэнкуцу-дати',
    description: '1 (Тори): zenkutsu_dachi_right. 2 (Укэ): turn_into_zenkutsu_left.',
    duration: 1.8,
    participantCount: 2,
    targetDistance: 1.29,
    targetAngle: 0,
    participants: [
      { role: 'tori', clipName: 'zenkutsu_dachi_right', initialStance: 'zenkutsu_dachi_right', offsetX: 0.24, offsetZ: 1.32, rotationY: -168, delaySeconds: 0 },
      { role: 'uke1', clipName: 'turn_into_zenkutsu_left', initialStance: 'zenkutsu_dachi_right', offsetX: 0, offsetZ: 0.05, rotationY: 10.7, delaySeconds: 0.05 },
    ],
  },
  {
    stepNumber: 14,
    title: 'Шаг 14: Маэ-гэри — Хайван-укэ и полшага назад в Хэйсоку-дати (спиной к Тори)',
    description: '1 (Тори): kick_mae_geri_right. 2 (Укэ): tech_haishu_uke_left.',
    duration: 2.2,
    participantCount: 2,
    targetDistance: 1.12,
    targetAngle: 0,
    participants: [
      { role: 'tori', clipName: 'kick_mae_geri_right', initialStance: 'zenkutsu_dachi_right', offsetX: 0.24, offsetZ: 1.32, rotationY: -168, delaySeconds: 0 },
      { role: 'uke1', clipName: 'tech_haishu_uke_left', initialStance: 'zenkutsu_dachi_left', offsetX: 0.04, offsetZ: 0.22, rotationY: -169.7, delaySeconds: 0.08 },
    ],
  },
  {
    stepNumber: 15,
    title: 'Шаг 15: Разворот Укэ в Миги дзэнкуцу-дати с блоком Гэдан-барай',
    description: '1 (Тори): zenkutsu_dachi_right. 2 (Укэ): tech_gedan_barai_right.',
    duration: 2.2,
    participantCount: 2,
    targetDistance: 1.07,
    targetAngle: 0,
    participants: [
      { role: 'tori', clipName: 'zenkutsu_dachi_right', initialStance: 'zenkutsu_dachi_right', offsetX: 0.24, offsetZ: 1.32, rotationY: -168, delaySeconds: 0 },
      { role: 'uke1', clipName: 'tech_gedan_barai_right', initialStance: 'stance_heisoku', offsetX: 0.06, offsetZ: 0.26, rotationY: 9.6, delaySeconds: 0.05 },
    ],
  },
  {
    stepNumber: 16,
    title: 'Шаг 16: Контрудар Укэ Гяку-дзуки',
    description: '1 (Тори): zenkutsu_dachi_right. 2 (Укэ): tech_gyaku_zuki_left.',
    duration: 2,
    participantCount: 2,
    targetDistance: 0.99,
    targetAngle: 0,
    participants: [
      { role: 'tori', clipName: 'zenkutsu_dachi_right', initialStance: 'zenkutsu_dachi_right', offsetX: 0.24, offsetZ: 1.32, rotationY: -168, delaySeconds: 0 },
      { role: 'uke1', clipName: 'tech_gyaku_zuki_left', initialStance: 'zenkutsu_dachi_right', offsetX: 0.08, offsetZ: 0.34, rotationY: 9.3, delaySeconds: 0.05 },
    ],
  },
  {
    stepNumber: 17,
    title: 'Шаг 17: Шаг назад Тори в Миги дзэнкуцу — первый Гяку-дзуки Укэ',
    description: '1 (Тори): step_backward_right. 2 (Укэ): tech_gyaku_zuki_left.',
    duration: 2,
    participantCount: 2,
    targetDistance: 1.07,
    targetAngle: 0,
    participants: [
      { role: 'tori', clipName: 'step_backward_right', initialStance: 'zenkutsu_dachi_right', offsetX: 0.28, offsetZ: 1.56, rotationY: -170, delaySeconds: 0 },
      { role: 'uke1', clipName: 'tech_gyaku_zuki_left', initialStance: 'zenkutsu_dachi_right', offsetX: 0.12, offsetZ: 0.5, rotationY: 8.6, delaySeconds: 0.06 },
    ],
  },
  {
    stepNumber: 18,
    title: 'Шаг 18: Второй Гяку-дзуки Укэ с шагом в Хидари дзэнкуцу-дати',
    description: '1 (Тори): zenkutsu_dachi_right. 2 (Укэ): tech_gyaku_zuki_right.',
    duration: 2,
    participantCount: 2,
    targetDistance: 0.95,
    targetAngle: 0,
    participants: [
      { role: 'tori', clipName: 'zenkutsu_dachi_right', initialStance: 'zenkutsu_dachi_right', offsetX: 0.28, offsetZ: 1.56, rotationY: -170, delaySeconds: 0 },
      { role: 'uke1', clipName: 'tech_gyaku_zuki_right', initialStance: 'zenkutsu_dachi_right', offsetX: 0.16, offsetZ: 0.62, rotationY: 7.3, delaySeconds: 0.05 },
    ],
  },
  {
    stepNumber: 19,
    title: 'Шаг 19: Кидзами-дзуки с выпадом — отвод Нагаси-укэ в Миги кокуцу-дати',
    description: '1 (Тори): jodan_zuki_left. 2 (Укэ): tech_uchi_uke_right.',
    duration: 2,
    participantCount: 2,
    targetDistance: 1,
    targetAngle: 0,
    participants: [
      { role: 'tori', clipName: 'jodan_zuki_left', initialStance: 'zenkutsu_dachi_right', offsetX: 0.22, offsetZ: 1.34, rotationY: -175, delaySeconds: 0 },
      { role: 'uke1', clipName: 'tech_uchi_uke_right', initialStance: 'zenkutsu_dachi_left', offsetX: 0.14, offsetZ: 0.34, rotationY: 4.6, delaySeconds: 0.05 },
    ],
  },
  {
    stepNumber: 20,
    title: 'Шаг 20: Блок Сюто-укэ в Миги кокуцу-дати',
    description: '1 (Тори): kokutsu_dachi_left. 2 (Укэ): tech_shuto_uke_left.',
    duration: 1.9,
    participantCount: 2,
    targetDistance: 1,
    targetAngle: 0,
    participants: [
      { role: 'tori', clipName: 'kokutsu_dachi_left', initialStance: 'zenkutsu_dachi_left', offsetX: 0.22, offsetZ: 1.34, rotationY: -175, delaySeconds: 0 },
      { role: 'uke1', clipName: 'tech_shuto_uke_left', initialStance: 'kokutsu_dachi_right', offsetX: 0.14, offsetZ: 0.34, rotationY: 4.6, delaySeconds: 0.05 },
    ],
  },
  {
    stepNumber: 21,
    title: 'Шаг 21: Шаг вперёд в Кокуцу-дати — Дзёдан Сюто-учи в область горла',
    description: '1 (Тори): kokutsu_dachi_left. 2 (Укэ): tech_shuto_uchi_right.',
    duration: 2,
    participantCount: 2,
    targetDistance: 0.86,
    targetAngle: 0,
    participants: [
      { role: 'tori', clipName: 'kokutsu_dachi_left', initialStance: 'kokutsu_dachi_left', offsetX: 0.22, offsetZ: 1.34, rotationY: -177, delaySeconds: 0 },
      { role: 'uke1', clipName: 'tech_shuto_uchi_right', initialStance: 'kokutsu_dachi_right', offsetX: 0.18, offsetZ: 0.48, rotationY: 3, delaySeconds: 0.05 },
    ],
  },
  {
    stepNumber: 22,
    title: 'Шаг 22: Гяку Агэ-укэ (вместо захвата за рукав)',
    description: '1 (Тори): zenkutsu_dachi_right. 2 (Укэ): tech_age_uke_right.',
    duration: 2,
    participantCount: 2,
    targetDistance: 0.76,
    targetAngle: 0,
    participants: [
      { role: 'tori', clipName: 'zenkutsu_dachi_right', initialStance: 'kokutsu_dachi_left', offsetX: 0.22, offsetZ: 1.34, rotationY: -178, delaySeconds: 0 },
      { role: 'uke1', clipName: 'tech_age_uke_right', initialStance: 'kokutsu_dachi_left', offsetX: 0.19, offsetZ: 0.58, rotationY: 2, delaySeconds: 0.05 },
    ],
  },
  {
    stepNumber: 23,
    title: 'Шаг 23: Подсечка Аши-барай в Сико-дати — падение Тори со страховкой Укэми',
    description: '1 (Тори): idle_shizentai. 2 (Укэ): kick_nami_gaeshi_left.',
    duration: 2.6,
    participantCount: 2,
    targetDistance: 0.62,
    targetAngle: 0,
    participants: [
      { role: 'tori', clipName: 'idle_shizentai', initialStance: 'zenkutsu_dachi_right', offsetX: 0.22, offsetZ: 1.34, rotationY: -178, delaySeconds: 0.15 },
      { role: 'uke1', clipName: 'kick_nami_gaeshi_left', initialStance: 'kokutsu_dachi_left', offsetX: 0.2, offsetZ: 0.72, rotationY: 2, delaySeconds: 0 },
    ],
  },
  {
    stepNumber: 24,
    title: 'Шаг 24: Добивающий удар Отоши-дзуки в стойке Сико-дати',
    description: '1 (Тори): idle_shizentai. 2 (Укэ): tech_tate_zuki_left.',
    duration: 2,
    participantCount: 2,
    targetDistance: 0.62,
    targetAngle: 0,
    participants: [
      { role: 'tori', clipName: 'idle_shizentai', initialStance: 'fallen_ukemi', offsetX: 0.22, offsetZ: 1.34, rotationY: -178, delaySeconds: 0 },
      { role: 'uke1', clipName: 'tech_tate_zuki_left', initialStance: 'stance_shiko', offsetX: 0.2, offsetZ: 0.72, rotationY: 2, delaySeconds: 0.04 },
    ],
  },
  {
    stepNumber: 25,
    title: 'Шаг 25: Отход Укэ правой ногой назад в Хидари дзэнкуцу-дати',
    description: '1 (Тори): idle_shizentai. 2 (Укэ): step_backward_right.',
    duration: 2,
    participantCount: 2,
    targetDistance: 1.59,
    targetAngle: 0,
    participants: [
      { role: 'tori', clipName: 'idle_shizentai', initialStance: 'fallen_ukemi', offsetX: 0.22, offsetZ: 1.34, rotationY: -178, delaySeconds: 0 },
      { role: 'uke1', clipName: 'step_backward_right', initialStance: 'stance_shiko', offsetX: 0.18, offsetZ: -0.25, rotationY: 2, delaySeconds: 0 },
    ],
  },
  {
    stepNumber: 26,
    title: 'Шаг 26: Подъем Тори через паузу в Миги дзэнкуцу-дати',
    description: '1 (Тори): zenkutsu_dachi_right. 2 (Укэ): zenkutsu_dachi_left.',
    duration: 2.4,
    participantCount: 2,
    targetDistance: 1.59,
    targetAngle: 0,
    participants: [
      { role: 'tori', clipName: 'zenkutsu_dachi_right', initialStance: 'fallen_ukemi', offsetX: 0.22, offsetZ: 1.34, rotationY: -178, delaySeconds: 0.25 },
      { role: 'uke1', clipName: 'zenkutsu_dachi_left', initialStance: 'zenkutsu_dachi_left', offsetX: 0.18, offsetZ: -0.25, rotationY: 2, delaySeconds: 0 },
    ],
  },
  {
    stepNumber: 27,
    title: 'Шаг 27: Возврат шагом назад в Хэйко-дати',
    description: '1 (Тори): step_backward. 2 (Укэ): step_backward.',
    duration: 2,
    participantCount: 2,
    targetDistance: 2.1,
    targetAngle: 0,
    participants: [
      { role: 'tori', clipName: 'step_backward', initialStance: 'zenkutsu_dachi_right', offsetX: 0, offsetZ: 1.55, rotationY: 180, delaySeconds: 0 },
      { role: 'uke1', clipName: 'step_backward', initialStance: 'zenkutsu_dachi_left', offsetX: 0, offsetZ: -0.55, rotationY: 0, delaySeconds: 0 },
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
        SET Title = N'Канонический Бункай: Хэйан Шодан (27 атомарных шагов)',
            Description = N'Официальный пошаговый бункай ката Хэйан Шодан: 1 — Тори (синий, атакующий), 2 — Укэ (белый, защищающийся). Разбор боевого взаимодействия на реальной боевой дистанции с непрерывными переходами и контролем анти-проникновения.',
            Status = N'approved'
        WHERE Bunkai_ID = @bId
      `);
      console.log(`Обновлена запись Bunkai #${bunkaiId}`);
    } else {
      const insRes = await pool.request().input('kId', kataId).query(`
        INSERT INTO dbo.Bunkai (Author_ID, Kata_ID, Title, Description, Application, Difficulty, Status)
        VALUES (1, @kId, N'Канонический Бункай: Хэйан Шодан (27 атомарных шагов)',
          N'Официальный пошаговый бункай ката Хэйан Шодан: 1 — Тори (синий, атакующий), 2 — Укэ (белый, защищающийся).',
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

    // 5. Вставляем все 27 атомарных шагов и участников
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

    console.log(`✔ Успешно сохранены все 27 атомарных шагов бункая для Хэйан Шодан!`);
  } catch (err) {
    console.warn('База данных недоступна или произошла ошибка:', err.message);
  }
}

seedBunkaiHeianShodan().then(() => process.exit(0));
