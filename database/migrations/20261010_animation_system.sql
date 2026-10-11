-- =========================================================
-- Bunkai Explorer: Миграция расширяемой системы анимаций
-- Таблицы: AnimationClips, ClipTransitions, BunkaiSteps, 
--          BunkaiStepParticipants, MissingAnimationRequests
-- =========================================================

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- 1. Каталог клипов анимаций
IF OBJECT_ID('dbo.AnimationClips', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.AnimationClips (
        Clip_ID            INT IDENTITY(1,1) PRIMARY KEY,
        Clip_Name          NVARCHAR(100) NOT NULL UNIQUE,
        Display_Name       NVARCHAR(200) NOT NULL,
        Category           NVARCHAR(50) NOT NULL, -- stance, transition, strike, defense, kick, locomotion, coupled_bunkai
        Source_Type        NVARCHAR(20) NOT NULL DEFAULT 'glb_action', -- glb_action, json
        File_Path          NVARCHAR(500) NULL,
        Duration           FLOAT NOT NULL,
        Stance_In          NVARCHAR(50) NOT NULL,
        Stance_Out         NVARCHAR(50) NOT NULL,
        Lead_In            VARCHAR(10) NULL, -- L, R, neutral
        Lead_Out           VARCHAR(10) NULL, -- L, R, neutral
        Interaction_Type   NVARCHAR(30) NOT NULL DEFAULT 'non_contact', -- non_contact, local_contact, coupled_pair
        Optimal_Distance   FLOAT NULL, -- рекомендованное расстояние Ма-ай (метры)
        Tolerance_Min      FLOAT NULL, -- мин. дистанция до блокировки / предупреждения
        Tolerance_Max      FLOAT NULL, -- макс. дистанция до потери контакта
        Contact_Bone_Self  NVARCHAR(50) NULL, -- кость контакта исполнителя
        Contact_Bone_Target NVARCHAR(50) NULL, -- ожидаемая область/кость контакта у соперника
        Contact_Time_Start FLOAT NULL, -- начало фазы контакта (сек)
        Contact_Time_End   FLOAT NULL, -- конец фазы контакта (сек)
        Is_Active          BIT NOT NULL DEFAULT 1,
        Created_At         DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );

    CREATE INDEX IX_AnimationClips_Category ON dbo.AnimationClips(Category);
    CREATE INDEX IX_AnimationClips_Stances ON dbo.AnimationClips(Stance_In, Stance_Out);
END
GO

-- 2. Матрица допустимых переходов между стойками и клипами
IF OBJECT_ID('dbo.ClipTransitions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ClipTransitions (
        Transition_ID          INT IDENTITY(1,1) PRIMARY KEY,
        From_Stance            NVARCHAR(50) NOT NULL,
        To_Stance              NVARCHAR(50) NOT NULL,
        Transition_Clip_ID     INT NULL REFERENCES dbo.AnimationClips(Clip_ID),
        Blending_Duration      FLOAT NOT NULL DEFAULT 0.25,
        Is_Direct_Blend_Allowed BIT NOT NULL DEFAULT 1,
        Notes                  NVARCHAR(500) NULL,
        CONSTRAINT UQ_ClipTransitions_Pair UNIQUE (From_Stance, To_Stance)
    );
END
GO

-- 3. Структурированные фазы (шаги/эпизоды) бункая
IF OBJECT_ID('dbo.BunkaiSteps', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.BunkaiSteps (
        Step_ID           INT IDENTITY(1,1) PRIMARY KEY,
        Bunkai_ID         INT NOT NULL REFERENCES dbo.Bunkai(Bunkai_ID) ON DELETE CASCADE,
        Step_Number       INT NOT NULL,
        Title             NVARCHAR(200) NOT NULL,
        Description       NVARCHAR(MAX) NULL,
        Duration          FLOAT NOT NULL DEFAULT 2.5,
        Participant_Count INT NOT NULL DEFAULT 2, -- 2 или 3
        Target_Distance   FLOAT NOT NULL DEFAULT 1.4, -- боевая дистанция между Тори и Укэ (метры)
        Target_Angle      FLOAT NOT NULL DEFAULT 0.0, -- угол атаки Укэ (градусы, 0 = фронт)
        Created_At        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_BunkaiSteps_Order UNIQUE (Bunkai_ID, Step_Number)
    );

    CREATE INDEX IX_BunkaiSteps_Bunkai_ID ON dbo.BunkaiSteps(Bunkai_ID);
END
GO

-- 4. Роли и клипы участников в каждом шаге бункая (Тори, Укэ 1, Укэ 2)
IF OBJECT_ID('dbo.BunkaiStepParticipants', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.BunkaiStepParticipants (
        BSP_ID         INT IDENTITY(1,1) PRIMARY KEY,
        Step_ID        INT NOT NULL REFERENCES dbo.BunkaiSteps(Step_ID) ON DELETE CASCADE,
        Role           NVARCHAR(20) NOT NULL, -- tori, uke, uke2
        Clip_ID        INT NULL REFERENCES dbo.AnimationClips(Clip_ID),
        Initial_Stance NVARCHAR(50) NULL,
        Offset_X       FLOAT NOT NULL DEFAULT 0.0,
        Offset_Z       FLOAT NOT NULL DEFAULT 0.0,
        Rotation_Y     FLOAT NOT NULL DEFAULT 0.0,
        Delay_Seconds  FLOAT NOT NULL DEFAULT 0.0,
        CONSTRAINT UQ_BSP_StepRole UNIQUE (Step_ID, Role)
    );

    CREATE INDEX IX_BSP_Step_ID ON dbo.BunkaiStepParticipants(Step_ID);
END
GO

-- 5. Реестр запросов на недостающие анимации (с агрегацией повторений)
IF OBJECT_ID('dbo.MissingAnimationRequests', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.MissingAnimationRequests (
        Request_ID           INT IDENTITY(1,1) PRIMARY KEY,
        Clip_Name            NVARCHAR(100) NOT NULL,
        Context_Type         NVARCHAR(50) NOT NULL, -- kata_step, bunkai_phase, stance_transition, custom_bunkai
        Context_Entity_ID    INT NULL,
        From_Stance          NVARCHAR(50) NULL,
        To_Stance            NVARCHAR(50) NULL,
        Requested_By_User_ID INT NULL REFERENCES dbo.Users(User_ID) ON DELETE SET NULL,
        Request_Count        INT NOT NULL DEFAULT 1,
        Status               NVARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, in_production, ready, rejected
        Notes                NVARCHAR(MAX) NULL,
        First_Requested_At   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        Last_Requested_At    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_MissingAnim_Status CHECK (Status IN ('pending', 'in_production', 'ready', 'rejected'))
    );

    CREATE INDEX IX_MissingAnim_Clip_Name ON dbo.MissingAnimationRequests(Clip_Name, Status);
    CREATE INDEX IX_MissingAnim_Count ON dbo.MissingAnimationRequests(Request_Count DESC);
END
GO

-- 6. Добавление колонок анимации в dbo.KataSteps (если отсутствуют)
IF COL_LENGTH('dbo.KataSteps', 'Clip_ID') IS NULL
    ALTER TABLE dbo.KataSteps ADD Clip_ID INT NULL REFERENCES dbo.AnimationClips(Clip_ID);
GO

IF COL_LENGTH('dbo.KataSteps', 'Stance_In') IS NULL
    ALTER TABLE dbo.KataSteps ADD Stance_In NVARCHAR(50) NULL;
GO

IF COL_LENGTH('dbo.KataSteps', 'Stance_Out') IS NULL
    ALTER TABLE dbo.KataSteps ADD Stance_Out NVARCHAR(50) NULL;
GO

IF COL_LENGTH('dbo.KataSteps', 'Root_Displacement_X') IS NULL
    ALTER TABLE dbo.KataSteps ADD Root_Displacement_X FLOAT NULL DEFAULT 0.0;
GO

IF COL_LENGTH('dbo.KataSteps', 'Root_Displacement_Z') IS NULL
    ALTER TABLE dbo.KataSteps ADD Root_Displacement_Z FLOAT NULL DEFAULT 0.0;
GO

IF COL_LENGTH('dbo.KataSteps', 'Root_Rotation_Y') IS NULL
    ALTER TABLE dbo.KataSteps ADD Root_Rotation_Y FLOAT NULL DEFAULT 0.0;
GO

-- =========================================================
-- ХРАНИМЫЕ ПРОЦЕДУРЫ
-- =========================================================

-- 1. Получить список всех клипов с фильтрацией
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

-- 2. Получить список всех переходов
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

-- 3. Регистрация отсутствующей анимации (Deduplication + Auto Increment)
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

-- 4. Список запросов на недостающие анимации (для админки / анимационного агента)
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

-- 5. Получить шаги бункая вместе с участниками
CREATE OR ALTER PROCEDURE dbo.sp_Bunkai_GetStepsWithParticipants
    @BunkaiId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Набор 1: Шаги
    SELECT
        s.Step_ID, s.Bunkai_ID, s.Step_Number, s.Title, s.Description,
        s.Duration, s.Participant_Count, s.Target_Distance, s.Target_Angle
    FROM dbo.BunkaiSteps s
    WHERE s.Bunkai_ID = @BunkaiId
    ORDER BY s.Step_Number;

    -- Набор 2: Участники каждого шага
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

-- 6. Сохранение полной структуры шагов бункая из JSON
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

    -- Удаляем старые шаги (каскадно удалятся и участники)
    DELETE FROM dbo.BunkaiSteps WHERE Bunkai_ID = @BunkaiId;

    -- Вставляем новые шаги из JSON
    DECLARE @StepMapping TABLE (
        ClientStepIndex INT,
        Step_ID INT
    );

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

        -- Вставляем участников этого шага (массив participants внутри шага)
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

PRINT N'Миграция системы анимаций Bunkai Explorer успешно выполнена!';
GO
