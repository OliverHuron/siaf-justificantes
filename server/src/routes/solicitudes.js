'use strict';

const express = require('express');
const db = require('../db');
const config = require('../config');
const { ApiError } = require('../middleware/error');
const { requireAlumno } = require('../middleware/auth');
const { upload, relativaDeMulter, borrarArchivo } = require('../lib/storage');
const banderas = require('../lib/banderas');
const bitacora = require('../lib/bitacora');
const { token } = require('../lib/crypto');
const {
  textoDias, diasNaturales, expandirRangoHabil, siguienteDiaHabil, diasHabilesEntre, iso,
} = require('../lib/dias');
const { resolverExpediente, matriculaDeCorreo } = require('../lib/expediente');

/**
 * Traduce (tipo de la UI, origen de atención) al `tipo` canónico + adjuntos requeridos.
 * medico+privada → receta_particular (receta+ticket)
 * medico+institucion_publica → receta_imss (receta)
 * caso_especial → caso_especial (documento_medico), exento de reglas de fecha
 */
function resolverMotivo(tipoUi, origen) {
  if (tipoUi === 'caso_especial') {
    return { tipo: 'caso_especial', origen_atencion: null, adjuntos: ['documento_medico'], exento: true };
  }
  if (tipoUi === 'medico') {
    if (origen === 'privada') {
      return { tipo: 'receta_particular', origen_atencion: 'privada', adjuntos: ['receta', 'ticket'], exento: false };
    }
    if (origen === 'institucion_publica') {
      return { tipo: 'receta_imss', origen_atencion: 'institucion_publica', adjuntos: ['receta'], exento: false };
    }
  }
  return null;
}

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
 * Campos: nombre, tipo (medico|caso_especial), origen (privada|institucion_publica),
 *         semestres[], secciones[], fecha_inicio, fecha_fin, contexto_extra
 * Archivos: receta / ticket / documento_medico según corresponda.
 */
router.post('/', requireAlumno, upload.fields(CAMPOS_ARCHIVO), async (req, res, next) => {
  const files = req.files || {};
  try {
    const email = req.alumno.email;
    const b = req.body || {};
    const nombre = String(b.nombre || '').trim();
    const tipoUi = String(b.tipo || '').trim();
    const origen = String(b.origen || '').trim() || null;

    // grupos: [{ semestre, seccion }, ...]. Compat: si viene semestres[]/secciones[]
    // (cliente viejo), se emparejan por posición.
    let gruposEntrada = [];
    try {
      const raw = typeof b.grupos === 'string' ? JSON.parse(b.grupos) : b.grupos;
      if (Array.isArray(raw)) {
        gruposEntrada = raw
          .map((g) => ({ semestre: String(g.semestre || '').trim(), seccion: String(g.seccion || '').trim() }))
          .filter((g) => g.semestre && g.seccion);
      }
    } catch (_) { /* se valida abajo */ }
    if (!gruposEntrada.length) {
      const ss = parseLista(b.semestres);
      const cc = parseLista(b.secciones);
      gruposEntrada = ss.map((s, i) => ({ semestre: s, seccion: cc[i] || cc[0] })).filter((g) => g.seccion);
    }
    // sin duplicados
    gruposEntrada = gruposEntrada.filter(
      (g, i, arr) => arr.findIndex((x) => x.semestre === g.semestre && x.seccion === g.seccion) === i
    );
    const semestres = [...new Set(gruposEntrada.map((g) => g.semestre))];
    const secciones = [...new Set(gruposEntrada.map((g) => g.seccion))];

    const fechaInicio = String(b.fecha_inicio || '').slice(0, 10);
    const fechaFin = String(b.fecha_fin || '').slice(0, 10);
    const contextoExtra = String(b.contexto_extra || '').trim() || null;

    // Matrícula desde el correo institucional
    const matricula = matriculaDeCorreo(email);
    if (!matricula) {
      throw new ApiError(400, 'Tu correo institucional no tiene el formato de matrícula (#######L@umich.mx)');
    }

    if (!nombre) throw new ApiError(400, 'El nombre completo es obligatorio');
    const motivo = resolverMotivo(tipoUi, origen);
    if (!motivo) throw new ApiError(400, 'Selecciona el tipo de justificante y el origen de atención');
    if (!gruposEntrada.length) throw new ApiError(400, 'Agrega al menos un grupo (semestre y sección)');
    if (!FECHA_RE.test(fechaInicio) || !FECHA_RE.test(fechaFin)) {
      throw new ApiError(400, 'Indica la fecha de inicio y de fin');
    }

    const hoy = iso(new Date());
    if (fechaInicio > fechaFin) throw new ApiError(400, 'La fecha de inicio no puede ser posterior a la de fin');
    if (fechaFin > hoy) throw new ApiError(400, 'No puedes justificar días que aún no ocurren');

    // Reglas y feriados de configuración
    const cfg = await db.query(`SELECT clave, valor FROM config WHERE clave IN ('reglas','feriados')`);
    const conf = Object.fromEntries(cfg.rows.map((r) => [r.clave, r.valor]));
    const feriados = Array.isArray(conf.feriados) ? conf.feriados : [];
    const diasMaximos = (conf.reglas && conf.reglas.dias_maximos) || 15;
    const diasLimite = (conf.reglas && conf.reglas.dias_limite_solicitud) || config.reglas.diasLimiteSolicitud;
    const pendientesMax = (conf.reglas && conf.reglas.pendientes_max) || config.reglas.pendientesMax;

    const totalDias = diasNaturales(fechaInicio, fechaFin);
    const fechasHabiles = expandirRangoHabil(fechaInicio, fechaFin, feriados);
    if (!fechasHabiles.length) throw new ApiError(400, 'El rango seleccionado no incluye días hábiles');

    if (!motivo.exento) {
      if (totalDias > diasMaximos) {
        throw new ApiError(400, `Solo se pueden justificar hasta ${diasMaximos} días por solicitud (seleccionaste ${totalDias}).`);
      }
      const reincorporacion = siguienteDiaHabil(fechaFin, feriados);
      const transcurridos = diasHabilesEntre(reincorporacion, hoy, feriados);
      if (transcurridos > diasLimite) {
        throw new ApiError(409,
          `Fuera de plazo: desde tu reincorporación (${reincorporacion}) ya pasaron ${transcurridos} días hábiles (máx. ${diasLimite}).`);
      }
    }

    // Adjuntos obligatorios
    for (const campo of motivo.adjuntos) {
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
    if (pend.rows[0].n >= pendientesMax) {
      throw new ApiError(409, `Ya tienes ${pendientesMax} solicitudes pendientes. Espera a que se resuelvan.`);
    }

    // Expediente por grupo — consulta en vivo con caché. No bloquea el envío:
    // límite global de 5 s; los que no resuelvan quedan sin snapshot.
    const expedientes = await Promise.race([
      Promise.all(
        gruposEntrada.map((g) => resolverExpediente(g.semestre, g.seccion).catch(() => ({ encontrado: false })))
      ),
      new Promise((r) => setTimeout(() => r(gruposEntrada.map(() => ({ encontrado: false }))), 5000)),
    ]);
    const gruposSnap = gruposEntrada.map((g, i) => {
      const e = expedientes[i] || {};
      return e.encontrado
        ? { semestre: g.semestre, seccion: g.seccion, licenciatura: e.licenciatura,
            turno: e.turno, salon: e.salon, modalidad: e.modalidad, periodo: e.periodo }
        : { semestre: g.semestre, seccion: g.seccion };
    });
    const exp = expedientes[0] && expedientes[0].encontrado ? expedientes[0] : { encontrado: false };

    const tipo = motivo.tipo;
    const fechasOrdenadas = fechasHabiles;
    const tokSeg = token(24);
    const flags = await banderas.calcular(
      { matricula, tipo, fechas: fechasOrdenadas, semestres, secciones, fecha_inicio: fechaInicio, fecha_fin: fechaFin },
      { diasLimite, diasMaximos, exento: motivo.exento, feriados }
    );

    const creada = await db.withTransaction(async (client) => {
      const ins = await client.query(
        `INSERT INTO solicitudes
           (origen, email_alumno, nombre_declarado, matricula_declarada, semestres, secciones,
            grupos, tipo, origen_atencion, fechas, fecha_inicio, fecha_fin, contexto_extra,
            dias_texto_oficio, licenciatura, turno, salon, modalidad, periodo,
            estado, token_seguimiento, banderas, ip_solicitud, enviado_en)
         VALUES ('alumno',$1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9::date[],$10,$11,$12,$13,$14,$15,$16,$17,$18,
                 'pendiente',$19,$20::jsonb,$21, now())
         RETURNING id, token_seguimiento, creado_en`,
        [
          email, nombre, matricula, semestres, secciones, JSON.stringify(gruposSnap),
          tipo, motivo.origen_atencion,
          fechasOrdenadas, fechaInicio, fechaFin, contextoExtra, textoDias(fechasOrdenadas),
          exp.encontrado ? exp.licenciatura : null,
          exp.encontrado ? exp.turno : null,
          exp.encontrado ? exp.salon : null,
          exp.encontrado ? exp.modalidad : null,
          exp.encontrado ? exp.periodo : null,
          tokSeg, JSON.stringify(flags), req.ip,
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
      `SELECT id, tipo, origen_atencion, estado, estado_triage, semestres, secciones,
              fechas, fecha_inicio, fecha_fin, token_seguimiento, creado_en, decidido_en, motivo_rechazo
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
