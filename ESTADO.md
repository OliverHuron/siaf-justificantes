# Estado del proyecto — dónde retomar

_Última sesión: 2026-08-31. Rama `main`, todo pusheado (último commit `11c3742`)._

## Resumen

- **`PLAN.md`** (v3) es el diseño de referencia y **está completo**: §14 sin pendientes
  bloqueantes, §13 marca **Fase 0 y Fase 1 como terminadas**.
- **Fase 0 (andamiaje)** y **Fase 1 (MVP que sustituye a Google Forms)**: hechas y probadas
  extremo a extremo contra Postgres local. Backend Express + PostgreSQL completo; SPA
  React + Vite completa; identidad visual UMSNH (login con `fondo.jpg` + overlay azul,
  shell navy con sidebar/topbar, código OTP en cuadros).

## Cómo levantarlo en otra PC (desde cero)

Requisitos: Node 20+, PostgreSQL 16, Google Chrome instalado (para el PDF; `pdf.js`
autodetecta la ruta en Windows/Linux o usa `CHROMIUM_PATH`).

```bash
git clone https://github.com/OliverHuron/siaf-justificantes.git
cd siaf-justificantes

# 1) Base de datos
createdb justificantes_db
#   crear el usuario/role que uses en el .env (o dejar el default de tu Postgres)

# 2) Backend
cd server
cp .env.example .env          # ajustar DB_USER / DB_PASSWORD / DB_NAME al Postgres local
npm install
npm run migrate               # crea el esquema (001_initial.sql)
npm run seed                  # 4 cuentas + catálogos + horario de prueba + plantillas
npm run dev                   # http://localhost:5004/api/health

# 3) Frontend (otra terminal)
cd ../client
npm install
npm run dev                   # http://localhost:5173  (proxya /api al :5004)
```

> En dev **no hay SMTP**: el código OTP del alumno y todos los correos se **imprimen en la
> terminal del servidor** (`[mailer:dev] ... asunto: Tu código de acceso: NNNNNN`).
> Para correo real: Configuración → SMTP, o `SMTP_USER`/`SMTP_PASS` en `.env` (App Password
> de Gmail).

## Accesos y rutas

| Quién | Ruta | Credenciales (seed, temporales) |
|---|---|---|
| Alumno | `/solicitar` (→ `/solicitar/acceso`) | código OTP a correo `@umich.mx` |
| Personal (encargada) | `/staff` (→ `/staff/acceso`) | `ventanilla` / `123456` |
| Supervisor | `/staff` | `direccion` / `123456` |
| Coordinador | `/staff` | `coordinador` / `123456` |
| Enfermería | `/enfermeria` (→ `/enfermeria/acceso`) | `enfermeria` / `123456` |
| Público | `/validar`, `/aviso-de-privacidad`, `/solicitud/<token>` | — |

Horario de prueba sembrado: semestre `primero`, sección `1`, lunes → `Contabilidad 1`
(themr.hurongameplay@gmail.com), martes → `Práctica Contable` (oliver2000.oovm@gmail.com).
Una solicitud de ese grupo con fechas en lunes y/o martes rutea el oficio a esos correos.

## Qué falta (siguiente sesión)

**Cierre de Fase 1**
1. **SMTP real** — pendiente y con problema conocido: el `.env` tiene
   `SMTP_USER=2211930x@umich.mx` + App Password, pero Gmail responde
   `535-5.7.8 BadCredentials`. Causa probable: cuenta de Google **Workspace** de la
   UMSNH con App Passwords / acceso SMTP deshabilitados por el administrador.
   Opciones: (a) cuenta `@gmail.com` personal con 2FA + App Password, (b) pedir a
   TI de la UMSNH habilitar SMTP para una cuenta de servicio, (c) proveedor
   transaccional (Resend/Brevo/SES). En dev, si el envío falla ya **no bloquea**:
   el código/correo se escribe en la consola del servidor.
2. **Primer deploy** en el servidor SIAF: pasos 2–11 de `DEPLOYMENT.md`
   (crear DB, `.env.siaf-justificantes`, nginx, Cloudflare Tunnel), enganchar el
   repo al runner self-hosted `siaf`, y confirmar `deploy.yml` + `/api/health`.
3. **Chromium en el server Linux**: instalar libs (`libnss3`, `libatk-1.0-0`,
   `libgbm1`, `libasound2`, …) — nota en `DEPLOYMENT.md §1`.

**Hecho en la sesión del 2026-08-31 (2ª parte)** — commits `1e5c414`, `430d360`:
- ✅ UI de cambio de contraseña del personal (`/staff/cuenta`).
- ✅ Ajuste del recuadro QR en `oficio.html` (anclado al pie, sin encimarse).
- ✅ Días feriados: clave config `feriados`, excluidos del cálculo de días
  hábiles y tachados/no seleccionables en el mini-calendario.
- ✅ PDF del oficio para el alumno desde `/solicitud/<token>`.
- ✅ Alertas de reventa: pestaña en Folios sobre `verificaciones_qr`.

**Hecho en la sesión del 2026-09-09 (3ª parte)** — rediseño del formulario del alumno:
- ✅ **Topbar** propio (logo FCCA + título + correo + Salir), sticky.
- ✅ **Dos columnas**: izquierda los pasos numerados (1 Fechas · 2 Datos · 3 Motivo,
  pills navy sustituidos por nº en círculo), derecha una tarjeta **«Resumen» fija**
  (`position: sticky`) que se llena en vivo: grupo/expediente, matrícula/correo,
  rango + días hábiles, motivo + checklist de comprobantes y aviso, y el botón Enviar.
- ✅ Las 3 cajas de fecha (con la ámbar) → una **línea ligera** `Inicio … · Fin …` +
  chip de días hábiles; el desglose completo vive en el Resumen.
- ✅ Responsive: a ≤900px las columnas se apilan (Resumen y botón al final).
- Clases nuevas en `styles.css`: `.just-topbar`, `.just-wrap`, `.just-grid`,
  `.paso`/`.paso-num`, `.fechas-linea`/`.chip-dias`, `.just-resumen`/`.res-*`.
  Se retiran del formulario `.sec-panel`/`.sec-head`/`.fechas-cards`/`.exp-cards`.

**Hecho en la sesión del 2026-09-09 (2ª parte)** — acceso con grupo + reglas por modalidad:
- ✅ **Semestre y sección en la pantalla de acceso** (`AlumnoLogin`), debajo del correo:
  dos `SelectorGrid` de selección **única**. El semestre solo muestra los del **periodo
  en curso** (NON 1/3/5/7/9 del 2-ago al 30-ene; PAR 2/4/6/8 del 1-feb al 1-ago).
  Al elegir se **verifica el grupo en vivo** contra la FCCA (`GET /api/expediente`) y se
  avisa ahí mismo si no existe; «Enviar código» se habilita solo con grupo válido. El
  grupo se guarda en `localStorage` (`sj_alumno_grupo`) y lo toma el formulario.
- ✅ **Formulario**: el expediente (tarjetas) y el motivo **no se muestran hasta elegir el
  rango de fechas**. Ya no hay `GruposSelector` (un solo grupo por solicitud).
- ✅ **Días hábiles por modalidad**: `ESC` (escolarizada) = lun–vie; `ABI`/otra = lun–sáb.
  `lib/dias.js` (`diasSemanaDeModalidad`, param `dias` en `expandirRangoHabil` /
  `siguienteDiaHabil` / `diasHabilesEntre`), `RangoCalendario` (prop `diasSemana`, días no
  hábiles no seleccionables), `banderas.js` y `POST /solicitudes` usan el set según la
  modalidad del grupo. El tope de 15 y la ventana de 10 se cuentan en **días hábiles de
  esa modalidad** desde la reincorporación (`siguienteDiaHabil(fecha_fin)`).

**Hecho en la sesión del 2026-09-09** — formulario de solicitud rediseñado:
- ✅ Layout por secciones con headers navy (FECHAS / EXPEDIENTE / MOTIVO Y COMPROBANTES),
  calendario de **rango** (inicio→fin) con tarjetas Inicio/Fin/Total.
- ✅ **Lista de grupos** (`GruposSelector`): el alumno agrega uno o varios grupos
  (semestre + sección); cada uno se resuelve en vivo y se muestra como **una fila
  compacta** (`7° · Secc 26 — LIA · Vespertino · A2-LAB4 · ESC`), responsive. Se guarda
  `solicitudes.grupos` jsonb con snapshot por grupo; `semestres`/`secciones` se derivan;
  las columnas `licenciatura/turno/...` guardan el grupo **principal** (1º) para el oficio.
- ✅ **Expediente automático (consulta en vivo, sin BD)**: `lib/fcca.js` consulta
  `fcca.umich.mx/Horarios.php` al vuelo con **caché en memoria** (sesión ~10 min,
  resultado por grupo ~12 h). `GET /api/expediente?semestre=&seccion=` → licenciatura/
  turno/salón/modalidad/periodo. 1ª consulta ~2.7 s, siguientes instantáneas. La matrícula
  se deriva del correo (`#######L@umich.mx`). En la solicitud se guarda solo un **snapshot**
  de esos 5 campos (columnas en `solicitudes`); la tabla `grupos` se eliminó (migración 003).
- ✅ **Motivo**: Tipo (Médico / Caso especial) + Origen (Privada → receta+ticket;
  Institución pública → receta). Enfermería se omite (tendrá panel propio).
- ✅ **Reglas de fecha** (no aplican a caso especial): tope 15 días por solicitud +
  `10 días hábiles` desde la reincorporación (`siguienteDiaHabil(fecha_fin)`); banderas
  `fuera_de_ventana` y `excede_maximo`.
- ✅ Enlace al Reglamento (`siia.umich.mx/.../CapituloI.htm`), en `config.textos.reglamento_url`.

**Fase 2 restante** (ver `PLAN.md §13`)
- Consolidado en PDF (hoy es tabla imprimible con `window.print()`).
- TOTP (segundo factor) para `encargada` y `supervisor`.

**Fase 3**
- SSO institucional (OAuth en producción) + autollenado de nombre/matrícula, reemplazando
  el OTP.

## Notas técnicas

- Cliente: `api.js` adjunta automáticamente el token de staff (o alumno) si no se pasa
  `tipo`. Tokens en `localStorage` (`sj_staff_token`, `sj_alumno_token`).
- `db.js` fuerza `DATE`/`DATE[]` a string `YYYY-MM-DD` (parsers de OID 1082/1182).
- Folio: `F-AAAA-NNNN-CC` (`CC` = HMAC con `FOLIO_HMAC_SECRET`) + `token_qr` aleatorio;
  `/validar` exige el `token_qr` para mostrar datos personales.
- Migraciones: agregar `server/migrations/00X_*.sql`; `npm run migrate` las aplica en orden
  y registra en la tabla `_migraciones`.
- `server/templates/oficio.html` es la plantilla real del oficio, parametrizada con
  `{{...}}` y renderizada a PDF con `puppeteer-core`.
