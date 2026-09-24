const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class User extends Model {
  // Никогда не возвращать хеш пароля клиенту
  toSafeJSON() {
    const { Password_Hash, ...safe } = this.toJSON();
    return safe;
  }
}

User.init(
  {
    User_ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    Role_ID: { type: DataTypes.INTEGER, allowNull: false },
    Username: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    Email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    Password_Hash: { type: DataTypes.STRING(255), allowNull: false },
    Avatar_URL: { type: DataTypes.STRING(500), allowNull: true },
    Display_Name: { type: DataTypes.STRING(100), allowNull: true },
    Bio: { type: DataTypes.TEXT, allowNull: true },
    Is_Blocked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    Created_At: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    Updated_At: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'Users',
  }
);

module.exports = User;
