/* =====================================================================
   Bunkai Explorer — начальные данные (T-SQL)

   ЭТО ШАБЛОН. Не запускайте этот файл напрямую — плейсхолдеры
   {{ADMIN_PASSWORD_HASH}} / {{USER_PASSWORD_HASH}} не являются
   валидными bcrypt-хешами.

   Чтобы получить готовый к запуску seed.sql с реальными хешами паролей:
     cd server
     npm install
     npm run seed:sql

   Скрипт server/scripts/generate-seed-sql.js подставит хеши, посчитанные
   той же библиотекой (bcryptjs), которой сервер проверяет пароли при
   логине, и сохранит результат в database/seed.sql.

   Пароли по умолчанию: admin123 (admin@bunkai.local), user12345 (karateka@bunkai.local).
   Дальше — то же самое содержимое, что генерирует Sequelize-сидер
   (server/seeders/20240101000001-demo-data.js), но в виде чистого SQL.
   ===================================================================== */

SET NOCOUNT ON;
GO

DECLARE @Now DATETIME2 = SYSUTCDATETIME();

-- --- Пользователи ---
INSERT INTO dbo.Users (email, username, passwordHash, role, reputation, isBanned, createdAt, updatedAt)
VALUES
    ('admin@bunkai.local', 'admin', '{{ADMIN_PASSWORD_HASH}}', 'admin', 0, 0, @Now, @Now),
    ('karateka@bunkai.local', 'karateka', '{{USER_PASSWORD_HASH}}', 'user', 5, 0, @Now, @Now);

DECLARE @AdminId INT = (SELECT id FROM dbo.Users WHERE email = 'admin@bunkai.local');
DECLARE @UserId  INT = (SELECT id FROM dbo.Users WHERE email = 'karateka@bunkai.local');

-- --- Ката ---
INSERT INTO dbo.Kata (name, nameJp, style, kyuLevel, description, history, youtubeUrl, thumbnailUrl, createdBy, createdAt, updatedAt)
VALUES
    (N'Хейан Шодан', N'平安初段', 'Shotokan', N'9 кю',
     N'Первая ката серии Хейан, вводит базовые стойки и блоки.',
     N'Создана Анко Итосу в начале XX века как упрощённая форма для обучения в школах.',
     'https://www.youtube.com/watch?v=6BpVeCbwGtY',
     dbo.ufn_YoutubeThumbnailUrl(dbo.ufn_YoutubeVideoId('https://www.youtube.com/watch?v=6BpVeCbwGtY')),
     @AdminId, @Now, @Now),
    (N'Бассай Дай', N'披塞大', 'Shotokan', N'1 кю',
     N'Продвинутая ката, название переводится как "штурм крепости".',
     N'Одна из старейших ката в каратэ, происхождение точно не установлено.',
     'https://www.youtube.com/watch?v=nQjSD3Qm3wc',
     dbo.ufn_YoutubeThumbnailUrl(dbo.ufn_YoutubeVideoId('https://www.youtube.com/watch?v=nQjSD3Qm3wc')),
     @AdminId, @Now, @Now);

DECLARE @KataHeianId INT = (SELECT id FROM dbo.Kata WHERE name = N'Хейан Шодан');

-- --- Последовательности для Хейан Шодан ---
INSERT INTO dbo.Sequences (kataId, [order], name, description, startTime, endTime, createdAt, updatedAt)
VALUES
    (@KataHeianId, 1, N'Вступление', N'Начальные движения ката', 0, 10, @Now, @Now),
    (@KataHeianId, 2, N'Средняя часть', N'Повороты и удары', 10, 25, @Now, @Now);

DECLARE @Seq1Id INT = (SELECT id FROM dbo.Sequences WHERE kataId = @KataHeianId AND [order] = 1);

-- --- Движения ---
INSERT INTO dbo.Movements (sequenceId, [order], name, nameJp, stance, direction, description, youtubeUrl, startTime, createdAt, updatedAt)
VALUES
    (@Seq1Id, 1, N'Блок предплечьем вниз влево', N'Гедан-барай', N'Зенкутсу-дачи', N'Влево',
     N'Разворот на 90° влево с нижним блоком.', 'https://www.youtube.com/watch?v=6BpVeCbwGtY', 3, @Now, @Now),
    (@Seq1Id, 2, N'Удар кулаком вперёд', N'Ой-цуки', N'Зенкутсу-дачи', N'Вперёд',
     N'Шаг вперёд с прямым ударом кулаком в корпус.', 'https://www.youtube.com/watch?v=6BpVeCbwGtY', 6, @Now, @Now);

DECLARE @Mv1Id INT = (SELECT id FROM dbo.Movements WHERE sequenceId = @Seq1Id AND [order] = 1);
DECLARE @Mv2Id INT = (SELECT id FROM dbo.Movements WHERE sequenceId = @Seq1Id AND [order] = 2);

-- --- Теги ---
INSERT INTO dbo.Tags (name, slug, createdAt, updatedAt)
VALUES
    (N'Захват', 'zahvat', @Now, @Now),
    (N'Бросок', 'brosok', @Now, @Now),
    (N'Болевой приём', 'bolevoy-priem', @Now, @Now);

-- --- Бункай (5 штук) ---
INSERT INTO dbo.Bunkai (movementId, title, description, youtubeUrl, difficulty, createdBy, status, rating, createdAt, updatedAt)
VALUES
    (@Mv1Id, N'Блок как захват запястья',
     N'Гедан-барай интерпретируется как захват и рывок атакующей руки противника.',
     'https://www.youtube.com/watch?v=6BpVeCbwGtY', 'beginner', @AdminId, 'approved', 3, @Now, @Now),
    (@Mv1Id, N'Уход с линии атаки и контроль руки',
     N'Разворот используется для смещения с линии атаки при одновременном контроле руки нападающего.',
     'https://www.youtube.com/watch?v=6BpVeCbwGtY', 'intermediate', @UserId, 'approved', 1, @Now, @Now),
    (@Mv2Id, N'Прямой удар как завершение связки',
     N'Ой-цуки применяется как финальный удар после освобождения от захвата.',
     'https://www.youtube.com/watch?v=6BpVeCbwGtY', 'beginner', @AdminId, 'approved', 4, @Now, @Now),
    (@Mv2Id, N'Бросок через бедро после блока',
     N'Альтернативная трактовка: движение вперёд превращается в вход для броска.',
     'https://www.youtube.com/watch?v=6BpVeCbwGtY', 'advanced', @UserId, 'pending', 0, @Now, @Now),
    (@Mv2Id, N'Болевой на запястье из позиции удара',
     N'Движение руки трактуется как переход в контроль кисти с последующим болевым.',
     'https://www.youtube.com/watch?v=6BpVeCbwGtY', 'advanced', @AdminId, 'pending', 0, @Now, @Now);

PRINT 'Начальные данные Bunkai Explorer успешно загружены.';
GO
