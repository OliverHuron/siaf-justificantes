'use strict';

const db = require('../db');
const { diasHabilesEntre, siguienteDiaHabil, diasNaturales, iso } = require('./dias');

const MATRICULA_RE = /^\d{7}[A-Za-z]$/; // 7 dígitos + letra (formato observado)

/**
 * Calcula las banderas de una solicitud recién enviada. No bloquea; solo
 * marca lo que la encargada debe mirar con atención (PLAN §8).
 *
 * @param {object} s  { matricula, tipo, fechas: string[], semestres, secciones, fecha_inicio, fecha_fin }
 * @param {object} reglas  { diasLimite, diasMaximos, exento, feriados }
 * @returns {object} banderas -> { clave: {detalle} }
 */
async function calcular(s, reglas = {}) {
  const banderas = {};
  const fechas = (s.fechas || []).map((f) => String(f).slice(0, 10));
  const exento = reglas.exento || s.tipo === 'caso_especial' || s.tipo === 'enfermeria_fcca';

  let feriados = reglas.feriados;
  if (!Array.isArray(feriados)) {
    try {
      const r = await db.query(`SELECT valor FROM config WHERE clave = 'feriados'`);
      feriados = Array.isArray(r.rows[0] && r.rows[0].valor) ? r.rows[0].valor : [];
    } catch (_) { feriados = []; }
  }

  if (!exento && s.fecha_inicio && s.fecha_fin) {
    const hoy = iso(new Date());
    // fuera_de_ventana: pasaron más de N días hábiles desde la reincorporación
    const reincorporacion = siguienteDiaHabil(s.fecha_fin, feriados);
    const transcurridos = diasHabilesEntre(reincorporacion, hoy, feriados);
    if (reglas.diasLimite && transcurridos > reglas.diasLimite) {
      banderas.fuera_de_ventana = { reincorporacion, transcurridos, limite: reglas.diasLimite };
    }
    // excede_maximo: el rango supera el tope de días
    const total = diasNaturales(s.fecha_inicio, s.fecha_fin);
    if (reglas.diasMaximos && total > reglas.diasMaximos) {
      banderas.excede_maximo = { total, maximo: reglas.diasMaximos };
    }
  }

  // matricula_formato
  if (!MATRICULA_RE.test(String(s.matricula || '').trim())) {
    banderas.matricula_formato = { valor: s.matricula };
  }

  // traslape: fechas que chocan con otra solicitud no rechazada de la misma matrícula
  if (fechas.length) {
    const r = await db.query(
      `SELECT id, fechas FROM solicitudes
        WHERE upper(matricula_declarada) = upper($1)
          AND estado <> 'rechazada' AND estado <> 'cancelada'`,
      [s.matricula]
    );
    const previas = new Set();
    for (const row of r.rows) (row.fechas || []).forEach((f) => previas.add(iso(new Date(f))));
    const choque = fechas.filter((f) => previas.has(f));
    if (choque.length) banderas.traslape = { fechas: choque };

    // duplicada: misma matrícula + mismas fechas + mismo tipo
    const dup = await db.query(
      `SELECT id FROM solicitudes
        WHERE upper(matricula_declarada) = upper($1)
          AND tipo = $2
          AND estado <> 'rechazada' AND estado <> 'cancelada'
          AND fechas @> $3::date[] AND fechas <@ $3::date[]
        LIMIT 1`,
      [s.matricula, s.tipo, fechas]
    );
    if (dup.rowCount) banderas.duplicada = { solicitud_id: dup.rows[0].id };
  }

  // repetidor: > 3 aprobadas en los últimos 60 días
  const rep = await db.query(
    `SELECT count(*)::int AS n FROM solicitudes
      WHERE upper(matricula_declarada) = upper($1)
        AND estado = 'aprobada'
        AND decidido_en > now() - interval '60 days'`,
    [s.matricula]
  );
  if (rep.rows[0].n > 3) banderas.repetidor = { aprobadas_60d: rep.rows[0].n };

  return banderas;
}

module.exports = { calcular, MATRICULA_RE };
