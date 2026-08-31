'use strict';

const db = require('../db');

/** Sustituye {{clave}} por vars[clave] (cadena vacía si falta). */
function render(plantilla, vars) {
  return String(plantilla || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) =>
    vars[k] == null ? '' : String(vars[k])
  );
}

/** Carga una plantilla por ámbito+clave. */
async function cargar(ambito, clave) {
  const r = await db.query(
    `SELECT id, ambito, clave, titulo, asunto, cuerpo, activo
       FROM plantillas WHERE ambito = $1 AND clave = $2`,
    [ambito, clave]
  );
  return r.rows[0] || null;
}

/**
 * Renderiza una plantilla de correo. Devuelve { asunto, cuerpo }.
 * Si `clave` es null, usa `libre` como cuerpo.
 */
async function correo({ clave, libre, asuntoLibre, vars }) {
  if (!clave) {
    return { asunto: asuntoLibre || 'Sobre tu solicitud de justificante', cuerpo: render(libre, vars) };
  }
  const p = await cargar('correo', clave);
  if (!p) throw new Error(`Plantilla de correo no encontrada: ${clave}`);
  return { asunto: render(p.asunto, vars), cuerpo: render(p.cuerpo, vars) };
}

/** Renderiza el cuerpo del oficio (plantilla por id, o texto libre). */
async function cuerpoOficio({ plantillaId, libre, vars }) {
  if (libre && libre.trim()) return render(libre, vars);
  if (plantillaId) {
    const r = await db.query(`SELECT cuerpo FROM plantillas WHERE id = $1 AND ambito = 'cuerpo_oficio'`, [
      plantillaId,
    ]);
    if (r.rows[0]) return render(r.rows[0].cuerpo, vars);
  }
  const gen = await cargar('cuerpo_oficio', 'generica');
  return render(gen ? gen.cuerpo : 'por los motivos acreditados ante esta Secretaría.', vars);
}

module.exports = { render, cargar, correo, cuerpoOficio };
