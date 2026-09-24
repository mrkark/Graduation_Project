const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class PrivateChatParticipant extends Model {}

PrivateChatParticipant.init(
  {
    ChatRoom_ID: { type: DataTypes.INTEGER, primaryKey: true },
    User_ID: { type: DataTypes.INTEGER, primaryKey: true },
  },
  { sequelize, modelName: 'PrivateChatParticipant', tableName: 'PrivateChatParticipants' }
);

module.exports = PrivateChatParticipant;
