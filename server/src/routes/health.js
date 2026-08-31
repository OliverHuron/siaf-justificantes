'use strict';

const express = require('express');
const db = require('../db');

const router = express.Router();

/**
 * GET /api/health
 * Sonda de vida. Verifica proceso + conexión a PostgreSQL.
 * El runbook de despliegue espera { status: "OK", ... }.
 */
router.get('/health', async (req, res) => {
  const out = {
    status: 'OK',
    servicio: 'siaf-justificantes',
    hora: new Date().toISOString(),
    uptime_s: Math.round(process.uptime()),
    db: 'desconocida',
  };
  try {
    const r = await db.query('SELECT 1 AS ok');
    out.db = r.rows[0] && r.rows[0].ok === 1 ? 'ok' : 'sin_respuesta';
  } catch (e) {
    out.status = 'DEGRADED';
    out.db = 'error';
    return res.status(503).json(out);
  }
  res.json(out);
});

module.exports = router;
