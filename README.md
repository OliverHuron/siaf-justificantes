# SIAF Justificantes

Sistema de control y emisión de justificantes de inasistencia para la **Facultad de
Contaduría y Ciencias Administrativas (FCCA), UMSNH**. Sustituye el flujo de Google Forms +
Sheets + Excel + envío manual del oficio.

- **Diseño / decisiones**: [`PLAN.md`](PLAN.md)
- **Despliegue en producción**: [`DEPLOYMENT.md`](DEPLOYMENT.md)
- **Estado**: Fase 0 (andamiaje). Ver el roadmap en `PLAN.md` §13.

## Estructura

```
server/    API Express + PostgreSQL (puerto 5004)
  src/           código
  migrations/    SQL versionado (npm run migrate)
  scripts/       migrate.js · seed.js
  templates/     oficio.html (plantilla del oficio, se parametriza en Fase 1)
client/    SPA React + Vite  (build → client/dist, servido por nginx)
.github/   workflow de despliegue (runner self-hosted `siaf`)
docs/      aviso de privacidad y otros textos
```

## Desarrollo local

Requisitos: Node 20+, PostgreSQL 16.

```bash
# 1) Base de datos
createdb justificantes_db
# crear el usuario justificantes_admin y darle permisos (ver DEPLOYMENT.md §4)

# 2) Backend
cd server
cp .env.example .env          # ajustar DB_PASSWORD, JWT_SECRET, etc.
npm install
npm run migrate
npm run seed
npm run dev                   # http://localhost:5004/api/health

# 3) Frontend (otra terminal)
cd client
npm install
npm run dev                   # http://localhost:5173  (proxya /api al :5004)
```

Cuentas sembradas (contraseña temporal `123456`, se cambia al primer ingreso):
`ventanilla` (encargada) · `direccion` (supervisor) · `coordinador` · `enfermeria`.
