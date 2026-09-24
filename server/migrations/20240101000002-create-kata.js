'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Kata', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING(150), allowNull: false },
      nameJp: { type: Sequelize.STRING(150), allowNull: true },
      style: { type: Sequelize.STRING(100), allowNull: false },
      kyuLevel: { type: Sequelize.STRING(50), allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      history: { type: Sequelize.TEXT, allowNull: true },
      youtubeUrl: { type: Sequelize.STRING(500), allowNull: true },
      thumbnailUrl: { type: Sequelize.STRING(500), allowNull: true },
      createdBy: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' } },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },
  down: async (queryInterface) => queryInterface.dropTable('Kata'),
};
