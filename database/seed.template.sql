-- =========================================================
-- Bunkai Explorer — начальные данные (ШАБЛОН)
-- Не выполняйте этот файл напрямую — используйте seed.sql,
-- сгенерированный командой `npm run seed:sql` в /server.
-- Плейсхолдеры вида {{ADMIN_PASSWORD_HASH}} заменяются
-- реальными bcrypt-хешами скриптом generate-seed-sql.js.
-- =========================================================

-- Роли
IF NOT EXISTS (SELECT 1 FROM dbo.Roles)
BEGIN
    INSERT INTO dbo.Roles (Role_Name, Description)
    VALUES
        (N'guest', N'Неавторизованный посетитель'),
        (N'user',  N'Обычный зарегистрированный пользователь'),
        (N'admin', N'Администратор системы');
END
GO

-- Администратор по умолчанию (логин/пароль см. в README, ОБЯЗАТЕЛЬНО смените пароль после первого входа)
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = N'admin')
BEGIN
    INSERT INTO dbo.Users (Role_ID, Username, Email, Password_Hash, Display_Name)
    VALUES (
        (SELECT Role_ID FROM dbo.Roles WHERE Role_Name = N'admin'),
        N'admin',
        N'admin@bunkai-explorer.local',
        N'{{ADMIN_PASSWORD_HASH}}',
        N'Администратор'
    );
END
GO

-- Демонстрационный обычный пользователь
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = N'demo_user')
BEGIN
    INSERT INTO dbo.Users (Role_ID, Username, Email, Password_Hash, Display_Name)
    VALUES (
        (SELECT Role_ID FROM dbo.Roles WHERE Role_Name = N'user'),
        N'demo_user',
        N'demo@bunkai-explorer.local',
        N'{{DEMO_PASSWORD_HASH}}',
        N'Демо Пользователь'
    );
END
GO

-- Общий чат (единственная комната типа general)
IF NOT EXISTS (SELECT 1 FROM dbo.ChatRooms WHERE Room_Type = N'general')
BEGIN
    INSERT INTO dbo.ChatRooms (Room_Type) VALUES (N'general');
END
GO

PRINT 'Seed-данные Bunkai Explorer применены.';
GO
