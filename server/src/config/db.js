const { Sequelize } = require('sequelize');

// Подключение к Microsoft SQL Server через драйвер tedious
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 1433,
    dialect: 'mssql',
    dialectOptions: {
      options: {
        encrypt: true,
        trustServerCertificate: true, // для локальной разработки / self-signed
      },
    },
    logging: false,
    define: {
      timestamps: true,
      freezeTableName: false,
    },
  }
);

module.exports = sequelize;
