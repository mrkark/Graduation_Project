// Конфиг для sequelize-cli (миграции/сидеры), читает те же .env переменные
require('dotenv').config();

const base = {
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 1433,
  dialect: 'mssql',
  dialectOptions: {
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
  },
};

module.exports = {
  development: base,
  test: base,
  production: base,
};
