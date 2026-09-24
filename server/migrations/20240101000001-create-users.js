'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Users', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      email: { type: Sequelize.STRING(255), allowNull: false, unique: true },
      passwordHash: { type: Sequelize.STRING(255), allowNull: false },
      username: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      role: { type: Sequelize.ENUM('user', 'moderator', 'admin'), allowNull: false, defaultValue: 'user' },
      avatar: { type: Sequelize.STRING(500), allowNull: true },
      reputation: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      isBanned: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },
  down: async (queryInterface) => queryInterface.dropTable('Users'),
};
