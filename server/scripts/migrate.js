'use strict';

/**
 * Runner de migraciones. Aplica en orden los .sql de server/migrations
 * que aún no estén en la tabla _migraciones. Cada archivo maneja su
 * propia transacción (BEGIN/COMMIT).
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('../src/db');

const DIR = path.join(__dirname, '..', 'migrations');

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migraciones (
      nombre      text PRIMARY KEY,
      aplicada_en timestamptz NOT NULL DEFAULT now()
    )
  `);

  const aplicadas = new Set(
    (await pool.query('SELECT nombre FROM _migraciones')).rows.map((r) => r.nombre)
  );

  const archivos = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let n = 0;
  for (const archivo of archivos) {
    if (aplicadas.has(archivo)) {
      console.log(`  = ${archivo} (ya aplicada)`);
      continue;
    }
    const sql = fs.readFileSync(path.join(DIR, archivo), 'utf8');
    process.stdout.write(`  + ${archivo} … `);
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO _migraciones (nombre) VALUES ($1)', [archivo]);
      console.log('ok');
      n++;
    } catch (e) {
      console.log('FALLÓ');
      console.error(e);
      process.exitCode = 1;
      return;
    }
  }
  console.log(n ? `${n} migración(es) aplicada(s).` : 'Sin migraciones pendientes.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
