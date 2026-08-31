'use strict';

const express = require('express');
const db = require('../db');
const { requireStaff, requireRol } = require('../middleware/auth');
const { TIPOS } = require('../lib/tipos');

const router = express.Router();
router.use(requireStaff, requireRol('encargada', 'supervisor', 'coordinador'));

/**
 * GET /api/consolidado?semestre=&seccion=&desde=&hasta=
 * Justificantes aprobados (con folio vigente) del periodo, para repartir a coordinadores.
 */
router.get('/', async (req, res, next) => {
  try {
    const { semestre, seccion, desde, hasta } = req.query;
    const cond = [`s.estado = 'aprobada'`, `f.anulado_en IS NULL`];
    const val = [];
    if (semestre) { val.push(semestre); cond.push(`$${val.length} = ANY(s.semestres)`); }
    if (seccion) { val.push(seccion); cond.push(`$${val.length} = ANY(s.secciones)`); }
    if (desde) { val.push(desde); cond.push(`f.emitido_en >= $${val.length}`); }
    if (hasta) { val.push(hasta); cond.push(`f.emitido_en < ($${val.length}::date + 1)`); }

    const r = await db.query(
      `SELECT f.folio, f.emitido_en, s.nombre_declarado, s.matricula_declarada,
              s.semestres, s.secciones, s.tipo, s.fechas, s.dias_texto_oficio
         FROM folios f
         JOIN solicitudes s ON s.id = f.solicitud_id
        WHERE ${cond.join(' AND ')}
        ORDER BY s.secciones, s.matricula_declarada, f.emitido_en`,
      val
    );
    res.json({
      filtro: { semestre: semestre || null, seccion: seccion || null, desde: desde || null, hasta: hasta || null },
      total: r.rowCount,
      filas: r.rows.map((row) => ({ ...row, tipo_etiqueta: (TIPOS[row.tipo] || {}).etiqueta || row.tipo })),
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
