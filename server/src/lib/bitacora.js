'use strict';

const db = require('../db');

/**
 * Escribe una entrada de bitácora (append-only). Nunca lanza: un fallo de
 * auditoría no debe tumbar la operación principal (se registra en consola).
 */
async function registrar({ actorTipo, actorRef, accion, solicitudId, detalle, ip }, client) {
  try {
    const q = client || db;
    await q.query(
      `INSERT INTO bitacora (actor_tipo, actor_ref, accion, solicitud_id, detalle, ip)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [
        actorTipo,
        actorRef || null,
        accion,
        solicitudId || null,
        JSON.stringify(detalle || {}),
        ip || null,
      ]
    );
  } catch (e) {
    console.error('[bitacora] no se pudo registrar:', accion, e.message);
  }
}

module.exports = { registrar };
