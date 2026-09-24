const { RELATION_TYPES } = require('../config/constants');

module.exports = (sequelize, DataTypes) => {
  const BunkaiRelation = sequelize.define(
    'BunkaiRelation',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      fromBunkaiId: { type: DataTypes.INTEGER, allowNull: false },
      toBunkaiId: { type: DataTypes.INTEGER, allowNull: false },
      type: {
        type: DataTypes.ENUM(...Object.values(RELATION_TYPES)),
        allowNull: false,
        defaultValue: RELATION_TYPES.SIMILAR,
      },
      createdBy: { type: DataTypes.INTEGER, allowNull: true },
    },
    { tableName: 'BunkaiRelations' }
  );
  return BunkaiRelation;
};
