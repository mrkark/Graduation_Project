module.exports = (sequelize, DataTypes) => {
  const Tag = sequelize.define(
    'Tag',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      slug: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    },
    { tableName: 'Tags' }
  );
  return Tag;
};
