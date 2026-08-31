'use strict';

const crypto = require('crypto');
const config = require('../config');

/**
 * Cifrado simétrico para secretos guardados en la tabla `config`
 * (p. ej. la contraseña SMTP). Usa AES-256-GCM con CONFIG_ENC_KEY.
 * CONFIG_ENC_KEY debe ser 32 bytes en base64. Si falta, en desarrollo
 * se deriva una llave fija de aviso (no usar en producción).
 */
function llave() {
  const raw = config.configEncKey;
  if (raw) {
    const buf = Buffer.from(raw, 'base64');
    if (buf.length === 32) return buf;
  }
  if (config.env === 'production') {
    throw new Error('CONFIG_ENC_KEY inválida (se esperan 32 bytes en base64)');
  }
  return crypto.createHash('sha256').update('dev-config-enc-key').digest();
}

function cifrar(textoPlano) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', llave(), iv);
  const enc = Buffer.concat([cipher.update(String(textoPlano), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

function descifrar(paquete) {
  const [ivB64, tagB64, dataB64] = String(paquete).split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', llave(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/** Token aleatorio url-safe (para seguimiento de solicitud y QR de folio). */
function token(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}

module.exports = { cifrar, descifrar, token };
