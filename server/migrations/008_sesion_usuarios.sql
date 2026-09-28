-- Seguimiento ligero de sesión de personal: último login, última actividad
-- (para el punto verde/rojo de "conectado") y tiempo total acumulado.

BEGIN;

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_login timestamptz;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultima_actividad timestamptz;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS segundos_conectado bigint NOT NULL DEFAULT 0;

COMMIT;
