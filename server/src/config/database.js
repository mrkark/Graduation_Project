const sql = require('mssql');
require('dotenv').config();

const config = {
  server: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 1433,
  database: process.env.DB_NAME || 'BunkaiExplorer',
  user: process.env.DB_USER || 'mrkark',
  password: process.env.DB_PASSWORD || 'mrkark9000',
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERT === 'true',
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then((pool) => {
    return pool;
  })
  .catch((err) => {
    console.error('✘ Ошибка подключения к базе данных через mssql:', err.message);
    throw err;
  });

module.exports = { sql, poolPromise };
