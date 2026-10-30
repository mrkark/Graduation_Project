const path = require('path');
const { poolPromise } = require('../config/database');
const adminRepo = require('../db/adminRepo');

/**
 * backupService — раздел 14 ТЗ.
 * Выполняет реальный BACKUP DATABASE через соединение с Microsoft SQL Server.
 */
async function createBackup({ createdBy }) {
  const fileName = `bunkai_explorer_${new Date().toISOString().replace(/[:.]/g, '-')}.bak`;
  const filePath = `/tmp/${fileName}`;

  let record = await adminRepo.createBackupRecord({ createdBy, fileName, filePath, backupType: 'full' });

  try {
    const pool = await poolPromise;
    const dbName = process.env.DB_NAME || 'BunkaiExplorer';
    const sqlQuery = `BACKUP DATABASE [${dbName}] TO DISK = N'${filePath}' WITH INIT, COMPRESSION;`;
    await pool.request().query(sqlQuery);

    record = await adminRepo.updateBackupStatus(record.Backup_ID, 'success');
    return { backup: record };
  } catch (err) {
    record = await adminRepo.updateBackupStatus(record.Backup_ID, 'failed');
    return {
      backup: record,
      error: `Ошибка при создании резервной копии: ${err.message}`,
    };
  }
}

module.exports = { createBackup };
