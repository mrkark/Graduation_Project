const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Role extends Model {}

Role.init(
  {
    Role_ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    Role_Name: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    Description: { type: DataTypes.STRING(255), allowNull: true },
    Created_At: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    modelName: 'Role',
    tableName: 'Roles',
  }
);

// Известные системные роли (используются в middleware вместо магических строк)
Role.NAMES = {
  GUEST: 'guest',
  USER: 'user',
  ADMIN: 'admin',
};

module.exports = Role;
