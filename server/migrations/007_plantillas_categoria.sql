-- Categoría de las plantillas de correo (para no revolver "rechazo" con
-- "ventanilla" en los dropdowns del expediente de revisión).

BEGIN;

ALTER TABLE plantillas ADD COLUMN IF NOT EXISTS categoria text
  CHECK (categoria IS NULL OR categoria IN ('aprobado', 'rechazo', 'ventanilla', 'informacion'));

-- Backfill de las plantillas ya sembradas, a partir de su clave.
UPDATE plantillas SET categoria = 'aprobado'
  WHERE ambito = 'correo' AND clave = 'aprobado' AND categoria IS NULL;
UPDATE plantillas SET categoria = 'rechazo'
  WHERE ambito = 'correo' AND clave LIKE 'rechazo_%' AND categoria IS NULL;
UPDATE plantillas SET categoria = 'ventanilla'
  WHERE ambito = 'correo' AND clave = 'pasar_ventanilla' AND categoria IS NULL;
UPDATE plantillas SET categoria = 'informacion'
  WHERE ambito = 'correo' AND clave = 'solicitud_informacion' AND categoria IS NULL;

COMMIT;
