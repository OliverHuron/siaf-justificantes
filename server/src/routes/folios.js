'use strict';

const express = require('express');
const db = require('../db');
const { ApiError } = require('../middleware/error');
const { requireStaff, requireRol } = require('../middleware/auth');
const bitacora = require('../lib/bitacora');
const { TIPOS } = require('../lib/tipos');

const router = express.Router();
router.use(requireStaff);

/** GET /api/folios?q=&estado=  — búsqueda (encargada/supervisor/coordinador). */
router.get('/', requireRol('encargada', 'supervisor', 'coordinador'), async (req, res, next) => {
  try {
    const cond = [];
    const val = [];
    if (req.query.q) {
      val.push(`%${req.query.q}%`);
      cond.push(`(f.folio ILIKE $${val.length} OR s.nombre_declarado ILIKE $${val.length} OR s.matricula_declarada ILIKE $${val.length})`);
    }
    if (req.query.estado === 'anulado') cond.push('f.anulado_en IS NOT NULL');
    if (req.query.estado === 'vigente') cond.push('f.anulado_en IS NULL');
    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
    const r = await db.query(
      `SELECT f.id, f.folio, f.emitido_en, f.anulado_en, f.motivo_anulacion,
              s.id AS solicitud_id, s.nombre_declarado, s.matricula_declarada, s.tipo,
              s.semestres, s.secciones, s.fechas,
              ue.nombre AS emitido_por, ua.nombre AS anulado_por
         FROM folios f
         JOIN solicitudes s ON s.id = f.solicitud_id
         LEFT JOIN usuarios ue ON ue.id = f.emitido_por
         LEFT JOIN usuarios ua ON ua.id = f.anulado_por
         ${where}
         ORDER BY f.emitido_en DESC
         LIMIT 300`,
      val
    );
    res.json(r.rows.map((row) => ({ ...row, tipo_etiqueta: (TIPOS[row.tipo] || {}).etiqueta || row.tipo })));
  } catch (e) {
    next(e);
  }
});

/** POST /api/folios/:id/anular   { motivo }   (solo supervisor). */
router.post('/:id/anular', requireRol('supervisor'), async (req, res, next) => {
  try {
    const motivo = String((req.body || {}).motivo || '').trim();
    if (!motivo) throw new ApiError(400, 'Indica el motivo de la anulación');
    const r = await db.query(
      `UPDATE folios SET anulado_en = now(), anulado_por = $2, motivo_anulacion = $3
        WHERE id = $1 AND anulado_en IS NULL
        RETURNING folio, solicitud_id`,
      [req.params.id, req.usuario.sub, motivo]
    );
    if (!r.rowCount) throw new ApiError(409, 'El folio no existe o ya estaba anulado');
    await bitacora.registrar({
      actorTipo: 'staff', actorRef: req.usuario.usuario, accion: 'folio_anulado',
      solicitudId: r.rows[0].solicitud_id, detalle: { folio: r.rows[0].folio, motivo }, ip: req.ip,
    });
    res.json({ ok: true, folio: r.rows[0].folio });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
