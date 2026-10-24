-- ============================================================
-- Bunkai Explorer — хранимые процедуры и функции (Microsoft SQL Server)
-- ============================================================
-- Запуск (после schema.sql и triggers.sql):
--   sqlcmd -S <server> -d <db> -i procedures.sql
-- Или:  npm run migrate   (из /server — применит все три файла)
--
-- Принцип: вся бизнес-логика доступа к данным (видимость по ролям,
-- проверка владения, модерация, защита от дублей и т.д.) находится
-- здесь. Node.js-код НЕ строит SQL самостоятельно — только вызывает
-- эти процедуры/функции с параметрами (EXEC dbo.sp_Xxx @p = :p).
--
-- Соглашение об ошибках:
--   Процедуры сигнализируют ожидаемые бизнес-ошибки через
--     THROW 50000, N'ERR|<HTTP_STATUS>|<CODE>|<Сообщение на русском>', 1;
--   Слой доступа к данным в Node.js (server/src/db/execProc.js)
--   разбирает эту строку и превращает её в ApiError с нужным
--   HTTP-статусом, кодом и сообщением. Любая другая ошибка SQL
--   (нарушение ограничений, обрыв соединения и т.д.) пробрасывается
--   как внутренняя ошибка 500.
-- ============================================================

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- ============================================================
-- ФУНКЦИИ
-- ============================================================

-- Являются ли два пользователя друзьями (связь хранится в обе стороны)
CREATE OR ALTER FUNCTION dbo.fn_IsFriend(@UserId1 INT, @UserId2 INT)
RETURNS BIT
AS
BEGIN
    DECLARE @result BIT = 0;
    IF EXISTS (SELECT 1 FROM dbo.Friends WHERE User_ID = @UserId1 AND Friend_User_ID = @UserId2)
        SET @result = 1;
    RETURN @result;
END
GO

-- Может ли пользователь читать/писать в комнату чата
-- (публичные комнаты — всем авторизованным; приватные — только участникам)
CREATE OR ALTER FUNCTION dbo.fn_CanAccessChatRoom(@RoomId INT, @UserId INT)
RETURNS BIT
AS
BEGIN
    DECLARE @result BIT = 0;
    DECLARE @roomType NVARCHAR(20);

    SELECT @roomType = Room_Type FROM dbo.ChatRooms WHERE ChatRoom_ID = @RoomId;

    IF @roomType IS NULL
        RETURN 0;

    IF @roomType <> N'private'
        SET @result = 1;
    ELSE IF EXISTS (SELECT 1 FROM dbo.PrivateChatParticipants WHERE ChatRoom_ID = @RoomId AND User_ID = @UserId)
        SET @result = 1;

    RETURN @result;
END
GO

-- Название роли по Role_ID (используется внутри процедур для проверок)
CREATE OR ALTER FUNCTION dbo.fn_RoleName(@RoleId INT)
RETURNS NVARCHAR(50)
AS
BEGIN
    RETURN (SELECT Role_Name FROM dbo.Roles WHERE Role_ID = @RoleId);
END
GO

-- ============================================================
-- ПРОЦЕДУРЫ — АВТОРИЗАЦИЯ / ПРОФИЛЬ
-- ============================================================

-- Регистрация: всегда роль 'user' (раздел 3 ТЗ — роль никогда не приходит извне)
CREATE OR ALTER PROCEDURE dbo.sp_Auth_Register
    @Username NVARCHAR(100),
    @Email NVARCHAR(255),
    @PasswordHash NVARCHAR(255),
    @DisplayName NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM dbo.Users WHERE Username = @Username)
        THROW 50000, N'ERR|409|USERNAME_TAKEN|Пользователь с таким именем уже существует', 1;

    IF EXISTS (SELECT 1 FROM dbo.Users WHERE Email = @Email)
        THROW 50000, N'ERR|409|EMAIL_TAKEN|Пользователь с таким email уже существует', 1;

    DECLARE @roleId INT = (SELECT Role_ID FROM dbo.Roles WHERE Role_Name = N'user');
    IF @roleId IS NULL
        THROW 50000, N'ERR|500|ROLE_MISSING|Роль "user" не настроена в базе данных', 1;

    DECLARE @newId INT;

    INSERT INTO dbo.Users (Role_ID, Username, Email, Password_Hash, Display_Name)
    VALUES (@roleId, @Username, @Email, @PasswordHash, ISNULL(NULLIF(@DisplayName, N''), @Username));

    SET @newId = SCOPE_IDENTITY();

    SELECT u.*, r.Role_Name
    FROM dbo.Users u
    JOIN dbo.Roles r ON r.Role_ID = u.Role_ID
    WHERE u.User_ID = @newId;
END
GO

-- Получить пользователя по логину (включая Password_Hash — только для внутренней проверки пароля)
CREATE OR ALTER PROCEDURE dbo.sp_Auth_GetByUsername
    @Username NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT u.*, r.Role_Name
    FROM dbo.Users u
    JOIN dbo.Roles r ON r.Role_ID = u.Role_ID
    WHERE u.Username = @Username;
END
GO

-- Получить пользователя по ID (включая Password_Hash — только для внутренней проверки пароля)
CREATE OR ALTER PROCEDURE dbo.sp_Auth_GetById
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT u.*, r.Role_Name
    FROM dbo.Users u
    JOIN dbo.Roles r ON r.Role_ID = u.Role_ID
    WHERE u.User_ID = @UserId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Auth_UpdateProfile
    @UserId INT,
    @DisplayName NVARCHAR(100) = NULL,
    @Bio NVARCHAR(MAX) = NULL,
    @AvatarUrl NVARCHAR(500) = NULL,
    @SetDisplayName BIT = 0,
    @SetBio BIT = 0,
    @SetAvatarUrl BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE User_ID = @UserId)
        THROW 50000, N'ERR|404|USER_NOT_FOUND|Пользователь не найден', 1;

    UPDATE dbo.Users
    SET
        Display_Name = CASE WHEN @SetDisplayName = 1 THEN @DisplayName ELSE Display_Name END,
        Bio          = CASE WHEN @SetBio = 1 THEN @Bio ELSE Bio END,
        Avatar_URL   = CASE WHEN @SetAvatarUrl = 1 THEN @AvatarUrl ELSE Avatar_URL END,
        Updated_At   = SYSUTCDATETIME()
    WHERE User_ID = @UserId;

    SELECT u.*, r.Role_Name
    FROM dbo.Users u
    JOIN dbo.Roles r ON r.Role_ID = u.Role_ID
    WHERE u.User_ID = @UserId;
END
GO

-- Удаление собственного аккаунта. Если с пользователем связаны материалы
-- (ката/бункаи/сообщения и т.д.), внешние ключи намеренно НЕ каскадные —
-- честно сообщаем об этом, а не имитируем успех.
CREATE OR ALTER PROCEDURE dbo.sp_Auth_DeleteAccount
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE User_ID = @UserId)
        THROW 50000, N'ERR|404|USER_NOT_FOUND|Пользователь не найден', 1;

    BEGIN TRY
        DELETE FROM dbo.Users WHERE User_ID = @UserId;
    END TRY
    BEGIN CATCH
        IF ERROR_NUMBER() = 547 -- нарушение внешнего ключа
            THROW 50000, N'ERR|409|USER_HAS_CONTENT|С аккаунтом связаны материалы (ката, бункаи, сообщения и т.д.) — сначала удалите или передайте их', 1;
        THROW;
    END CATCH
END
GO

-- ============================================================
-- ПРОЦЕДУРЫ — КАТА
-- ============================================================

CREATE OR ALTER PROCEDURE dbo.sp_Kata_List
    @UserId INT,
    @UserRole NVARCHAR(20),
    @Search NVARCHAR(200) = NULL,
    @Difficulty NVARCHAR(20) = NULL,
    @Style NVARCHAR(100) = NULL,
    @Status NVARCHAR(20) = NULL,
    @Sort NVARCHAR(20) = N'newest',
    @Offset INT = 0,
    @Limit INT = 12
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        k.Kata_ID, k.Author_ID, k.Title, k.Description, k.Difficulty, k.Style,
        k.Video_URL, k.Thumbnail_URL, k.Status, k.Created_At, k.Updated_At,
        u.Username AS Author_Username, u.Display_Name AS Author_Display_Name, u.Avatar_URL AS Author_Avatar_URL,
        COUNT(*) OVER () AS Total_Count
    FROM dbo.Kata k
    JOIN dbo.Users u ON u.User_ID = k.Author_ID
    WHERE
        (
            @UserRole = N'admin'
            OR k.Status = N'approved'
            OR k.Author_ID = @UserId
        )
        AND (@UserRole <> N'admin' OR @Status IS NULL OR k.Status = @Status)
        AND (@Search IS NULL OR @Search = N'' OR k.Title LIKE N'%' + @Search + N'%')
        AND (@Difficulty IS NULL OR k.Difficulty = @Difficulty)
        AND (@Style IS NULL OR @Style = N'' OR k.Style = @Style)
    ORDER BY
        CASE WHEN @Sort = N'oldest' THEN k.Created_At END ASC,
        CASE WHEN @Sort = N'title' THEN k.Title END ASC,
        CASE WHEN @Sort = N'difficulty' THEN k.Difficulty END ASC,
        CASE WHEN @Sort = N'newest' OR @Sort IS NULL THEN k.Created_At END DESC,
        k.Kata_ID DESC
    OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Kata_GetById
    @KataId INT,
    @UserId INT,
    @UserRole NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @status NVARCHAR(20), @authorId INT;
    SELECT @status = Status, @authorId = Author_ID FROM dbo.Kata WHERE Kata_ID = @KataId;

    IF @status IS NULL
        THROW 50000, N'ERR|404|KATA_NOT_FOUND|Ката не найдено', 1;

    IF @status <> N'approved' AND @authorId <> @UserId AND @UserRole <> N'admin'
        THROW 50000, N'ERR|404|KATA_NOT_FOUND|Ката не найдено', 1;

    SELECT
        k.Kata_ID, k.Author_ID, k.Title, k.Description, k.Difficulty, k.Style,
        k.Video_URL, k.Thumbnail_URL, k.Status, k.Created_At, k.Updated_At,
        u.Username AS Author_Username, u.Display_Name AS Author_Display_Name, u.Avatar_URL AS Author_Avatar_URL
    FROM dbo.Kata k
    JOIN dbo.Users u ON u.User_ID = k.Author_ID
    WHERE k.Kata_ID = @KataId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_KataStep_ListByKata
    @KataId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        s.Step_ID, s.Kata_ID, s.Step_Number, s.Title, s.Description, s.Technique,
        s.Direction, s.Duration, s.Image_URL, s.Video_URL,
        s.Clip_ID, c.Clip_Name, s.Stance_In, s.Stance_Out,
        s.Root_Displacement_X, s.Root_Displacement_Z, s.Root_Rotation_Y
    FROM dbo.KataSteps s
    LEFT JOIN dbo.AnimationClips c ON c.Clip_ID = s.Clip_ID
    WHERE s.Kata_ID = @KataId
    ORDER BY s.Step_Number ASC;
END
GO

-- Одобренные бункаи, связанные с ката (показываем в карточке ката всем)
CREATE OR ALTER PROCEDURE dbo.sp_Bunkai_ListByKataApproved
    @KataId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT Bunkai_ID, Title FROM dbo.Bunkai WHERE Kata_ID = @KataId AND Status = N'approved' ORDER BY Title;
END
GO

-- Создаёт ката + (опционально) шаги из JSON + чат-комнату ката — одной транзакцией
CREATE OR ALTER PROCEDURE dbo.sp_Kata_Create
    @AuthorId INT,
    @Title NVARCHAR(200),
    @Description NVARCHAR(MAX) = NULL,
    @Difficulty NVARCHAR(20) = N'beginner',
    @Style NVARCHAR(100) = NULL,
    @VideoUrl NVARCHAR(500) = NULL,
    @ThumbnailUrl NVARCHAR(500) = NULL,
    @StepsJson NVARCHAR(MAX) = N'[]'
AS
BEGIN
    SET NOCOUNT ON;

    IF @Title IS NULL OR LTRIM(RTRIM(@Title)) = N''
        THROW 50000, N'ERR|400|VALIDATION_ERROR|Название обязательно', 1;

    DECLARE @newId INT;

    BEGIN TRANSACTION;

    INSERT INTO dbo.Kata (Author_ID, Title, Description, Difficulty, Style, Video_URL, Thumbnail_URL, Status)
    VALUES (@AuthorId, @Title, @Description, ISNULL(@Difficulty, N'beginner'), @Style, @VideoUrl, @ThumbnailUrl, N'pending');

    SET @newId = SCOPE_IDENTITY();

    INSERT INTO dbo.KataSteps (Kata_ID, Step_Number, Title, Description, Technique, Direction, Duration, Image_URL, Video_URL)
    SELECT
        @newId,
        ISNULL(j.StepNumber, ROW_NUMBER() OVER (ORDER BY (SELECT NULL))),
        j.Title, j.Description, j.Technique, j.Direction, j.Duration, j.ImageUrl, j.VideoUrl
    FROM OPENJSON(ISNULL(@StepsJson, N'[]')) WITH (
        StepNumber INT '$.stepNumber',
        Title NVARCHAR(200) '$.title',
        Description NVARCHAR(MAX) '$.description',
        Technique NVARCHAR(200) '$.technique',
        Direction NVARCHAR(50) '$.direction',
        Duration INT '$.duration',
        ImageUrl NVARCHAR(500) '$.imageUrl',
        VideoUrl NVARCHAR(500) '$.videoUrl'
    ) j;

    COMMIT TRANSACTION;

    SELECT Kata_ID FROM dbo.Kata WHERE Kata_ID = @newId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Kata_Update
    @KataId INT,
    @UserId INT,
    @UserRole NVARCHAR(20),
    @Title NVARCHAR(200) = NULL,
    @Description NVARCHAR(MAX) = NULL,
    @Difficulty NVARCHAR(20) = NULL,
    @Style NVARCHAR(100) = NULL,
    @VideoUrl NVARCHAR(500) = NULL,
    @ThumbnailUrl NVARCHAR(500) = NULL,
    @StepsJson NVARCHAR(MAX) = NULL, -- NULL = не трогать шаги, иначе — полная замена
    @SetTitle BIT = 0, @SetDescription BIT = 0, @SetDifficulty BIT = 0,
    @SetStyle BIT = 0, @SetVideoUrl BIT = 0, @SetThumbnailUrl BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @authorId INT, @status NVARCHAR(20);
    SELECT @authorId = Author_ID, @status = Status FROM dbo.Kata WHERE Kata_ID = @KataId;

    IF @authorId IS NULL
        THROW 50000, N'ERR|404|KATA_NOT_FOUND|Ката не найдено', 1;

    DECLARE @isOwner BIT = CASE WHEN @authorId = @UserId THEN 1 ELSE 0 END;
    IF @isOwner = 0 AND @UserRole <> N'admin'
        THROW 50000, N'ERR|403|FORBIDDEN|Недостаточно прав', 1;

    BEGIN TRANSACTION;

    UPDATE dbo.Kata
    SET
        Title         = CASE WHEN @SetTitle = 1 THEN @Title ELSE Title END,
        Description   = CASE WHEN @SetDescription = 1 THEN @Description ELSE Description END,
        Difficulty    = CASE WHEN @SetDifficulty = 1 THEN @Difficulty ELSE Difficulty END,
        Style         = CASE WHEN @SetStyle = 1 THEN @Style ELSE Style END,
        Video_URL     = CASE WHEN @SetVideoUrl = 1 THEN @VideoUrl ELSE Video_URL END,
        Thumbnail_URL = CASE WHEN @SetThumbnailUrl = 1 THEN @ThumbnailUrl ELSE Thumbnail_URL END,
        -- правки обычного пользователя отправляют материал на повторную модерацию
        Status        = CASE WHEN @isOwner = 1 AND @UserRole <> N'admin' THEN N'pending' ELSE Status END,
        Updated_At    = SYSUTCDATETIME()
    WHERE Kata_ID = @KataId;

    IF @StepsJson IS NOT NULL
    BEGIN
        DELETE FROM dbo.KataSteps WHERE Kata_ID = @KataId;

        INSERT INTO dbo.KataSteps (Kata_ID, Step_Number, Title, Description, Technique, Direction, Duration, Image_URL, Video_URL)
        SELECT
            @KataId,
            ISNULL(j.StepNumber, ROW_NUMBER() OVER (ORDER BY (SELECT NULL))),
            j.Title, j.Description, j.Technique, j.Direction, j.Duration, j.ImageUrl, j.VideoUrl
        FROM OPENJSON(@StepsJson) WITH (
            StepNumber INT '$.stepNumber',
            Title NVARCHAR(200) '$.title',
            Description NVARCHAR(MAX) '$.description',
            Technique NVARCHAR(200) '$.technique',
            Direction NVARCHAR(50) '$.direction',
            Duration INT '$.duration',
            ImageUrl NVARCHAR(500) '$.imageUrl',
            VideoUrl NVARCHAR(500) '$.videoUrl'
        ) j;
    END

    COMMIT TRANSACTION;

    SELECT Kata_ID FROM dbo.Kata WHERE Kata_ID = @KataId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Kata_Delete
    @KataId INT,
    @UserId INT,
    @UserRole NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @authorId INT;
    SELECT @authorId = Author_ID FROM dbo.Kata WHERE Kata_ID = @KataId;

    IF @authorId IS NULL
        THROW 50000, N'ERR|404|KATA_NOT_FOUND|Ката не найдено', 1;

    IF @authorId <> @UserId AND @UserRole <> N'admin'
        THROW 50000, N'ERR|403|FORBIDDEN|Недостаточно прав', 1;

    DELETE FROM dbo.Kata WHERE Kata_ID = @KataId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Kata_SetStatus
    @KataId INT,
    @Status NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Kata WHERE Kata_ID = @KataId)
        THROW 50000, N'ERR|404|KATA_NOT_FOUND|Ката не найдено', 1;

    UPDATE dbo.Kata SET Status = @Status, Updated_At = SYSUTCDATETIME() WHERE Kata_ID = @KataId;

    SELECT Kata_ID FROM dbo.Kata WHERE Kata_ID = @KataId;
END
GO

-- ============================================================
-- ПРОЦЕДУРЫ — БУНКАИ
-- ============================================================

CREATE OR ALTER PROCEDURE dbo.sp_Bunkai_List
    @UserId INT,
    @UserRole NVARCHAR(20),
    @Search NVARCHAR(200) = NULL,
    @KataId INT = NULL,
    @Difficulty NVARCHAR(20) = NULL,
    @Status NVARCHAR(20) = NULL,
    @Sort NVARCHAR(20) = N'newest',
    @Offset INT = 0,
    @Limit INT = 12
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        b.Bunkai_ID, b.Author_ID, b.Kata_ID, b.Title, b.Description, b.Application, b.Difficulty,
        b.Video_URL, b.Thumbnail_URL, b.Status, b.Created_At, b.Updated_At,
        u.Username AS Author_Username, u.Display_Name AS Author_Display_Name, u.Avatar_URL AS Author_Avatar_URL,
        k.Title AS Kata_Title,
        COUNT(*) OVER () AS Total_Count
    FROM dbo.Bunkai b
    JOIN dbo.Users u ON u.User_ID = b.Author_ID
    JOIN dbo.Kata k ON k.Kata_ID = b.Kata_ID
    WHERE
        (
            @UserRole = N'admin'
            OR b.Status = N'approved'
            OR b.Author_ID = @UserId
        )
        AND (@UserRole <> N'admin' OR @Status IS NULL OR b.Status = @Status)
        AND (@Search IS NULL OR @Search = N'' OR b.Title LIKE N'%' + @Search + N'%')
        AND (@KataId IS NULL OR b.Kata_ID = @KataId)
        AND (@Difficulty IS NULL OR b.Difficulty = @Difficulty)
    ORDER BY
        CASE WHEN @Sort = N'oldest' THEN b.Created_At END ASC,
        CASE WHEN @Sort = N'title' THEN b.Title END ASC,
        CASE WHEN @Sort = N'newest' OR @Sort IS NULL THEN b.Created_At END DESC,
        b.Bunkai_ID DESC
    OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Bunkai_GetById
    @BunkaiId INT,
    @UserId INT,
    @UserRole NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @status NVARCHAR(20), @authorId INT;
    SELECT @status = Status, @authorId = Author_ID FROM dbo.Bunkai WHERE Bunkai_ID = @BunkaiId;

    IF @status IS NULL
        THROW 50000, N'ERR|404|BUNKAI_NOT_FOUND|Бункай не найден', 1;

    IF @status <> N'approved' AND @authorId <> @UserId AND @UserRole <> N'admin'
        THROW 50000, N'ERR|404|BUNKAI_NOT_FOUND|Бункай не найден', 1;

    SELECT
        b.Bunkai_ID, b.Author_ID, b.Kata_ID, b.Title, b.Description, b.Application, b.Difficulty,
        b.Video_URL, b.Thumbnail_URL, b.Status, b.Created_At, b.Updated_At,
        u.Username AS Author_Username, u.Display_Name AS Author_Display_Name, u.Avatar_URL AS Author_Avatar_URL,
        k.Title AS Kata_Title, k.Status AS Kata_Status
    FROM dbo.Bunkai b
    JOIN dbo.Users u ON u.User_ID = b.Author_ID
    JOIN dbo.Kata k ON k.Kata_ID = b.Kata_ID
    WHERE b.Bunkai_ID = @BunkaiId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Bunkai_Create
    @AuthorId INT,
    @KataId INT,
    @Title NVARCHAR(200),
    @Description NVARCHAR(MAX) = NULL,
    @Application NVARCHAR(MAX) = NULL,
    @Difficulty NVARCHAR(20) = N'beginner',
    @VideoUrl NVARCHAR(500) = NULL,
    @ThumbnailUrl NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @Title IS NULL OR LTRIM(RTRIM(@Title)) = N''
        THROW 50000, N'ERR|400|VALIDATION_ERROR|Название обязательно', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.Kata WHERE Kata_ID = @KataId)
        THROW 50000, N'ERR|400|KATA_NOT_FOUND|Указанное ката не существует', 1;

    DECLARE @newId INT;

    BEGIN TRANSACTION;

    INSERT INTO dbo.Bunkai (Author_ID, Kata_ID, Title, Description, Application, Difficulty, Video_URL, Thumbnail_URL, Status)
    VALUES (@AuthorId, @KataId, @Title, @Description, @Application, ISNULL(@Difficulty, N'beginner'), @VideoUrl, @ThumbnailUrl, N'pending');

    SET @newId = SCOPE_IDENTITY();

    COMMIT TRANSACTION;

    SELECT Bunkai_ID FROM dbo.Bunkai WHERE Bunkai_ID = @newId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Bunkai_Update
    @BunkaiId INT,
    @UserId INT,
    @UserRole NVARCHAR(20),
    @Title NVARCHAR(200) = NULL,
    @Description NVARCHAR(MAX) = NULL,
    @Application NVARCHAR(MAX) = NULL,
    @Difficulty NVARCHAR(20) = NULL,
    @VideoUrl NVARCHAR(500) = NULL,
    @ThumbnailUrl NVARCHAR(500) = NULL,
    @SetTitle BIT = 0, @SetDescription BIT = 0, @SetApplication BIT = 0,
    @SetDifficulty BIT = 0, @SetVideoUrl BIT = 0, @SetThumbnailUrl BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @authorId INT;
    SELECT @authorId = Author_ID FROM dbo.Bunkai WHERE Bunkai_ID = @BunkaiId;

    IF @authorId IS NULL
        THROW 50000, N'ERR|404|BUNKAI_NOT_FOUND|Бункай не найден', 1;

    DECLARE @isOwner BIT = CASE WHEN @authorId = @UserId THEN 1 ELSE 0 END;
    IF @isOwner = 0 AND @UserRole <> N'admin'
        THROW 50000, N'ERR|403|FORBIDDEN|Недостаточно прав', 1;

    UPDATE dbo.Bunkai
    SET
        Title         = CASE WHEN @SetTitle = 1 THEN @Title ELSE Title END,
        Description   = CASE WHEN @SetDescription = 1 THEN @Description ELSE Description END,
        Application   = CASE WHEN @SetApplication = 1 THEN @Application ELSE Application END,
        Difficulty    = CASE WHEN @SetDifficulty = 1 THEN @Difficulty ELSE Difficulty END,
        Video_URL     = CASE WHEN @SetVideoUrl = 1 THEN @VideoUrl ELSE Video_URL END,
        Thumbnail_URL = CASE WHEN @SetThumbnailUrl = 1 THEN @ThumbnailUrl ELSE Thumbnail_URL END,
        Status        = CASE WHEN @isOwner = 1 AND @UserRole <> N'admin' THEN N'pending' ELSE Status END,
        Updated_At    = SYSUTCDATETIME()
    WHERE Bunkai_ID = @BunkaiId;

    SELECT Bunkai_ID FROM dbo.Bunkai WHERE Bunkai_ID = @BunkaiId;
END
GO

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

    IF @authorId <> @UserId AND @UserRole NOT IN (N'admin', N'moderator')
        THROW 50000, N'ERR|403|FORBIDDEN|Недостаточно прав', 1;

    DELETE FROM dbo.Bunkai WHERE Bunkai_ID = @BunkaiId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Bunkai_SetStatus
    @BunkaiId INT,
    @Status NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Bunkai WHERE Bunkai_ID = @BunkaiId)
        THROW 50000, N'ERR|404|BUNKAI_NOT_FOUND|Бункай не найден', 1;

    UPDATE dbo.Bunkai SET Status = @Status, Updated_At = SYSUTCDATETIME() WHERE Bunkai_ID = @BunkaiId;

    SELECT Bunkai_ID FROM dbo.Bunkai WHERE Bunkai_ID = @BunkaiId;
END
GO

-- ============================================================
-- ПРОЦЕДУРЫ — КОММЕНТАРИИ
-- ============================================================

CREATE OR ALTER PROCEDURE dbo.sp_Comment_List
    @KataId INT = NULL,
    @BunkaiId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @KataId IS NULL AND @BunkaiId IS NULL
        THROW 50000, N'ERR|400|VALIDATION_ERROR|Укажите kataId или bunkaiId', 1;

    SELECT
        c.Comment_ID, c.User_ID, c.Kata_ID, c.Bunkai_ID, c.Text, c.Created_At, c.Updated_At,
        u.Username AS Author_Username, u.Display_Name AS Author_Display_Name, u.Avatar_URL AS Author_Avatar_URL
    FROM dbo.Comments c
    JOIN dbo.Users u ON u.User_ID = c.User_ID
    WHERE (@KataId IS NOT NULL AND c.Kata_ID = @KataId) OR (@BunkaiId IS NOT NULL AND c.Bunkai_ID = @BunkaiId)
    ORDER BY c.Created_At ASC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Comment_Create
    @UserId INT,
    @KataId INT = NULL,
    @BunkaiId INT = NULL,
    @Text NVARCHAR(2000)
AS
BEGIN
    SET NOCOUNT ON;

    SET @Text = LTRIM(RTRIM(ISNULL(@Text, N'')));
    IF @Text = N''
        THROW 50000, N'ERR|400|EMPTY_COMMENT|Комментарий не может быть пустым', 1;
    IF LEN(@Text) > 2000
        THROW 50000, N'ERR|400|COMMENT_TOO_LONG|Комментарий слишком длинный', 1;

    IF (CASE WHEN @KataId IS NOT NULL THEN 1 ELSE 0 END) = (CASE WHEN @BunkaiId IS NOT NULL THEN 1 ELSE 0 END)
        THROW 50000, N'ERR|400|VALIDATION_ERROR|Комментарий должен относиться либо к ката, либо к бункаю', 1;

    IF @KataId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Kata WHERE Kata_ID = @KataId)
        THROW 50000, N'ERR|404|KATA_NOT_FOUND|Ката не найдено', 1;

    IF @BunkaiId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Bunkai WHERE Bunkai_ID = @BunkaiId)
        THROW 50000, N'ERR|404|BUNKAI_NOT_FOUND|Бункай не найден', 1;

    DECLARE @newId INT;

    INSERT INTO dbo.Comments (User_ID, Kata_ID, Bunkai_ID, Text)
    VALUES (@UserId, @KataId, @BunkaiId, @Text);

    SET @newId = SCOPE_IDENTITY();

    SELECT
        c.Comment_ID, c.User_ID, c.Kata_ID, c.Bunkai_ID, c.Text, c.Created_At, c.Updated_At,
        u.Username AS Author_Username, u.Display_Name AS Author_Display_Name, u.Avatar_URL AS Author_Avatar_URL
    FROM dbo.Comments c
    JOIN dbo.Users u ON u.User_ID = c.User_ID
    WHERE c.Comment_ID = @newId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Comment_Delete
    @CommentId INT,
    @UserId INT,
    @UserRole NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ownerId INT;
    SELECT @ownerId = User_ID FROM dbo.Comments WHERE Comment_ID = @CommentId;

    IF @ownerId IS NULL
        THROW 50000, N'ERR|404|COMMENT_NOT_FOUND|Комментарий не найден', 1;

    IF @ownerId <> @UserId AND @UserRole <> N'admin'
        THROW 50000, N'ERR|403|FORBIDDEN|Недостаточно прав', 1;

    DELETE FROM dbo.Comments WHERE Comment_ID = @CommentId;

    SELECT CASE WHEN @ownerId = @UserId THEN N'delete_own_comment' ELSE N'admin_delete_comment' END AS Action_Name;
END
GO

-- ============================================================
-- ПРОЦЕДУРЫ — ЧАТ
-- ============================================================

CREATE OR ALTER PROCEDURE dbo.sp_Chat_GetOrCreateGeneralRoom
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.ChatRooms WHERE Room_Type = N'general')
        INSERT INTO dbo.ChatRooms (Room_Type) VALUES (N'general');

    SELECT TOP 1 
        ChatRoom_ID, 
        Room_Type, 
        Created_At,
        CAST(NULL AS INT) AS Friend_User_ID,
        CAST(NULL AS NVARCHAR(50)) AS Friend_Username,
        CAST(NULL AS NVARCHAR(100)) AS Friend_Display_Name,
        CAST(NULL AS NVARCHAR(500)) AS Friend_Avatar_URL
    FROM dbo.ChatRooms WHERE Room_Type = N'general';
END
GO

-- Все доступные комнаты пользователя (общий чат додзё + приватные диалоги с друзьями)
CREATE OR ALTER PROCEDURE dbo.sp_Chat_ListRoomsForUser
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Общий чат додзё
    SELECT 
        ChatRoom_ID, 
        Room_Type, 
        Created_At,
        CAST(NULL AS INT) AS Friend_User_ID,
        CAST(NULL AS NVARCHAR(50)) AS Friend_Username,
        CAST(NULL AS NVARCHAR(100)) AS Friend_Display_Name,
        CAST(NULL AS NVARCHAR(500)) AS Friend_Avatar_URL
    FROM dbo.ChatRooms
    WHERE Room_Type = N'general'

    UNION ALL

    -- Приватные чаты (с привязкой данных собеседника-друга)
    SELECT 
        r.ChatRoom_ID, 
        r.Room_Type, 
        r.Created_At,
        fu.User_ID AS Friend_User_ID,
        fu.Username AS Friend_Username,
        fu.Display_Name AS Friend_Display_Name,
        fu.Avatar_URL AS Friend_Avatar_URL
    FROM dbo.ChatRooms r
    JOIN dbo.PrivateChatParticipants p ON p.ChatRoom_ID = r.ChatRoom_ID
    JOIN dbo.PrivateChatParticipants fp ON fp.ChatRoom_ID = r.ChatRoom_ID AND fp.User_ID <> @UserId
    JOIN dbo.Users fu ON fu.User_ID = fp.User_ID
    WHERE r.Room_Type = N'private' AND p.User_ID = @UserId

    ORDER BY Created_At ASC;
END
GO

-- Находит существующую приватную комнату между двумя друзьями либо создаёт новую
CREATE OR ALTER PROCEDURE dbo.sp_Chat_CreatePrivateRoom
    @UserId INT,
    @FriendUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF dbo.fn_IsFriend(@UserId, @FriendUserId) = 0
        THROW 50000, N'ERR|403|NOT_FRIENDS|Приватный чат доступен только для друзей', 1;

    DECLARE @roomId INT;

    SELECT @roomId = p1.ChatRoom_ID
    FROM dbo.PrivateChatParticipants p1
    JOIN dbo.PrivateChatParticipants p2 ON p2.ChatRoom_ID = p1.ChatRoom_ID
    WHERE p1.User_ID = @UserId AND p2.User_ID = @FriendUserId;

    IF @roomId IS NULL
    BEGIN
        BEGIN TRANSACTION;

        INSERT INTO dbo.ChatRooms (Room_Type) VALUES (N'private');
        SET @roomId = SCOPE_IDENTITY();

        INSERT INTO dbo.PrivateChatParticipants (ChatRoom_ID, User_ID) VALUES (@roomId, @UserId), (@roomId, @FriendUserId);

        COMMIT TRANSACTION;
    END

    SELECT 
        r.ChatRoom_ID, 
        r.Room_Type, 
        r.Created_At,
        fu.User_ID AS Friend_User_ID,
        fu.Username AS Friend_Username,
        fu.Display_Name AS Friend_Display_Name,
        fu.Avatar_URL AS Friend_Avatar_URL
    FROM dbo.ChatRooms r
    JOIN dbo.PrivateChatParticipants fp ON fp.ChatRoom_ID = r.ChatRoom_ID AND fp.User_ID = @FriendUserId
    JOIN dbo.Users fu ON fu.User_ID = fp.User_ID
    WHERE r.ChatRoom_ID = @roomId;
END
GO

-- История сообщений: последние @Limit (с конца, начиная с @Offset), в хронологическом порядке
-- отдаётся уже в SQL (ORDER BY по возрастанию поверх подзапроса DESC), не требует .reverse() в JS
CREATE OR ALTER PROCEDURE dbo.sp_Chat_ListMessages
    @RoomId INT,
    @UserId INT,
    @Offset INT = 0,
    @Limit INT = 50
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.ChatRooms WHERE ChatRoom_ID = @RoomId)
        THROW 50000, N'ERR|404|ROOM_NOT_FOUND|Комната не найдена', 1;

    IF dbo.fn_CanAccessChatRoom(@RoomId, @UserId) = 0
        THROW 50000, N'ERR|403|FORBIDDEN|Недостаточно прав для этой комнаты', 1;

    SELECT * FROM (
        SELECT
            m.Message_ID, m.ChatRoom_ID, m.User_ID, m.Message_Text, m.Created_At, m.Edited_At,
            u.Username AS Author_Username, u.Display_Name AS Author_Display_Name, u.Avatar_URL AS Author_Avatar_URL,
            COUNT(*) OVER () AS Total_Count
        FROM dbo.ChatMessages m
        JOIN dbo.Users u ON u.User_ID = m.User_ID
        WHERE m.ChatRoom_ID = @RoomId AND m.Is_Deleted = 0
        ORDER BY m.Created_At DESC, m.Message_ID DESC
        OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
    ) page
    ORDER BY Created_At ASC, Message_ID ASC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Chat_CreateMessage
    @RoomId INT,
    @UserId INT,
    @Text NVARCHAR(2000)
AS
BEGIN
    SET NOCOUNT ON;

    SET @Text = LTRIM(RTRIM(ISNULL(@Text, N'')));
    IF @Text = N''
        THROW 50000, N'ERR|400|EMPTY_MESSAGE|Сообщение не может быть пустым', 1;
    IF LEN(@Text) > 2000
        THROW 50000, N'ERR|400|MESSAGE_TOO_LONG|Сообщение слишком длинное', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.ChatRooms WHERE ChatRoom_ID = @RoomId)
        THROW 50000, N'ERR|404|ROOM_NOT_FOUND|Комната не найдена', 1;

    IF dbo.fn_CanAccessChatRoom(@RoomId, @UserId) = 0
        THROW 50000, N'ERR|403|FORBIDDEN|Недостаточно прав для этой комнаты', 1;

    DECLARE @newId INT;

    INSERT INTO dbo.ChatMessages (ChatRoom_ID, User_ID, Message_Text) VALUES (@RoomId, @UserId, @Text);
    SET @newId = SCOPE_IDENTITY();

    SELECT
        m.Message_ID, m.ChatRoom_ID, m.User_ID, m.Message_Text, m.Created_At, m.Edited_At,
        u.Username AS Author_Username, u.Display_Name AS Author_Display_Name, u.Avatar_URL AS Author_Avatar_URL
    FROM dbo.ChatMessages m
    JOIN dbo.Users u ON u.User_ID = m.User_ID
    WHERE m.Message_ID = @newId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Chat_DeleteMessage
    @MessageId INT,
    @UserId INT,
    @UserRole NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ownerId INT, @roomId INT;
    SELECT @ownerId = User_ID, @roomId = ChatRoom_ID FROM dbo.ChatMessages WHERE Message_ID = @MessageId;

    IF @ownerId IS NULL
        THROW 50000, N'ERR|404|MESSAGE_NOT_FOUND|Сообщение не найдено', 1;

    IF @ownerId <> @UserId AND @UserRole <> N'admin'
        THROW 50000, N'ERR|403|FORBIDDEN|Недостаточно прав', 1;

    UPDATE dbo.ChatMessages SET Is_Deleted = 1 WHERE Message_ID = @MessageId;

    SELECT @roomId AS ChatRoom_ID, @MessageId AS Message_ID;
END
GO

-- ============================================================
-- ПРОЦЕДУРЫ — ДРУЗЬЯ
-- ============================================================

CREATE OR ALTER PROCEDURE dbo.sp_Friend_SearchUsers
    @Query NVARCHAR(200),
    @ExcludeUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF @Query IS NULL OR LEN(LTRIM(RTRIM(@Query))) < 2
    BEGIN
        SELECT TOP 0 User_ID, Username, Display_Name, Avatar_URL, Bio FROM dbo.Users;
        RETURN;
    END

    SELECT TOP 20 User_ID, Username, Display_Name, Avatar_URL, Bio
    FROM dbo.Users
    WHERE (Username LIKE N'%' + @Query + N'%' OR Display_Name LIKE N'%' + @Query + N'%')
      AND User_ID <> @ExcludeUserId
    ORDER BY Username;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Friend_SendRequest
    @SenderId INT,
    @ReceiverId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF @SenderId = @ReceiverId
        THROW 50000, N'ERR|400|SELF_REQUEST|Нельзя отправить заявку самому себе', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE User_ID = @ReceiverId)
        THROW 50000, N'ERR|404|USER_NOT_FOUND|Пользователь не найден', 1;

    IF dbo.fn_IsFriend(@SenderId, @ReceiverId) = 1
        THROW 50000, N'ERR|409|ALREADY_FRIENDS|Вы уже друзья', 1;

    IF EXISTS (
        SELECT 1 FROM dbo.FriendRequests
        WHERE Status = N'pending'
          AND ((Sender_ID = @SenderId AND Receiver_ID = @ReceiverId) OR (Sender_ID = @ReceiverId AND Receiver_ID = @SenderId))
    )
        THROW 50000, N'ERR|409|REQUEST_EXISTS|Заявка уже отправлена', 1;

    -- Если ранее в этом же направлении была отклонённая/отменённая заявка — переиспользуем строку
    -- (иначе нарушим UNIQUE(Sender_ID, Receiver_ID))
    IF EXISTS (SELECT 1 FROM dbo.FriendRequests WHERE Sender_ID = @SenderId AND Receiver_ID = @ReceiverId)
        UPDATE dbo.FriendRequests SET Status = N'pending', Updated_At = SYSUTCDATETIME()
        WHERE Sender_ID = @SenderId AND Receiver_ID = @ReceiverId;
    ELSE
        INSERT INTO dbo.FriendRequests (Sender_ID, Receiver_ID, Status) VALUES (@SenderId, @ReceiverId, N'pending');

    SELECT Request_ID, Sender_ID, Receiver_ID, Status, Created_At, Updated_At
    FROM dbo.FriendRequests WHERE Sender_ID = @SenderId AND Receiver_ID = @ReceiverId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Friend_AcceptRequest
    @RequestId INT,
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @senderId INT, @receiverId INT, @status NVARCHAR(20);
    SELECT @senderId = Sender_ID, @receiverId = Receiver_ID, @status = Status
    FROM dbo.FriendRequests WHERE Request_ID = @RequestId;

    IF @senderId IS NULL
        THROW 50000, N'ERR|404|REQUEST_NOT_FOUND|Заявка не найдена', 1;

    IF @receiverId <> @UserId
        THROW 50000, N'ERR|403|FORBIDDEN|Недостаточно прав', 1;

    IF @status <> N'pending'
        THROW 50000, N'ERR|409|REQUEST_ALREADY_HANDLED|Заявка уже обработана', 1;

    BEGIN TRANSACTION;

    UPDATE dbo.FriendRequests SET Status = N'accepted', Updated_At = SYSUTCDATETIME() WHERE Request_ID = @RequestId;

    IF NOT EXISTS (SELECT 1 FROM dbo.Friends WHERE User_ID = @senderId AND Friend_User_ID = @receiverId)
        INSERT INTO dbo.Friends (User_ID, Friend_User_ID) VALUES (@senderId, @receiverId);
    IF NOT EXISTS (SELECT 1 FROM dbo.Friends WHERE User_ID = @receiverId AND Friend_User_ID = @senderId)
        INSERT INTO dbo.Friends (User_ID, Friend_User_ID) VALUES (@receiverId, @senderId);

    COMMIT TRANSACTION;

    SELECT Request_ID, Sender_ID, Receiver_ID, Status, Created_At, Updated_At
    FROM dbo.FriendRequests WHERE Request_ID = @RequestId;
END
GO

-- Получатель отклоняет ИЛИ отправитель отменяет — определяется по @UserId
CREATE OR ALTER PROCEDURE dbo.sp_Friend_RejectRequest
    @RequestId INT,
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @senderId INT, @receiverId INT, @status NVARCHAR(20);
    SELECT @senderId = Sender_ID, @receiverId = Receiver_ID, @status = Status
    FROM dbo.FriendRequests WHERE Request_ID = @RequestId;

    IF @senderId IS NULL
        THROW 50000, N'ERR|404|REQUEST_NOT_FOUND|Заявка не найдена', 1;

    IF @status <> N'pending'
        THROW 50000, N'ERR|409|REQUEST_ALREADY_HANDLED|Заявка уже обработана', 1;

    IF @receiverId = @UserId
        UPDATE dbo.FriendRequests SET Status = N'rejected', Updated_At = SYSUTCDATETIME() WHERE Request_ID = @RequestId;
    ELSE IF @senderId = @UserId
        UPDATE dbo.FriendRequests SET Status = N'cancelled', Updated_At = SYSUTCDATETIME() WHERE Request_ID = @RequestId;
    ELSE
        THROW 50000, N'ERR|403|FORBIDDEN|Недостаточно прав', 1;

    SELECT Request_ID, Sender_ID, Receiver_ID, Status, Created_At, Updated_At
    FROM dbo.FriendRequests WHERE Request_ID = @RequestId;
END
GO

-- @Direction: 'incoming' | 'outgoing'; всегда только pending-заявки
CREATE OR ALTER PROCEDURE dbo.sp_Friend_ListRequests
    @UserId INT,
    @Direction NVARCHAR(10) = N'incoming'
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        r.Request_ID, r.Status, r.Created_At,
        su.User_ID AS Sender_User_ID, su.Username AS Sender_Username, su.Display_Name AS Sender_Display_Name, su.Avatar_URL AS Sender_Avatar_URL,
        ru.User_ID AS Receiver_User_ID, ru.Username AS Receiver_Username, ru.Display_Name AS Receiver_Display_Name, ru.Avatar_URL AS Receiver_Avatar_URL
    FROM dbo.FriendRequests r
    JOIN dbo.Users su ON su.User_ID = r.Sender_ID
    JOIN dbo.Users ru ON ru.User_ID = r.Receiver_ID
    WHERE r.Status = N'pending'
      AND (
        (@Direction = N'outgoing' AND r.Sender_ID = @UserId)
        OR (@Direction <> N'outgoing' AND r.Receiver_ID = @UserId)
      )
    ORDER BY r.Created_At DESC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Friend_ListFriends
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT u.User_ID, u.Username, u.Display_Name, u.Avatar_URL, u.Bio, f.Created_At AS Friends_Since
    FROM dbo.Friends f
    JOIN dbo.Users u ON u.User_ID = f.Friend_User_ID
    WHERE f.User_ID = @UserId
    ORDER BY f.Created_At DESC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Friend_Remove
    @UserId INT,
    @FriendUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM dbo.Friends
    WHERE (User_ID = @UserId AND Friend_User_ID = @FriendUserId)
       OR (User_ID = @FriendUserId AND Friend_User_ID = @UserId);
END
GO

-- ============================================================
-- ПРОЦЕДУРЫ — АДМИНИСТРИРОВАНИЕ
-- ============================================================

CREATE OR ALTER PROCEDURE dbo.sp_Admin_ListUsers
    @Search NVARCHAR(200) = NULL,
    @RoleName NVARCHAR(50) = NULL,
    @Offset INT = 0,
    @Limit INT = 20
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        u.User_ID, u.Username, u.Email, u.Display_Name, u.Avatar_URL, u.Is_Blocked, u.Created_At,
        r.Role_Name,
        COUNT(*) OVER () AS Total_Count
    FROM dbo.Users u
    JOIN dbo.Roles r ON r.Role_ID = u.Role_ID
    WHERE
        (@Search IS NULL OR @Search = N'' OR u.Username LIKE N'%' + @Search + N'%' OR u.Email LIKE N'%' + @Search + N'%')
        AND (@RoleName IS NULL OR @RoleName = N'' OR r.Role_Name = @RoleName)
    ORDER BY u.Created_At DESC
    OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Admin_GetUser
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE User_ID = @UserId)
        THROW 50000, N'ERR|404|USER_NOT_FOUND|Пользователь не найден', 1;

    SELECT u.User_ID, u.Username, u.Email, u.Display_Name, u.Avatar_URL, u.Bio, u.Is_Blocked, u.Created_At, r.Role_Name
    FROM dbo.Users u
    JOIN dbo.Roles r ON r.Role_ID = u.Role_ID
    WHERE u.User_ID = @UserId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Admin_BlockUser
    @UserId INT,
    @ActorUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF @UserId = @ActorUserId
        THROW 50000, N'ERR|400|SELF_BLOCK|Нельзя заблокировать самого себя', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE User_ID = @UserId)
        THROW 50000, N'ERR|404|USER_NOT_FOUND|Пользователь не найден', 1;

    UPDATE dbo.Users SET Is_Blocked = 1, Updated_At = SYSUTCDATETIME() WHERE User_ID = @UserId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Admin_UnblockUser
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE User_ID = @UserId)
        THROW 50000, N'ERR|404|USER_NOT_FOUND|Пользователь не найден', 1;

    UPDATE dbo.Users SET Is_Blocked = 0, Updated_At = SYSUTCDATETIME() WHERE User_ID = @UserId;
END
GO

-- Раздел 3 ТЗ: пользователь не может назначить себе роль admin — здесь это
-- гарантируется параметром @ActorUserId (маршрут вызывает с ID администратора,
-- отличным от целевого пользователя)
CREATE OR ALTER PROCEDURE dbo.sp_Admin_ChangeUserRole
    @UserId INT,
    @ActorUserId INT,
    @RoleName NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    IF @RoleName NOT IN (N'user', N'admin', N'moderator')
        THROW 50000, N'ERR|400|VALIDATION_ERROR|Недопустимая роль', 1;

    IF @UserId = @ActorUserId
        THROW 50000, N'ERR|400|SELF_ROLE_CHANGE|Нельзя изменить собственную роль', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE User_ID = @UserId)
        THROW 50000, N'ERR|404|USER_NOT_FOUND|Пользователь не найден', 1;

    DECLARE @roleId INT = (SELECT Role_ID FROM dbo.Roles WHERE Role_Name = @RoleName);
    IF @roleId IS NULL
        THROW 50000, N'ERR|500|ROLE_MISSING|Роль не настроена в базе данных', 1;

    UPDATE dbo.Users SET Role_ID = @roleId, Updated_At = SYSUTCDATETIME() WHERE User_ID = @UserId;
END
GO

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

CREATE OR ALTER PROCEDURE dbo.sp_Admin_ListLogs
    @Action NVARCHAR(100) = NULL,
    @UserId INT = NULL,
    @Offset INT = 0,
    @Limit INT = 50
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        l.Log_ID, l.User_ID, l.Action, l.Entity_Type, l.Entity_ID, l.Details, l.Ip_Address, l.Created_At,
        u.Username AS User_Username,
        COUNT(*) OVER () AS Total_Count
    FROM dbo.ActivityLogs l
    LEFT JOIN dbo.Users u ON u.User_ID = l.User_ID
    WHERE (@Action IS NULL OR @Action = N'' OR l.Action = @Action)
      AND (@UserId IS NULL OR l.User_ID = @UserId)
    ORDER BY l.Created_At DESC
    OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Admin_ListBackups
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP 100 Backup_ID, Created_By, File_Name, File_Path, Backup_Type, Status, Created_At
    FROM dbo.Backups ORDER BY Created_At DESC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Admin_CreateBackupRecord
    @CreatedBy INT,
    @FileName NVARCHAR(255),
    @FilePath NVARCHAR(500),
    @BackupType NVARCHAR(50) = N'full'
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @newId INT;

    INSERT INTO dbo.Backups (Created_By, File_Name, File_Path, Backup_Type, Status)
    VALUES (@CreatedBy, @FileName, @FilePath, @BackupType, N'pending');

    SET @newId = SCOPE_IDENTITY();

    SELECT Backup_ID, Created_By, File_Name, File_Path, Backup_Type, Status, Created_At
    FROM dbo.Backups WHERE Backup_ID = @newId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Admin_UpdateBackupStatus
    @BackupId INT,
    @Status NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Backups SET Status = @Status WHERE Backup_ID = @BackupId;

    SELECT Backup_ID, Created_By, File_Name, File_Path, Backup_Type, Status, Created_At
    FROM dbo.Backups WHERE Backup_ID = @BackupId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Admin_Stats
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        (SELECT COUNT(*) FROM dbo.Users) AS Users,
        (SELECT COUNT(*) FROM dbo.Users WHERE Is_Blocked = 1) AS Blocked_Users,
        (SELECT COUNT(*) FROM dbo.Kata) AS Kata_Total,
        (SELECT COUNT(*) FROM dbo.Kata WHERE Status = N'pending') AS Kata_Pending,
        (SELECT COUNT(*) FROM dbo.Bunkai) AS Bunkai_Total,
        (SELECT COUNT(*) FROM dbo.Bunkai WHERE Status = N'pending') AS Bunkai_Pending,
        (SELECT COUNT(*) FROM dbo.Comments) AS Comments;
END
GO

-- ============================================================
-- ПРОЦЕДУРЫ — ЖУРНАЛ ДЕЙСТВИЙ
-- ============================================================

CREATE OR ALTER PROCEDURE dbo.sp_ActivityLog_Insert
    @UserId INT = NULL,
    @Action NVARCHAR(100),
    @EntityType NVARCHAR(50) = NULL,
    @EntityId INT = NULL,
    @Details NVARCHAR(MAX) = NULL,
    @IpAddress NVARCHAR(64) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.ActivityLogs (User_ID, Action, Entity_Type, Entity_ID, Details, Ip_Address)
    VALUES (@UserId, @Action, @EntityType, @EntityId, @Details, @IpAddress);
END
GO

-- =========================================================
-- Анимации, переходы, расширенный бункай и реестр пропусков
-- =========================================================

CREATE OR ALTER PROCEDURE dbo.sp_Animation_ListClips
    @Category NVARCHAR(50) = NULL,
    @InteractionType NVARCHAR(30) = NULL,
    @Search NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        Clip_ID, Clip_Name, Display_Name, Category, Source_Type, File_Path,
        Duration, Stance_In, Stance_Out, Lead_In, Lead_Out,
        Interaction_Type, Optimal_Distance, Tolerance_Min, Tolerance_Max,
        Contact_Bone_Self, Contact_Bone_Target, Contact_Time_Start, Contact_Time_End,
        Is_Active, Created_At
    FROM dbo.AnimationClips
    WHERE Is_Active = 1
      AND (@Category IS NULL OR Category = @Category)
      AND (@InteractionType IS NULL OR Interaction_Type = @InteractionType)
      AND (@Search IS NULL OR Display_Name LIKE N'%' + @Search + N'%' OR Clip_Name LIKE N'%' + @Search + N'%')
    ORDER BY Category, Display_Name;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Animation_ListTransitions
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        t.Transition_ID, t.From_Stance, t.To_Stance,
        t.Transition_Clip_ID, c.Clip_Name AS Transition_Clip_Name,
        t.Blending_Duration, t.Is_Direct_Blend_Allowed, t.Notes
    FROM dbo.ClipTransitions t
    LEFT JOIN dbo.AnimationClips c ON c.Clip_ID = t.Transition_Clip_ID
    ORDER BY t.From_Stance, t.To_Stance;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Animation_LogMissing
    @ClipName NVARCHAR(100),
    @ContextType NVARCHAR(50),
    @ContextEntityId INT = NULL,
    @FromStance NVARCHAR(50) = NULL,
    @ToStance NVARCHAR(50) = NULL,
    @UserId INT = NULL,
    @Notes NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @existingId INT;

    SELECT @existingId = Request_ID
    FROM dbo.MissingAnimationRequests
    WHERE Clip_Name = @ClipName
      AND Context_Type = @ContextType
      AND ISNULL(From_Stance, N'') = ISNULL(@FromStance, N'')
      AND ISNULL(To_Stance, N'') = ISNULL(@ToStance, N'')
      AND Status IN (N'pending', N'in_production');

    IF @existingId IS NOT NULL
    BEGIN
        UPDATE dbo.MissingAnimationRequests
        SET Request_Count = Request_Count + 1,
            Last_Requested_At = SYSUTCDATETIME(),
            Notes = COALESCE(@Notes, Notes)
        WHERE Request_ID = @existingId;

        SELECT Request_ID, Request_Count, Status
        FROM dbo.MissingAnimationRequests
        WHERE Request_ID = @existingId;
    END
    ELSE
    BEGIN
        INSERT INTO dbo.MissingAnimationRequests
            (Clip_Name, Context_Type, Context_Entity_ID, From_Stance, To_Stance, Requested_By_User_ID, Request_Count, Status, Notes)
        VALUES
            (@ClipName, @ContextType, @ContextEntityId, @FromStance, @ToStance, @UserId, 1, N'pending', @Notes);

        DECLARE @newId INT = SCOPE_IDENTITY();
        SELECT Request_ID, Request_Count, Status
        FROM dbo.MissingAnimationRequests
        WHERE Request_ID = @newId;
    END
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Animation_ListMissingRequests
    @Status NVARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        r.Request_ID, r.Clip_Name, r.Context_Type, r.Context_Entity_ID,
        r.From_Stance, r.To_Stance, r.Request_Count, r.Status, r.Notes,
        r.First_Requested_At, r.Last_Requested_At,
        u.Username AS Requested_By_Username
    FROM dbo.MissingAnimationRequests r
    LEFT JOIN dbo.Users u ON u.User_ID = r.Requested_By_User_ID
    WHERE (@Status IS NULL OR r.Status = @Status)
    ORDER BY r.Request_Count DESC, r.Last_Requested_At DESC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Bunkai_GetStepsWithParticipants
    @BunkaiId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        s.Step_ID, s.Bunkai_ID, s.Step_Number, s.Title, s.Description,
        s.Duration, s.Participant_Count, s.Target_Distance, s.Target_Angle
    FROM dbo.BunkaiSteps s
    WHERE s.Bunkai_ID = @BunkaiId
    ORDER BY s.Step_Number;

    SELECT
        p.BSP_ID, p.Step_ID, p.Role, p.Clip_ID,
        c.Clip_Name, c.Display_Name AS Clip_Title, c.Duration AS Clip_Duration,
        c.Interaction_Type, c.Optimal_Distance,
        p.Initial_Stance, p.Offset_X, p.Offset_Z, p.Rotation_Y, p.Delay_Seconds
    FROM dbo.BunkaiStepParticipants p
    JOIN dbo.BunkaiSteps s ON s.Step_ID = p.Step_ID
    LEFT JOIN dbo.AnimationClips c ON c.Clip_ID = p.Clip_ID
    WHERE s.Bunkai_ID = @BunkaiId
    ORDER BY s.Step_Number, p.Role;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Bunkai_SaveSteps
    @BunkaiId INT,
    @UserId INT,
    @UserRole NVARCHAR(20),
    @StepsJson NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @authorId INT;
    SELECT @authorId = Author_ID FROM dbo.Bunkai WHERE Bunkai_ID = @BunkaiId;

    IF @authorId IS NULL
        THROW 50000, N'ERR|404|BUNKAI_NOT_FOUND|Бункай не найден', 1;

    IF @authorId <> @UserId AND @UserRole <> N'admin'
        THROW 50000, N'ERR|403|FORBIDDEN|Нет прав на редактирование бункая', 1;

    BEGIN TRANSACTION;

    DELETE FROM dbo.BunkaiSteps WHERE Bunkai_ID = @BunkaiId;

    DECLARE @i INT = 0;
    DECLARE @totalSteps INT = (SELECT COUNT(*) FROM OPENJSON(@StepsJson));

    WHILE @i < @totalSteps
    BEGIN
        DECLARE @stepPath NVARCHAR(50) = '$[' + CAST(@i AS NVARCHAR(10)) + ']';
        DECLARE @stepNum INT = JSON_VALUE(@StepsJson, @stepPath + '.stepNumber');
        DECLARE @title NVARCHAR(200) = JSON_VALUE(@StepsJson, @stepPath + '.title');
        DECLARE @desc NVARCHAR(MAX) = JSON_VALUE(@StepsJson, @stepPath + '.description');
        DECLARE @dur FLOAT = ISNULL(CAST(JSON_VALUE(@StepsJson, @stepPath + '.duration') AS FLOAT), 2.5);
        DECLARE @pCount INT = ISNULL(CAST(JSON_VALUE(@StepsJson, @stepPath + '.participantCount') AS INT), 2);
        DECLARE @dist FLOAT = ISNULL(CAST(JSON_VALUE(@StepsJson, @stepPath + '.targetDistance') AS FLOAT), 1.4);
        DECLARE @angle FLOAT = ISNULL(CAST(JSON_VALUE(@StepsJson, @stepPath + '.targetAngle') AS FLOAT), 0.0);

        INSERT INTO dbo.BunkaiSteps (Bunkai_ID, Step_Number, Title, Description, Duration, Participant_Count, Target_Distance, Target_Angle)
        VALUES (@BunkaiId, ISNULL(@stepNum, @i + 1), ISNULL(@title, N'Эпизод ' + CAST(@i + 1 AS NVARCHAR(10))), @desc, @dur, @pCount, @dist, @angle);

        DECLARE @newStepId INT = SCOPE_IDENTITY();

        DECLARE @partJson NVARCHAR(MAX) = JSON_QUERY(@StepsJson, @stepPath + '.participants');
        IF @partJson IS NOT NULL
        BEGIN
            INSERT INTO dbo.BunkaiStepParticipants (Step_ID, Role, Clip_ID, Initial_Stance, Offset_X, Offset_Z, Rotation_Y, Delay_Seconds)
            SELECT
                @newStepId,
                pj.role,
                pj.clipId,
                pj.initialStance,
                ISNULL(pj.offsetX, 0.0),
                ISNULL(pj.offsetZ, 0.0),
                ISNULL(pj.rotationY, 0.0),
                ISNULL(pj.delaySeconds, 0.0)
            FROM OPENJSON(@partJson) WITH (
                role NVARCHAR(20) '$.role',
                clipId INT '$.clipId',
                initialStance NVARCHAR(50) '$.initialStance',
                offsetX FLOAT '$.offsetX',
                offsetZ FLOAT '$.offsetZ',
                rotationY FLOAT '$.rotationY',
                delaySeconds FLOAT '$.delaySeconds'
            ) AS pj;
        END

        SET @i = @i + 1;
    END

    COMMIT TRANSACTION;

    EXEC dbo.sp_Bunkai_GetStepsWithParticipants @BunkaiId = @BunkaiId;
END
GO

-- ============================================================
-- ДОДЗЁ (Задача 5: Создание Додзё и приглашения)
-- ============================================================

-- Создание нового Додзё
CREATE OR ALTER PROCEDURE dbo.sp_Dojo_Create
    @CreatorId   INT,
    @Name        NVARCHAR(150),
    @Kanji       NVARCHAR(50) = NULL,
    @Description NVARCHAR(MAX) = NULL,
    @AvatarUrl   NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF @CreatorId IS NULL OR NOT EXISTS (SELECT 1 FROM dbo.Users WHERE User_ID = @CreatorId AND Is_Blocked = 0)
        THROW 50000, N'ERR|401|UNAUTHORIZED|Пользователь не найден или заблокирован', 1;

    SET @Name = LTRIM(RTRIM(@Name));
    IF @Name IS NULL OR LEN(@Name) < 3
        THROW 50000, N'ERR|400|VALIDATION_ERROR|Название Додзё должно содержать минимум 3 символа', 1;

    IF @Kanji IS NULL OR LEN(@Kanji) = 0
        SET @Kanji = N'道場';

    DECLARE @DojoId INT;

    BEGIN TRANSACTION;
    BEGIN TRY
        INSERT INTO dbo.Dojos (Name, Kanji, Description, Creator_ID, Avatar_URL)
        VALUES (@Name, @Kanji, @Description, @CreatorId, @AvatarUrl);

        SET @DojoId = SCOPE_IDENTITY();

        -- Создатель становится сэнсэем Додзё
        INSERT INTO dbo.DojoMembers (Dojo_ID, User_ID, Role, Status)
        VALUES (@DojoId, @CreatorId, 'sensei', 'active');

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    SELECT d.Dojo_ID, d.Name, d.Kanji, d.Description, d.Creator_ID, d.Avatar_URL, d.Created_At,
           (SELECT COUNT(*) FROM dbo.DojoMembers dm WHERE dm.Dojo_ID = d.Dojo_ID AND dm.Status = 'active') AS MembersCount
    FROM dbo.Dojos d
    WHERE d.Dojo_ID = @DojoId;
END;
GO

-- Приглашение пользователя в Додзё
CREATE OR ALTER PROCEDURE dbo.sp_Dojo_InviteUser
    @DojoId       INT,
    @InviterId    INT,
    @TargetUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Dojos WHERE Dojo_ID = @DojoId)
        THROW 50000, N'ERR|404|DOJO_NOT_FOUND|Додзё не найдено', 1;

    -- Проверяем, что приглашающий — активный участник
    IF NOT EXISTS (
        SELECT 1 FROM dbo.DojoMembers 
        WHERE Dojo_ID = @DojoId AND User_ID = @InviterId AND Status = 'active'
    )
        THROW 50000, N'ERR|403|FORBIDDEN|Только участники Додзё могут отправлять приглашения', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE User_ID = @TargetUserId AND Is_Blocked = 0)
        THROW 50000, N'ERR|404|USER_NOT_FOUND|Приглашаемый пользователь не найден', 1;

    IF EXISTS (SELECT 1 FROM dbo.DojoMembers WHERE Dojo_ID = @DojoId AND User_ID = @TargetUserId)
    BEGIN
        DECLARE @existingStatus NVARCHAR(20);
        SELECT @existingStatus = Status FROM dbo.DojoMembers WHERE Dojo_ID = @DojoId AND User_ID = @TargetUserId;
        IF @existingStatus = 'active'
            THROW 50000, N'ERR|400|ALREADY_MEMBER|Пользователь уже состоит в этом Додзё', 1;
        ELSE
            THROW 50000, N'ERR|400|ALREADY_INVITED|Приглашение пользователю уже отправлено', 1;
    END;

    INSERT INTO dbo.DojoMembers (Dojo_ID, User_ID, Role, Status)
    VALUES (@DojoId, @TargetUserId, 'student', 'invited');

    SELECT dm.Dojo_ID, dm.User_ID, dm.Role, dm.Status, dm.Joined_At,
           u.Username, u.Display_Name, u.Avatar_URL,
           d.Name AS Dojo_Name, d.Kanji AS Dojo_Kanji
    FROM dbo.DojoMembers dm
    JOIN dbo.Users u ON u.User_ID = dm.User_ID
    JOIN dbo.Dojos d ON d.Dojo_ID = dm.Dojo_ID
    WHERE dm.Dojo_ID = @DojoId AND dm.User_ID = @TargetUserId;
END;
GO

-- Список Додзё пользователя (активные и приглашения)
CREATE OR ALTER PROCEDURE dbo.sp_Dojo_ListMy
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT d.Dojo_ID, d.Name, d.Kanji, d.Description, d.Creator_ID, d.Avatar_URL, d.Created_At,
           dm.Role AS Role, dm.Role AS MyRole,
           dm.Status AS Status, dm.Status AS MyStatus,
           dm.Joined_At,
           u.Display_Name AS SenseiName, u.Display_Name AS Sensei_Name,
           u.Username AS Sensei_Username,
           (SELECT COUNT(*) FROM dbo.DojoMembers sub WHERE sub.Dojo_ID = d.Dojo_ID AND sub.Status = 'active') AS MemberCount,
           (SELECT COUNT(*) FROM dbo.DojoMembers sub WHERE sub.Dojo_ID = d.Dojo_ID AND sub.Status = 'active') AS MembersCount
    FROM dbo.DojoMembers dm
    JOIN dbo.Dojos d ON d.Dojo_ID = dm.Dojo_ID
    JOIN dbo.Users u ON u.User_ID = d.Creator_ID
    WHERE dm.User_ID = @UserId
    ORDER BY d.Created_At DESC;
END;
GO

-- Детали Додзё и список его участников
CREATE OR ALTER PROCEDURE dbo.sp_Dojo_GetDetails
    @DojoId INT,
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM dbo.Dojos WHERE Dojo_ID = @DojoId)
        THROW 50000, N'ERR|404|DOJO_NOT_FOUND|Додзё не найдено', 1;

    -- 1. Информация о Додзё
    SELECT d.Dojo_ID, d.Name, d.Kanji, d.Description, d.Creator_ID, d.Avatar_URL, d.Created_At,
           u.Display_Name AS Sensei_Name, u.Username AS Sensei_Username,
           (SELECT dm.Role FROM dbo.DojoMembers dm WHERE dm.Dojo_ID = d.Dojo_ID AND dm.User_ID = @UserId) AS MyRole,
           (SELECT dm.Status FROM dbo.DojoMembers dm WHERE dm.Dojo_ID = d.Dojo_ID AND dm.User_ID = @UserId) AS MyStatus,
           (SELECT COUNT(*) FROM dbo.DojoMembers dm WHERE dm.Dojo_ID = d.Dojo_ID AND dm.Status = 'active') AS MembersCount
    FROM dbo.Dojos d
    JOIN dbo.Users u ON u.User_ID = d.Creator_ID
    WHERE d.Dojo_ID = @DojoId;

    -- 2. Участники Додзё
    SELECT dm.User_ID, dm.Role, dm.Status, dm.Joined_At,
           u.Username, u.Display_Name, u.Avatar_URL, u.Bio
    FROM dbo.DojoMembers dm
    JOIN dbo.Users u ON u.User_ID = dm.User_ID
    WHERE dm.Dojo_ID = @DojoId
    ORDER BY CASE dm.Role WHEN 'sensei' THEN 1 WHEN 'sempai' THEN 2 ELSE 3 END, dm.Joined_At ASC;
END;
GO

-- Ответ на приглашение в Додзё (принять или отклонить)
CREATE OR ALTER PROCEDURE dbo.sp_Dojo_RespondInvite
    @DojoId INT,
    @UserId INT,
    @Accept BIT
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM dbo.DojoMembers WHERE Dojo_ID = @DojoId AND User_ID = @UserId AND Status = 'invited')
        THROW 50000, N'ERR|404|INVITE_NOT_FOUND|Приглашение не найдено или уже обработано', 1;

    IF @Accept = 1
    BEGIN
        UPDATE dbo.DojoMembers
        SET Status = 'active', Joined_At = SYSUTCDATETIME()
        WHERE Dojo_ID = @DojoId AND User_ID = @UserId;
    END
    ELSE
    BEGIN
        DELETE FROM dbo.DojoMembers
        WHERE Dojo_ID = @DojoId AND User_ID = @UserId;
    END;

    SELECT @DojoId AS Dojo_ID, @UserId AS User_ID, @Accept AS Accepted;
END;
GO

-- Редактирование существующего Додзё
CREATE OR ALTER PROCEDURE dbo.sp_Dojo_Update
    @DojoId      INT,
    @UserId      INT,
    @Name        NVARCHAR(150),
    @Kanji       NVARCHAR(50) = NULL,
    @Description NVARCHAR(MAX) = NULL,
    @AvatarUrl   NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM dbo.Dojos WHERE Dojo_ID = @DojoId)
        THROW 50000, N'ERR|404|DOJO_NOT_FOUND|Додзё не найдено', 1;

    DECLARE @UserRole NVARCHAR(50);
    SELECT @UserRole = r.Role_Name 
    FROM dbo.Users u 
    JOIN dbo.Roles r ON r.Role_ID = u.Role_ID 
    WHERE u.User_ID = @UserId;

    -- Проверка прав: создатель Додзё, сэнсэй либо глобальный админ
    IF NOT EXISTS (
        SELECT 1 FROM dbo.Dojos WHERE Dojo_ID = @DojoId AND Creator_ID = @UserId
    ) AND NOT EXISTS (
        SELECT 1 FROM dbo.DojoMembers WHERE Dojo_ID = @DojoId AND User_ID = @UserId AND Role = 'sensei' AND Status = 'active'
    ) AND ISNULL(@UserRole, '') <> 'admin'
        THROW 50000, N'ERR|403|FORBIDDEN|Только создатель или Сэнсэй может изменять параметры Додзё', 1;

    SET @Name = LTRIM(RTRIM(@Name));
    IF @Name IS NULL OR LEN(@Name) < 3
        THROW 50000, N'ERR|400|VALIDATION_ERROR|Название Додзё должно содержать минимум 3 символа', 1;

    IF @Kanji IS NULL OR LEN(LTRIM(RTRIM(@Kanji))) = 0
        SET @Kanji = N'道場';

    UPDATE dbo.Dojos
    SET Name = @Name,
        Kanji = LTRIM(RTRIM(@Kanji)),
        Description = @Description,
        Avatar_URL = ISNULL(@AvatarUrl, Avatar_URL),
        Updated_At = SYSUTCDATETIME()
    WHERE Dojo_ID = @DojoId;

    SELECT d.Dojo_ID, d.Name, d.Kanji, d.Description, d.Creator_ID, d.Avatar_URL, d.Created_At, d.Updated_At,
           (SELECT COUNT(*) FROM dbo.DojoMembers dm WHERE dm.Dojo_ID = d.Dojo_ID AND dm.Status = 'active') AS MembersCount
    FROM dbo.Dojos d
    WHERE d.Dojo_ID = @DojoId;
END;
GO

-- Удаление (роспуск) Додзё
CREATE OR ALTER PROCEDURE dbo.sp_Dojo_Delete
    @DojoId INT,
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM dbo.Dojos WHERE Dojo_ID = @DojoId)
        THROW 50000, N'ERR|404|DOJO_NOT_FOUND|Додзё не найдено', 1;

    DECLARE @UserRole NVARCHAR(50);
    SELECT @UserRole = r.Role_Name 
    FROM dbo.Users u 
    JOIN dbo.Roles r ON r.Role_ID = u.Role_ID 
    WHERE u.User_ID = @UserId;

    -- Удалить Додзё может создатель либо глобальный админ
    IF NOT EXISTS (
        SELECT 1 FROM dbo.Dojos WHERE Dojo_ID = @DojoId AND Creator_ID = @UserId
    ) AND ISNULL(@UserRole, '') <> 'admin'
        THROW 50000, N'ERR|403|FORBIDDEN|Только создатель Додзё может его распустить и удалить', 1;

    -- Удаляем Додзё (каскадное удаление удалит участников DojoMembers)
    DELETE FROM dbo.Dojos WHERE Dojo_ID = @DojoId;

    SELECT @DojoId AS Deleted_Dojo_ID;
END;
GO

-- ============================================================
-- УВЕДОМЛЕНИЯ (Персистентные и оффлайн-уведомления)
-- ============================================================

-- Создание уведомления для пользователя
CREATE OR ALTER PROCEDURE dbo.sp_Notification_Create
    @UserId INT,
    @Type NVARCHAR(50),
    @Title NVARCHAR(200),
    @Message NVARCHAR(MAX),
    @TargetURL NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.Notifications (User_ID, Type, Title, Message, Target_URL, Is_Read, Created_At)
    VALUES (@UserId, @Type, @Title, @Message, @TargetURL, 0, SYSUTCDATETIME());

    DECLARE @NewId INT = SCOPE_IDENTITY();

    SELECT Notification_ID, User_ID, Type, Title, Message, Target_URL, Is_Read, Created_At
    FROM dbo.Notifications
    WHERE Notification_ID = @NewId;
END;
GO

-- Список уведомлений пользователя
CREATE OR ALTER PROCEDURE dbo.sp_Notification_List
    @UserId INT,
    @Limit INT = 30
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP (@Limit) Notification_ID, User_ID, Type, Title, Message, Target_URL, Is_Read, Created_At
    FROM dbo.Notifications
    WHERE User_ID = @UserId
    ORDER BY Created_At DESC;
END;
GO

-- Отметка уведомления (или всех) как прочитанных
CREATE OR ALTER PROCEDURE dbo.sp_Notification_MarkRead
    @UserId INT,
    @NotificationId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF @NotificationId IS NOT NULL
    BEGIN
        UPDATE dbo.Notifications
        SET Is_Read = 1
        WHERE Notification_ID = @NotificationId AND User_ID = @UserId;
    END
    ELSE
    BEGIN
        UPDATE dbo.Notifications
        SET Is_Read = 1
        WHERE User_ID = @UserId AND Is_Read = 0;
    END;

    SELECT @@ROWCOUNT AS UpdatedCount;
END;
GO

-- Получение количества непрочитанных уведомлений
CREATE OR ALTER PROCEDURE dbo.sp_Notification_GetUnreadCount
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT COUNT(*) AS UnreadCount
    FROM dbo.Notifications
    WHERE User_ID = @UserId AND Is_Read = 0;
END;
GO

-- ============================================================
-- ИЗБРАННОЕ (Ката и Бункай)
-- ============================================================

-- Переключение статуса "избранное" (toggle)
CREATE OR ALTER PROCEDURE dbo.sp_Favorite_Toggle
    @UserId INT,
    @ItemType NVARCHAR(20),
    @ItemId INT
AS
BEGIN
    SET NOCOUNT ON;
    IF @ItemType NOT IN (N'kata', N'bunkai')
        THROW 50000, N'ERR|400|INVALID_ITEM_TYPE|Недопустимый тип избранного', 1;

    IF EXISTS (SELECT 1 FROM dbo.Favorites WHERE User_ID = @UserId AND Item_Type = @ItemType AND Item_ID = @ItemId)
    BEGIN
        DELETE FROM dbo.Favorites
        WHERE User_ID = @UserId AND Item_Type = @ItemType AND Item_ID = @ItemId;

        SELECT 0 AS Is_Favorite, @ItemType AS Item_Type, @ItemId AS Item_ID;
    END
    ELSE
    BEGIN
        INSERT INTO dbo.Favorites (User_ID, Item_Type, Item_ID, Created_At)
        VALUES (@UserId, @ItemType, @ItemId, SYSUTCDATETIME());

        SELECT 1 AS Is_Favorite, @ItemType AS Item_Type, @ItemId AS Item_ID;
    END;
END;
GO

-- Список всех избранных сущностей пользователя
CREATE OR ALTER PROCEDURE dbo.sp_Favorite_List
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT Favorite_ID, User_ID, Item_Type, Item_ID, Created_At
    FROM dbo.Favorites
    WHERE User_ID = @UserId
    ORDER BY Created_At DESC;
END;
GO

-- Получение списка User_ID, добавивших ката в избранное
CREATE OR ALTER PROCEDURE dbo.sp_Favorite_GetUsersForKata
    @KataId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT DISTINCT User_ID
    FROM dbo.Favorites
    WHERE Item_Type = N'kata' AND Item_ID = @KataId;
END;
GO

PRINT N'Процедуры и функции Bunkai Explorer созданы успешно.';
GO
