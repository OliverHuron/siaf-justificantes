'use strict';

const express = require('express');
const db = require('../db');
const { ApiError } = require('../middleware/error');
const bitacora = require('../lib/bitacora');
const { TIPOS } = require('../lib/tipos');

const router = express.Router();

async function cargarPorToken(tokenSeg) {
  const r = await db.query(
    `SELECT s.id, s.tipo, s.estado, s.estado_triage, s.semestres, s.secciones, s.fechas,
            s.nombre_declarado, s.matricula_declarada, s.creado_en, s.decidido_en,
            s.motivo_rechazo, s.requiere_ventanilla, s.ventanilla_recibido,
            f.folio, f.anulado_en
       FROM solicitudes s
       LEFT JOIN folios f ON f.solicitud_id = s.id
      WHERE s.token_seguimiento = $1`,
    [tokenSeg]
  );
  return r.rows[0];
}

/** GET /api/seguimiento/:token  — estado + hilo (sin login). */
router.get('/:token', async (req, res, next) => {
  try {
    const s = await cargarPorToken(req.params.token);
    if (!s) throw new ApiError(404, 'Solicitud no encontrada');
    const msgs = await db.query(
      `SELECT autor, cuerpo, creado_en FROM mensajes WHERE solicitud_id = $1 ORDER BY creado_en`,
      [s.id]
    );
    res.json({
      solicitud: {
        tipo: s.tipo,
        tipo_etiqueta: (TIPOS[s.tipo] && TIPOS[s.tipo].etiqueta) || s.tipo,
        estado: s.estado,
        nombre: s.nombre_declarado,
        matricula: s.matricula_declarada,
        semestres: s.semestres,
        secciones: s.secciones,
        fechas: s.fechas,
        creado_en: s.creado_en,
        decidido_en: s.decidido_en,
        motivo_rechazo: s.motivo_rechazo,
        requiere_ventanilla: s.requiere_ventanilla,
        ventanilla_recibido: s.ventanilla_recibido,
        folio: s.folio || null,
        anulado: !!s.anulado_en,
      },
      mensajes: msgs.rows,
    });
  } catch (e) {
    next(e);
  }
});

/** POST /api/seguimiento/:token/mensajes  { cuerpo } */
router.post('/:token/mensajes', async (req, res, next) => {
  try {
    const cuerpo = String((req.body && req.body.cuerpo) || '').trim();
    if (!cuerpo) throw new ApiError(400, 'El mensaje está vacío');
    if (cuerpo.length > 4000) throw new ApiError(400, 'Mensaje demasiado largo');

    const s = await cargarPorToken(req.params.token);
    if (!s) throw new ApiError(404, 'Solicitud no encontrada');

    await db.query(
      `INSERT INTO mensajes (solicitud_id, autor, cuerpo) VALUES ($1, 'alumno', $2)`,
      [s.id, cuerpo]
    );
    await bitacora.registrar({
      actorTipo: 'alumno', actorRef: s.matricula_declarada, accion: 'mensaje_alumno',
      solicitudId: s.id, ip: req.ip,
    });
    res.status(201).json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
