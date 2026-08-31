'use strict';

/** Error de aplicación con código HTTP explícito. */
class ApiError extends Error {
  constructor(status, message, detalle) {
    super(message);
    this.status = status;
    this.detalle = detalle;
  }
}

/** 404 para rutas no montadas. */
function notFound(req, res, next) {
  next(new ApiError(404, 'Recurso no encontrado'));
}

/** Manejador final de errores. */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  if (status >= 500) {
    console.error('[error]', err);
  }
  res.status(status).json({
    error: err.message || 'Error interno',
    ...(err.detalle ? { detalle: err.detalle } : {}),
  });
}

module.exports = { ApiError, notFound, errorHandler };
