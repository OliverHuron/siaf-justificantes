'use strict';

const { Pool, types } = require('pg');
const config = require('./config');

// DATE (OID 1082) y DATE[] (OID 1182): devolver 'YYYY-MM-DD' tal cual, sin
// convertir a Date (evita corrimientos de zona horaria en fechas de calendario).
types.setTypeParser(1082, (v) => v);
types.setTypeParser(1182, (v) =>
  v == null || v === '{}' ? [] : v.replace(/^\{|\}$/g, '').split(',').map((s) => s.replace(/^"|"$/g, ''))
);

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('[db] error inesperado en cliente ocioso', err);
});

/** Ejecuta una consulta parametrizada. */
function query(text, params) {
  return pool.query(text, params);
}

/** Corre `fn` dentro de una transacción, con commit/rollback automático. */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
