'use strict';

const express = require('express');

const health = require('./health');
const auth = require('./auth');
const catalogos = require('./catalogos');
const solicitudes = require('./solicitudes');
const seguimiento = require('./seguimiento');
const revision = require('./revision');
const validar = require('./validar');
const folios = require('./folios');
const config = require('./config');
const plantillas = require('./plantillas');
const horarios = require('./horarios');
const usuarios = require('./usuarios');
const consolidado = require('./consolidado');
const enfermeria = require('./enfermeria');
const expediente = require('./expediente');

const router = express.Router();

router.use('/', health);
router.use('/auth', auth);
router.use('/catalogos', catalogos);
router.use('/solicitudes', solicitudes);
router.use('/seguimiento', seguimiento);
router.use('/revision', revision);
router.use('/validar', validar);
router.use('/folios', folios);
router.use('/config', config);
router.use('/plantillas', plantillas);
router.use('/horarios', horarios);
router.use('/usuarios', usuarios);
router.use('/consolidado', consolidado);
router.use('/enfermeria', enfermeria);
router.use('/expediente', expediente);

module.exports = router;
