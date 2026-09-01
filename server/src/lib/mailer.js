'use strict';

const nodemailer = require('nodemailer');
const db = require('../db');
const config = require('../config');
const { descifrar } = require('./crypto');

/**
 * Resuelve la configuración SMTP efectiva: primero la tabla `config` (editable
 * desde la UI), con respaldo en las variables de entorno.
 */
async function resolverSmtp() {
  let fila;
  try {
    const r = await db.query(`SELECT valor FROM config WHERE clave = 'smtp'`);
    fila = r.rows[0] && r.rows[0].valor;
  } catch (_) {
    fila = null;
  }
  const host = (fila && fila.host) || config.smtp.host;
  const port = (fila && fila.port) || config.smtp.port;
  const user = (fila && fila.user) || config.smtp.user;
  const from = (fila && fila.from) || config.smtp.from;
  let pass = config.smtp.pass;
  if (fila && fila.pass_cifrada) {
    try {
      pass = descifrar(fila.pass_cifrada);
    } catch (_) {
      /* usa la de entorno */
    }
  }
  return { host, port, user, pass, from, secure: Number(port) === 465 };
}

let contadorDia = { fecha: '', enviados: 0 };
const LIMITE_DIARIO = 500; // tope práctico del SMTP de Gmail

function marcarEnvio() {
  const hoy = new Date().toISOString().slice(0, 10);
  if (contadorDia.fecha !== hoy) contadorDia = { fecha: hoy, enviados: 0 };
  contadorDia.enviados += 1;
  if (contadorDia.enviados === LIMITE_DIARIO - 20) {
    console.warn(`[mailer] cerca del límite diario: ${contadorDia.enviados}/${LIMITE_DIARIO}`);
  }
}

function contador() {
  return { ...contadorDia, limite: LIMITE_DIARIO };
}

/**
 * Envía un correo. Si no hay SMTP configurado, en desarrollo lo escribe en consola
 * y no falla; en producción lanza error.
 */
async function enviar({ to, subject, text, html, attachments }) {
  const smtp = await resolverSmtp();

  if (!smtp.user || !smtp.pass) {
    if (config.env === 'production') {
      throw new Error('SMTP no configurado');
    }
    console.log('\n[mailer:dev] (sin SMTP) correo simulado:');
    console.log(`  para:    ${to}`);
    console.log(`  asunto:  ${subject}`);
    console.log(`  texto:   ${(text || '').replace(/\n/g, '\n           ')}`);
    if (attachments) console.log(`  adjuntos: ${attachments.map((a) => a.filename).join(', ')}`);
    console.log('');
    return { simulado: true };
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  });

  try {
    const info = await transporter.sendMail({ from: smtp.from, to, subject, text, html, attachments });
    marcarEnvio();
    return info;
  } catch (err) {
    // En producción el fallo se propaga. En desarrollo, para no bloquear las
    // pruebas cuando las credenciales SMTP no son válidas, se registra en consola.
    if (config.env === 'production') throw err;
    console.log('\n[mailer:dev] SMTP falló (%s). Correo NO enviado, se muestra el contenido:', err.message);
    console.log(`  para:    ${to}`);
    console.log(`  asunto:  ${subject}`);
    console.log(`  texto:   ${(text || '').replace(/\n/g, '\n           ')}`);
    console.log('');
    return { simulado: true, error: err.message };
  }
}

/** Verifica credenciales SMTP sin enviar (para el botón "probar" de Configuración). */
async function verificar() {
  const smtp = await resolverSmtp();
  if (!smtp.user || !smtp.pass) throw new Error('SMTP no configurado');
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  });
  await transporter.verify();
  return { ok: true, host: smtp.host, port: smtp.port, user: smtp.user };
}

module.exports = { enviar, verificar, contador, resolverSmtp };
