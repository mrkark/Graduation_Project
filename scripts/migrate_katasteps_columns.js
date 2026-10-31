const { poolPromise } = require('../server/src/config/database');

async function migrate() {
  const pool = await poolPromise;
  console.log('Подключение к MSSQL установлено...');

  const queries = [
    `IF COL_LENGTH('dbo.KataSteps', 'Clip_ID') IS NULL
       ALTER TABLE dbo.KataSteps ADD Clip_ID INT NULL REFERENCES dbo.AnimationClips(Clip_ID);`,
    `IF COL_LENGTH('dbo.KataSteps', 'Stance_In') IS NULL
       ALTER TABLE dbo.KataSteps ADD Stance_In NVARCHAR(50) NULL;`,
    `IF COL_LENGTH('dbo.KataSteps', 'Stance_Out') IS NULL
       ALTER TABLE dbo.KataSteps ADD Stance_Out NVARCHAR(50) NULL;`,
    `IF COL_LENGTH('dbo.KataSteps', 'Root_Displacement_X') IS NULL
       ALTER TABLE dbo.KataSteps ADD Root_Displacement_X FLOAT NULL DEFAULT 0.0;`,
    `IF COL_LENGTH('dbo.KataSteps', 'Root_Displacement_Z') IS NULL
       ALTER TABLE dbo.KataSteps ADD Root_Displacement_Z FLOAT NULL DEFAULT 0.0;`,
    `IF COL_LENGTH('dbo.KataSteps', 'Root_Rotation_Y') IS NULL
       ALTER TABLE dbo.KataSteps ADD Root_Rotation_Y FLOAT NULL DEFAULT 0.0;`,
  ];

  for (const q of queries) {
    await pool.request().query(q);
  }

  console.log('✔ Колонки успешно добавлены/проверены в dbo.KataSteps.');

  const res = await pool.request().query(
    "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'KataSteps'"
  );
  console.log('Текущий состав колонок dbo.KataSteps:');
  console.log(res.recordset.map((r) => `${r.COLUMN_NAME} (${r.DATA_TYPE})`).join(', '));

  process.exit(0);
}

migrate().catch((err) => {
  console.error('Ошибка миграции:', err);
  process.exit(1);
});
