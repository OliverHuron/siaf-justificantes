# SIAF Justificantes — Plan de desarrollo (borrador v3)

Sistema de control y emisión de justificantes de inasistencia para la Facultad de
Contaduría y Ciencias Administrativas (FCCA), UMSNH. Reemplaza el flujo actual de
Google Forms + Google Sheets + Excel + envío manual del oficio.

> Borrador para revisión. La sección final lista lo que sigue pendiente de confirmar.

---

## 0. Cambios respecto a la v2 (según tus últimas respuestas)

- **El alumno NO elige profesores.** El sistema toma las **secciones + semestres + los
  días** de la solicitud, cruza contra la tabla de **horarios** (qué materias tiene ese
  grupo ese día de la semana), obtiene el **profesor/correo** de cada materia y le manda el
  oficio a cada uno. Para probarlo se carga un **horario de prueba** con los dos correos
  dados.
- **Tres cuentas / tres roles**:
  | Rol | Cuenta | Usuario | Contraseña | Función |
  |---|---|---|---|---|
  | `encargada` | `ventanilla@umich.mx` | `ventanilla` | `123456` | Recibe y revisa solicitudes, aprueba/rechaza, mensajes al alumno. |
  | `supervisor` | `direccion@umich.mx` | `dirección` | `123456` | Todo lo de encargada + anular folios + Configuración + horarios + bitácora + usuarios. |
  | `coordinador` | `coordinador@umich.mx` | `coordinador` | `123456` | Solo lectura + consolidado por sección/semestre. |
  (Todas `must_change_password = true`.)
- **Días = mini-calendario.** Tarjetas por mes/año con los días; el alumno marca el/los
  día(s). Reglas:
  - No se puede solicitar más de **10 días hábiles** (lun–vie) después de la fecha de la
    falta *(configurable; no aplica a caso especial ni a enfermería)*.
  - La encargada **coteja los días marcados contra la fecha de la receta** (casilla
    "fechas verificadas"). Si no cuadran, rechaza.
- **El `tipo` lo elige el alumno** en el formulario (IMSS / particular / caso especial). Es
  una **clasificación** que: (a) define **qué adjuntos pide el formulario** y (b) se muestra
  como **badge de color** en la bandeja de la encargada. **No** fija el texto del oficio.
- **Dos tipos de plantilla**:
  1. **Plantillas de correo** — los correos al alumno (acuse, rechazo, etc.).
  2. **Plantillas de cuerpo del oficio** — la frase de motivo dentro del PDF. **No hay un
     texto fijo por tipo**: el supervisor crea estas plantillas y la encargada elige una
     **o escribe una libre** al aprobar. La semilla trae solo una genérica.
- **Enfermería FCCA**: **panel propio con login** (rol `enfermeria`). El personal de
  enfermería llena una ficha **igual que la del alumno** (nombre, matrícula, semestre[s],
  sección[es], días, constancia) — ahí atiende al alumno y antes le generaba el documento.
  Tipo fijo `enfermeria_fcca`, sin ticket, sin regla de 10 días. Cae en la **misma bandeja**
  y la encargada la **confirma/aprueba** antes de emitir.
- **Caso especial**: puede enviarse escaneado; si se necesita el original, la encargada
  marca **"requiere verificación en ventanilla"** y el trámite queda en espera.
- **Folio** `F-2026-0001-XX` — consecutivo **reinicia por año** + 2 caracteres verificadores
  (HMAC con secreto), más un `token_qr` largo y aleatorio para la validación real.
- **Fecha del oficio** = el día en que se **aprueba/genera**, con año:
  *"Morelia, Michoacán, a DD de MES de AAAA"*.
- **Aviso de privacidad**: se redacta y se publica como página propia (formato "grande"),
  con base en la **LGPDPPSO**, la **Ley de Protección de Datos Personales en Posesión de
  Sujetos Obligados del Estado de Michoacán** y los avisos de la propia UMSNH (sección 12).
- **Repo GitHub**: `siaf-justificantes`.

### Formulario actual (confirmado por capturas)

Título *"JUSTIFICANTES FCCA"*. Campos: Correo (`@umich.mx`), **NOMBRE COMPLETO** (hoy
opcional → se hará obligatorio), **MATRÍCULA**, **SECCIÓN O SECCIONES** (casillas, lista
1–93 con huecos + "Otro", multi), **SEMESTRE(S)** (primero…noveno, multi), **DÍA(S) A
JUSTIFICAR** (texto → pasa a mini-calendario), **adjunto** (1 PDF ≤ 10 MB). Se agrega
**Tipo de solicitud**.

---

## 1. Encaje con la familia SIAF

Mismo esquema de `DEPLOYMENT.md` (servidor compartido, Cloudflare Tunnel → nginx → PM2 →
Express → PostgreSQL, deploy por GitHub Actions con el runner `siaf`).

| Recurso | Valor |
|---|---|
| Proyecto / repo | `siaf-justificantes` |
| Dominio | `justificantes.siafsystem.online` |
| Puerto Express | `5004` |
| Base de datos | `justificantes_db` / `justificantes_admin` |
| `.env` producción | `/var/www/.env.siaf-justificantes` |
| Cliente | React + Vite |
| Servidor | Express (+ `nodemon` en desarrollo) |
| Sin SSE. Con subida de archivos → `client_max_body_size` en nginx. |

---

## 2. Autenticación

### 2.1 Alumno — código por correo `@umich.mx`
1. Escribe correo; si no es `@umich.mx` → mensaje en el formulario y no continúa.
2. Código de 6 dígitos (hash en BD, 10 min, un solo uso, máx. 5 intentos).
3. Sesión corta (JWT ~2 h) para enviar **una** solicitud y ver las suyas.
4. Rate-limit del envío de código: 3/h por correo, 10/h por IP (cuida el tope de 500/día
   del SMTP de Gmail).

### 2.2 Personal — 3 cuentas sembradas (sección 0). Login usuario/contraseña → JWT (`7d`).

| Acción | encargada | supervisor | coordinador |
|---|:--:|:--:|:--:|
| Ver cola / detalle / evidencia | ✅ | ✅ | ✅ (lectura) |
| Aprobar / rechazar / ventanilla | ✅ | ✅ | ❌ |
| Mensajes al alumno / plantillas rápidas | ✅ | ✅ | ❌ |
| Triage (color, recordatorio, atendido) | ✅ | ✅ | ❌ |
| Anular folios | ❌ | ✅ | ❌ |
| Configuración (plantillas, SMTP, horarios, folio, textos) | ❌ | ✅ | ❌ |
| Usuarios | ❌ | ✅ | ❌ |
| Bitácora completa | parcial | ✅ | ❌ |
| Consolidado por sección/semestre | ✅ | ✅ | ✅ |

Rol `enfermeria` — cuenta `enfermeria@umich.mx` / `enfermeria` / `123456`. Llena fichas
tipo `enfermeria_fcca` (formulario igual al del alumno + constancia); **no** ve el resto de
la bandeja ni la Configuración. Sus fichas pasan a la bandeja de la encargada para aprobación.

### 2.3 Alumno — seguimiento sin login
El acuse trae `…/solicitud/<token_seguimiento>`: estado + hilo de mensajes con la encargada.

### 2.4 Público — `…/validar?folio=&token=` y `…/aviso-de-privacidad`.

---

## 3. Tipos de solicitud y evidencia

| Tipo | Adjuntos obligatorios | Reglas propias |
|---|---|---|
| `receta_imss` | Receta IMSS + ticket de compra | Regla de 10 días **hábiles**. Cotejo de fechas vs receta. |
| `receta_particular` | Receta particular + ticket de compra | Igual que IMSS. |
| `enfermeria_fcca` | Constancia de enfermería FCCA | **Sin ticket, sin regla de 10 días.** Se crea desde el **panel de enfermería** (rol `enfermeria`), no por el alumno. La encargada **confirma** antes de emitir. |
| `caso_especial` | Documento del médico tratante/responsable con **firma autógrafa** (escaneado) | **Sin receta/ticket.** **No** aplica la regla de 10 días ni el cotejo de receta. La encargada puede marcar **"requiere verificación en ventanilla"** (entrega del original físico) y dejarlo en espera. Campo de contexto ampliado. |

El `tipo` se muestra como **badge** en la bandeja y define los adjuntos del formulario;
**no** fija la frase del oficio (esa la pone la encargada al aprobar, con plantilla de
cuerpo o texto libre).

---

## 4. Ruteo automático a profesores

1. La solicitud tiene: `semestres[]`, `secciones[]`, `fechas[]` (del mini-calendario).
2. Cada fecha → día de la semana.
3. Se consulta `horarios` del **ciclo escolar activo**:
   `semestre ∈ semestres[] AND seccion ∈ secciones[] AND dia_semana ∈ {días de las fechas}`.
4. Se juntan los `(materia, profesor, correo)` distintos → **lista de destinatarios**.
5. La encargada **revisa la lista** en la pantalla de aprobación: puede **desmarcar** un
   profesor o **agregar** uno manual antes de enviar.
6. Al aprobar, a cada correo incluido se le envía el **oficio en PDF** (con QR).
7. Los destinatarios resueltos se **congelan** en `solicitud_profesores` (para auditoría).

**Horario de prueba** (semilla): ciclo `2026`, semestre `primero`, sección `1`:
`("Contabilidad 1", "Profesor 1", themr.hurongameplay@gmail.com, lunes)` y
`("Práctica Contable", "—", oliver2000.oovm@gmail.com, martes)`. Solicitud de prueba con
un lunes y un martes → los dos correos deben llegar.

---

## 5. Modelo de datos (PostgreSQL, `001_initial.sql`)

- **`usuarios`** — `id, usuario, nombre, email, password_hash, rol
  (encargada|supervisor|coordinador), activo, must_change_password, totp_secret (null),
  creado_en, actualizado_en`.

- **`otp_codes`** — `id, email, code_hash, expires_at, intentos, consumido_en, ip, creado_en`.

- **`horarios`** — `id, ciclo_escolar, semestre, seccion, materia, profesor_nombre,
  profesor_correo, dia_semana (1–7), hora_inicio (null), hora_fin (null), activo`.
  CRUD + importación CSV desde Configuración. (Se normaliza cuando llegue la BD real.)

- **`solicitudes`**
  `id, email_alumno, nombre_declarado, matricula_declarada, semestres (text[]),
  secciones (text[]), tipo, fechas (date[]), contexto_extra,
  dias_texto_oficio (generado, editable), plantilla_cuerpo_id (fk, null),
  frase_cuerpo (text), estado, estado_triage, color, recordatorio,
  fechas_verificadas_receta (bool), requiere_ventanilla (bool), ventanilla_recibido (bool),
  enfermeria_confirmada (bool), ip_solicitud, token_seguimiento, banderas (jsonb),
  creado_en, enviado_en, decidido_en, decidido_por (fk usuarios), motivo_rechazo, nota_interna`.
  `estado ∈ {pendiente, aprobada, rechazada, requiere_ventanilla, cancelada}`.

- **`adjuntos`** — `id, solicitud_id, tipo (receta|ticket|constancia|documento_medico|otro),
  ruta_archivo, nombre_original, mime, tamano, subido_en`. En `storage/adjuntos/`, no
  servidos por nginx. **Sin purga automática** (evidencia; ver aviso de privacidad).

- **`solicitud_profesores`** — `id, solicitud_id, materia, profesor_nombre, profesor_correo,
  incluir (bool), origen (auto|manual), enviado_en (null)`.

- **`folios`** — al aprobar. `id, solicitud_id, folio (único), token_qr (único, aleatorio),
  pdf_ruta, emitido_en, emitido_por, anulado_en, anulado_por, motivo_anulacion`.

- **`mensajes`** — `id, solicitud_id, autor (alumno|staff), autor_usuario (null),
  cuerpo, leido, creado_en`.

- **`plantillas`** — `id, ambito (correo|cuerpo_oficio), clave, titulo, asunto (null para
  cuerpo), cuerpo, activo`. Variables `{{nombre}}`, `{{folio}}`, `{{dias}}`,
  `{{motivo_rechazo}}`, `{{semestre}}`, `{{seccion}}`, …

- **`config`** — `clave, valor (jsonb)`: SMTP (contraseña cifrada), prefijo/consecutivo de
  folio por año, `DIAS_LIMITE_SOLICITUD` (10), `PENDIENTES_MAX` (2), `CICLO_ACTIVO`,
  textos legales, catálogo de secciones/semestres.

- **`bitacora`** — `id, actor_tipo (staff|alumno|sistema), actor_ref, accion, solicitud_id,
  detalle (jsonb), ip, creado_en`. Append-only.

- **`verificaciones_qr`** — `id, folio, token_ok (bool), ip, user_agent, creado_en`.

---

## 6. API (`/api`)

### Auth
- `POST /auth/alumno/solicitar-codigo` `{ email }`
- `POST /auth/alumno/verificar-codigo` `{ email, code }`
- `POST /auth/login` · `POST /auth/cambiar-password`

### Solicitudes (alumno)
- `GET /catalogos` — tipos, semestres, secciones, `DIAS_LIMITE_SOLICITUD`, aviso corto.
- `POST /solicitudes` — crea y envía. Valida: dominio; adjuntos según `tipo`; ≥1 semestre y
  ≥1 sección; `fechas` no vacías y (salvo `caso_especial`) dentro de la ventana de 10 días;
  **máx. 2 en `pendiente`** por correo y por matrícula.
- `POST /solicitudes/:id/adjuntos` — multipart.
- `GET /solicitudes/mias`
- `GET /seguimiento/:token` · `POST /seguimiento/:token/mensajes` `{ cuerpo }`

### Revisión (encargada / supervisor)
- `GET /revision/cola` — filtros: estado, estado_triage, semestre, seccion, desde/hasta,
  solo_marcadas, texto.
- `PATCH /revision/:id/triage` `{ estado_triage, color, recordatorio }`
- `GET /revision/:id` — datos + adjuntos (URL autorizada) + banderas + historial de la
  matrícula + hilo + **lista de profesores resuelta**.
- `POST /revision/:id/mensajes` `{ cuerpo | plantilla_clave }` — correo al alumno.
- `PATCH /revision/:id/profesores` `{ items:[{materia,profesor,correo,incluir,origen}] }`
- `POST /revision/:id/aprobar` `{ plantilla_cuerpo_id | frase_cuerpo, dias_texto_oficio,
  fechas_verificadas_receta }` — folio + `token_qr`, PDF, envío a profesores incluidos,
  acuse + enlace al alumno, bitácora. (Bloquea si `enfermeria_fcca` y no
  `enfermeria_confirmada`, o si `requiere_ventanilla` y no `ventanilla_recibido`.)
- `POST /revision/:id/rechazar` `{ plantilla_clave | motivo }`
- `POST /revision/:id/ventanilla` `{ plantilla_clave | nota }` · `POST /revision/:id/ventanilla-recibido`
- `POST /revision/:id/enfermeria-confirmar`
- `POST /revision/:id/nota` `{ texto }`
- `GET /revision/:id/pdf` — genera/descarga bajo demanda.

### Folios
- `GET /folios` · `POST /folios/:id/anular` `{ motivo }` (supervisor)

### Configuración (supervisor)
- `GET/PUT /config` · `POST /config/smtp/test`
- `GET/POST/PATCH/DELETE /plantillas?ambito=correo|cuerpo_oficio`
- `GET/POST/PATCH/DELETE /horarios` · `POST /horarios/importar` (CSV)
- `GET/POST/PATCH /usuarios`

### Consolidado
- `GET /consolidado?semestre=&seccion=&desde=&hasta=` (encargada/supervisor/coordinador)

### Público
- `GET /validar?folio=&token=` — registra escaneo.
- `GET /health`

---

## 7. El oficio (PDF)

- **Motor**: Puppeteer (Chromium headless) renderiza `server/templates/oficio.html`
  (tu `evento_transmision.html` parametrizado) → PDF fiel. ~150 MB en el server, una vez.
- **Variables**: `{{fecha_oficio}}` (fecha de aprobación, *"Morelia, Michoacán, a DD de MES
  de AAAA"*), `No. {{folio}}.`, `{{destinatario}}` (ver abajo), `{{nombre}}`,
  `{{matricula}}`, `{{dias_texto_oficio}}`, `{{frase_cuerpo}}` (de la plantilla de cuerpo o
  texto libre), **recuadro QR** al pie con la leyenda de validación.
- **QR** → `…/validar?folio={{folio}}&token={{token_qr}}`.
- **Cuándo**: al aprobar (se adjunta al correo de cada profesor) y bajo demanda
  (`GET /revision/:id/pdf`). Se guarda en `storage/folios/<folio>.pdf`.
- **Multi semestre/sección**: **siempre un solo oficio**, aunque abarque varias secciones o
  semestres. `{{destinatario}}` se arma con la lista combinada
  (p. ej. *"Profesores de los Semestres primero y tercero, Secciones 1 y 5"*) y el mismo
  PDF se envía a todos los profesores resueltos.

### Folio
`F-<AAAA>-<NNNN>-<CC>` — `AAAA` año/ciclo, `NNNN` consecutivo con ceros (reinicia por año),
`CC` = 2 caracteres base32 de un HMAC-SHA256 (secreto en `.env`) sobre `F-AAAA-NNNN`. El
`CC` frena que alguien "suba el número" en una copia; la validación real es el `token_qr`.

---

## 8. Bandeja de revisión (reemplazo del Excel)

- **Cola** con **color / estado de triage** editable, **recordatorio** por fila, marca de
  **atendido**, y **envío rápido**: desplegable con títulos de plantillas de correo + botón
  **Enviar** sin abrir la solicitud.
- **Filtros**: estado, triage, semestre/sección, fecha, con banderas/recordatorio, texto.
- **Detalle**: adjuntos en línea con zoom **junto a las fechas marcadas** (para el cotejo
  con la receta) + casilla "fechas verificadas"; banderas; historial de la matrícula; hilo;
  **lista de profesores resuelta** (marcar/desmarcar/agregar); selector de **plantilla de
  cuerpo** o texto libre; botones **Aprobar / Rechazar / Requiere ventanilla / Confirmar
  enfermería / Nota**.

### Banderas (al enviar)
`fuera_de_ventana` (>10 días hábiles; no en caso especial ni enfermería) · `traslape` · `duplicada`
(matrícula+fechas+tipo) · `repetidor` (>N aprobadas en 60 días) · `sin_adjunto_completo` ·
`matricula_formato` · `sin_horario` (no se resolvió ningún profesor).

---

## 9. Configuración (sidebar, supervisor)

1. **Plantillas de correo** — CRUD (clave, título, asunto, cuerpo). Semilla:
   `acuse_recibido`, `aprobado`, `rechazo_receta_ilegible`, `rechazo_falta_ticket`,
   `rechazo_fechas`, `pasar_ventanilla`, `solicitud_informacion`.
2. **Plantillas de cuerpo del oficio** — CRUD (clave, título, cuerpo). Semilla: **una sola
   genérica**; el supervisor redacta las demás y la encargada elige o escribe libre al aprobar.
3. **SMTP** — host/puerto/usuario/contraseña (cifrada)/remitente + **prueba**.
4. **Horarios** — CRUD + importación CSV; selección del **ciclo activo**.
5. **Folio** — año, consecutivo actual, secreto del verificador.
6. **Textos** — aviso de privacidad (integral y corto), mensajes del formulario,
   catálogo de secciones/semestres, `DIAS_LIMITE_SOLICITUD`, `PENDIENTES_MAX`.

---

## 10. Frontend

| Superficie | Rol | Contenido |
|---|---|---|
| **Portal del alumno** | Alumno | Login por código → formulario: correo, nombre*, matrícula, semestre(s), sección(es), **tipo**, **mini-calendario de días**, adjuntos según tipo, casilla de consentimiento del aviso → "Mis solicitudes". |
| **Seguimiento** | Alumno + token | Estado + hilo de mensajes. |
| **Panel de enfermería** | `enfermeria` / encargada | Alta de justificante `enfermeria_fcca` con constancia, días y grupo. *(Pendiente §14.)* |
| **Bandeja** | encargada / supervisor | Cola con triage + envío rápido; detalle con evidencia vs fechas, profesores resueltos, plantilla de cuerpo, decisiones. |
| **Folios** | supervisor (coordinador: lectura) | Buscar / anular. |
| **Configuración** | supervisor | Sección 9. |
| **Consolidado** | los tres | Lista por sección/semestre. |
| **Validación** | Público | `/validar`. |
| **Aviso de privacidad** | Público | `/aviso-de-privacidad` (sección 12). |

---

## 11. Infraestructura (deltas sobre `DEPLOYMENT.md`)

1. `.env.siaf-justificantes`: `PORT=5004`, `DB_NAME=justificantes_db`,
   `DB_USER=justificantes_admin`, `CLIENT_URL=https://justificantes.siafsystem.online`,
   `SMTP_HOST/PORT/USER/PASS/FROM`, `PUBLIC_URL`, `STORAGE_PATH`, `CONFIG_ENC_KEY`,
   `FOLIO_HMAC_SECRET`, `OTP_TTL_MIN`, `OTP_MAX_INTENTOS`, `PENDIENTES_MAX`, `DIAS_LIMITE_SOLICITUD`.
2. nginx: estático + `/api` → `:5004`; **sin** bloque SSE; `client_max_body_size 15m;`;
   `storage/` no expuesto.
3. `storage/{adjuntos,folios}` dueño `oliver`, excluido del `rsync`.
4. Cloudflare Tunnel: `hostname: justificantes.siafsystem.online` antes de `http_status:404`
   + `cloudflared tunnel route dns …`.
5. GitHub Actions: runner `siaf`; `deploy.yml` con `--name siaf-justificantes`.
6. Dependencias de Chromium headless en el server (una vez).
7. `seed`: **4 usuarios** (encargada `ventanilla`, supervisor `dirección`, coordinador
   `coordinador`, enfermería `enfermeria`), horario de prueba (sección 4), plantillas de
   correo + 1 de cuerpo genérica, catálogo de secciones (lista 1–93 del formulario actual)
   y semestres, config por defecto.
8. Reescribir `DEPLOYMENT.md` con estos valores al confirmar.

---

## 12. Aviso de privacidad

**Marco legal aplicable** (UMSNH es *sujeto obligado*, no *particular* → **no** es la
LFPDPPP): Ley General de Protección de Datos Personales en Posesión de Sujetos Obligados
(**LGPDPPSO**); **Ley de Protección de Datos Personales en Posesión de Sujetos Obligados
del Estado de Michoacán de Ocampo**; órgano garante **IMAIP**. UMSNH ya publica avisos
(Secretaría Auxiliar, DTAI, Control Escolar) que sirven de modelo y de responsable.

**Entrega en dos capas** (patrón de los sitios grandes):
- **Aviso simplificado (corto)** en el formulario, con casilla de consentimiento **expreso**
  para datos personales **sensibles** (salud) y enlace al integral.
- **Aviso integral** en `/aviso-de-privacidad` con: responsable y domicilio; datos tratados
  (identificación, contacto, académicos y **sensibles de salud**: receta/constancia/
  documento médico y comprobantes de compra); finalidades primarias (tramitar y emitir el
  justificante, notificar a los profesores, control de folios, auditoría) y secundarias con
  opción de negativa; fundamento legal; remisiones/comunicaciones (profesores y control
  escolar de la propia UMSNH; autoridades cuando la ley lo exija); medios para ejercer
  derechos **ARCO** y revocar consentimiento (Unidad de Transparencia UMSNH / correo);
  plazo y criterio de conservación (evidencia académica y auditoría); uso de cookies solo
  de sesión; procedimiento de cambios al aviso; fecha de última actualización.

**Datos que ya se tienen** (públicos, UMSNH): la Unidad de Transparencia es el
**Departamento de Transparencia y Acceso a la Información (DTAI)**; los derechos **ARCO**
(Acceso, Rectificación, Cancelación, Oposición) se ejercen por escrito ante esa unidad, por
la **Plataforma Nacional de Transparencia** o al correo **infopub@umich.mx**; portal
`informacionpublica.umich.mx`.

**Responsable**: la **Universidad Michoacana de San Nicolás de Hidalgo (UMSNH)**, con la
FCCA como área que opera el trámite. Derechos ARCO por el DTAI / Plataforma Nacional de
Transparencia / `infopub@umich.mx`. Domicilio institucional (Ciudad Universitaria, Av. Fco.
J. Múgica s/n, Morelia, Michoacán) va como marcador `[por verificar]`.

Lo **redacto como borrador** en `docs/aviso-de-privacidad.md` (la página la sirve el
cliente); lo que falte va como marcador `[…]`.

---

## 13. Roadmap

**Fase 0 — Andamiaje**: `server/` + `client/`, `001_initial.sql`, `seed`, `deploy.yml`,
`/api/health`, pipeline en verde.

**Fase 1 — MVP (sustituye a Google Forms)**: 3 roles · OTP `@umich.mx` · formulario con
tipos + semestre/sección multi + **mini-calendario** + adjuntos por tipo + regla de 10 días
+ regla de 2 pendientes · **horarios** (CRUD + import) y **ruteo automático a profesores** ·
bandeja con triage/recordatorio/filtros/envío rápido · aprobar/rechazar/ventanilla/
confirmar enfermería · hilo bilateral · folio + `token_qr` · **PDF del oficio con QR
enviado a los profesores** · acuse + enlace de seguimiento · plantillas de correo y de
cuerpo · Configuración · `/validar` · **aviso de privacidad** · bitácora.

**Fase 2 — Operación**: log de escaneos + alertas de reventa · PDF bajo demanda para el
alumno · consolidado · banderas refinadas · TOTP · afinar panel de coordinador.

**Fase 3 — Integraciones**: BD real de horarios/materias/profesores (elimina el CRUD
manual) · BD de alumnos / OAuth en producción → SSO institucional y autollenado de
nombre/matrícula (sustituye el OTP).

---

## 14. Pendientes por confirmar

**Todos los puntos abiertos quedaron resueltos.** Resumen de lo decidido en las últimas rondas:

- Enfermería FCCA = **panel propio con login** (rol `enfermeria`), llena ficha igual a la
  del alumno + constancia; la encargada la aprueba.
- Fecha del oficio = **día de aprobación**, con año.
- Ventana = **10 días hábiles** (lun–vie; feriados: lista opcional en Configuración, Fase 2).
- Catálogo de secciones = **lista actual del formulario** (1–93 con huecos + "Otro").
- Folio = **`F-2026-0001-XX`**, reinicia por año.
- Responsable del aviso = **UMSNH** (ARCO por `infopub@umich.mx` / DTAI); domicilio como marcador.

Sub-puntos menores que se ajustan sobre la marcha durante el desarrollo (no bloquean):
formato exacto de `dias_texto_oficio`, redacción de la plantilla de cuerpo genérica,
transcripción fina de la lista de secciones, dirección postal exacta de la UMSNH.
