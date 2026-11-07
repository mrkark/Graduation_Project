-- =========================================================
-- Bunkai Explorer: Таблица и процедуры для пресетов микшера
-- Таблица: MotionPresets
-- Процедуры: sp_MotionPresets_List, sp_MotionPresets_Create, sp_MotionPresets_Delete
-- =========================================================

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('dbo.MotionPresets', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.MotionPresets (
        Preset_ID          INT IDENTITY(1,1) PRIMARY KEY,
        Title              NVARCHAR(200) NOT NULL,
        Description        NVARCHAR(500) NULL,
        Category           NVARCHAR(50) NOT NULL DEFAULT 'combo',
        Motion_Mode        NVARCHAR(20) NOT NULL DEFAULT 'modular',
        Stance_ID          NVARCHAR(100) NULL,
        Technique_ID       NVARCHAR(100) NULL,
        Full_Body_Clip     NVARCHAR(100) NULL,
        Turn_Angle         FLOAT NOT NULL DEFAULT 0.0,
        Speed              FLOAT NOT NULL DEFAULT 1.0,
        Displacement_X     FLOAT NOT NULL DEFAULT 0.0,
        Displacement_Z     FLOAT NOT NULL DEFAULT 0.0,
        Preset_Config_JSON NVARCHAR(MAX) NULL,
        Created_By_User_ID INT NULL REFERENCES dbo.Users(User_ID) ON DELETE SET NULL,
        Author_Name        NVARCHAR(100) NOT NULL DEFAULT N'Мастер Додзё',
        Usage_Count        INT NOT NULL DEFAULT 0,
        Is_Public          BIT NOT NULL DEFAULT 1,
        Created_At         DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );

    CREATE INDEX IX_MotionPresets_Mode ON dbo.MotionPresets(Motion_Mode);
    CREATE INDEX IX_MotionPresets_Category ON dbo.MotionPresets(Category);
END;
GO

-- 1. List Motion Presets
CREATE OR ALTER PROCEDURE dbo.sp_MotionPresets_List
    @Category NVARCHAR(50) = NULL,
    @MotionMode NVARCHAR(20) = NULL,
    @Search NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        p.Preset_ID,
        p.Title,
        p.Description,
        p.Category,
        p.Motion_Mode,
        p.Stance_ID,
        p.Technique_ID,
        p.Full_Body_Clip,
        p.Turn_Angle,
        p.Speed,
        p.Displacement_X,
        p.Displacement_Z,
        p.Preset_Config_JSON,
        p.Created_By_User_ID,
        COALESCE(u.Username, p.Author_Name, N'Мастер Додзё') AS Author_Name,
        p.Usage_Count,
        p.Is_Public,
        p.Created_At
    FROM dbo.MotionPresets p
    LEFT JOIN dbo.Users u ON u.User_ID = p.Created_By_User_ID
    WHERE p.Is_Public = 1
      AND (@Category IS NULL OR p.Category = @Category)
      AND (@MotionMode IS NULL OR p.Motion_Mode = @MotionMode)
      AND (@Search IS NULL OR p.Title LIKE N'%' + @Search + N'%' OR p.Description LIKE N'%' + @Search + N'%')
    ORDER BY p.Created_At DESC;
END;
GO

-- 2. Create Motion Preset (or reuse if identical preset exists)
CREATE OR ALTER PROCEDURE dbo.sp_MotionPresets_Create
    @Title NVARCHAR(200),
    @Description NVARCHAR(500) = NULL,
    @Category NVARCHAR(50) = N'combo',
    @MotionMode NVARCHAR(20) = N'modular',
    @StanceId NVARCHAR(100) = NULL,
    @TechniqueId NVARCHAR(100) = NULL,
    @FullBodyClip NVARCHAR(100) = NULL,
    @TurnAngle FLOAT = 0.0,
    @Speed FLOAT = 1.0,
    @DisplacementX FLOAT = 0.0,
    @DisplacementZ FLOAT = 0.0,
    @PresetConfigJson NVARCHAR(MAX) = NULL,
    @UserId INT = NULL,
    @AuthorName NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ExistingId INT = NULL;

    IF @MotionMode = N'modular'
    BEGIN
        SELECT TOP 1 @ExistingId = Preset_ID
        FROM dbo.MotionPresets
        WHERE Motion_Mode = N'modular'
          AND ISNULL(Stance_ID, '') = ISNULL(@StanceId, '')
          AND ISNULL(Technique_ID, '') = ISNULL(@TechniqueId, '')
          AND ABS(Turn_Angle - @TurnAngle) < 0.01;
    END
    ELSE
    BEGIN
        SELECT TOP 1 @ExistingId = Preset_ID
        FROM dbo.MotionPresets
        WHERE Motion_Mode = N'fullbody'
          AND ISNULL(Full_Body_Clip, '') = ISNULL(@FullBodyClip, '')
          AND ABS(Turn_Angle - @TurnAngle) < 0.01;
    END

    IF @ExistingId IS NOT NULL
    BEGIN
        UPDATE dbo.MotionPresets 
        SET Usage_Count = Usage_Count + 1 
        WHERE Preset_ID = @ExistingId;

        SELECT 
            p.Preset_ID, p.Title, p.Description, p.Category, p.Motion_Mode,
            p.Stance_ID, p.Technique_ID, p.Full_Body_Clip, p.Turn_Angle, p.Speed,
            p.Displacement_X, p.Displacement_Z, p.Preset_Config_JSON,
            p.Created_By_User_ID,
            COALESCE(u.Username, p.Author_Name, N'Мастер Додзё') AS Author_Name,
            p.Usage_Count, p.Is_Public, p.Created_At,
            CAST(1 AS BIT) AS AlreadyExisted
        FROM dbo.MotionPresets p
        LEFT JOIN dbo.Users u ON u.User_ID = p.Created_By_User_ID
        WHERE p.Preset_ID = @ExistingId;

        RETURN;
    END

    DECLARE @FinalAuthor NVARCHAR(100) = @AuthorName;
    IF @FinalAuthor IS NULL AND @UserId IS NOT NULL
    BEGIN
        SELECT @FinalAuthor = Username FROM dbo.Users WHERE User_ID = @UserId;
    END
    IF @FinalAuthor IS NULL
    BEGIN
        SET @FinalAuthor = N'Мастер Додзё';
    END

    INSERT INTO dbo.MotionPresets (
        Title, Description, Category, Motion_Mode, Stance_ID, Technique_ID,
        Full_Body_Clip, Turn_Angle, Speed, Displacement_X, Displacement_Z,
        Preset_Config_JSON, Created_By_User_ID, Author_Name, Usage_Count, Is_Public
    )
    VALUES (
        @Title, @Description, @Category, @MotionMode, @StanceId, @TechniqueId,
        @FullBodyClip, @TurnAngle, @Speed, @DisplacementX, @DisplacementZ,
        @PresetConfigJson, @UserId, @FinalAuthor, 1, 1
    );

    DECLARE @NewId INT = SCOPE_IDENTITY();

    SELECT 
        p.Preset_ID, p.Title, p.Description, p.Category, p.Motion_Mode,
        p.Stance_ID, p.Technique_ID, p.Full_Body_Clip, p.Turn_Angle, p.Speed,
        p.Displacement_X, p.Displacement_Z, p.Preset_Config_JSON,
        p.Created_By_User_ID,
        p.Author_Name,
        p.Usage_Count, p.Is_Public, p.Created_At,
        CAST(0 AS BIT) AS AlreadyExisted
    FROM dbo.MotionPresets p
    WHERE p.Preset_ID = @NewId;
END;
GO

-- 3. Delete Motion Preset
CREATE OR ALTER PROCEDURE dbo.sp_MotionPresets_Delete
    @PresetId INT,
    @UserId INT = NULL,
    @UserRole NVARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @OwnerId INT;
    SELECT @OwnerId = Created_By_User_ID FROM dbo.MotionPresets WHERE Preset_ID = @PresetId;

    IF @OwnerId IS NULL AND NOT EXISTS (SELECT 1 FROM dbo.MotionPresets WHERE Preset_ID = @PresetId)
        THROW 50000, N'ERR|404|PRESET_NOT_FOUND|Пресет не найден', 1;

    IF @UserRole <> N'admin' AND (@OwnerId IS NULL OR @OwnerId <> @UserId)
        THROW 50000, N'ERR|403|FORBIDDEN|Нет прав на удаление этого пресета', 1;

    DELETE FROM dbo.MotionPresets WHERE Preset_ID = @PresetId;

    SELECT @PresetId AS Deleted_Preset_ID;
END;
GO
