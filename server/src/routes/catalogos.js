'use strict';

const express = require('express');
const db = require('../db');
const config = require('../config');
const { tiposParaAlumno } = require('../lib/tipos');

const router = express.Router();

/**
 * GET /api/catalogos  — datos para armar el formulario del alumno.
 * Público: solo catálogos y textos, sin información sensible.
 */
router.get('/', async (req, res, next) => {
  try {
    const [sec, sem, cfg] = await Promise.all([
      db.query(`SELECT clave, etiqueta FROM secciones WHERE activo ORDER BY orden`),
      db.query(`SELECT clave, etiqueta FROM semestres WHERE activo ORDER BY orden`),
      db.query(`SELECT clave, valor FROM config WHERE clave IN ('reglas','textos','feriados')`),
    ]);
    const conf = Object.fromEntries(cfg.rows.map((r) => [r.clave, r.valor]));

    res.json({
      tipos: tiposParaAlumno(),
      semestres: sem.rows,
      secciones: sec.rows,
      reglas: {
        dias_limite_solicitud:
          (conf.reglas && conf.reglas.dias_limite_solicitud) || config.reglas.diasLimiteSolicitud,
        pendientes_max: (conf.reglas && conf.reglas.pendientes_max) || config.reglas.pendientesMax,
        dias_habiles: conf.reglas ? conf.reglas.dias_habiles !== false : true,
      },
      textos: conf.textos || {},
      feriados: Array.isArray(conf.feriados) ? conf.feriados : [],
      dominio_alumno: config.dominioAlumno,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
