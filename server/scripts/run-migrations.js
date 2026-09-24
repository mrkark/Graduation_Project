/**
 * Применяет database/schema.sql и database/triggers.sql к базе данных,
 * используя те же параметры подключения, что и сам сервер (.env).
 *
 * Это НЕ полноценная система версионированных миграций (raw SQL-скрипты
 * написаны так, что их можно запускать повторно — см. IF OBJECT_ID ... IS NULL
 * в schema.sql), а простой раннер для случаев, когда sqlcmd недоступен
 * на машине разработчика и нужно применить схему прямо из Node.js.
 *
 * Запуск: npm run migrate   (из папки server/)
 * Альтернатива без Node.js: см. раздел README "Альтернатива: чистый SQL-путь".
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sequelize = require('../src/config/database');

const FILES = [
  path.resolve(__dirname, '../../database/schema.sql'),
  path.resolve(__dirname, '../../database/triggers.sql'),
  path.resolve(__dirname, '../../database/procedures.sql'),
];

// T-SQL скрипты используют "GO" как разделитель батчей — это не валидный
// SQL-оператор, его понимает только sqlcmd/SSMS, поэтому режем вручную.
function splitBatches(sql) {
  return sql
    .split(/^\s*GO\s*$/im)
    .map((batch) => batch.trim())
    .filter(Boolean);
}

async function runFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠ Файл не найден, пропускаю: ${filePath}`);
    return;
  }
  const sql = fs.readFileSync(filePath, 'utf8');
  const batches = splitBatches(sql);

  console.log(`\n→ Применяю ${path.basename(filePath)} (${batches.length} батчей)…`);
  for (const [i, batch] of batches.entries()) {
    try {
      await sequelize.query(batch);
    } catch (err) {
      console.error(`✘ Ошибка в батче #${i + 1} файла ${path.basename(filePath)}:`);
      console.error(err.original?.message || err.message);
      throw err;
    }
  }
  console.log(`✔ ${path.basename(filePath)} применён.`);
}

async function main() {
  try {
    await sequelize.authenticate();
    console.log('✔ Подключение к MSSQL установлено.');
  } catch (err) {
    console.error('✘ Не удалось подключиться к базе данных:', err.message);
    process.exit(1);
  }

  for (const file of FILES) {
    await runFile(file);
  }

  console.log('\n✔ Схема базы данных применена. Теперь выполните: npm run seed:sql, затем примените database/seed.sql через sqlcmd.');
  await sequelize.close();
}

main().catch((err) => {
  console.error('\n✘ Применение схемы прервано из-за ошибки:', err.message);
  process.exit(1);
});
