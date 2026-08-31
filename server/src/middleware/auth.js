'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');
const { ApiError } = require('./error');

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
 */
function firmarAlumno(payload) {
  return jwt.sign({ ...payload, tipo: 'alumno' }, config.jwt.secret, {
    expiresIn: config.jwt.alumnoExpire,
  });
}

function extraerToken(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return null;
}

/** Exige un token válido de personal. Deja `req.usuario`. */
function requireStaff(req, res, next) {
  const token = extraerToken(req);
  if (!token) return next(new ApiError(401, 'Falta el token de sesión'));
  try {
    const claims = jwt.verify(token, config.jwt.secret);
    if (claims.tipo !== 'staff') throw new Error('tipo incorrecto');
    req.usuario = claims;
    next();
  } catch (e) {
    next(new ApiError(401, 'Sesión inválida o expirada'));
  }
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

/** Exige un token válido de alumno. Deja `req.alumno`. */
function requireAlumno(req, res, next) {
  const token = extraerToken(req);
  if (!token) return next(new ApiError(401, 'Falta el token de sesión'));
  try {
    const claims = jwt.verify(token, config.jwt.secret);
    if (claims.tipo !== 'alumno') throw new Error('tipo incorrecto');
    req.alumno = claims;
    next();
  } catch (e) {
    next(new ApiError(401, 'Sesión inválida o expirada'));
  }
}

module.exports = {
  firmarStaff,
  firmarAlumno,
  requireStaff,
  requireRol,
  requireAlumno,
};
