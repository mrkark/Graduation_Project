const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Kata extends Model {}

Kata.init(
  {
    Kata_ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    Author_ID: { type: DataTypes.INTEGER, allowNull: false },
    Title: { type: DataTypes.STRING(200), allowNull: false },
    Description: { type: DataTypes.TEXT, allowNull: true },
    Difficulty: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'beginner',
      validate: { isIn: [['beginner', 'intermediate', 'advanced', 'master']] },
    },
    Style: { type: DataTypes.STRING(100), allowNull: true },
    Video_URL: { type: DataTypes.STRING(500), allowNull: true },
    Thumbnail_URL: { type: DataTypes.STRING(500), allowNull: true },
    Status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
      validate: { isIn: [['pending', 'approved', 'rejected']] },
    },
    Created_At: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    Updated_At: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { sequelize, modelName: 'Kata', tableName: 'Kata' }
);

module.exports = Kata;
