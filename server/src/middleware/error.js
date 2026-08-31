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
  let status = err.status || 500;
  let message = err.message || 'Error interno';

  if (err.name === 'MulterError') {
    status = 400;
    if (err.code === 'LIMIT_FILE_SIZE') message = 'El archivo supera el tamaño máximo (15 MB)';
    else if (err.code === 'LIMIT_FILE_COUNT') message = 'Demasiados archivos';
    else if (err.code === 'LIMIT_UNEXPECTED_FILE') message = `Campo de archivo inesperado: ${err.field}`;
  }

  if (status >= 500) {
    console.error('[error]', err);
  }
  res.status(status).json({
    error: message,
    ...(err.detalle ? { detalle: err.detalle } : {}),
  });
}

module.exports = { ApiError, notFound, errorHandler };
