const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 1433,
  dialect: 'mssql',
  dialectOptions: {
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERT === 'true',
      enableArithAbort: true,
    },
  },
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  define: {
    timestamps: false, // управляем полями Created_At/Updated_At вручную под T-SQL-схему
    freezeTableName: true,
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

module.exports = sequelize;
