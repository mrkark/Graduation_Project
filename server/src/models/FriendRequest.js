const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class FriendRequest extends Model {}

FriendRequest.init(
  {
    Request_ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    Sender_ID: { type: DataTypes.INTEGER, allowNull: false },
    Receiver_ID: { type: DataTypes.INTEGER, allowNull: false },
    Status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
      validate: { isIn: [['pending', 'accepted', 'rejected', 'cancelled']] },
    },
    Created_At: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    Updated_At: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { sequelize, modelName: 'FriendRequest', tableName: 'FriendRequests' }
);

module.exports = FriendRequest;
