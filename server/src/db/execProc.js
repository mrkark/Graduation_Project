const { QueryTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * ApiError — типизированная ошибка с HTTP-статусом и кодом, которую
 * контроллеры превращают в ответ через utils/apiResponse.fail().
 */
class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Разбирает сообщение THROW из процедуры: 'ERR|404|KATA_NOT_FOUND|Ката не найдено'
function parseProcedureError(err) {
  const raw = err?.original?.message || err?.parent?.message || err?.message || '';
  const match = raw.match(/ERR\|(\d{3})\|([A-Z0-9_]+)\|([\s\S]*)/);
  if (match) {
    const [, status, code, message] = match;
    return new ApiError(Number(status), message.trim(), code);
  }
  return err;
}

/**
 * callProcedure — ЕДИНСТВЕННОЕ место в приложении, где встречается SQL-текст:
 * буквально "EXEC dbo.<имя> @param = :param, ...". Вся остальная логика
 * (проверки прав, видимость по ролям, модерация и т.д.) живёт в
 * database/procedures.sql. Контроллеры вызывают только именованные функции
 * из server/src/db/*Repo.js — они, в свою очередь, вызывают callProcedure.
 *
 * @param {string} procName — имя процедуры/функции без схемы (dbo. добавляется автоматически)
 * @param {object} params — именованные параметры (@Key = :key)
 * @returns {Promise<object[]>} строки первого набора результатов
 */
async function callProcedure(procName, params = {}) {
  const safeParams = {};
  for (const [key, value] of Object.entries(params)) {
    safeParams[key] = value === undefined ? null : value;
  }

  const assignments = Object.keys(safeParams)
    .map((key) => `@${key} = :${key}`)
    .join(', ');
  const sql = assignments ? `EXEC dbo.${procName} ${assignments};` : `EXEC dbo.${procName};`;

  try {
    return await sequelize.query(sql, { replacements: safeParams, type: QueryTypes.SELECT });
  } catch (err) {
    throw parseProcedureError(err);
  }
}

// Вызов скалярной функции: SELECT dbo.fn_Xxx(@p1, @p2) AS Result
async function callScalarFunction(fnName, orderedArgs = []) {
  const placeholders = orderedArgs.map((_, i) => `:arg${i}`).join(', ');
  const replacements = {};
  orderedArgs.forEach((v, i) => {
    replacements[`arg${i}`] = v === undefined ? null : v;
  });

  const sql = `SELECT dbo.${fnName}(${placeholders}) AS Result;`;
  try {
    const rows = await sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
    return rows[0]?.Result;
  } catch (err) {
    throw parseProcedureError(err);
  }
}

module.exports = { callProcedure, callScalarFunction, ApiError };
