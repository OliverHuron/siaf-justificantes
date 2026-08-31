'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { ApiError } = require('../middleware/error');
const { firmarStaff, firmarAlumno, requireStaff } = require('../middleware/auth');
const otp = require('../lib/otp');

const router = express.Router();

/**
 * POST /api/auth/login   { usuario, password }
 * Login de personal (encargada / supervisor / coordinador / enfermeria).
 */
router.post('/login', async (req, res, next) => {
  try {
    const { usuario, password } = req.body || {};
    if (!usuario || !password) {
      throw new ApiError(400, 'Usuario y contraseña son obligatorios');
    }
    const r = await db.query(
      `SELECT id, usuario, nombre, email, password_hash, rol, activo, must_change_password
         FROM usuarios WHERE lower(usuario) = lower($1)`,
      [usuario]
    );
    const u = r.rows[0];
    if (!u || !u.activo) throw new ApiError(401, 'Credenciales inválidas');

    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) throw new ApiError(401, 'Credenciales inválidas');

    const token = firmarStaff({ sub: u.id, usuario: u.usuario, rol: u.rol, nombre: u.nombre });
    res.json({
      token,
      usuario: {
        id: u.id,
        usuario: u.usuario,
        nombre: u.nombre,
        email: u.email,
        rol: u.rol,
        must_change_password: u.must_change_password,
      },
    });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/auth/cambiar-password   { actual, nueva }   (personal autenticado)
 */
router.post('/cambiar-password', requireStaff, async (req, res, next) => {
  try {
    const { actual, nueva } = req.body || {};
    if (!actual || !nueva) throw new ApiError(400, 'Faltan campos');
    if (String(nueva).length < 8) {
      throw new ApiError(400, 'La nueva contraseña debe tener al menos 8 caracteres');
    }
    const r = await db.query('SELECT password_hash FROM usuarios WHERE id = $1', [req.usuario.sub]);
    if (!r.rows[0]) throw new ApiError(404, 'Usuario no encontrado');
    const ok = await bcrypt.compare(actual, r.rows[0].password_hash);
    if (!ok) throw new ApiError(401, 'La contraseña actual no coincide');

    const hash = await bcrypt.hash(nueva, 12);
    await db.query(
      `UPDATE usuarios SET password_hash = $1, must_change_password = false, actualizado_en = now()
         WHERE id = $2`,
      [hash, req.usuario.sub]
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// --- OTP de alumno (PLAN §2.1) ---

/** POST /api/auth/alumno/solicitar-codigo  { email } */
router.post('/alumno/solicitar-codigo', async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email) throw new ApiError(400, 'El correo es obligatorio');
    const r = await otp.solicitarCodigo(email, req.ip);
    res.json(r);
  } catch (e) {
    next(e);
  }
});

/** POST /api/auth/alumno/verificar-codigo  { email, code } -> JWT de alumno */
router.post('/alumno/verificar-codigo', async (req, res, next) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) throw new ApiError(400, 'Faltan campos');
    await otp.verificarCodigo(email, code);
    const emailNorm = otp.normEmail(email);
    const token = firmarAlumno({ email: emailNorm });
    res.json({ token, email: emailNorm });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
