const sequelize = require('../config/database');
const Role = require('./Role');
const User = require('./User');
const Kata = require('./Kata');
const KataStep = require('./KataStep');
const Bunkai = require('./Bunkai');
const Comment = require('./Comment');
const ChatRoom = require('./ChatRoom');
const PrivateChatParticipant = require('./PrivateChatParticipant');
const ChatMessage = require('./ChatMessage');
const FriendRequest = require('./FriendRequest');
const Friend = require('./Friend');
const ActivityLog = require('./ActivityLog');
const Backup = require('./Backup');

// --- Roles <-> Users ---
Role.hasMany(User, { foreignKey: 'Role_ID' });
User.belongsTo(Role, { foreignKey: 'Role_ID' });

// --- Users <-> Kata ---
User.hasMany(Kata, { foreignKey: 'Author_ID', as: 'AuthoredKata' });
Kata.belongsTo(User, { foreignKey: 'Author_ID', as: 'Author' });

// --- Kata <-> KataSteps ---
Kata.hasMany(KataStep, { foreignKey: 'Kata_ID', as: 'Steps', onDelete: 'CASCADE' });
KataStep.belongsTo(Kata, { foreignKey: 'Kata_ID' });

// --- Users/Kata <-> Bunkai ---
User.hasMany(Bunkai, { foreignKey: 'Author_ID', as: 'AuthoredBunkai' });
Bunkai.belongsTo(User, { foreignKey: 'Author_ID', as: 'Author' });
Kata.hasMany(Bunkai, { foreignKey: 'Kata_ID', as: 'RelatedBunkai' });
Bunkai.belongsTo(Kata, { foreignKey: 'Kata_ID', as: 'Kata' });

// --- Comments ---
User.hasMany(Comment, { foreignKey: 'User_ID' });
Comment.belongsTo(User, { foreignKey: 'User_ID', as: 'Author' });
Kata.hasMany(Comment, { foreignKey: 'Kata_ID', onDelete: 'CASCADE' });
Comment.belongsTo(Kata, { foreignKey: 'Kata_ID' });
Bunkai.hasMany(Comment, { foreignKey: 'Bunkai_ID' });
Comment.belongsTo(Bunkai, { foreignKey: 'Bunkai_ID' });

// --- ChatRooms ---
ChatRoom.belongsToMany(User, { through: PrivateChatParticipant, foreignKey: 'ChatRoom_ID', as: 'Participants' });
User.belongsToMany(ChatRoom, { through: PrivateChatParticipant, foreignKey: 'User_ID', as: 'PrivateRooms' });

ChatRoom.hasMany(ChatMessage, { foreignKey: 'ChatRoom_ID', onDelete: 'CASCADE' });
ChatMessage.belongsTo(ChatRoom, { foreignKey: 'ChatRoom_ID' });
User.hasMany(ChatMessage, { foreignKey: 'User_ID' });
ChatMessage.belongsTo(User, { foreignKey: 'User_ID', as: 'Author' });

// --- Friends ---
User.hasMany(FriendRequest, { foreignKey: 'Sender_ID', as: 'SentRequests' });
User.hasMany(FriendRequest, { foreignKey: 'Receiver_ID', as: 'ReceivedRequests' });
FriendRequest.belongsTo(User, { foreignKey: 'Sender_ID', as: 'Sender' });
FriendRequest.belongsTo(User, { foreignKey: 'Receiver_ID', as: 'Receiver' });

User.hasMany(Friend, { foreignKey: 'User_ID' });
Friend.belongsTo(User, { foreignKey: 'User_ID' });
Friend.belongsTo(User, { foreignKey: 'Friend_User_ID', as: 'FriendUser' });

// --- Logs & Backups ---
User.hasMany(ActivityLog, { foreignKey: 'User_ID' });
ActivityLog.belongsTo(User, { foreignKey: 'User_ID' });
User.hasMany(Backup, { foreignKey: 'Created_By' });
Backup.belongsTo(User, { foreignKey: 'Created_By', as: 'CreatedByUser' });

module.exports = {
  sequelize,
  Role,
  User,
  Kata,
  KataStep,
  Bunkai,
  Comment,
  ChatRoom,
  PrivateChatParticipant,
  ChatMessage,
  FriendRequest,
  Friend,
  ActivityLog,
  Backup,
};
