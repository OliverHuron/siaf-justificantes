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
      // Estructura Tipo + Origen para "Motivo y comprobantes" (PLAN §3).
      motivo: {
        tipos: [
          { clave: 'medico', etiqueta: 'Médico' },
          { clave: 'caso_especial', etiqueta: 'Caso especial' },
        ],
        origenes: [
          { clave: 'privada', etiqueta: 'Privada', adjuntos: ['receta', 'ticket'] },
          { clave: 'institucion_publica', etiqueta: 'Institución pública (IMSS / ISSSTE / SSA)', adjuntos: ['receta'] },
        ],
        caso_especial_adjuntos: ['documento_medico'],
      },
      semestres: sem.rows,
      secciones: sec.rows,
      reglas: {
        dias_limite_solicitud:
          (conf.reglas && conf.reglas.dias_limite_solicitud) || config.reglas.diasLimiteSolicitud,
        dias_maximos: (conf.reglas && conf.reglas.dias_maximos) || 15,
        pendientes_max: (conf.reglas && conf.reglas.pendientes_max) || config.reglas.pendientesMax,
        dias_habiles: conf.reglas ? conf.reglas.dias_habiles !== false : true,
      },
      textos: conf.textos || {},
      reglamento_url:
        (conf.textos && conf.textos.reglamento_url) ||
        'https://www.siia.umich.mx/escolar/Normatividad/examenes/CapituloI.htm',
      feriados: Array.isArray(conf.feriados) ? conf.feriados : [],
      dominio_alumno: config.dominioAlumno,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
