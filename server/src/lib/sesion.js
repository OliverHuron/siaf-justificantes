'use strict';

const db = require('../db');

/**
 * Seguimiento ligero de sesión de personal, sin tabla de sesiones ni
 * websockets: en cada request autenticado se toca `ultima_actividad` y, si el
 * hueco desde la actividad previa es menor al umbral de "conectado", se suma
 * ese hueco a `segundos_conectado` (tiempo activo acumulado). Un hueco mayor
 * (se cerró la pestaña, se fue a comer, etc.) no cuenta como tiempo conectado.
 */
const UMBRAL_CONECTADO_MS = 5 * 60 * 1000; // 5 min sin actividad = "no conectado"

async function registrarActividad(usuarioId) {
  try {
    const r = await db.query('SELECT ultima_actividad FROM usuarios WHERE id = $1', [usuarioId]);
    const prev = r.rows[0] && r.rows[0].ultima_actividad;
    let incremento = 0;
    if (prev) {
      const delta = Date.now() - new Date(prev).getTime();
      if (delta > 0 && delta < UMBRAL_CONECTADO_MS) incremento = Math.round(delta / 1000);
    }
    await db.query(
      `UPDATE usuarios SET ultima_actividad = now(), segundos_conectado = segundos_conectado + $2 WHERE id = $1`,
      [usuarioId, incremento]
    );
  } catch (_) {
    /* no bloquea la petición por esto */
  }
}

function estaConectado(ultimaActividad) {
  if (!ultimaActividad) return false;
  return Date.now() - new Date(ultimaActividad).getTime() < UMBRAL_CONECTADO_MS;
}

module.exports = { registrarActividad, estaConectado, UMBRAL_CONECTADO_MS };
