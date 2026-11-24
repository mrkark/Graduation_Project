-- =========================================================
-- Bunkai Explorer: Миграция связей реляционной схемы
-- Добавление внешних ключей в Favorites и MotionPresets
-- =========================================================

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- 1. Обновление таблицы Favorites: добавление явных FK связей
IF COL_LENGTH('dbo.Favorites', 'Kata_ID') IS NULL
BEGIN
    ALTER TABLE dbo.Favorites ADD Kata_ID INT NULL;
END
GO

IF COL_LENGTH('dbo.Favorites', 'Bunkai_ID') IS NULL
BEGIN
    ALTER TABLE dbo.Favorites ADD Bunkai_ID INT NULL;
END
GO

IF COL_LENGTH('dbo.Favorites', 'Preset_ID') IS NULL
BEGIN
    ALTER TABLE dbo.Favorites ADD Preset_ID INT NULL;
END
GO

-- Синхронизация существующих записей с новыми колонками
UPDATE dbo.Favorites
SET Kata_ID = Item_ID
WHERE Item_Type = N'kata' AND (Kata_ID IS NULL OR Kata_ID <> Item_ID);
GO

UPDATE dbo.Favorites
SET Bunkai_ID = Item_ID
WHERE Item_Type = N'bunkai' AND (Bunkai_ID IS NULL OR Bunkai_ID <> Item_ID);
GO

-- Добавление ограничений внешнего ключа (FK) для Favorites
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Favorites_Kata')
BEGIN
    ALTER TABLE dbo.Favorites
    ADD CONSTRAINT FK_Favorites_Kata FOREIGN KEY (Kata_ID) 
        REFERENCES dbo.Kata(Kata_ID) ON DELETE CASCADE;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Favorites_Bunkai')
BEGIN
    ALTER TABLE dbo.Favorites
    ADD CONSTRAINT FK_Favorites_Bunkai FOREIGN KEY (Bunkai_ID) 
        REFERENCES dbo.Bunkai(Bunkai_ID) ON DELETE NO ACTION;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Favorites_Preset')
BEGIN
    ALTER TABLE dbo.Favorites
    ADD CONSTRAINT FK_Favorites_Preset FOREIGN KEY (Preset_ID) 
        REFERENCES dbo.MotionPresets(Preset_ID) ON DELETE NO ACTION;
END
GO

-- Индексы внешних ключей Favorites
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Favorites_Kata_ID')
    CREATE INDEX IX_Favorites_Kata_ID ON dbo.Favorites(Kata_ID);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Favorites_Bunkai_ID')
    CREATE INDEX IX_Favorites_Bunkai_ID ON dbo.Favorites(Bunkai_ID);
GO

-- 2. Обновление таблицы MotionPresets: добавление FK связей к AnimationClips и KataSteps
IF COL_LENGTH('dbo.MotionPresets', 'Clip_ID') IS NULL
BEGIN
    ALTER TABLE dbo.MotionPresets ADD Clip_ID INT NULL;
END
GO

IF COL_LENGTH('dbo.MotionPresets', 'Step_ID') IS NULL
BEGIN
    ALTER TABLE dbo.MotionPresets ADD Step_ID INT NULL;
END
GO

-- Привязка существующих пресетов к AnimationClips по имени клипа
UPDATE p
SET p.Clip_ID = c.Clip_ID
FROM dbo.MotionPresets p
JOIN dbo.AnimationClips c ON p.Full_Body_Clip = c.Clip_Name
WHERE p.Clip_ID IS NULL;
GO

-- Добавление ограничений внешнего ключа (FK) для MotionPresets
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_MotionPresets_Clip')
BEGIN
    ALTER TABLE dbo.MotionPresets
    ADD CONSTRAINT FK_MotionPresets_Clip FOREIGN KEY (Clip_ID) 
        REFERENCES dbo.AnimationClips(Clip_ID) ON DELETE SET NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_MotionPresets_Step')
BEGIN
    ALTER TABLE dbo.MotionPresets
    ADD CONSTRAINT FK_MotionPresets_Step FOREIGN KEY (Step_ID) 
        REFERENCES dbo.KataSteps(Step_ID) ON DELETE SET NULL;
END
GO

-- Индексы внешних ключей MotionPresets
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_MotionPresets_Clip_ID')
    CREATE INDEX IX_MotionPresets_Clip_ID ON dbo.MotionPresets(Clip_ID);
GO

-- 3. Обновление хранимой процедуры переключения избранного с поддержкой FK
CREATE OR ALTER PROCEDURE dbo.sp_Favorite_Toggle
    @UserId INT,
    @ItemType NVARCHAR(20),
    @ItemId INT
AS
BEGIN
    SET NOCOUNT ON;
    IF @ItemType NOT IN (N'kata', N'bunkai', N'preset')
        THROW 50000, N'ERR|400|INVALID_ITEM_TYPE|Недопустимый тип избранного', 1;

    IF EXISTS (SELECT 1 FROM dbo.Favorites WHERE User_ID = @UserId AND Item_Type = @ItemType AND Item_ID = @ItemId)
    BEGIN
        DELETE FROM dbo.Favorites
        WHERE User_ID = @UserId AND Item_Type = @ItemType AND Item_ID = @ItemId;

        SELECT 0 AS Is_Favorite, @ItemType AS Item_Type, @ItemId AS Item_ID;
    END
    ELSE
    BEGIN
        DECLARE @KataId INT = CASE WHEN @ItemType = N'kata' THEN @ItemId ELSE NULL END;
        DECLARE @BunkaiId INT = CASE WHEN @ItemType = N'bunkai' THEN @ItemId ELSE NULL END;
        DECLARE @PresetId INT = CASE WHEN @ItemType = N'preset' THEN @ItemId ELSE NULL END;

        INSERT INTO dbo.Favorites (User_ID, Item_Type, Item_ID, Kata_ID, Bunkai_ID, Preset_ID)
        VALUES (@UserId, @ItemType, @ItemId, @KataId, @BunkaiId, @PresetId);

        SELECT 1 AS Is_Favorite, @ItemType AS Item_Type, @ItemId AS Item_ID;
    END
END;
GO

PRINT N'Миграция связей реляционной схемы успешно применена.';
GO
