module.exports = (sequelize, DataTypes) => {
  const Vote = sequelize.define(
    'Vote',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      userId: { type: DataTypes.INTEGER, allowNull: false },
      bunkaiId: { type: DataTypes.INTEGER, allowNull: false },
      value: { type: DataTypes.INTEGER, allowNull: false }, // 1 или -1
    },
    {
      tableName: 'Votes',
      indexes: [{ unique: true, fields: ['userId', 'bunkaiId'] }],
    }
  );
  return Vote;
};
