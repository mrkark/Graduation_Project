module.exports = (sequelize, DataTypes) => {
  const Sequence = sequelize.define(
    'Sequence',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      kataId: { type: DataTypes.INTEGER, allowNull: false },
      order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      name: { type: DataTypes.STRING(150), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      startTime: { type: DataTypes.INTEGER, allowNull: true }, // секунды в видео ката
      endTime: { type: DataTypes.INTEGER, allowNull: true },
    },
    { tableName: 'Sequences' }
  );
  return Sequence;
};
