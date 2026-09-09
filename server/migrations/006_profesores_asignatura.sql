-- Padrón de profesores por asignatura, sección y semestre.
-- Encabezados del archivo original:
--   ProfAsigNombre | ProfAsigApePate | ProfAsigApeMate | Correo | Materia | Sem | Secc
-- Por ahora sin datos (se cargará después); solo se agrega un registro de ejemplo.

BEGIN;

CREATE TABLE IF NOT EXISTS profesores_asignatura (
  id                  bigserial PRIMARY KEY,
  prof_asig_nombre    text NOT NULL,
  prof_asig_ape_pate  text,
  prof_asig_ape_mate  text,
  correo              text NOT NULL,
  materia             text NOT NULL,
  sem                 integer NOT NULL,
  secc                integer NOT NULL,
  creado_en           timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_profasig_correo_materia_grupo
  ON profesores_asignatura (lower(correo), lower(materia), sem, secc);
CREATE INDEX IF NOT EXISTS ix_profasig_sem_secc ON profesores_asignatura (sem, secc);
CREATE INDEX IF NOT EXISTS ix_profasig_materia  ON profesores_asignatura (lower(materia));

INSERT INTO profesores_asignatura
  (prof_asig_nombre, prof_asig_ape_pate, prof_asig_ape_mate, correo, materia, sem, secc)
VALUES
  ('OLIVER OTONIEL', 'VIRRUETA', 'MONTERO', 'themr.hurongameplay@gmail.com', 'CONTABILIDAD I', 1, 45)
ON CONFLICT (lower(correo), lower(materia), sem, secc) DO NOTHING;

COMMIT;
