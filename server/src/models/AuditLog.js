module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define(
    'AuditLog',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      actorId: { type: DataTypes.INTEGER, allowNull: true },
      action: { type: DataTypes.STRING(100), allowNull: false }, // напр. 'user.role.update'
      targetType: { type: DataTypes.STRING(50), allowNull: true }, // 'User' | 'Kata' | 'Bunkai' ...
      targetId: { type: DataTypes.INTEGER, allowNull: true },
      details: { type: DataTypes.TEXT, allowNull: true }, // JSON-строка с подробностями
    },
    { tableName: 'AuditLogs' }
  );
  return AuditLog;
};
