'use strict';

const db = require('../db');

async function obtenerConfig() {
  try {
    const r = await db.query(`SELECT valor FROM config WHERE clave = 'sheets'`);
    return (r.rows[0] && r.rows[0].valor) || null;
  } catch (_) {
    return null;
  }
}

/**
 * Notifica a la hoja de Google Sheets (vía Apps Script Web App) cuando se
 * emite o anula un folio. Nunca lanza: si la hoja no está configurada, o el
 * webhook falla, se registra en consola y el flujo principal continúa igual.
 */
async function notificar(payload) {
  const cfg = await obtenerConfig();
  if (!cfg || !cfg.url || cfg.activo === false) return;
  try {
    const r = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secreto: cfg.secreto || '', ...payload }),
    });
    if (!r.ok) console.error(`[sheets] respuesta no OK (${r.status}) al notificar ${payload.accion}`);
  } catch (e) {
    console.error('[sheets] no se pudo notificar:', e.message);
  }
}

module.exports = { notificar };
