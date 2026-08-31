'use strict';

const crypto = require('crypto');
const config = require('../config');
const { token } = require('./crypto');

// Alfabeto base32 sin caracteres ambiguos (0/O, 1/I).
const B32 = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** 2 caracteres verificadores derivados por HMAC del cuerpo del folio. */
function verificador(cuerpo) {
  const h = crypto.createHmac('sha256', config.folioHmacSecret).update(cuerpo).digest();
  return B32[h[0] % B32.length] + B32[h[1] % B32.length];
}

/** Comprueba que un folio completo tenga el verificador correcto. */
function esValido(folioCompleto) {
  const m = /^(.*)-([A-Z0-9]{2})$/.exec(String(folioCompleto || ''));
  if (!m) return false;
  return verificador(m[1]) === m[2];
}

/**
 * Reserva el siguiente consecutivo del año y arma el folio.
 * Debe llamarse dentro de una transacción (recibe el `client`).
 * @returns {Promise<{folio, token_qr, anio, consecutivo}>}
 */
async function emitir(client, prefijo = 'F') {
  const anio = new Date().getFullYear();
  const up = await client.query(
    `INSERT INTO folio_consecutivo (anio, siguiente) VALUES ($1, 2)
     ON CONFLICT (anio) DO UPDATE SET siguiente = folio_consecutivo.siguiente + 1
     RETURNING siguiente - 1 AS consecutivo`,
    [anio]
  );
  const consecutivo = up.rows[0].consecutivo;
  const cuerpo = `${prefijo}-${anio}-${String(consecutivo).padStart(4, '0')}`;
  const folio = `${cuerpo}-${verificador(cuerpo)}`;
  return { folio, token_qr: token(24), anio, consecutivo };
}

module.exports = { emitir, esValido, verificador };
