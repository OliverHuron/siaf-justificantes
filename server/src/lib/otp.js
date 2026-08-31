'use strict';

const bcrypt = require('bcryptjs');
const db = require('../db');
const config = require('../config');
const { ApiError } = require('../middleware/error');
const mailer = require('./mailer');

const LIM_POR_CORREO_HORA = 3;
const LIM_POR_IP_HORA = 10;

function normEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function esDominioInstitucional(email) {
  return normEmail(email).endsWith(config.dominioAlumno);
}

function generarCodigo() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 dígitos
}

/**
 * Crea y envía un código OTP para `email`. Aplica rate-limit por correo y por IP.
 */
async function solicitarCodigo(email, ip) {
  email = normEmail(email);
  if (!esDominioInstitucional(email)) {
    throw new ApiError(400, `Solo se aceptan correos institucionales ${config.dominioAlumno}`);
  }

  const porCorreo = await db.query(
    `SELECT count(*)::int AS n FROM otp_codes
      WHERE email = $1 AND creado_en > now() - interval '1 hour'`,
    [email]
  );
  if (porCorreo.rows[0].n >= LIM_POR_CORREO_HORA) {
    throw new ApiError(429, 'Demasiados códigos solicitados. Intenta de nuevo en una hora.');
  }
  if (ip) {
    const porIp = await db.query(
      `SELECT count(*)::int AS n FROM otp_codes
        WHERE ip = $1 AND creado_en > now() - interval '1 hour'`,
      [ip]
    );
    if (porIp.rows[0].n >= LIM_POR_IP_HORA) {
      throw new ApiError(429, 'Demasiadas solicitudes desde esta red. Intenta más tarde.');
    }
  }

  const codigo = generarCodigo();
  const codeHash = await bcrypt.hash(codigo, 10);
  await db.query(
    `INSERT INTO otp_codes (email, code_hash, expires_at, ip)
     VALUES ($1, $2, now() + ($3 || ' minutes')::interval, $4)`,
    [email, codeHash, String(config.otp.ttlMin), ip || null]
  );

  await mailer.enviar({
    to: email,
    subject: `Tu código de acceso: ${codigo}`,
    text:
      `Tu código para el sistema de justificantes de la FCCA es: ${codigo}\n\n` +
      `Vence en ${config.otp.ttlMin} minutos. Si no lo solicitaste, ignora este correo.`,
  });

  return { enviado: true, expira_min: config.otp.ttlMin };
}

/**
 * Verifica un código. Devuelve true si es válido (y lo marca consumido).
 */
async function verificarCodigo(email, codigo) {
  email = normEmail(email);
  const r = await db.query(
    `SELECT id, code_hash, intentos, expires_at, consumido_en
       FROM otp_codes
      WHERE email = $1 AND consumido_en IS NULL AND expires_at > now()
      ORDER BY creado_en DESC
      LIMIT 1`,
    [email]
  );
  const fila = r.rows[0];
  if (!fila) throw new ApiError(400, 'No hay un código vigente. Solicita uno nuevo.');

  if (fila.intentos >= config.otp.maxIntentos) {
    await db.query(`UPDATE otp_codes SET consumido_en = now() WHERE id = $1`, [fila.id]);
    throw new ApiError(429, 'Código bloqueado por demasiados intentos. Solicita uno nuevo.');
  }

  const ok = await bcrypt.compare(String(codigo || ''), fila.code_hash);
  if (!ok) {
    await db.query(`UPDATE otp_codes SET intentos = intentos + 1 WHERE id = $1`, [fila.id]);
    throw new ApiError(401, 'Código incorrecto.');
  }

  await db.query(`UPDATE otp_codes SET consumido_en = now() WHERE id = $1`, [fila.id]);
  return true;
}

module.exports = { solicitarCodigo, verificarCodigo, esDominioInstitucional, normEmail };
