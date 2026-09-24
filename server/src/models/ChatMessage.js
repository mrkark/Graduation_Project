const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class ChatMessage extends Model {}

ChatMessage.init(
  {
    Message_ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    ChatRoom_ID: { type: DataTypes.INTEGER, allowNull: false },
    User_ID: { type: DataTypes.INTEGER, allowNull: false },
    Message_Text: { type: DataTypes.STRING(2000), allowNull: false },
    Created_At: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    Edited_At: { type: DataTypes.DATE, allowNull: true },
    Is_Deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  { sequelize, modelName: 'ChatMessage', tableName: 'ChatMessages' }
);

module.exports = ChatMessage;
