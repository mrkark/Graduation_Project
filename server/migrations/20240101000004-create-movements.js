'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Movements', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      sequenceId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Sequences', key: 'id' }, onDelete: 'CASCADE' },
      order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      name: { type: Sequelize.STRING(150), allowNull: false },
      nameJp: { type: Sequelize.STRING(150), allowNull: true },
      stance: { type: Sequelize.STRING(100), allowNull: true },
      direction: { type: Sequelize.STRING(50), allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      youtubeUrl: { type: Sequelize.STRING(500), allowNull: true },
      startTime: { type: Sequelize.INTEGER, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },
  down: async (queryInterface) => queryInterface.dropTable('Movements'),
};
