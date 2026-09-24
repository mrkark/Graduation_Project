module.exports = (sequelize, DataTypes) => {
  const Movement = sequelize.define(
    'Movement',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      sequenceId: { type: DataTypes.INTEGER, allowNull: false },
      order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      name: { type: DataTypes.STRING(150), allowNull: false },
      nameJp: { type: DataTypes.STRING(150), allowNull: true },
      stance: { type: DataTypes.STRING(100), allowNull: true }, // напр. "Zenkutsu-dachi"
      direction: { type: DataTypes.STRING(50), allowNull: true }, // напр. "вперёд", "90° влево"
      description: { type: DataTypes.TEXT, allowNull: true },
      youtubeUrl: { type: DataTypes.STRING(500), allowNull: true },
      startTime: { type: DataTypes.INTEGER, allowNull: true }, // таймкод для перемотки
    },
    { tableName: 'Movements' }
  );
  return Movement;
};
