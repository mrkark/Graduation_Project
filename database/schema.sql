-- =========================================================
-- Bunkai Explorer — схема базы данных (Microsoft SQL Server)
-- =========================================================
-- Выполнять на пустой базе данных. Пример создания БД:
-- CREATE DATABASE BunkaiExplorer;
-- GO
-- USE BunkaiExplorer;
-- GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- =========================================================
-- 1. Roles — таблица ролей (НЕ строка в Users!)
-- =========================================================
IF OBJECT_ID('dbo.Roles', 'U') IS NOT NULL DROP TABLE dbo.Roles;
GO
CREATE TABLE dbo.Roles (
    Role_ID     INT IDENTITY(1,1) PRIMARY KEY,
    Role_Name   NVARCHAR(50) NOT NULL UNIQUE,
    Description NVARCHAR(255) NULL,
    Created_At  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- =========================================================
-- 2. Users
-- =========================================================
IF OBJECT_ID('dbo.Users', 'U') IS NOT NULL DROP TABLE dbo.Users;
GO
CREATE TABLE dbo.Users (
    User_ID        INT IDENTITY(1,1) PRIMARY KEY,
    Role_ID        INT NOT NULL,
    Username       NVARCHAR(100) NOT NULL UNIQUE,
    Email          NVARCHAR(255) NOT NULL UNIQUE,
    Password_Hash  NVARCHAR(255) NOT NULL,
    Avatar_URL     NVARCHAR(500) NULL,
    Display_Name   NVARCHAR(100) NULL,
    Bio            NVARCHAR(MAX) NULL,
    Is_Blocked     BIT NOT NULL DEFAULT 0,
    Created_At     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    Updated_At     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Users_Roles FOREIGN KEY (Role_ID) REFERENCES dbo.Roles(Role_ID)
);
GO
CREATE INDEX IX_Users_Role_ID ON dbo.Users(Role_ID);
CREATE INDEX IX_Users_Is_Blocked ON dbo.Users(Is_Blocked);
GO

-- =========================================================
-- 3. Kata
-- =========================================================
IF OBJECT_ID('dbo.Kata', 'U') IS NOT NULL DROP TABLE dbo.Kata;
GO
CREATE TABLE dbo.Kata (
    Kata_ID       INT IDENTITY(1,1) PRIMARY KEY,
    Author_ID     INT NOT NULL,
    Title         NVARCHAR(200) NOT NULL,
    Description   NVARCHAR(MAX) NULL,
    Difficulty    NVARCHAR(20) NOT NULL DEFAULT 'beginner',
    Style         NVARCHAR(100) NULL,
    Video_URL     NVARCHAR(500) NULL,
    Thumbnail_URL NVARCHAR(500) NULL,
    Status        NVARCHAR(20) NOT NULL DEFAULT 'pending',
    Created_At    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    Updated_At    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Kata_Author FOREIGN KEY (Author_ID) REFERENCES dbo.Users(User_ID),
    CONSTRAINT CK_Kata_Status CHECK (Status IN ('pending', 'approved', 'rejected')),
    CONSTRAINT CK_Kata_Difficulty CHECK (Difficulty IN ('beginner', 'intermediate', 'advanced', 'master'))
);
GO
CREATE INDEX IX_Kata_Author_ID ON dbo.Kata(Author_ID);
CREATE INDEX IX_Kata_Status ON dbo.Kata(Status);
CREATE INDEX IX_Kata_Style ON dbo.Kata(Style);
GO

-- =========================================================
-- 4. KataSteps
-- =========================================================
IF OBJECT_ID('dbo.KataSteps', 'U') IS NOT NULL DROP TABLE dbo.KataSteps;
GO
CREATE TABLE dbo.KataSteps (
    Step_ID     INT IDENTITY(1,1) PRIMARY KEY,
    Kata_ID     INT NOT NULL,
    Step_Number INT NOT NULL,
    Title       NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    Technique   NVARCHAR(200) NULL,
    Direction   NVARCHAR(50) NULL,
    Duration    INT NULL, -- в секундах
    Image_URL   NVARCHAR(500) NULL,
    Video_URL   NVARCHAR(500) NULL,
    CONSTRAINT FK_KataSteps_Kata FOREIGN KEY (Kata_ID) REFERENCES dbo.Kata(Kata_ID) ON DELETE CASCADE,
    CONSTRAINT UQ_KataSteps_Order UNIQUE (Kata_ID, Step_Number)
);
GO
CREATE INDEX IX_KataSteps_Kata_ID ON dbo.KataSteps(Kata_ID);
GO

-- =========================================================
-- 5. Bunkai
-- =========================================================
IF OBJECT_ID('dbo.Bunkai', 'U') IS NOT NULL DROP TABLE dbo.Bunkai;
GO
CREATE TABLE dbo.Bunkai (
    Bunkai_ID     INT IDENTITY(1,1) PRIMARY KEY,
    Author_ID     INT NOT NULL,
    Kata_ID       INT NOT NULL,
    Title         NVARCHAR(200) NOT NULL,
    Description   NVARCHAR(MAX) NULL,
    Application   NVARCHAR(MAX) NULL,
    Difficulty    NVARCHAR(20) NOT NULL DEFAULT 'beginner',
    Video_URL     NVARCHAR(500) NULL,
    Thumbnail_URL NVARCHAR(500) NULL,
    Status        NVARCHAR(20) NOT NULL DEFAULT 'pending',
    Created_At    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    Updated_At    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Bunkai_Author FOREIGN KEY (Author_ID) REFERENCES dbo.Users(User_ID),
    CONSTRAINT FK_Bunkai_Kata FOREIGN KEY (Kata_ID) REFERENCES dbo.Kata(Kata_ID) ON DELETE NO ACTION,
    CONSTRAINT CK_Bunkai_Status CHECK (Status IN ('pending', 'approved', 'rejected')),
    CONSTRAINT CK_Bunkai_Difficulty CHECK (Difficulty IN ('beginner', 'intermediate', 'advanced', 'master'))
);
GO
CREATE INDEX IX_Bunkai_Author_ID ON dbo.Bunkai(Author_ID);
CREATE INDEX IX_Bunkai_Kata_ID ON dbo.Bunkai(Kata_ID);
CREATE INDEX IX_Bunkai_Status ON dbo.Bunkai(Status);
GO

-- =========================================================
-- 6. Comments (относится либо к Kata, либо к Bunkai)
-- =========================================================
IF OBJECT_ID('dbo.Comments', 'U') IS NOT NULL DROP TABLE dbo.Comments;
GO
CREATE TABLE dbo.Comments (
    Comment_ID INT IDENTITY(1,1) PRIMARY KEY,
    User_ID    INT NOT NULL,
    Kata_ID    INT NULL,
    Bunkai_ID  INT NULL,
    Text       NVARCHAR(2000) NOT NULL,
    Created_At DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    Updated_At DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Comments_User FOREIGN KEY (User_ID) REFERENCES dbo.Users(User_ID),
    CONSTRAINT FK_Comments_Kata FOREIGN KEY (Kata_ID) REFERENCES dbo.Kata(Kata_ID) ON DELETE CASCADE,
    CONSTRAINT FK_Comments_Bunkai FOREIGN KEY (Bunkai_ID) REFERENCES dbo.Bunkai(Bunkai_ID) ON DELETE NO ACTION,
    -- ровно одно из двух полей должно быть заполнено
    CONSTRAINT CK_Comments_Target CHECK (
        (Kata_ID IS NOT NULL AND Bunkai_ID IS NULL) OR
        (Kata_ID IS NULL AND Bunkai_ID IS NOT NULL)
    )
);
GO
CREATE INDEX IX_Comments_Kata_ID ON dbo.Comments(Kata_ID);
CREATE INDEX IX_Comments_Bunkai_ID ON dbo.Comments(Bunkai_ID);
CREATE INDEX IX_Comments_User_ID ON dbo.Comments(User_ID);
GO

-- =========================================================
-- 7. ChatRooms (общий чат додзё + приватные чаты друзей)
-- =========================================================
IF OBJECT_ID('dbo.ChatRooms', 'U') IS NOT NULL DROP TABLE dbo.ChatRooms;
GO
CREATE TABLE dbo.ChatRooms (
    ChatRoom_ID INT IDENTITY(1,1) PRIMARY KEY,
    Room_Type   NVARCHAR(20) NOT NULL,
    Created_At  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_ChatRooms_Type CHECK (Room_Type IN ('general', 'private'))
);
GO

-- Приватные чаты между двумя конкретными друзьями
IF OBJECT_ID('dbo.PrivateChatParticipants', 'U') IS NOT NULL DROP TABLE dbo.PrivateChatParticipants;
GO
CREATE TABLE dbo.PrivateChatParticipants (
    ChatRoom_ID INT NOT NULL,
    User_ID     INT NOT NULL,
    PRIMARY KEY (ChatRoom_ID, User_ID),
    CONSTRAINT FK_PCP_Room FOREIGN KEY (ChatRoom_ID) REFERENCES dbo.ChatRooms(ChatRoom_ID) ON DELETE CASCADE,
    CONSTRAINT FK_PCP_User FOREIGN KEY (User_ID) REFERENCES dbo.Users(User_ID) ON DELETE NO ACTION
);
GO

-- =========================================================
-- 8. ChatMessages
-- =========================================================
IF OBJECT_ID('dbo.ChatMessages', 'U') IS NOT NULL DROP TABLE dbo.ChatMessages;
GO
CREATE TABLE dbo.ChatMessages (
    Message_ID   INT IDENTITY(1,1) PRIMARY KEY,
    ChatRoom_ID  INT NOT NULL,
    User_ID      INT NOT NULL,
    Message_Text NVARCHAR(2000) NOT NULL,
    Created_At   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    Edited_At    DATETIME2 NULL,
    Is_Deleted   BIT NOT NULL DEFAULT 0,
    CONSTRAINT FK_ChatMessages_Room FOREIGN KEY (ChatRoom_ID) REFERENCES dbo.ChatRooms(ChatRoom_ID) ON DELETE CASCADE,
    CONSTRAINT FK_ChatMessages_User FOREIGN KEY (User_ID) REFERENCES dbo.Users(User_ID) ON DELETE NO ACTION
);
GO
CREATE INDEX IX_ChatMessages_Room_Created ON dbo.ChatMessages(ChatRoom_ID, Created_At);
CREATE INDEX IX_ChatMessages_User_ID ON dbo.ChatMessages(User_ID);
GO

-- =========================================================
-- 9. FriendRequests
-- =========================================================
IF OBJECT_ID('dbo.FriendRequests', 'U') IS NOT NULL DROP TABLE dbo.FriendRequests;
GO
CREATE TABLE dbo.FriendRequests (
    Request_ID  INT IDENTITY(1,1) PRIMARY KEY,
    Sender_ID   INT NOT NULL,
    Receiver_ID INT NOT NULL,
    Status      NVARCHAR(20) NOT NULL DEFAULT 'pending',
    Created_At  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    Updated_At  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_FriendRequests_Sender FOREIGN KEY (Sender_ID) REFERENCES dbo.Users(User_ID),
    CONSTRAINT FK_FriendRequests_Receiver FOREIGN KEY (Receiver_ID) REFERENCES dbo.Users(User_ID),
    CONSTRAINT CK_FriendRequests_Status CHECK (Status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    CONSTRAINT CK_FriendRequests_NotSelf CHECK (Sender_ID <> Receiver_ID),
    -- запрет дублирующей активной заявки в любом направлении
    CONSTRAINT UQ_FriendRequests_Pair UNIQUE (Sender_ID, Receiver_ID)
);
GO
CREATE INDEX IX_FriendRequests_Receiver ON dbo.FriendRequests(Receiver_ID, Status);
CREATE INDEX IX_FriendRequests_Sender ON dbo.FriendRequests(Sender_ID, Status);
GO

-- =========================================================
-- 10. Friends
-- =========================================================
IF OBJECT_ID('dbo.Friends', 'U') IS NOT NULL DROP TABLE dbo.Friends;
GO
CREATE TABLE dbo.Friends (
    Friend_ID      INT IDENTITY(1,1) PRIMARY KEY,
    User_ID        INT NOT NULL,
    Friend_User_ID INT NOT NULL,
    Created_At     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Friends_User FOREIGN KEY (User_ID) REFERENCES dbo.Users(User_ID),
    CONSTRAINT FK_Friends_FriendUser FOREIGN KEY (Friend_User_ID) REFERENCES dbo.Users(User_ID),
    CONSTRAINT CK_Friends_NotSelf CHECK (User_ID <> Friend_User_ID),
    CONSTRAINT UQ_Friends_Pair UNIQUE (User_ID, Friend_User_ID)
);
GO
CREATE INDEX IX_Friends_User_ID ON dbo.Friends(User_ID);
GO

-- =========================================================
-- 11. ActivityLogs
-- =========================================================
IF OBJECT_ID('dbo.ActivityLogs', 'U') IS NOT NULL DROP TABLE dbo.ActivityLogs;
GO
CREATE TABLE dbo.ActivityLogs (
    Log_ID      INT IDENTITY(1,1) PRIMARY KEY,
    User_ID     INT NULL,
    Action      NVARCHAR(100) NOT NULL,
    Entity_Type NVARCHAR(50) NULL,
    Entity_ID   INT NULL,
    Details     NVARCHAR(MAX) NULL,
    Ip_Address  NVARCHAR(64) NULL,
    Created_At  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_ActivityLogs_User FOREIGN KEY (User_ID) REFERENCES dbo.Users(User_ID) ON DELETE SET NULL
);
GO
CREATE INDEX IX_ActivityLogs_User_ID ON dbo.ActivityLogs(User_ID);
CREATE INDEX IX_ActivityLogs_Action ON dbo.ActivityLogs(Action);
CREATE INDEX IX_ActivityLogs_Created_At ON dbo.ActivityLogs(Created_At);
GO

-- =========================================================
-- 12. Backups
-- =========================================================
IF OBJECT_ID('dbo.Backups', 'U') IS NOT NULL DROP TABLE dbo.Backups;
GO
CREATE TABLE dbo.Backups (
    Backup_ID   INT IDENTITY(1,1) PRIMARY KEY,
    Created_By  INT NOT NULL,
    File_Name   NVARCHAR(255) NOT NULL,
    File_Path   NVARCHAR(500) NOT NULL,
    Backup_Type NVARCHAR(50) NOT NULL DEFAULT 'full',
    Status      NVARCHAR(20) NOT NULL DEFAULT 'pending',
    Created_At  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Backups_User FOREIGN KEY (Created_By) REFERENCES dbo.Users(User_ID),
    CONSTRAINT CK_Backups_Status CHECK (Status IN ('pending', 'in_progress', 'success', 'failed'))
);
GO
CREATE INDEX IX_Backups_Status ON dbo.Backups(Status);
GO

PRINT 'Схема Bunkai Explorer успешно создана.';
GO
