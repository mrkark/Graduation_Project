-- =========================================================
-- Bunkai Explorer — Миграция: Добавление роли Модератора
-- Дата: 2026-10-17
-- Назначение: Добавление роли 'moderator', позволяющей
-- просматривать и удалять пользователей и бункаи.
-- =========================================================

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- 1. Добавление роли moderator в dbo.Roles (если ещё не существует)
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Role_Name = N'moderator')
BEGIN
    INSERT INTO dbo.Roles (Role_Name, Description)
    VALUES (N'moderator', N'Модератор (просмотр и удаление пользователей и бункаев)');
    PRINT N'Роль moderator успешно добавлена в таблицу dbo.Roles.';
END
ELSE
BEGIN
    PRINT N'Роль moderator уже существует в dbo.Roles.';
END
GO

-- 2. Обновление процедуры dbo.sp_Admin_ChangeUserRole для поддержки роли moderator
CREATE OR ALTER PROCEDURE dbo.sp_Admin_ChangeUserRole
    @UserId INT,
    @ActorUserId INT,
    @RoleName NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    IF @RoleName NOT IN (N'user', N'admin', N'moderator')
        THROW 50000, N'ERR|400|VALIDATION_ERROR|Недопустимая роль. Допустимы: user, admin, moderator', 1;

    IF @UserId = @ActorUserId
        THROW 50000, N'ERR|400|SELF_ROLE_CHANGE|Нельзя изменить собственную роль', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE User_ID = @UserId)
        THROW 50000, N'ERR|404|USER_NOT_FOUND|Пользователь не найден', 1;

    DECLARE @roleId INT = (SELECT Role_ID FROM dbo.Roles WHERE Role_Name = @RoleName);
    IF @roleId IS NULL
        THROW 50000, N'ERR|500|ROLE_MISSING|Роль не настроена в базе данных', 1;

    UPDATE dbo.Users
    SET Role_ID = @roleId, Updated_At = SYSUTCDATETIME()
    WHERE User_ID = @UserId;
END
GO
PRINT N'Процедура dbo.sp_Admin_ChangeUserRole обновлена.';
GO

-- 3. Обновление процедуры dbo.sp_Bunkai_Delete для разрешения удаления модераторам
CREATE OR ALTER PROCEDURE dbo.sp_Bunkai_Delete
    @BunkaiId INT,
    @UserId INT,
    @UserRole NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @authorId INT;
    SELECT @authorId = Author_ID FROM dbo.Bunkai WHERE Bunkai_ID = @BunkaiId;

    IF @authorId IS NULL
        THROW 50000, N'ERR|404|BUNKAI_NOT_FOUND|Бункай не найден', 1;

    -- Удалять бункай может либо его автор, либо администратор, либо модератор
    IF @authorId <> @UserId AND @UserRole NOT IN (N'admin', N'moderator')
        THROW 50000, N'ERR|403|FORBIDDEN|Недостаточно прав для удаления бункая', 1;

    DELETE FROM dbo.Bunkai WHERE Bunkai_ID = @BunkaiId;
END
GO
PRINT N'Процедура dbo.sp_Bunkai_Delete обновлена (поддержка admin и moderator).';
GO

-- 4. Обновление процедуры dbo.sp_Admin_DeleteUser:
-- Модератор может удалять пользователей, но не может удалить администратора или себя
CREATE OR ALTER PROCEDURE dbo.sp_Admin_DeleteUser
    @UserId INT,
    @ActorUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF @UserId = @ActorUserId
        THROW 50000, N'ERR|400|SELF_DELETE|Нельзя удалить самого себя', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE User_ID = @UserId)
        THROW 50000, N'ERR|404|USER_NOT_FOUND|Пользователь не найден', 1;

    DECLARE @actorRole NVARCHAR(50);
    DECLARE @targetRole NVARCHAR(50);

    SELECT @actorRole = r.Role_Name
    FROM dbo.Users u
    JOIN dbo.Roles r ON u.Role_ID = r.Role_ID
    WHERE u.User_ID = @ActorUserId;

    SELECT @targetRole = r.Role_Name
    FROM dbo.Users u
    JOIN dbo.Roles r ON u.Role_ID = r.Role_ID
    WHERE u.User_ID = @UserId;

    IF @actorRole = N'moderator' AND @targetRole = N'admin'
        THROW 50000, N'ERR|403|FORBIDDEN|Модератор не имеет прав на удаление администратора', 1;

    BEGIN TRY
        DELETE FROM dbo.Users WHERE User_ID = @UserId;
    END TRY
    BEGIN CATCH
        IF ERROR_NUMBER() = 547
            THROW 50000, N'ERR|409|USER_HAS_CONTENT|С аккаунтом связаны материалы — сначала удалите или передайте их', 1;
        THROW;
    END CATCH
END
GO
PRINT N'Процедура dbo.sp_Admin_DeleteUser обновлена (поддержка безопасного удаления модератором).';
GO
