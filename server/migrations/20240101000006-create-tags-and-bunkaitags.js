'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Tags', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      slug: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.createTable('BunkaiTags', {
      bunkaiId: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true, references: { model: 'Bunkai', key: 'id' }, onDelete: 'CASCADE' },
      tagId: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true, references: { model: 'Tags', key: 'id' }, onDelete: 'CASCADE' },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('BunkaiTags');
    await queryInterface.dropTable('Tags');
  },
};
