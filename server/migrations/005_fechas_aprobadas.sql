-- Días que la encargada aprueba (subconjunto de solicitudes.fechas). El oficio y
-- el folio se emiten con estos días; si es NULL se toman todas las fechas pedidas.

BEGIN;

ALTER TABLE solicitudes
  ADD COLUMN IF NOT EXISTS fechas_aprobadas date[];

COMMIT;
