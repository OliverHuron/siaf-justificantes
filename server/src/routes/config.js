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

/** POST /api/config/smtp/test  — verifica credenciales sin enviar. */
router.post('/smtp/test', async (req, res, next) => {
  try {
    const r = await mailer.verificar();
    res.json(r);
  } catch (e) {
    next(new ApiError(400, `SMTP no responde: ${e.message}`));
  }
});

module.exports = router;
