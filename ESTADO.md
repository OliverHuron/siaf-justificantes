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
1. **SMTP real**: configurar y probar envío de verdad (OTP + oficio a profesores + acuse).
2. **Primer deploy** en el servidor SIAF: pasos 2–11 de `DEPLOYMENT.md`
   (crear DB, `.env.siaf-justificantes`, nginx, Cloudflare Tunnel, runner `siaf`), y
   confirmar que el workflow `deploy.yml` corre y `/api/health` responde `OK`.
   El repo ya está en GitHub, falta engancharlo al runner self-hosted.
3. **Chromium en el server Linux**: instalar libs (`libnss3`, `libatk-1.0-0`, `libgbm1`,
   `libasound2`, …) — nota en `DEPLOYMENT.md §1`.
4. **UI de cambio de contraseña** del personal (hoy solo hay un aviso).

**Fase 2** (ver `PLAN.md §13`)
- Alertas de reventa sobre `verificaciones_qr` (mismo folio escaneado muchas veces / desde
  IPs dispares) en un panel de supervisor.
- PDF bajo demanda para el alumno desde `/solicitud/<token>`.
- Lista de días feriados en Configuración (hoy la ventana de 10 días solo excluye fines de
  semana).
- Consolidado en PDF (hoy es tabla imprimible).
- TOTP (segundo factor) para `encargada` y `supervisor`.
- Afinar posición del recuadro QR en `templates/oficio.html` (queda un poco encima de la
  franja inferior del membrete).

**Fase 3**
- Sustituir el CRUD manual de `horarios` por la BD/exportación institucional.
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
