const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class ActivityLog extends Model {}

ActivityLog.init(
  {
    Log_ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    User_ID: { type: DataTypes.INTEGER, allowNull: true },
    Action: { type: DataTypes.STRING(100), allowNull: false },
    Entity_Type: { type: DataTypes.STRING(50), allowNull: true },
    Entity_ID: { type: DataTypes.INTEGER, allowNull: true },
    Details: { type: DataTypes.TEXT, allowNull: true },
    Ip_Address: { type: DataTypes.STRING(64), allowNull: true },
    Created_At: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { sequelize, modelName: 'ActivityLog', tableName: 'ActivityLogs' }
);

module.exports = ActivityLog;
