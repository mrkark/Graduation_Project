const { poolPromise, sql } = require('../config/database');

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
  const raw = err?.originalError?.message || err?.precedingErrors?.[0]?.message || err?.message || '';
  const match = raw.match(/ERR\|(\d{3})\|([A-Z0-9_]+)\|([\s\S]*)/);
  if (match) {
    const [, status, code, message] = match;
    return new ApiError(Number(status), message.trim(), code);
  }
  return err;
}

/**
 * callProcedure — выполняет хранимую процедуру через библиотеку mssql с параметризованными входными данными.
 *
 * @param {string} procName — имя процедуры без схемы (dbo. добавляется автоматически)
 * @param {object} params — именованные параметры (@Key = value)
 * @returns {Promise<object[]>} строки первого набора результатов (recordset)
 */
async function callProcedure(procName, params = {}) {
  const pool = await poolPromise;
  const request = pool.request();

  for (const [key, value] of Object.entries(params)) {
    request.input(key, value === undefined ? null : value);
  }

  try {
    const result = await request.execute(`dbo.${procName}`);
    return result.recordset || [];
  } catch (err) {
    throw parseProcedureError(err);
  }
}

// Вызов скалярной функции: SELECT dbo.fn_Xxx(@p1, @p2) AS Result
async function callScalarFunction(fnName, orderedArgs = []) {
  const pool = await poolPromise;
  const request = pool.request();

  const placeholders = orderedArgs.map((v, i) => {
    const paramKey = `arg${i}`;
    request.input(paramKey, v === undefined ? null : v);
    return `@${paramKey}`;
  });

  const queryText = `SELECT dbo.${fnName}(${placeholders.join(', ')}) AS Result;`;
  try {
    const result = await request.query(queryText);
    return result.recordset?.[0]?.Result;
  } catch (err) {
    throw parseProcedureError(err);
  }
}

async function callProcedureWithRecordsets(procName, params = {}) {
  const pool = await poolPromise;
  const request = pool.request();

  for (const [key, value] of Object.entries(params)) {
    request.input(key, value === undefined ? null : value);
  }

  try {
    const result = await request.execute(`dbo.${procName}`);
    return result.recordsets || [];
  } catch (err) {
    throw parseProcedureError(err);
  }
}

module.exports = {
  callProcedure,
  execProc: callProcedure,
  callProcedureWithRecordsets,
  callScalarFunction,
  ApiError,
};
