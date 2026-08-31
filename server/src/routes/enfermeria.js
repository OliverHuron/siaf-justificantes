'use strict';

const express = require('express');
const db = require('../db');
const config = require('../config');
const { ApiError } = require('../middleware/error');
const { requireStaff, requireRol } = require('../middleware/auth');
const { upload, relativaDeMulter, borrarArchivo } = require('../lib/storage');
const banderas = require('../lib/banderas');
const bitacora = require('../lib/bitacora');
const { token } = require('../lib/crypto');
const { textoDias } = require('../lib/dias');

const router = express.Router();
router.use(requireStaff, requireRol('enfermeria'));

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

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

/**
 * POST /api/enfermeria/solicitudes  (multipart)
 * Campos: nombre, matricula, email_alumno, semestres[], secciones[], fechas[], contexto_extra
 * Archivo: constancia
 */
router.post('/solicitudes', upload.fields([{ name: 'constancia', maxCount: 1 }]), async (req, res, next) => {
  const files = req.files || {};
  try {
    const b = req.body || {};
    const nombre = String(b.nombre || '').trim();
    const matricula = String(b.matricula || '').trim();
    const email = String(b.email_alumno || '').trim().toLowerCase();
    const semestres = parseLista(b.semestres);
    const secciones = parseLista(b.secciones);
    const fechas = parseLista(b.fechas);
    const contextoExtra = String(b.contexto_extra || '').trim() || null;

    if (!nombre || !matricula || !email) throw new ApiError(400, 'Nombre, matrícula y correo del alumno son obligatorios');
    if (!semestres.length || !secciones.length) throw new ApiError(400, 'Indica semestre(s) y sección(es)');
    if (!fechas.length || !fechas.every((f) => FECHA_RE.test(f))) throw new ApiError(400, 'Fechas inválidas');
    if (!files.constancia || !files.constancia[0]) throw new ApiError(400, 'Falta la constancia de enfermería');

    const fechasOrdenadas = [...new Set(fechas)].sort();
    const tokSeg = token(24);
    const flags = await banderas.calcular(
      { matricula, tipo: 'enfermeria_fcca', fechas: fechasOrdenadas, semestres, secciones },
      { diasLimite: config.reglas.diasLimiteSolicitud }
    );

    const creada = await db.withTransaction(async (client) => {
      const ins = await client.query(
        `INSERT INTO solicitudes
           (origen, email_alumno, nombre_declarado, matricula_declarada, semestres, secciones,
            tipo, fechas, contexto_extra, dias_texto_oficio, estado, token_seguimiento,
            banderas, ip_solicitud, enviado_en)
         VALUES ('enfermeria',$1,$2,$3,$4,$5,'enfermeria_fcca',$6::date[],$7,$8,'pendiente',$9,$10::jsonb,$11, now())
         RETURNING id, token_seguimiento`,
        [
          email, nombre, matricula, semestres, secciones, fechasOrdenadas,
          contextoExtra, textoDias(fechasOrdenadas), tokSeg, JSON.stringify(flags), req.ip,
        ]
      );
      const s = ins.rows[0];
      const f = files.constancia[0];
      await client.query(
        `INSERT INTO adjuntos (solicitud_id, tipo, ruta_archivo, nombre_original, mime, tamano)
         VALUES ($1,'constancia',$2,$3,$4,$5)`,
        [s.id, relativaDeMulter(f), f.originalname, f.mimetype, f.size]
      );
      await bitacora.registrar({
        actorTipo: 'staff', actorRef: req.usuario.usuario, accion: 'solicitud_enfermeria_creada',
        solicitudId: s.id, detalle: { matricula, fechas: fechasOrdenadas }, ip: req.ip,
      }, client);
      return s;
    });

    res.status(201).json({
      id: creada.id,
      token_seguimiento: creada.token_seguimiento,
      enlace_seguimiento: `${config.publicUrl}/solicitud/${creada.token_seguimiento}`,
    });
  } catch (e) {
    if (files.constancia && files.constancia[0]) borrarArchivo(relativaDeMulter(files.constancia[0]));
    next(e);
  }
});

/** GET /api/enfermeria/solicitudes  — historial del panel de enfermería. */
router.get('/solicitudes', async (req, res, next) => {
  try {
    const r = await db.query(
      `SELECT s.id, s.nombre_declarado, s.matricula_declarada, s.semestres, s.secciones,
              s.fechas, s.estado, s.enfermeria_confirmada, s.creado_en, s.decidido_en, f.folio
         FROM solicitudes s
         LEFT JOIN folios f ON f.solicitud_id = s.id
        WHERE s.origen = 'enfermeria'
        ORDER BY s.creado_en DESC
        LIMIT 200`
    );
    res.json(r.rows);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
