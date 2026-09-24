const path = require('path');
const { execFile } = require('child_process');
const adminRepo = require('../db/adminRepo');

/**
 * backupService — раздел 14 ТЗ.
 * Создаёт запись в Backups (через sp_Admin_CreateBackupRecord) и пытается
 * выполнить реальный BACKUP DATABASE через sqlcmd. Если sqlcmd недоступен
 * в окружении, статус честно помечается 'failed' (через sp_Admin_UpdateBackupStatus) —
 * НЕ имитируем фиктивный успех.
 */
async function createBackup({ createdBy }) {
  const fileName = `bunkai_explorer_${new Date().toISOString().replace(/[:.]/g, '-')}.bak`;
  const filePath = path.join(process.env.BACKUP_DIR || '/tmp/bunkai-explorer-backups', fileName);

  let record = await adminRepo.createBackupRecord({ createdBy, fileName, filePath, backupType: 'full' });

  const dbName = process.env.DB_NAME;
  const sql = `BACKUP DATABASE [${dbName}] TO DISK = N'${filePath}' WITH INIT, COMPRESSION;`;

  const args = [
    '-S',
    `${process.env.DB_HOST},${process.env.DB_PORT || 1433}`,
    '-U',
    process.env.DB_USER,
    '-P',
    process.env.DB_PASSWORD,
    '-Q',
    sql,
  ];

  return new Promise((resolve) => {
    execFile('sqlcmd', args, { timeout: 5 * 60 * 1000 }, async (error, stdout, stderr) => {
      if (error) {
        record = await adminRepo.updateBackupStatus(record.Backup_ID, 'failed');
        resolve({
          backup: record,
          error: `Не удалось выполнить резервное копирование через sqlcmd: ${error.message}. Убедитесь, что утилита sqlcmd установлена и доступна на сервере приложения.`,
        });
        return;
      }
      record = await adminRepo.updateBackupStatus(record.Backup_ID, 'success');
      resolve({ backup: record, stdout, stderr });
    });
  });
}

module.exports = { createBackup };
