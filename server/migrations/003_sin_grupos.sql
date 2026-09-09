-- El expediente del grupo ya no se persiste: se consulta en vivo contra
-- fcca.umich.mx (lib/fcca.js) con caché en memoria. Se elimina la tabla `grupos`.
-- Las columnas de expediente en `solicitudes` se conservan como snapshot por solicitud.

BEGIN;

DROP TABLE IF EXISTS grupos;

COMMIT;
