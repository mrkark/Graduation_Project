const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Backup extends Model {}

Backup.init(
  {
    Backup_ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    Created_By: { type: DataTypes.INTEGER, allowNull: false },
    File_Name: { type: DataTypes.STRING(255), allowNull: false },
    File_Path: { type: DataTypes.STRING(500), allowNull: false },
    Backup_Type: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'full' },
    Status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
      validate: { isIn: [['pending', 'in_progress', 'success', 'failed']] },
    },
    Created_At: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { sequelize, modelName: 'Backup', tableName: 'Backups' }
);

module.exports = Backup;
