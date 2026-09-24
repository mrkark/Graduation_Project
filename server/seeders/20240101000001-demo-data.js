'use strict';
const bcrypt = require('bcryptjs');

module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    const passwordHash = await bcrypt.hash('admin123', 10);
    const userPasswordHash = await bcrypt.hash('user12345', 10);

    // --- Пользователи ---
    await queryInterface.bulkInsert('Users', [
      {
        email: 'admin@bunkai.local',
        username: 'admin',
        passwordHash,
        role: 'admin',
        reputation: 0,
        isBanned: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        email: 'karateka@bunkai.local',
        username: 'karateka',
        passwordHash: userPasswordHash,
        role: 'user',
        reputation: 5,
        isBanned: false,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // --- Ката ---
    await queryInterface.bulkInsert('Kata', [
      {
        name: 'Хейан Шодан',
        nameJp: '平安初段',
        style: 'Shotokan',
        kyuLevel: '9 кю',
        description: 'Первая ката серии Хейан, вводит базовые стойки и блоки.',
        history: 'Создана Анко Итосу в начале XX века как упрощённая форма для обучения в школах.',
        youtubeUrl: 'https://www.youtube.com/watch?v=6BpVeCbwGtY',
        thumbnailUrl: 'https://img.youtube.com/vi/6BpVeCbwGtY/maxresdefault.jpg',
        createdBy: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: 'Бассай Дай',
        nameJp: '披塞大',
        style: 'Shotokan',
        kyuLevel: '1 кю',
        description: 'Продвинутая ката, название переводится как "штурм крепости".',
        history: 'Одна из старейших ката в каратэ, происхождение точно не установлено.',
        youtubeUrl: 'https://www.youtube.com/watch?v=nQjSD3Qm3wc',
        thumbnailUrl: 'https://img.youtube.com/vi/nQjSD3Qm3wc/maxresdefault.jpg',
        createdBy: 1,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // --- Последовательности для Хейан Шодан (kataId=1) ---
    await queryInterface.bulkInsert('Sequences', [
      { kataId: 1, order: 1, name: 'Вступление', description: 'Начальные движения ката', startTime: 0, endTime: 10, createdAt: now, updatedAt: now },
      { kataId: 1, order: 2, name: 'Средняя часть', description: 'Повороты и удары', startTime: 10, endTime: 25, createdAt: now, updatedAt: now },
    ]);

    // --- Движения ---
    await queryInterface.bulkInsert('Movements', [
      {
        sequenceId: 1,
        order: 1,
        name: 'Блок предплечьем вниз влево',
        nameJp: 'Гедан-барай',
        stance: 'Зенкутсу-дачи',
        direction: 'Влево',
        description: 'Разворот на 90° влево с нижним блоком.',
        youtubeUrl: 'https://www.youtube.com/watch?v=6BpVeCbwGtY',
        startTime: 3,
        createdAt: now,
        updatedAt: now,
      },
      {
        sequenceId: 1,
        order: 2,
        name: 'Удар кулаком вперёд',
        nameJp: 'Ой-цуки',
        stance: 'Зенкутсу-дачи',
        direction: 'Вперёд',
        description: 'Шаг вперёд с прямым ударом кулаком в корпус.',
        youtubeUrl: 'https://www.youtube.com/watch?v=6BpVeCbwGtY',
        startTime: 6,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // --- Теги ---
    await queryInterface.bulkInsert('Tags', [
      { name: 'Захват', slug: 'zahvat', createdAt: now, updatedAt: now },
      { name: 'Бросок', slug: 'brosok', createdAt: now, updatedAt: now },
      { name: 'Болевой приём', slug: 'bolevoy-priem', createdAt: now, updatedAt: now },
    ]);

    // --- Бункай (5 штук, привязаны к 2 движениям) ---
    await queryInterface.bulkInsert('Bunkai', [
      {
        movementId: 1,
        title: 'Блок как захват запястья',
        description: 'Гедан-барай интерпретируется как захват и рывок атакующей руки противника.',
        youtubeUrl: 'https://www.youtube.com/watch?v=6BpVeCbwGtY',
        difficulty: 'beginner',
        createdBy: 1,
        status: 'approved',
        rating: 3,
        createdAt: now,
        updatedAt: now,
      },
      {
        movementId: 1,
        title: 'Уход с линии атаки и контроль руки',
        description: 'Разворот используется для смещения с линии атаки при одновременном контроле руки нападающего.',
        youtubeUrl: 'https://www.youtube.com/watch?v=6BpVeCbwGtY',
        difficulty: 'intermediate',
        createdBy: 2,
        status: 'approved',
        rating: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        movementId: 2,
        title: 'Прямой удар как завершение связки',
        description: 'Ой-цуки применяется как финальный удар после освобождения от захвата.',
        youtubeUrl: 'https://www.youtube.com/watch?v=6BpVeCbwGtY',
        difficulty: 'beginner',
        createdBy: 1,
        status: 'approved',
        rating: 4,
        createdAt: now,
        updatedAt: now,
      },
      {
        movementId: 2,
        title: 'Бросок через бедро после блока',
        description: 'Альтернативная трактовка: движение вперёд превращается в вход для броска.',
        youtubeUrl: 'https://www.youtube.com/watch?v=6BpVeCbwGtY',
        difficulty: 'advanced',
        createdBy: 2,
        status: 'pending',
        rating: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        movementId: 2,
        title: 'Болевой на запястье из позиции удара',
        description: 'Движение руки трактуется как переход в контроль кисти с последующим болевым.',
        youtubeUrl: 'https://www.youtube.com/watch?v=6BpVeCbwGtY',
        difficulty: 'advanced',
        createdBy: 1,
        status: 'pending',
        rating: 0,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('Bunkai', null, {});
    await queryInterface.bulkDelete('Tags', null, {});
    await queryInterface.bulkDelete('Movements', null, {});
    await queryInterface.bulkDelete('Sequences', null, {});
    await queryInterface.bulkDelete('Kata', null, {});
    await queryInterface.bulkDelete('Users', null, {});
  },
};
