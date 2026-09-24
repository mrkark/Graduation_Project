'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Bunkai', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      movementId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Movements', key: 'id' }, onDelete: 'CASCADE' },
      title: { type: Sequelize.STRING(200), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      youtubeUrl: { type: Sequelize.STRING(500), allowNull: true },
      difficulty: { type: Sequelize.ENUM('beginner', 'intermediate', 'advanced'), allowNull: false, defaultValue: 'beginner' },
      createdBy: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' } },
      status: { type: Sequelize.ENUM('pending', 'approved', 'rejected'), allowNull: false, defaultValue: 'pending' },
      rating: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },
  down: async (queryInterface) => queryInterface.dropTable('Bunkai'),
};
