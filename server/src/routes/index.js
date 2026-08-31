'use strict';

const express = require('express');

const health = require('./health');
const auth = require('./auth');
const catalogos = require('./catalogos');
const solicitudes = require('./solicitudes');
const seguimiento = require('./seguimiento');

const router = express.Router();

router.use('/', health);
router.use('/auth', auth);
router.use('/catalogos', catalogos);
router.use('/solicitudes', solicitudes);
router.use('/seguimiento', seguimiento);

/**
 * Stubs de Fase 1. Cada grupo tiene su contrato en PLAN.md §6; aquí solo
 * responden 501 para que el andamiaje (Fase 0) quede montado y probado.
 */
function stub(nombre, refPlan) {
  const r = express.Router();
  r.all('*', (req, res) => {
    res.status(501).json({
      error: 'No implementado (Fase 1)',
      grupo: nombre,
      ref: refPlan,
      metodo: req.method,
      ruta: req.originalUrl,
    });
  });
  return r;
}

router.use('/revision', stub('revision', 'PLAN §6 (encargada/supervisor)'));
router.use('/folios', stub('folios', 'PLAN §6 (supervisor)'));
router.use('/config', stub('config', 'PLAN §9'));
router.use('/plantillas', stub('plantillas', 'PLAN §9'));
router.use('/horarios', stub('horarios', 'PLAN §4 / §9'));
router.use('/usuarios', stub('usuarios', 'PLAN §2.2'));
router.use('/consolidado', stub('consolidado', 'PLAN §6'));
router.use('/enfermeria', stub('enfermeria', 'PLAN §2.2 (panel de enfermería)'));
router.use('/validar', stub('validar', 'PLAN §7 (público)'));

module.exports = router;
