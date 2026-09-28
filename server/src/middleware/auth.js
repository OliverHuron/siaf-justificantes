'use strict';

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');
const { ApiError } = require('./error');
const { registrarActividad } = require('../lib/sesion');
const db = require('../db');

/**
 * Firma un token de personal. `payload` debe incluir al menos { sub, rol }.
 */
function firmarStaff(payload) {
  return jwt.sign({ ...payload, tipo: 'staff' }, config.jwt.secret, {
    expiresIn: config.jwt.expire,
  });
}

/**
 * Firma una sesión corta de alumno. `payload` debe incluir { email }.
 * Lleva un `jti` propio para poder invalidarla (de un solo uso) al enviar
 * una solicitud, sin depender de listas de revocación por usuario.
 */
function firmarAlumno(payload) {
  return jwt.sign({ ...payload, tipo: 'alumno', jti: crypto.randomUUID() }, config.jwt.secret, {
    expiresIn: config.jwt.alumnoExpire,
  });
}

/**
 * Marca el token de alumno (por su jti) como ya usado, para que no sirva para
 * enviar otra solicitud sin pedir un OTP nuevo. De paso barre usos viejos
 * (más allá de la expiración del JWT) para que la tabla no crezca sin límite.
 * Nunca lanza: la solicitud ya quedó creada (commit hecho) cuando se llama
 * esto, así que un fallo aquí no debe convertir un envío exitoso en un error
 * para el alumno.
 */
async function invalidarAlumno({ jti, email }) {
  if (!jti) return;
  try {
    await db.query(
      `INSERT INTO alumno_tokens_usados (jti, email) VALUES ($1, $2) ON CONFLICT (jti) DO NOTHING`,
      [jti, email]
    );
  } catch (e) {
    console.error('[invalidarAlumno] no se pudo marcar el token como usado:', e.message);
    return;
  }
  db.query(`DELETE FROM alumno_tokens_usados WHERE usado_en < now() - interval '1 day'`).catch(() => {});
}

function extraerToken(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return null;
}

/** Exige un token válido de personal. Deja `req.usuario`. */
async function requireStaff(req, res, next) {
  const token = extraerToken(req);
  if (!token) return next(new ApiError(401, 'Falta el token de sesión'));
  let claims;
  try {
    claims = jwt.verify(token, config.jwt.secret);
    if (claims.tipo !== 'staff') throw new Error('tipo incorrecto');
  } catch (e) {
    return next(new ApiError(401, 'Sesión inválida o expirada'));
  }
  req.usuario = claims;
  // Con await: para que una lectura inmediata después (p. ej. GET /usuarios)
  // ya vea la actividad de esta misma petición, no una carrera con ella.
  await registrarActividad(claims.sub);
  next();
}

/** Exige que el personal autenticado tenga alguno de los roles dados. */
function requireRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario) return next(new ApiError(401, 'No autenticado'));
    if (!roles.includes(req.usuario.rol)) {
      return next(new ApiError(403, 'No tienes permiso para esta acción'));
    }
    next();
  };
}

/**
 * Exige un token válido de alumno. Deja `req.alumno`.
 * Además de la firma/expiración, revisa que el jti no se haya consumido ya
 * (una solicitud enviada = token usado; hace falta un OTP nuevo para otra).
 */
async function requireAlumno(req, res, next) {
  const token = extraerToken(req);
  if (!token) return next(new ApiError(401, 'Falta el token de sesión'));
  let claims;
  try {
    claims = jwt.verify(token, config.jwt.secret);
    if (claims.tipo !== 'alumno') throw new Error('tipo incorrecto');
    // Tokens emitidos antes de que existiera el jti (sesiones viejas todavía
    // vigentes por hasta 2h tras el despliegue) no se pueden rastrear como
    // usados/no usados: se tratan como inválidos para forzar un OTP nuevo.
    if (!claims.jti) throw new Error('sin jti');
  } catch (e) {
    return next(new ApiError(401, 'Sesión inválida o expirada'));
  }
  try {
    const r = await db.query(`SELECT 1 FROM alumno_tokens_usados WHERE jti = $1`, [claims.jti]);
    if (r.rowCount) return next(new ApiError(401, 'Ya enviaste una solicitud con este código; pide uno nuevo.'));
  } catch (e) {
    return next(e);
  }
  req.alumno = claims;
  next();
}

module.exports = {
  firmarStaff,
  firmarAlumno,
  invalidarAlumno,
  requireStaff,
  requireRol,
  requireAlumno,
};
