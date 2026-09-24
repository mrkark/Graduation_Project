-- =========================================================
-- Bunkai Explorer — триггеры автообновления Updated_At
-- Выполнять после schema.sql
-- =========================================================

IF OBJECT_ID('dbo.TR_Users_UpdatedAt', 'TR') IS NOT NULL DROP TRIGGER dbo.TR_Users_UpdatedAt;
GO
CREATE TRIGGER dbo.TR_Users_UpdatedAt ON dbo.Users AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    UPDATE u SET Updated_At = SYSUTCDATETIME()
    FROM dbo.Users u INNER JOIN inserted i ON u.User_ID = i.User_ID;
END;
GO

IF OBJECT_ID('dbo.TR_Kata_UpdatedAt', 'TR') IS NOT NULL DROP TRIGGER dbo.TR_Kata_UpdatedAt;
GO
CREATE TRIGGER dbo.TR_Kata_UpdatedAt ON dbo.Kata AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    UPDATE k SET Updated_At = SYSUTCDATETIME()
    FROM dbo.Kata k INNER JOIN inserted i ON k.Kata_ID = i.Kata_ID;
END;
GO

IF OBJECT_ID('dbo.TR_Bunkai_UpdatedAt', 'TR') IS NOT NULL DROP TRIGGER dbo.TR_Bunkai_UpdatedAt;
GO
CREATE TRIGGER dbo.TR_Bunkai_UpdatedAt ON dbo.Bunkai AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    UPDATE b SET Updated_At = SYSUTCDATETIME()
    FROM dbo.Bunkai b INNER JOIN inserted i ON b.Bunkai_ID = i.Bunkai_ID;
END;
GO

IF OBJECT_ID('dbo.TR_Comments_UpdatedAt', 'TR') IS NOT NULL DROP TRIGGER dbo.TR_Comments_UpdatedAt;
GO
CREATE TRIGGER dbo.TR_Comments_UpdatedAt ON dbo.Comments AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    UPDATE c SET Updated_At = SYSUTCDATETIME()
    FROM dbo.Comments c INNER JOIN inserted i ON c.Comment_ID = i.Comment_ID;
END;
GO

IF OBJECT_ID('dbo.TR_FriendRequests_UpdatedAt', 'TR') IS NOT NULL DROP TRIGGER dbo.TR_FriendRequests_UpdatedAt;
GO
CREATE TRIGGER dbo.TR_FriendRequests_UpdatedAt ON dbo.FriendRequests AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    UPDATE fr SET Updated_At = SYSUTCDATETIME()
    FROM dbo.FriendRequests fr INNER JOIN inserted i ON fr.Request_ID = i.Request_ID;
END;
GO

PRINT 'Триггеры Bunkai Explorer успешно созданы.';
GO
