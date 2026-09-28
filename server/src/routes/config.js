'use strict';

const express = require('express');
const db = require('../db');
const { ApiError } = require('../middleware/error');
const { requireStaff, requireRol } = require('../middleware/auth');
const { cifrar } = require('../lib/crypto');
const mailer = require('../lib/mailer');

const router = express.Router();
router.use(requireStaff, requireRol('supervisor'));

// Claves cuyo valor nunca se devuelve tal cual al cliente.
const SECRETO = new Set(['smtp']);

function sanear(clave, valor) {
  if (clave === 'smtp' && valor) {
    const { pass_cifrada, ...resto } = valor;
    return { ...resto, pass_configurada: !!pass_cifrada };
  }
  return valor;
}

/** GET /api/config  — todas las claves (saneadas). */
router.get('/', async (req, res, next) => {
  try {
    const r = await db.query(`SELECT clave, valor, actualizado_en FROM config ORDER BY clave`);
    res.json(r.rows.map((row) => ({ ...row, valor: sanear(row.clave, row.valor) })));
  } catch (e) {
    next(e);
  }
});

/** GET /api/config/:clave */
router.get('/:clave', async (req, res, next) => {
  try {
    const r = await db.query(`SELECT clave, valor FROM config WHERE clave = $1`, [req.params.clave]);
    if (!r.rowCount) throw new ApiError(404, 'Clave no encontrada');
    res.json({ clave: r.rows[0].clave, valor: sanear(r.rows[0].clave, r.rows[0].valor) });
  } catch (e) {
    next(e);
  }
});

/**
 * PUT /api/config/:clave   { valor }
 * Para 'smtp', si viene `valor.pass` en claro se cifra y se guarda como pass_cifrada.
 */
router.put('/:clave', async (req, res, next) => {
  try {
    const clave = req.params.clave;
    let valor = (req.body || {}).valor;
    if (valor === undefined) throw new ApiError(400, 'Falta "valor"');

    if (clave === 'smtp') {
      const prev = (await db.query(`SELECT valor FROM config WHERE clave = 'smtp'`)).rows[0];
      const base = (prev && prev.valor) || {};
      const nuevo = { ...base, ...valor };
      if (valor.pass) {
        nuevo.pass_cifrada = cifrar(valor.pass);
      }
      delete nuevo.pass;
      valor = nuevo;
    }

    await db.query(
      `INSERT INTO config (clave, valor, actualizado_en) VALUES ($1, $2::jsonb, now())
       ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, actualizado_en = now()`,
      [clave, JSON.stringify(valor)]
    );
    res.json({ ok: true, clave, valor: sanear(clave, valor) });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/config/smtp/test  { host?, port?, user?, pass?, from? }
 * Verifica credenciales sin enviar. Si vienen campos en el body (lo que hay
 * escrito en el formulario, aunque no se haya guardado), se prueban esos en
 * vez de los ya guardados en la BD.
 */
router.post('/smtp/test', async (req, res, next) => {
  try {
    const { host, port, user, pass, from } = req.body || {};
    const overrides = {};
    if (host) overrides.host = host;
    if (port) overrides.port = Number(port);
    if (user) overrides.user = user;
    if (pass) overrides.pass = pass;
    if (from) overrides.from = from;
    const r = await mailer.verificar(Object.keys(overrides).length ? overrides : undefined);
    res.json(r);
  } catch (e) {
    next(new ApiError(400, `SMTP no responde: ${e.message}`));
  }
});

/**
 * POST /api/config/sheets/test  { url, secreto? }
 * Manda un ping de prueba al Web App de Apps Script (sin guardar nada).
 */
router.post('/sheets/test', async (req, res, next) => {
  try {
    const { url, secreto } = req.body || {};
    if (!url) throw new ApiError(400, 'Falta la URL del Web App');
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secreto: secreto || '', accion: 'prueba' }),
    });
    const texto = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${texto.slice(0, 200)}`);
    // Apps Script siempre responde 200 aunque el script reporte un error
    // lógico (p. ej. secreto inválido) en el cuerpo JSON, así que hay que
    // revisar también el campo "ok" del cuerpo, no solo el status HTTP.
    let cuerpo;
    try { cuerpo = JSON.parse(texto); } catch (_) { cuerpo = null; }
    if (cuerpo && cuerpo.ok === false) throw new Error(cuerpo.error || 'el script reportó un error');
    res.json({ ok: true, respuesta: texto.slice(0, 200) });
  } catch (e) {
    next(new ApiError(400, `No se pudo conectar: ${e.message}`));
  }
});

module.exports = router;
