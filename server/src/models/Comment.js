const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Comment extends Model {}

Comment.init(
  {
    Comment_ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    User_ID: { type: DataTypes.INTEGER, allowNull: false },
    Kata_ID: { type: DataTypes.INTEGER, allowNull: true },
    Bunkai_ID: { type: DataTypes.INTEGER, allowNull: true },
    Text: { type: DataTypes.STRING(2000), allowNull: false },
    Created_At: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    Updated_At: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { sequelize, modelName: 'Comment', tableName: 'Comments' }
);

module.exports = Comment;
