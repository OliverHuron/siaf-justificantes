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
    if (req.query.categoria) {
      val.push(req.query.categoria);
      cond.push(`categoria = $${val.length}`);
    }
    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
    const r = await db.query(
      `SELECT id, ambito, clave, titulo, asunto, cuerpo, categoria, activo, actualizado_en
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
    const { ambito, clave, titulo, asunto, cuerpo, categoria } = req.body || {};
    if (!AMBITOS.includes(ambito)) throw new ApiError(400, 'Ámbito inválido');
    if (!clave || !titulo || !cuerpo) throw new ApiError(400, 'Faltan campos (clave, título, cuerpo)');
    if (ambito === 'cuerpo_oficio' && cuerpo.length > 167) {
      throw new ApiError(400, 'El cuerpo de una plantilla de oficio no puede superar 167 caracteres');
    }
    const r = await db.query(
      `INSERT INTO plantillas (ambito, clave, titulo, asunto, cuerpo, categoria)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [ambito, clave, titulo, ambito === 'correo' ? asunto || '' : null, cuerpo,
       ambito === 'correo' ? categoria || null : null]
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
    const { titulo, asunto, cuerpo, activo, categoria } = req.body || {};
    if (cuerpo) {
      const actual = await db.query(`SELECT ambito FROM plantillas WHERE id = $1`, [req.params.id]);
      if (actual.rows[0] && actual.rows[0].ambito === 'cuerpo_oficio' && cuerpo.length > 167) {
        throw new ApiError(400, 'El cuerpo de una plantilla de oficio no puede superar 167 caracteres');
      }
    }
    // `categoria` distingue "no viene en el body" (no tocar) de "viene vacía"
    // (limpiarla): por eso no usa COALESCE como los demás campos.
    const tieneCategoria = Object.prototype.hasOwnProperty.call(req.body || {}, 'categoria');
    const r = await db.query(
      `UPDATE plantillas SET
         titulo = COALESCE($2, titulo),
         asunto = COALESCE($3, asunto),
         cuerpo = COALESCE($4, cuerpo),
         activo = COALESCE($5, activo),
         categoria = CASE WHEN $6 THEN $7 ELSE categoria END,
         actualizado_en = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, titulo ?? null, asunto ?? null, cuerpo ?? null,
       typeof activo === 'boolean' ? activo : null, tieneCategoria, categoria || null]
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
