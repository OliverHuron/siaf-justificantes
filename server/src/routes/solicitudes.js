'use strict';

const express = require('express');
const db = require('../db');
const config = require('../config');
const { ApiError } = require('../middleware/error');
const { requireAlumno } = require('../middleware/auth');
const { upload, relativaDeMulter, borrarArchivo } = require('../lib/storage');
const { TIPOS } = require('../lib/tipos');
const banderas = require('../lib/banderas');
const bitacora = require('../lib/bitacora');
const { token } = require('../lib/crypto');
const { textoDias } = require('../lib/dias');

const router = express.Router();

const CAMPOS_ARCHIVO = [
  { name: 'receta', maxCount: 1 },
  { name: 'ticket', maxCount: 1 },
  { name: 'documento_medico', maxCount: 1 },
];

function limpiarArchivos(files) {
  if (!files) return;
  for (const arr of Object.values(files)) for (const f of arr) borrarArchivo(relativaDeMulter(f));
}

function parseLista(v) {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string' && v.trim()) {
    try {
      const j = JSON.parse(v);
      if (Array.isArray(j)) return j.map((x) => String(x).trim()).filter(Boolean);
    } catch (_) {
      return v.split(',').map((x) => x.trim()).filter(Boolean);
    }
  }
  return [];
}

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * POST /api/solicitudes   (multipart)  — crea y envía en un paso.
 * Campos: nombre, matricula, semestres[], secciones[], tipo, fechas[], contexto_extra
 * Archivos: según TIPOS[tipo].adjuntos
 */
router.post('/', requireAlumno, upload.fields(CAMPOS_ARCHIVO), async (req, res, next) => {
  const files = req.files || {};
  try {
    const email = req.alumno.email;
    const b = req.body || {};
    const nombre = String(b.nombre || '').trim();
    const matricula = String(b.matricula || '').trim();
    const tipo = String(b.tipo || '').trim();
    const semestres = parseLista(b.semestres);
    const secciones = parseLista(b.secciones);
    const fechas = parseLista(b.fechas);
    const contextoExtra = String(b.contexto_extra || '').trim() || null;

    if (!nombre) throw new ApiError(400, 'El nombre completo es obligatorio');
    if (!matricula) throw new ApiError(400, 'La matrícula es obligatoria');
    if (!TIPOS[tipo]) throw new ApiError(400, 'Tipo de solicitud inválido');
    if (TIPOS[tipo].origen !== 'alumno') {
      throw new ApiError(400, 'Ese tipo de justificante no se solicita por este medio');
    }
    if (!semestres.length) throw new ApiError(400, 'Selecciona al menos un semestre');
    if (!secciones.length) throw new ApiError(400, 'Selecciona al menos una sección');
    if (!fechas.length) throw new ApiError(400, 'Marca al menos un día a justificar');
    if (!fechas.every((f) => FECHA_RE.test(f))) throw new ApiError(400, 'Formato de fecha inválido');

    const hoy = new Date().toISOString().slice(0, 10);
    if (fechas.some((f) => f > hoy)) {
      throw new ApiError(400, 'No puedes justificar días que aún no ocurren');
    }

    // Adjuntos obligatorios por tipo
    for (const campo of TIPOS[tipo].adjuntos) {
      if (!files[campo] || !files[campo][0]) {
        throw new ApiError(400, `Falta el archivo obligatorio: ${campo}`);
      }
    }

    // Regla de pendientes (por correo y por matrícula)
    const pend = await db.query(
      `SELECT count(*)::int AS n FROM solicitudes
        WHERE estado = 'pendiente' AND (lower(email_alumno) = lower($1) OR upper(matricula_declarada) = upper($2))`,
      [email, matricula]
    );
    if (pend.rows[0].n >= config.reglas.pendientesMax) {
      throw new ApiError(
        409,
        `Ya tienes ${config.reglas.pendientesMax} solicitudes pendientes. Espera a que se resuelvan.`
      );
    }

    const fechasOrdenadas = [...new Set(fechas)].sort();
    const tokSeg = token(24);
    const flags = await banderas.calcular(
      { matricula, tipo, fechas: fechasOrdenadas, semestres, secciones },
      { diasLimite: config.reglas.diasLimiteSolicitud }
    );

    const creada = await db.withTransaction(async (client) => {
      const ins = await client.query(
        `INSERT INTO solicitudes
           (origen, email_alumno, nombre_declarado, matricula_declarada, semestres, secciones,
            tipo, fechas, contexto_extra, dias_texto_oficio, estado, token_seguimiento,
            banderas, ip_solicitud, enviado_en)
         VALUES ('alumno',$1,$2,$3,$4,$5,$6,$7::date[],$8,$9,'pendiente',$10,$11::jsonb,$12, now())
         RETURNING id, token_seguimiento, creado_en`,
        [
          email, nombre, matricula, semestres, secciones, tipo, fechasOrdenadas,
          contextoExtra, textoDias(fechasOrdenadas), tokSeg, JSON.stringify(flags), req.ip,
        ]
      );
      const solicitud = ins.rows[0];

      for (const campo of Object.keys(files)) {
        const f = files[campo][0];
        const tipoAdj = campo === 'documento_medico' ? 'documento_medico' : campo;
        await client.query(
          `INSERT INTO adjuntos (solicitud_id, tipo, ruta_archivo, nombre_original, mime, tamano)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [solicitud.id, tipoAdj, relativaDeMulter(f), f.originalname, f.mimetype, f.size]
        );
      }

      await bitacora.registrar(
        {
          actorTipo: 'alumno',
          actorRef: email,
          accion: 'solicitud_creada',
          solicitudId: solicitud.id,
          detalle: { tipo, fechas: fechasOrdenadas, banderas: Object.keys(flags) },
          ip: req.ip,
        },
        client
      );
      return solicitud;
    });

    res.status(201).json({
      id: creada.id,
      token_seguimiento: creada.token_seguimiento,
      enlace_seguimiento: `${config.publicUrl}/solicitud/${creada.token_seguimiento}`,
      banderas: Object.keys(flags),
    });
  } catch (e) {
    limpiarArchivos(files);
    next(e);
  }
});

/** POST /api/solicitudes/:id/adjuntos  — agrega un archivo mientras siga pendiente. */
router.post('/:id/adjuntos', requireAlumno, upload.single('archivo'), async (req, res, next) => {
  try {
    if (!req.file) throw new ApiError(400, 'No se recibió archivo');
    const tipoAdj = String(req.body.tipo || 'otro');
    const permitidos = ['receta', 'ticket', 'documento_medico', 'constancia', 'otro'];
    if (!permitidos.includes(tipoAdj)) throw new ApiError(400, 'Tipo de adjunto inválido');

    const r = await db.query(
      `SELECT id, estado FROM solicitudes WHERE id = $1 AND lower(email_alumno) = lower($2)`,
      [req.params.id, req.alumno.email]
    );
    const s = r.rows[0];
    if (!s) {
      borrarArchivo(relativaDeMulter(req.file));
      throw new ApiError(404, 'Solicitud no encontrada');
    }
    if (s.estado !== 'pendiente') {
      borrarArchivo(relativaDeMulter(req.file));
      throw new ApiError(409, 'La solicitud ya no admite cambios');
    }
    await db.query(
      `INSERT INTO adjuntos (solicitud_id, tipo, ruta_archivo, nombre_original, mime, tamano)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [s.id, tipoAdj, relativaDeMulter(req.file), req.file.originalname, req.file.mimetype, req.file.size]
    );
    res.status(201).json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/** GET /api/solicitudes/mias */
router.get('/mias', requireAlumno, async (req, res, next) => {
  try {
    const r = await db.query(
      `SELECT id, tipo, estado, estado_triage, semestres, secciones, fechas,
              token_seguimiento, creado_en, decidido_en, motivo_rechazo
         FROM solicitudes
        WHERE lower(email_alumno) = lower($1)
        ORDER BY creado_en DESC`,
      [req.alumno.email]
    );
    res.json(r.rows);
  } catch (e) {
    next(e);
  }
});

/** POST /api/solicitudes/:id/cancelar  — libera un cupo de pendientes. */
router.post('/:id/cancelar', requireAlumno, async (req, res, next) => {
  try {
    const r = await db.query(
      `UPDATE solicitudes SET estado = 'cancelada'
        WHERE id = $1 AND lower(email_alumno) = lower($2) AND estado = 'pendiente'
        RETURNING id`,
      [req.params.id, req.alumno.email]
    );
    if (!r.rowCount) throw new ApiError(409, 'No se puede cancelar (no existe o ya fue resuelta)');
    await bitacora.registrar({
      actorTipo: 'alumno', actorRef: req.alumno.email, accion: 'solicitud_cancelada',
      solicitudId: Number(req.params.id), ip: req.ip,
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
