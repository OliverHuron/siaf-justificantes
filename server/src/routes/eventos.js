'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config');
const eventos = require('../lib/eventos');

const router = express.Router();

/**
 * GET /api/eventos/stream?token=<jwt de personal>  (SSE)
 * EventSource no puede mandar el header Authorization, así que aquí el
 * token va en la query string y se valida a mano (no con requireStaff).
 */
router.get('/stream', (req, res) => {
  try {
    const claims = jwt.verify(req.query.token || '', config.jwt.secret);
    if (claims.tipo !== 'staff') throw new Error('tipo incorrecto');
  } catch (_) {
    res.status(401).end();
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // que nginx no bufferee esta respuesta
  });
  res.write(': conectado\n\n');

  const cancelar = eventos.suscribir(res);
  // "late" cada 25s para que ningún proxy intermedio cierre la conexión por inactividad.
  const keepAlive = setInterval(() => {
    try { res.write(':\n\n'); } catch (_) { /* se limpia en 'close' */ }
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    cancelar();
  });
});

module.exports = router;
