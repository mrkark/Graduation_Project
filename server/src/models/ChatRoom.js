const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class ChatRoom extends Model {}

ChatRoom.init(
  {
    ChatRoom_ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    Room_Type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: { isIn: [['general', 'private']] },
    },
    Created_At: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { sequelize, modelName: 'ChatRoom', tableName: 'ChatRooms' }
);

module.exports = ChatRoom;
