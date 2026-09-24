/* =====================================================================
   Bunkai Explorer — хранимые процедуры и функции (T-SQL)
   Накатывается ПОСЛЕ schema.sql:
     sqlcmd -S localhost -U sa -P "YourStrong!Passw0rd" -d bunkai_explorer -i procedures.sql
   Node.js-сервис ими не пользуется напрямую (вся бизнес-логика — в
   server/src/services), но они полезны для прямых отчётов/обслуживания
   базы и как демонстрация серверной логики на уровне СУБД.
   ===================================================================== */

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- ---------------------------------------------------------------------
-- ufn_YoutubeVideoId: извлекает videoId из ссылки на YouTube
-- (watch?v=, youtu.be/, embed/, shorts/). Возвращает NULL, если не распознано.
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.ufn_YoutubeVideoId', 'FN') IS NOT NULL DROP FUNCTION dbo.ufn_YoutubeVideoId;
GO
CREATE FUNCTION dbo.ufn_YoutubeVideoId (@Url NVARCHAR(500))
RETURNS NVARCHAR(20)
AS
BEGIN
    DECLARE @Id NVARCHAR(20) = NULL;
    DECLARE @Pos INT;

    IF @Url IS NULL RETURN NULL;

    IF CHARINDEX('youtu.be/', @Url) > 0
    BEGIN
        SET @Pos = CHARINDEX('youtu.be/', @Url) + LEN('youtu.be/');
        SET @Id = SUBSTRING(@Url, @Pos, 20);
    END
    ELSE IF CHARINDEX('v=', @Url) > 0
    BEGIN
        SET @Pos = CHARINDEX('v=', @Url) + 2;
        SET @Id = SUBSTRING(@Url, @Pos, 20);
    END
    ELSE IF CHARINDEX('embed/', @Url) > 0
    BEGIN
        SET @Pos = CHARINDEX('embed/', @Url) + LEN('embed/');
        SET @Id = SUBSTRING(@Url, @Pos, 20);
    END
    ELSE IF CHARINDEX('shorts/', @Url) > 0
    BEGIN
        SET @Pos = CHARINDEX('shorts/', @Url) + LEN('shorts/');
        SET @Id = SUBSTRING(@Url, @Pos, 20);
    END
    ELSE
        RETURN NULL;

    -- Отрезаем всё, что после видео-ID (& или ?), если есть
    IF CHARINDEX('&', @Id) > 0 SET @Id = LEFT(@Id, CHARINDEX('&', @Id) - 1);
    IF CHARINDEX('?', @Id) > 0 SET @Id = LEFT(@Id, CHARINDEX('?', @Id) - 1);

    RETURN @Id;
END;
GO

-- ---------------------------------------------------------------------
-- ufn_YoutubeThumbnailUrl: строит URL превью по videoId
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.ufn_YoutubeThumbnailUrl', 'FN') IS NOT NULL DROP FUNCTION dbo.ufn_YoutubeThumbnailUrl;
GO
CREATE FUNCTION dbo.ufn_YoutubeThumbnailUrl (@VideoId NVARCHAR(20))
RETURNS NVARCHAR(200)
AS
BEGIN
    IF @VideoId IS NULL RETURN NULL;
    RETURN 'https://img.youtube.com/vi/' + @VideoId + '/maxresdefault.jpg';
END;
GO

-- ---------------------------------------------------------------------
-- usp_RecalculateBunkaiRating: пересчитывает rating бункай как сумму голосов
-- (та же логика, что в bunkaiService.vote на уровне Node, но полезна для
-- разовой сверки/восстановления данных).
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.usp_RecalculateBunkaiRating', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_RecalculateBunkaiRating;
GO
CREATE PROCEDURE dbo.usp_RecalculateBunkaiRating
    @BunkaiId INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Sum INT;
    SELECT @Sum = COALESCE(SUM(value), 0) FROM dbo.Votes WHERE bunkaiId = @BunkaiId;
    UPDATE dbo.Bunkai SET rating = @Sum, updatedAt = SYSUTCDATETIME() WHERE id = @BunkaiId;
END;
GO

-- ---------------------------------------------------------------------
-- usp_RecalculateAllRatings: пересчитывает rating для всех бункай сразу
-- (обслуживание базы, например после ручных правок в Votes).
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.usp_RecalculateAllRatings', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_RecalculateAllRatings;
GO
CREATE PROCEDURE dbo.usp_RecalculateAllRatings
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE b
    SET b.rating = agg.total, b.updatedAt = SYSUTCDATETIME()
    FROM dbo.Bunkai b
    OUTER APPLY (
        SELECT COALESCE(SUM(v.value), 0) AS total
        FROM dbo.Votes v
        WHERE v.bunkaiId = b.id
    ) agg;
END;
GO

-- ---------------------------------------------------------------------
-- usp_ModerateBunkai: одобрить/отклонить бункай + запись в audit log одним вызовом
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.usp_ModerateBunkai', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_ModerateBunkai;
GO
CREATE PROCEDURE dbo.usp_ModerateBunkai
    @BunkaiId INT,
    @Status   NVARCHAR(20),   -- 'approved' | 'rejected'
    @ActorId  INT
AS
BEGIN
    SET NOCOUNT ON;
    IF @Status NOT IN ('approved', 'rejected', 'pending')
    BEGIN
        RAISERROR('Недопустимый статус бункай: %s', 16, 1, @Status);
        RETURN;
    END

    UPDATE dbo.Bunkai SET status = @Status, updatedAt = SYSUTCDATETIME() WHERE id = @BunkaiId;

    INSERT INTO dbo.AuditLogs (actorId, action, targetType, targetId, details, createdAt, updatedAt)
    VALUES (@ActorId, 'bunkai.moderate', 'Bunkai', @BunkaiId,
            '{"status":"' + @Status + '"}', SYSUTCDATETIME(), SYSUTCDATETIME());
END;
GO

-- ---------------------------------------------------------------------
-- usp_SetUserRole: смена роли пользователя + audit log
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.usp_SetUserRole', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_SetUserRole;
GO
CREATE PROCEDURE dbo.usp_SetUserRole
    @UserId  INT,
    @Role    NVARCHAR(20),   -- 'user' | 'moderator' | 'admin'
    @ActorId INT
AS
BEGIN
    SET NOCOUNT ON;
    IF @Role NOT IN ('user', 'moderator', 'admin')
    BEGIN
        RAISERROR('Недопустимая роль: %s', 16, 1, @Role);
        RETURN;
    END

    UPDATE dbo.Users SET role = @Role, updatedAt = SYSUTCDATETIME() WHERE id = @UserId;

    INSERT INTO dbo.AuditLogs (actorId, action, targetType, targetId, details, createdAt, updatedAt)
    VALUES (@ActorId, 'user.role.update', 'User', @UserId,
            '{"role":"' + @Role + '"}', SYSUTCDATETIME(), SYSUTCDATETIME());
END;
GO

-- ---------------------------------------------------------------------
-- usp_SetUserBan: бан/разбан пользователя + audit log
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.usp_SetUserBan', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_SetUserBan;
GO
CREATE PROCEDURE dbo.usp_SetUserBan
    @UserId   INT,
    @IsBanned BIT,
    @ActorId  INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Users SET isBanned = @IsBanned, updatedAt = SYSUTCDATETIME() WHERE id = @UserId;

    INSERT INTO dbo.AuditLogs (actorId, action, targetType, targetId, details, createdAt, updatedAt)
    VALUES (@ActorId, 'user.ban.update', 'User', @UserId,
            '{"isBanned":' + CASE WHEN @IsBanned = 1 THEN 'true' ELSE 'false' END + '}',
            SYSUTCDATETIME(), SYSUTCDATETIME());
END;
GO

-- ---------------------------------------------------------------------
-- usp_GetAdminStats: агрегированная статистика для дашборда админки
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.usp_GetAdminStats', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_GetAdminStats;
GO
CREATE PROCEDURE dbo.usp_GetAdminStats
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        (SELECT COUNT(*) FROM dbo.Users)                                   AS usersCount,
        (SELECT COUNT(*) FROM dbo.Kata)                                    AS kataCount,
        (SELECT COUNT(*) FROM dbo.Bunkai)                                  AS bunkaiCount,
        (SELECT COUNT(*) FROM dbo.Comments)                                AS commentsCount,
        (SELECT COUNT(*) FROM dbo.Bunkai WHERE status = 'pending')         AS pendingCount,
        (SELECT COUNT(*) FROM dbo.Bunkai WHERE createdAt >= DATEADD(DAY, -14, SYSUTCDATETIME())) AS newBunkaiLast14Days;
END;
GO

-- ---------------------------------------------------------------------
-- usp_GetKataTree: дерево ката → последовательности → движения → одобренные
-- бункай одним вызовом, в виде JSON (удобно для быстрых интеграций/отчётов).
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.usp_GetKataTree', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_GetKataTree;
GO
CREATE PROCEDURE dbo.usp_GetKataTree
    @KataId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        k.id, k.name, k.nameJp, k.style, k.kyuLevel, k.description, k.history,
        k.youtubeUrl, k.thumbnailUrl,
        (
            SELECT s.id, s.[order], s.name, s.startTime, s.endTime,
                (
                    SELECT m.id, m.[order], m.name, m.nameJp, m.stance, m.direction,
                           m.youtubeUrl, m.startTime,
                        (
                            SELECT b.id, b.title, b.description, b.difficulty, b.rating
                            FROM dbo.Bunkai b
                            WHERE b.movementId = m.id AND b.status = 'approved'
                            FOR JSON PATH
                        ) AS bunkaiList
                    FROM dbo.Movements m
                    WHERE m.sequenceId = s.id
                    ORDER BY m.[order]
                    FOR JSON PATH
                ) AS movements
            FROM dbo.Sequences s
            WHERE s.kataId = k.id
            ORDER BY s.[order]
            FOR JSON PATH
        ) AS sequences
    FROM dbo.Kata k
    WHERE k.id = @KataId
    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
END;
GO

-- ---------------------------------------------------------------------
-- Триггеры: автоматическое обновление updatedAt при прямом UPDATE через SQL
-- (Sequelize делает это сам на уровне ORM; триггеры подстраховывают на
-- случай ручных изменений/скриптов, идущих в обход Node-приложения).
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.trg_Users_UpdatedAt', 'TR') IS NOT NULL DROP TRIGGER dbo.trg_Users_UpdatedAt;
GO
CREATE TRIGGER dbo.trg_Users_UpdatedAt ON dbo.Users
AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    UPDATE u SET updatedAt = SYSUTCDATETIME()
    FROM dbo.Users u INNER JOIN inserted i ON u.id = i.id;
END;
GO

IF OBJECT_ID('dbo.trg_Bunkai_UpdatedAt', 'TR') IS NOT NULL DROP TRIGGER dbo.trg_Bunkai_UpdatedAt;
GO
CREATE TRIGGER dbo.trg_Bunkai_UpdatedAt ON dbo.Bunkai
AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    UPDATE b SET updatedAt = SYSUTCDATETIME()
    FROM dbo.Bunkai b INNER JOIN inserted i ON b.id = i.id;
END;
GO

PRINT 'Процедуры, функции и триггеры Bunkai Explorer успешно созданы.';
GO
