'use strict';

const express = require('express');
const db = require('../db');
const { ApiError } = require('../middleware/error');
const { requireStaff, requireRol } = require('../middleware/auth');
const { borrarArchivo } = require('../lib/storage');
const bitacora = require('../lib/bitacora');

const router = express.Router();
router.use(requireStaff, requireRol('supervisor'));

/** Construye el WHERE + valores a partir de los filtros de fecha/matrícula/folio. */
function condiciones(q) {
  const cond = [];
  const val = [];
  if (q.desde) {
    val.push(q.desde);
    cond.push(`a.subido_en >= $${val.length}::date`);
  }
  if (q.hasta) {
    val.push(q.hasta);
    cond.push(`a.subido_en < ($${val.length}::date + interval '1 day')`);
  }
  if (q.matricula) {
    val.push(`%${q.matricula}%`);
    cond.push(`s.matricula_declarada ILIKE $${val.length}`);
  }
  if (q.folio) {
    val.push(`%${q.folio}%`);
    cond.push(`f.folio ILIKE $${val.length}`);
  }
  return { where: cond.length ? `WHERE ${cond.join(' AND ')}` : '', val };
}

/** GET /api/adjuntos?desde=&hasta=&matricula=&folio=  — lista para revisar antes de borrar. */
router.get('/', async (req, res, next) => {
  try {
    const { where, val } = condiciones(req.query);
    const r = await db.query(
      `SELECT a.id, a.tipo, a.nombre_original, a.mime, a.tamano, a.subido_en,
              s.id AS solicitud_id, s.nombre_declarado, s.matricula_declarada,
              f.folio
         FROM adjuntos a
         JOIN solicitudes s ON s.id = a.solicitud_id
         LEFT JOIN folios f ON f.solicitud_id = s.id
         ${where}
         ORDER BY a.subido_en DESC
         LIMIT 500`,
      val
    );
    res.json(r.rows);
  } catch (e) {
    next(e);
  }
});

/** DELETE /api/adjuntos/:id  — elimina un adjunto individual (archivo + registro). */
router.delete('/:id', async (req, res, next) => {
  try {
    const r = await db.query(
      `DELETE FROM adjuntos WHERE id = $1 RETURNING ruta_archivo, nombre_original, solicitud_id`,
      [req.params.id]
    );
    if (!r.rowCount) throw new ApiError(404, 'Adjunto no encontrado');
    borrarArchivo(r.rows[0].ruta_archivo);
    await bitacora.registrar({
      actorTipo: 'staff', actorRef: req.usuario.usuario, accion: 'adjunto_eliminado',
      solicitudId: r.rows[0].solicitud_id, detalle: { nombre_original: r.rows[0].nombre_original }, ip: req.ip,
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/** DELETE /api/adjuntos?desde=&hasta=&matricula=&folio=  — elimina en lote por filtro. */
router.delete('/', async (req, res, next) => {
  try {
    const { where, val } = condiciones(req.query);
    if (!where) throw new ApiError(400, 'Indica al menos un filtro (fecha, matrícula o folio)');
    const r = await db.query(
      `SELECT a.id, a.ruta_archivo, a.solicitud_id
         FROM adjuntos a
         JOIN solicitudes s ON s.id = a.solicitud_id
         LEFT JOIN folios f ON f.solicitud_id = s.id
         ${where}`,
      val
    );
    if (!r.rowCount) return res.json({ ok: true, eliminados: 0 });
    const ids = r.rows.map((x) => x.id);
    await db.query(`DELETE FROM adjuntos WHERE id = ANY($1::bigint[])`, [ids]);
    for (const row of r.rows) borrarArchivo(row.ruta_archivo);
    await bitacora.registrar({
      actorTipo: 'staff', actorRef: req.usuario.usuario, accion: 'adjuntos_eliminados_lote',
      detalle: { filtro: req.query, cantidad: ids.length }, ip: req.ip,
    });
    res.json({ ok: true, eliminados: ids.length });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
