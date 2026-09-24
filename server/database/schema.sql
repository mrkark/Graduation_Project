/* =====================================================================
   Bunkai Explorer — схема базы данных (Microsoft SQL Server, T-SQL)
   Соответствует Sequelize-моделям из server/src/models.
   Накатывается напрямую, без Node.js/Sequelize:
     sqlcmd -S localhost -U sa -P "YourStrong!Passw0rd" -d bunkai_explorer -i schema.sql
   ===================================================================== */

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- ---------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.Users', 'U') IS NOT NULL DROP TABLE dbo.Users;
GO
CREATE TABLE dbo.Users (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    email         NVARCHAR(255) NOT NULL,
    passwordHash  NVARCHAR(255) NOT NULL,
    username      NVARCHAR(50)  NOT NULL,
    role          NVARCHAR(20)  NOT NULL DEFAULT 'user'
                  CONSTRAINT CK_Users_Role CHECK (role IN ('user', 'moderator', 'admin')),
    avatar        NVARCHAR(500) NULL,
    reputation    INT NOT NULL DEFAULT 0,
    isBanned      BIT NOT NULL DEFAULT 0,
    createdAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_Users_Email UNIQUE (email),
    CONSTRAINT UQ_Users_Username UNIQUE (username)
);
GO

-- ---------------------------------------------------------------------
-- Kata
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.Kata', 'U') IS NOT NULL DROP TABLE dbo.Kata;
GO
CREATE TABLE dbo.Kata (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    name          NVARCHAR(150) NOT NULL,
    nameJp        NVARCHAR(150) NULL,
    style         NVARCHAR(100) NOT NULL,
    kyuLevel      NVARCHAR(50)  NULL,
    description   NVARCHAR(MAX) NULL,
    history       NVARCHAR(MAX) NULL,
    youtubeUrl    NVARCHAR(500) NULL,
    thumbnailUrl  NVARCHAR(500) NULL,
    createdBy     INT NULL,
    createdAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Kata_CreatedBy FOREIGN KEY (createdBy) REFERENCES dbo.Users(id)
);
GO

-- ---------------------------------------------------------------------
-- Sequences (последовательности внутри ката)
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.Sequences', 'U') IS NOT NULL DROP TABLE dbo.Sequences;
GO
CREATE TABLE dbo.Sequences (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    kataId        INT NOT NULL,
    [order]       INT NOT NULL DEFAULT 0,
    name          NVARCHAR(150) NOT NULL,
    description   NVARCHAR(MAX) NULL,
    startTime     INT NULL,
    endTime       INT NULL,
    createdAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Sequences_Kata FOREIGN KEY (kataId) REFERENCES dbo.Kata(id) ON DELETE CASCADE
);
GO

-- ---------------------------------------------------------------------
-- Movements (движения внутри последовательности)
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.Movements', 'U') IS NOT NULL DROP TABLE dbo.Movements;
GO
CREATE TABLE dbo.Movements (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    sequenceId    INT NOT NULL,
    [order]       INT NOT NULL DEFAULT 0,
    name          NVARCHAR(150) NOT NULL,
    nameJp        NVARCHAR(150) NULL,
    stance        NVARCHAR(100) NULL,
    direction     NVARCHAR(50)  NULL,
    description   NVARCHAR(MAX) NULL,
    youtubeUrl    NVARCHAR(500) NULL,
    startTime     INT NULL,
    createdAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Movements_Sequence FOREIGN KEY (sequenceId) REFERENCES dbo.Sequences(id) ON DELETE CASCADE
);
GO

-- ---------------------------------------------------------------------
-- Bunkai
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.Bunkai', 'U') IS NOT NULL DROP TABLE dbo.Bunkai;
GO
CREATE TABLE dbo.Bunkai (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    movementId    INT NOT NULL,
    title         NVARCHAR(200) NOT NULL,
    description   NVARCHAR(MAX) NULL,
    youtubeUrl    NVARCHAR(500) NULL,
    difficulty    NVARCHAR(20) NOT NULL DEFAULT 'beginner'
                  CONSTRAINT CK_Bunkai_Difficulty CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    createdBy     INT NULL,
    status        NVARCHAR(20) NOT NULL DEFAULT 'pending'
                  CONSTRAINT CK_Bunkai_Status CHECK (status IN ('pending', 'approved', 'rejected')),
    rating        INT NOT NULL DEFAULT 0,
    createdAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Bunkai_Movement FOREIGN KEY (movementId) REFERENCES dbo.Movements(id) ON DELETE CASCADE,
    CONSTRAINT FK_Bunkai_CreatedBy FOREIGN KEY (createdBy) REFERENCES dbo.Users(id)
);
GO

-- ---------------------------------------------------------------------
-- Tags + BunkaiTags (many-to-many)
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.Tags', 'U') IS NOT NULL DROP TABLE dbo.Tags;
GO
CREATE TABLE dbo.Tags (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    name          NVARCHAR(50) NOT NULL,
    slug          NVARCHAR(50) NOT NULL,
    createdAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_Tags_Name UNIQUE (name),
    CONSTRAINT UQ_Tags_Slug UNIQUE (slug)
);
GO

IF OBJECT_ID('dbo.BunkaiTags', 'U') IS NOT NULL DROP TABLE dbo.BunkaiTags;
GO
CREATE TABLE dbo.BunkaiTags (
    bunkaiId      INT NOT NULL,
    tagId         INT NOT NULL,
    CONSTRAINT PK_BunkaiTags PRIMARY KEY (bunkaiId, tagId),
    CONSTRAINT FK_BunkaiTags_Bunkai FOREIGN KEY (bunkaiId) REFERENCES dbo.Bunkai(id) ON DELETE CASCADE,
    CONSTRAINT FK_BunkaiTags_Tag FOREIGN KEY (tagId) REFERENCES dbo.Tags(id) ON DELETE CASCADE
);
GO

-- ---------------------------------------------------------------------
-- Votes
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.Votes', 'U') IS NOT NULL DROP TABLE dbo.Votes;
GO
CREATE TABLE dbo.Votes (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    userId        INT NOT NULL,
    bunkaiId      INT NOT NULL,
    value         INT NOT NULL CONSTRAINT CK_Votes_Value CHECK (value IN (1, -1)),
    createdAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Votes_User FOREIGN KEY (userId) REFERENCES dbo.Users(id) ON DELETE CASCADE,
    CONSTRAINT FK_Votes_Bunkai FOREIGN KEY (bunkaiId) REFERENCES dbo.Bunkai(id) ON DELETE NO ACTION,
    CONSTRAINT UQ_Votes_User_Bunkai UNIQUE (userId, bunkaiId)
);
GO

-- ---------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.Comments', 'U') IS NOT NULL DROP TABLE dbo.Comments;
GO
CREATE TABLE dbo.Comments (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    userId        INT NOT NULL,
    bunkaiId      INT NOT NULL,
    text          NVARCHAR(MAX) NOT NULL,
    isHidden      BIT NOT NULL DEFAULT 0,
    createdAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Comments_User FOREIGN KEY (userId) REFERENCES dbo.Users(id) ON DELETE CASCADE,
    CONSTRAINT FK_Comments_Bunkai FOREIGN KEY (bunkaiId) REFERENCES dbo.Bunkai(id) ON DELETE NO ACTION
);
GO

-- ---------------------------------------------------------------------
-- BunkaiRelations (граф рекомендаций между бункаями)
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.BunkaiRelations', 'U') IS NOT NULL DROP TABLE dbo.BunkaiRelations;
GO
CREATE TABLE dbo.BunkaiRelations (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    fromBunkaiId  INT NOT NULL,
    toBunkaiId    INT NOT NULL,
    type          NVARCHAR(20) NOT NULL DEFAULT 'similar'
                  CONSTRAINT CK_BunkaiRelations_Type CHECK (type IN ('similar', 'variation', 'counter', 'follow_up')),
    createdBy     INT NULL,
    createdAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_BunkaiRelations_From FOREIGN KEY (fromBunkaiId) REFERENCES dbo.Bunkai(id) ON DELETE NO ACTION,
    CONSTRAINT FK_BunkaiRelations_To FOREIGN KEY (toBunkaiId) REFERENCES dbo.Bunkai(id) ON DELETE NO ACTION,
    CONSTRAINT FK_BunkaiRelations_CreatedBy FOREIGN KEY (createdBy) REFERENCES dbo.Users(id)
);
GO

-- ---------------------------------------------------------------------
-- MediaFiles
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.MediaFiles', 'U') IS NOT NULL DROP TABLE dbo.MediaFiles;
GO
CREATE TABLE dbo.MediaFiles (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    filename      NVARCHAR(255) NOT NULL,
    originalName  NVARCHAR(255) NOT NULL,
    mimeType      NVARCHAR(100) NOT NULL,
    size          INT NOT NULL,
    path          NVARCHAR(500) NOT NULL,
    uploadedBy    INT NULL,
    createdAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_MediaFiles_UploadedBy FOREIGN KEY (uploadedBy) REFERENCES dbo.Users(id)
);
GO

-- ---------------------------------------------------------------------
-- AuditLogs
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.AuditLogs', 'U') IS NOT NULL DROP TABLE dbo.AuditLogs;
GO
CREATE TABLE dbo.AuditLogs (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    actorId       INT NULL,
    action        NVARCHAR(100) NOT NULL,
    targetType    NVARCHAR(50) NULL,
    targetId      INT NULL,
    details       NVARCHAR(MAX) NULL,
    createdAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_AuditLogs_Actor FOREIGN KEY (actorId) REFERENCES dbo.Users(id)
);
GO

-- ---------------------------------------------------------------------
-- Индексы для типичных запросов (поиск, фильтрация, лента)
-- ---------------------------------------------------------------------
CREATE INDEX IX_Kata_Style ON dbo.Kata(style);
CREATE INDEX IX_Bunkai_Status ON dbo.Bunkai(status);
CREATE INDEX IX_Bunkai_MovementId ON dbo.Bunkai(movementId);
CREATE INDEX IX_Comments_BunkaiId ON dbo.Comments(bunkaiId);
CREATE INDEX IX_AuditLogs_CreatedAt ON dbo.AuditLogs(createdAt DESC);
GO

PRINT 'Схема Bunkai Explorer успешно создана.';
GO
