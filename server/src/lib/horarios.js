'use strict';

const db = require('../db');
const { semestreNum } = require('./expediente');

const EMAIL_RE = "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$";

/**
 * Resuelve los profesores a notificar para una solicitud, cruzando
 * (semestre, sección) del grupo contra `profesores_asignatura`.
 *
 * Solo devuelve las filas que EXISTEN en la tabla y traen un correo válido:
 * si de todas las materias del grupo algunas no tienen profesor asignado o
 * no proporcionaron correo, simplemente no se incluyen (no se aborta el envío).
 *
 * @returns {Promise<Array<{materia, profesor_nombre, profesor_correo, dias:number[]}>>}
 */
async function resolverProfesores({ semestres, secciones }) {
  const sems = [...new Set(
    (semestres || []).map((x) => Number(semestreNum(x))).filter((n) => Number.isInteger(n) && n > 0)
  )];
  const secs = [...new Set(
    (secciones || []).map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0)
  )];
  if (!sems.length || !secs.length) return [];

  const r = await db.query(
    `SELECT materia,
            trim(concat_ws(' ', prof_asig_nombre, prof_asig_ape_pate, prof_asig_ape_mate)) AS profesor_nombre,
            lower(correo) AS profesor_correo,
            '{}'::int[] AS dias
       FROM profesores_asignatura
      WHERE sem = ANY($1::int[])
        AND secc = ANY($2::int[])
        AND correo ~* $3
      GROUP BY 1, 2, 3
      ORDER BY materia`,
    [sems, secs, EMAIL_RE]
  );
  return r.rows;
}

module.exports = { resolverProfesores };
