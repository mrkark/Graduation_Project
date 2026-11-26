-- =========================================================
-- Bunkai Explorer: Добавление Metadata_Json для полного
-- совпадения всех параметров шагов между редактором и демонстрацией
-- =========================================================

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF COL_LENGTH('dbo.BunkaiSteps', 'Metadata_Json') IS NULL
BEGIN
    ALTER TABLE dbo.BunkaiSteps ADD Metadata_Json NVARCHAR(MAX) NULL;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Bunkai_GetStepsWithParticipants
    @BunkaiId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        s.Step_ID, s.Bunkai_ID, s.Step_Number, s.Title, s.Description,
        s.Duration, s.Participant_Count, s.Target_Distance, s.Target_Angle,
        s.Metadata_Json
    FROM dbo.BunkaiSteps s
    WHERE s.Bunkai_ID = @BunkaiId
    ORDER BY s.Step_Number;

    SELECT
        p.BSP_ID, p.Step_ID, p.Role, p.Clip_ID,
        c.Clip_Name, c.Display_Name AS Clip_Title, c.Duration AS Clip_Duration,
        c.Interaction_Type, c.Optimal_Distance,
        p.Initial_Stance, p.Final_Stance, p.Landing_Mode,
        p.Offset_X, p.Offset_Z, p.Rotation_Y, p.Delay_Seconds
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
        DECLARE @metaJson NVARCHAR(MAX) = JSON_QUERY(@StepsJson, @stepPath + '.metadata');
        IF @metaJson IS NULL
            SET @metaJson = JSON_VALUE(@StepsJson, @stepPath + '.metadataJson');

        INSERT INTO dbo.BunkaiSteps (Bunkai_ID, Step_Number, Title, Description, Duration, Participant_Count, Target_Distance, Target_Angle, Metadata_Json)
        VALUES (@BunkaiId, ISNULL(@stepNum, @i + 1), ISNULL(@title, N'Эпизод ' + CAST(@i + 1 AS NVARCHAR(10))), @desc, @dur, @pCount, @dist, @angle, @metaJson);

        DECLARE @newStepId INT = SCOPE_IDENTITY();

        DECLARE @partJson NVARCHAR(MAX) = JSON_QUERY(@StepsJson, @stepPath + '.participants');
        IF @partJson IS NOT NULL
        BEGIN
            INSERT INTO dbo.BunkaiStepParticipants (Step_ID, Role, Clip_ID, Initial_Stance, Final_Stance, Landing_Mode, Offset_X, Offset_Z, Rotation_Y, Delay_Seconds)
            SELECT
                @newStepId,
                pj.role,
                pj.clipId,
                pj.initialStance,
                pj.finalStance,
                pj.landingMode,
                ISNULL(pj.offsetX, 0.0),
                ISNULL(pj.offsetZ, 0.0),
                ISNULL(pj.rotationY, 0.0),
                ISNULL(pj.delaySeconds, 0.0)
            FROM OPENJSON(@partJson) WITH (
                role NVARCHAR(20) '$.role',
                clipId INT '$.clipId',
                initialStance NVARCHAR(50) '$.initialStance',
                finalStance NVARCHAR(50) '$.finalStance',
                landingMode NVARCHAR(20) '$.landingMode',
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
