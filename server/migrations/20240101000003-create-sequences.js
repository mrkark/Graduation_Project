'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Sequences', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      kataId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Kata', key: 'id' }, onDelete: 'CASCADE' },
      order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      name: { type: Sequelize.STRING(150), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      startTime: { type: Sequelize.INTEGER, allowNull: true },
      endTime: { type: Sequelize.INTEGER, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },
  down: async (queryInterface) => queryInterface.dropTable('Sequences'),
};
