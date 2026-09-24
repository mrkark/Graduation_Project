const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Friend extends Model {}

Friend.init(
  {
    Friend_ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    User_ID: { type: DataTypes.INTEGER, allowNull: false },
    Friend_User_ID: { type: DataTypes.INTEGER, allowNull: false },
    Created_At: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { sequelize, modelName: 'Friend', tableName: 'Friends' }
);

module.exports = Friend;
