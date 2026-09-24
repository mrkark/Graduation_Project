module.exports = (sequelize, DataTypes) => {
  const BunkaiTag = sequelize.define(
    'BunkaiTag',
    {
      bunkaiId: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
      tagId: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
    },
    { tableName: 'BunkaiTags', timestamps: false }
  );
  return BunkaiTag;
};
