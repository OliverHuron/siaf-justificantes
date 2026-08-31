-- SIAF Justificantes — esquema inicial
-- Modelo descrito en PLAN.md §5. Se ejecuta con `npm run migrate`.
-- Idempotente en lo posible (IF NOT EXISTS); el runner ya evita repetir migraciones aplicadas.

BEGIN;

-- ---------------------------------------------------------------------------
-- Personal
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario                text        NOT NULL UNIQUE,
  nombre                 text        NOT NULL,
  email                  text        NOT NULL,
  password_hash          text        NOT NULL,
  rol                    text        NOT NULL
                          CHECK (rol IN ('encargada','supervisor','coordinador','enfermeria')),
  activo                 boolean     NOT NULL DEFAULT true,
  must_change_password   boolean     NOT NULL DEFAULT true,
  totp_secret            text,
  creado_en              timestamptz NOT NULL DEFAULT now(),
  actualizado_en         timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Códigos OTP de alumno (login por correo @umich.mx)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS otp_codes (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         text        NOT NULL,
  code_hash     text        NOT NULL,
  expires_at    timestamptz NOT NULL,
  intentos      int         NOT NULL DEFAULT 0,
  consumido_en  timestamptz,
  ip            inet,
  creado_en     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_otp_email      ON otp_codes (email);
CREATE INDEX IF NOT EXISTS idx_otp_expires_at ON otp_codes (expires_at);

-- ---------------------------------------------------------------------------
-- Catálogos para el formulario
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS secciones (
  clave    text PRIMARY KEY,
  etiqueta text    NOT NULL,
  orden    int     NOT NULL DEFAULT 0,
  activo   boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS semestres (
  clave    text PRIMARY KEY,
  etiqueta text    NOT NULL,
  orden    int     NOT NULL DEFAULT 0,
  activo   boolean NOT NULL DEFAULT true
);

-- ---------------------------------------------------------------------------
-- Horarios (para el ruteo automático a profesores). PLAN §4.
-- Se normaliza cuando llegue la BD institucional real.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS horarios (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ciclo_escolar    text        NOT NULL,
  semestre         text        NOT NULL,
  seccion          text        NOT NULL,
  materia          text        NOT NULL,
  profesor_nombre  text,
  profesor_correo  text        NOT NULL,
  dia_semana       int         NOT NULL CHECK (dia_semana BETWEEN 1 AND 7), -- 1 = lunes
  hora_inicio      time,
  hora_fin         time,
  activo           boolean     NOT NULL DEFAULT true,
  creado_en        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_horarios_lookup
  ON horarios (ciclo_escolar, semestre, seccion, dia_semana) WHERE activo;

-- ---------------------------------------------------------------------------
-- Plantillas: correos al alumno y cuerpo del oficio. PLAN §9.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plantillas (
  id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ambito   text NOT NULL CHECK (ambito IN ('correo','cuerpo_oficio')),
  clave    text NOT NULL,
  titulo   text NOT NULL,
  asunto   text,                -- null para cuerpo_oficio
  cuerpo   text NOT NULL,
  activo   boolean NOT NULL DEFAULT true,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ambito, clave)
);

-- ---------------------------------------------------------------------------
-- Configuración clave/valor (SMTP, folio, textos legales, parámetros…). PLAN §5/§9.
-- La contraseña SMTP se guarda cifrada (CONFIG_ENC_KEY).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS config (
  clave          text PRIMARY KEY,
  valor          jsonb NOT NULL,
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Solicitudes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS solicitudes (
  id                       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  origen                   text        NOT NULL DEFAULT 'alumno'
                            CHECK (origen IN ('alumno','enfermeria')),
  email_alumno             text        NOT NULL,
  nombre_declarado         text        NOT NULL,
  matricula_declarada      text        NOT NULL,
  semestres                text[]      NOT NULL DEFAULT '{}',
  secciones                text[]      NOT NULL DEFAULT '{}',
  tipo                     text        NOT NULL
                            CHECK (tipo IN ('receta_imss','receta_particular','enfermeria_fcca','caso_especial')),
  fechas                   date[]      NOT NULL DEFAULT '{}',
  contexto_extra           text,
  dias_texto_oficio        text,
  plantilla_cuerpo_id      bigint      REFERENCES plantillas(id),
  frase_cuerpo             text,
  estado                   text        NOT NULL DEFAULT 'pendiente'
                            CHECK (estado IN ('pendiente','aprobada','rechazada','requiere_ventanilla','cancelada')),
  estado_triage            text        NOT NULL DEFAULT 'nueva'
                            CHECK (estado_triage IN ('nueva','en_revision','atendida','espera_alumno')),
  color                    text,
  recordatorio             text,
  fechas_verificadas_receta boolean    NOT NULL DEFAULT false,
  requiere_ventanilla      boolean     NOT NULL DEFAULT false,
  ventanilla_recibido      boolean     NOT NULL DEFAULT false,
  enfermeria_confirmada    boolean     NOT NULL DEFAULT false,
  ip_solicitud             inet,
  token_seguimiento        text        NOT NULL UNIQUE,
  banderas                 jsonb       NOT NULL DEFAULT '{}'::jsonb,
  creado_en                timestamptz NOT NULL DEFAULT now(),
  enviado_en               timestamptz,
  decidido_en              timestamptz,
  decidido_por             bigint      REFERENCES usuarios(id),
  motivo_rechazo           text,
  nota_interna             text
);
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado    ON solicitudes (estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_email     ON solicitudes (lower(email_alumno));
CREATE INDEX IF NOT EXISTS idx_solicitudes_matricula ON solicitudes (upper(matricula_declarada));
CREATE INDEX IF NOT EXISTS idx_solicitudes_creado    ON solicitudes (creado_en DESC);

-- ---------------------------------------------------------------------------
-- Adjuntos (evidencia). Archivos en STORAGE_PATH/adjuntos, no servidos por nginx.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS adjuntos (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  solicitud_id   bigint      NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
  tipo           text        NOT NULL
                  CHECK (tipo IN ('receta','ticket','constancia','documento_medico','otro')),
  ruta_archivo   text        NOT NULL,
  nombre_original text       NOT NULL,
  mime           text        NOT NULL,
  tamano         bigint      NOT NULL,
  subido_en      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_adjuntos_solicitud ON adjuntos (solicitud_id);

-- ---------------------------------------------------------------------------
-- Profesores resueltos para una solicitud (congelados al aprobar). PLAN §4.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS solicitud_profesores (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  solicitud_id    bigint  NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
  materia         text    NOT NULL,
  profesor_nombre text,
  profesor_correo text    NOT NULL,
  incluir         boolean NOT NULL DEFAULT true,
  origen          text    NOT NULL DEFAULT 'auto' CHECK (origen IN ('auto','manual')),
  enviado_en      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_sol_prof_solicitud ON solicitud_profesores (solicitud_id);

-- ---------------------------------------------------------------------------
-- Folios emitidos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS folios (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  solicitud_id     bigint      NOT NULL UNIQUE REFERENCES solicitudes(id),
  folio            text        NOT NULL UNIQUE,
  token_qr         text        NOT NULL UNIQUE,
  pdf_ruta         text,
  emitido_en       timestamptz NOT NULL DEFAULT now(),
  emitido_por      bigint      REFERENCES usuarios(id),
  anulado_en       timestamptz,
  anulado_por      bigint      REFERENCES usuarios(id),
  motivo_anulacion text
);

-- Contador de consecutivo de folio por año. PLAN §7 (F-AAAA-NNNN-CC).
CREATE TABLE IF NOT EXISTS folio_consecutivo (
  anio      int PRIMARY KEY,
  siguiente int NOT NULL DEFAULT 1
);

-- ---------------------------------------------------------------------------
-- Hilo bilateral alumno <-> personal
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mensajes (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  solicitud_id  bigint      NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
  autor         text        NOT NULL CHECK (autor IN ('alumno','staff')),
  autor_usuario bigint      REFERENCES usuarios(id),
  cuerpo        text        NOT NULL,
  leido         boolean     NOT NULL DEFAULT false,
  creado_en     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mensajes_solicitud ON mensajes (solicitud_id, creado_en);

-- ---------------------------------------------------------------------------
-- Bitácora (append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bitacora (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_tipo   text        NOT NULL CHECK (actor_tipo IN ('staff','alumno','sistema')),
  actor_ref    text,
  accion       text        NOT NULL,
  solicitud_id bigint      REFERENCES solicitudes(id) ON DELETE SET NULL,
  detalle      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  ip           inet,
  creado_en    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bitacora_solicitud ON bitacora (solicitud_id);
CREATE INDEX IF NOT EXISTS idx_bitacora_creado    ON bitacora (creado_en DESC);

-- ---------------------------------------------------------------------------
-- Registro de escaneos de la página de validación
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verificaciones_qr (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  folio      text        NOT NULL,
  token_ok   boolean     NOT NULL,
  ip         inet,
  user_agent text,
  creado_en  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_verif_folio ON verificaciones_qr (folio);

COMMIT;
