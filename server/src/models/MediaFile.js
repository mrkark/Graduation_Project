module.exports = (sequelize, DataTypes) => {
  const MediaFile = sequelize.define(
    'MediaFile',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      filename: { type: DataTypes.STRING(255), allowNull: false },
      originalName: { type: DataTypes.STRING(255), allowNull: false },
      mimeType: { type: DataTypes.STRING(100), allowNull: false },
      size: { type: DataTypes.INTEGER, allowNull: false },
      path: { type: DataTypes.STRING(500), allowNull: false },
      uploadedBy: { type: DataTypes.INTEGER, allowNull: true },
    },
    { tableName: 'MediaFiles' }
  );
  return MediaFile;
};
