'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('BunkaiRelations', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      fromBunkaiId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Bunkai', key: 'id' }, onDelete: 'CASCADE' },
      toBunkaiId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Bunkai', key: 'id' }, onDelete: 'CASCADE' },
      type: { type: Sequelize.ENUM('similar', 'variation', 'counter', 'follow_up'), allowNull: false, defaultValue: 'similar' },
      createdBy: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' } },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.createTable('MediaFiles', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      filename: { type: Sequelize.STRING(255), allowNull: false },
      originalName: { type: Sequelize.STRING(255), allowNull: false },
      mimeType: { type: Sequelize.STRING(100), allowNull: false },
      size: { type: Sequelize.INTEGER, allowNull: false },
      path: { type: Sequelize.STRING(500), allowNull: false },
      uploadedBy: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' } },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.createTable('AuditLogs', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      actorId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' } },
      action: { type: Sequelize.STRING(100), allowNull: false },
      targetType: { type: Sequelize.STRING(50), allowNull: true },
      targetId: { type: Sequelize.INTEGER, allowNull: true },
      details: { type: Sequelize.TEXT, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('AuditLogs');
    await queryInterface.dropTable('MediaFiles');
    await queryInterface.dropTable('BunkaiRelations');
  },
};
