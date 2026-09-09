'use strict';

const express = require('express');
const { ApiError } = require('../middleware/error');
const { resolverExpediente } = require('../lib/expediente');

const router = express.Router();

/**
 * GET /api/expediente?semestre=&seccion=
 * Devuelve licenciatura / turno / salón / modalidad / periodo del grupo
 * (datos sincronizados de fcca.umich.mx). Si no hay grupo cargado → encontrado:false.
 */
router.get('/', async (req, res, next) => {
  try {
    const { semestre, seccion } = req.query;
    if (!semestre || !seccion) throw new ApiError(400, 'Faltan semestre y seccion');
    res.json(await resolverExpediente(semestre, seccion));
  } catch (e) {
    next(e);
  }
});

module.exports = router;
