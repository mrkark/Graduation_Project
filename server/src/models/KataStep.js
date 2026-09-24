const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class KataStep extends Model {}

KataStep.init(
  {
    Step_ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    Kata_ID: { type: DataTypes.INTEGER, allowNull: false },
    Step_Number: { type: DataTypes.INTEGER, allowNull: false },
    Title: { type: DataTypes.STRING(200), allowNull: false },
    Description: { type: DataTypes.TEXT, allowNull: true },
    Technique: { type: DataTypes.STRING(200), allowNull: true },
    Direction: { type: DataTypes.STRING(50), allowNull: true },
    Duration: { type: DataTypes.INTEGER, allowNull: true },
    Image_URL: { type: DataTypes.STRING(500), allowNull: true },
    Video_URL: { type: DataTypes.STRING(500), allowNull: true },
  },
  { sequelize, modelName: 'KataStep', tableName: 'KataSteps' }
);

module.exports = KataStep;
