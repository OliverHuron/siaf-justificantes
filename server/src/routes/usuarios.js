'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const config = require('../config');
const { ApiError } = require('../middleware/error');
const { requireStaff, requireRol } = require('../middleware/auth');
const bitacora = require('../lib/bitacora');

const router = express.Router();
router.use(requireStaff, requireRol('supervisor'));

const ROLES = ['encargada', 'supervisor', 'coordinador', 'enfermeria'];

/** GET /api/usuarios */
router.get('/', async (req, res, next) => {
  try {
    const r = await db.query(
      `SELECT id, usuario, nombre, email, rol, activo, must_change_password, creado_en
         FROM usuarios ORDER BY rol, usuario`
    );
    res.json(r.rows);
  } catch (e) {
    next(e);
  }
});

/** POST /api/usuarios  { usuario, nombre, email, rol, password? } */
router.post('/', async (req, res, next) => {
  try {
    const { usuario, nombre, email, rol } = req.body || {};
    if (!usuario || !nombre || !email || !rol) throw new ApiError(400, 'Faltan campos');
    if (!ROLES.includes(rol)) throw new ApiError(400, 'Rol inválido');
    const password = (req.body && req.body.password) || config.seedPassword;
    const hash = await bcrypt.hash(password, 12);
    const r = await db.query(
      `INSERT INTO usuarios (usuario, nombre, email, password_hash, rol, must_change_password)
       VALUES ($1,$2,$3,$4,$5,true)
       RETURNING id, usuario, nombre, email, rol, activo, must_change_password`,
      [usuario, nombre, email, hash, rol]
    );
    await bitacora.registrar({
      actorTipo: 'staff', actorRef: req.usuario.usuario, accion: 'usuario_creado',
      detalle: { usuario, rol }, ip: req.ip,
    });
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return next(new ApiError(409, 'Ese usuario ya existe'));
    next(e);
  }
});

/** PATCH /api/usuarios/:id  { nombre?, email?, rol?, activo?, reset_password? } */
router.patch('/:id', async (req, res, next) => {
  try {
    const { nombre, email, rol, activo, reset_password } = req.body || {};
    if (rol && !ROLES.includes(rol)) throw new ApiError(400, 'Rol inválido');

    let passHash = null;
    let mustChange = null;
    if (reset_password) {
      passHash = await bcrypt.hash(config.seedPassword, 12);
      mustChange = true;
    }

    const r = await db.query(
      `UPDATE usuarios SET
         nombre = COALESCE($2, nombre),
         email = COALESCE($3, email),
         rol = COALESCE($4, rol),
         activo = COALESCE($5, activo),
         password_hash = COALESCE($6, password_hash),
         must_change_password = COALESCE($7, must_change_password),
         actualizado_en = now()
       WHERE id = $1
       RETURNING id, usuario, nombre, email, rol, activo, must_change_password`,
      [
        req.params.id, nombre ?? null, email ?? null, rol ?? null,
        typeof activo === 'boolean' ? activo : null, passHash, mustChange,
      ]
    );
    if (!r.rowCount) throw new ApiError(404, 'Usuario no encontrado');
    res.json({ ...r.rows[0], ...(reset_password ? { password_temporal: config.seedPassword } : {}) });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
