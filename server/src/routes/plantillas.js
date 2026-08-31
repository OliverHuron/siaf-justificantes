'use strict';

const express = require('express');
const db = require('../db');
const { ApiError } = require('../middleware/error');
const { requireStaff, requireRol } = require('../middleware/auth');

const router = express.Router();
router.use(requireStaff);

const AMBITOS = ['correo', 'cuerpo_oficio'];

/** GET /api/plantillas?ambito=correo|cuerpo_oficio  — lectura para encargada+supervisor. */
router.get('/', requireRol('encargada', 'supervisor'), async (req, res, next) => {
  try {
    const cond = [];
    const val = [];
    if (req.query.ambito) {
      if (!AMBITOS.includes(req.query.ambito)) throw new ApiError(400, 'Ámbito inválido');
      val.push(req.query.ambito);
      cond.push(`ambito = $${val.length}`);
    }
    if (req.query.activo === 'true') cond.push('activo = true');
    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
    const r = await db.query(
      `SELECT id, ambito, clave, titulo, asunto, cuerpo, activo, actualizado_en
         FROM plantillas ${where} ORDER BY ambito, titulo`,
      val
    );
    res.json(r.rows);
  } catch (e) {
    next(e);
  }
});

router.use(requireRol('supervisor'));

/** POST /api/plantillas  { ambito, clave, titulo, asunto?, cuerpo } */
router.post('/', async (req, res, next) => {
  try {
    const { ambito, clave, titulo, asunto, cuerpo } = req.body || {};
    if (!AMBITOS.includes(ambito)) throw new ApiError(400, 'Ámbito inválido');
    if (!clave || !titulo || !cuerpo) throw new ApiError(400, 'Faltan campos (clave, título, cuerpo)');
    const r = await db.query(
      `INSERT INTO plantillas (ambito, clave, titulo, asunto, cuerpo)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [ambito, clave, titulo, ambito === 'correo' ? asunto || '' : null, cuerpo]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return next(new ApiError(409, 'Ya existe una plantilla con esa clave en ese ámbito'));
    next(e);
  }
});

/** PATCH /api/plantillas/:id  { titulo?, asunto?, cuerpo?, activo? } */
router.patch('/:id', async (req, res, next) => {
  try {
    const { titulo, asunto, cuerpo, activo } = req.body || {};
    const r = await db.query(
      `UPDATE plantillas SET
         titulo = COALESCE($2, titulo),
         asunto = COALESCE($3, asunto),
         cuerpo = COALESCE($4, cuerpo),
         activo = COALESCE($5, activo),
         actualizado_en = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, titulo ?? null, asunto ?? null, cuerpo ?? null, typeof activo === 'boolean' ? activo : null]
    );
    if (!r.rowCount) throw new ApiError(404, 'Plantilla no encontrada');
    res.json(r.rows[0]);
  } catch (e) {
    next(e);
  }
});

/** DELETE /api/plantillas/:id */
router.delete('/:id', async (req, res, next) => {
  try {
    const r = await db.query(`DELETE FROM plantillas WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!r.rowCount) throw new ApiError(404, 'Plantilla no encontrada');
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
