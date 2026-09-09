-- Lista de grupos (semestre + sección) de la solicitud, con snapshot de expediente
-- por grupo. Los campos licenciatura/turno/salon/modalidad/periodo del nivel
-- solicitud siguen guardando el grupo PRINCIPAL (para el oficio).

BEGIN;

ALTER TABLE solicitudes
  ADD COLUMN IF NOT EXISTS grupos jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMIT;
