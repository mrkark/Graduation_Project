/**
 * Генерирует database/seed.sql из database/seed.template.sql,
 * подставляя реальные bcrypt-хеши (той же библиотекой bcryptjs,
 * которую использует сам сервер для проверки паролей).
 *
 * Запуск: npm run seed:sql   (из папки server/)
 *
 * Пароли по умолчанию берутся из переменных окружения,
 * если заданы, иначе используются значения из README
 * (обязательно смените их после первого входа в проде).
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const TEMPLATE_PATH = path.resolve(__dirname, '../../database/seed.template.sql');
const OUTPUT_PATH = path.resolve(__dirname, '../../database/seed.sql');

const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin#12345';
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || 'Demo#12345';

function escapeSqlString(str) {
  return str.replace(/'/g, "''");
}

async function main() {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error(`Шаблон не найден: ${TEMPLATE_PATH}`);
    process.exit(1);
  }

  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const demoHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  let sql = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  sql = sql.replace('{{ADMIN_PASSWORD_HASH}}', escapeSqlString(adminHash));
  sql = sql.replace('{{DEMO_PASSWORD_HASH}}', escapeSqlString(demoHash));

  fs.writeFileSync(OUTPUT_PATH, sql, 'utf8');

  console.log('✔ seed.sql сгенерирован:', OUTPUT_PATH);
  console.log('');
  console.log('Учётные данные для входа после применения seed.sql:');
  console.log(`  Администратор — логин: admin       пароль: ${ADMIN_PASSWORD}`);
  console.log(`  Пользователь  — логин: demo_user   пароль: ${DEMO_PASSWORD}`);
  console.log('');
  console.log('⚠ Смените эти пароли сразу после первого входа в продакшн-среде.');
}

main().catch((err) => {
  console.error('Ошибка генерации seed.sql:', err);
  process.exit(1);
});
