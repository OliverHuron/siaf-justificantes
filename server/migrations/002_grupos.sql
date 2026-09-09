-- SIAF Justificantes — grupos (expediente por semestre/sección) y campos de expediente/rango en solicitudes

BEGIN;

-- Datos de grupo obtenidos de fcca.umich.mx/Horarios.php (script sync:fcca).
CREATE TABLE IF NOT EXISTS grupos (
  ciclo_escolar     text NOT NULL,
  semestre          text NOT NULL,   -- '1'..'9'
  seccion           text NOT NULL,   -- '1','16','26',...
  licenciatura      text,            -- código: LIA / LC / LA / LM
  licenciatura_raw  text,            -- 'LIA-2017'
  turno             text,            -- MAT / VESP
  salon             text,            -- 'A2-LAB4'
  modalidad         text,            -- ESC / ABI / LINEA
  periodo           text,            -- 'AGO2026-FEB2027'
  actualizado_en    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ciclo_escolar, semestre, seccion)
);

-- Campos de rango y expediente en la solicitud (snapshot).
ALTER TABLE solicitudes
  ADD COLUMN IF NOT EXISTS fecha_inicio     date,
  ADD COLUMN IF NOT EXISTS fecha_fin        date,
  ADD COLUMN IF NOT EXISTS origen_atencion  text
    CHECK (origen_atencion IS NULL OR origen_atencion IN ('privada','institucion_publica')),
  ADD COLUMN IF NOT EXISTS licenciatura     text,
  ADD COLUMN IF NOT EXISTS turno            text,
  ADD COLUMN IF NOT EXISTS salon            text,
  ADD COLUMN IF NOT EXISTS modalidad        text,
  ADD COLUMN IF NOT EXISTS periodo          text;

COMMIT;
