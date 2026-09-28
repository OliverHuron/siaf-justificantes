-- Doble aprobación: la encargada "aprueba" (congela el dictamen: días, plantilla
-- de oficio, verificación de fechas) pero eso NO emite folio ni manda correos
-- todavía; queda en un estado intermedio hasta que el supervisor lo confirma.
-- Solo entonces se emite el folio, se genera el PDF y se envían los correos
-- (acuse al alumno + oficio a profesores). El panel de la encargada no cambia:
-- para ella "Aprobar" se ve y se siente exactamente igual que antes.

BEGIN;

ALTER TABLE solicitudes DROP CONSTRAINT solicitudes_estado_check;
ALTER TABLE solicitudes ADD CONSTRAINT solicitudes_estado_check
  CHECK (estado IN ('pendiente', 'aprobada_pendiente_confirmacion', 'aprobada',
                     'rechazada', 'requiere_ventanilla', 'cancelada'));

-- Quién dejó el dictamen listo (encargada) vs. quién confirmó el envío final
-- (supervisor). `decidido_por`/`decidido_en` pasan a significar "confirmación
-- final"; se agregan estos para no perder el registro del primer paso.
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS preaprobado_por bigint REFERENCES usuarios(id);
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS preaprobado_en timestamptz;

COMMIT;
