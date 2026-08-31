'use strict';

const db = require('../db');
const { diaSemanaIso } = require('./dias');

/**
 * Resuelve los profesores a notificar para una solicitud (PLAN §4):
 * cruza (semestres, secciones, días de la semana de las fechas) contra
 * la tabla `horarios` del ciclo activo.
 *
 * @returns {Promise<Array<{materia, profesor_nombre, profesor_correo, dias:number[]}>>}
 */
async function resolverProfesores({ semestres, secciones, fechas }) {
  const cfg = await db.query(`SELECT valor FROM config WHERE clave = 'ciclo_activo'`);
  const ciclo = (cfg.rows[0] && String(cfg.rows[0].valor).replace(/"/g, '')) || String(new Date().getFullYear());

  const dias = [...new Set((fechas || []).map((f) => diaSemanaIso(f)))];
  if (!dias.length || !semestres.length || !secciones.length) return [];

  const r = await db.query(
    `SELECT materia, profesor_nombre, lower(profesor_correo) AS profesor_correo,
            array_agg(DISTINCT dia_semana ORDER BY dia_semana) AS dias
       FROM horarios
      WHERE activo
        AND ciclo_escolar = $1
        AND semestre = ANY($2::text[])
        AND seccion  = ANY($3::text[])
        AND dia_semana = ANY($4::int[])
      GROUP BY materia, profesor_nombre, lower(profesor_correo)
      ORDER BY materia`,
    [ciclo, semestres, secciones, dias]
  );
  return r.rows;
}

module.exports = { resolverProfesores };
