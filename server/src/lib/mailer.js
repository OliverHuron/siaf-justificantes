'use strict';

const nodemailer = require('nodemailer');
const db = require('../db');
const config = require('../config');
const { descifrar } = require('./crypto');

/**
 * Resuelve la configuración SMTP efectiva: primero `overrides` (valores sin
 * guardar, para "Probar conexión" desde Configuración), luego la tabla
 * `config` (editable desde la UI), con respaldo en las variables de entorno.
 */
async function resolverSmtp(overrides) {
  let fila;
  try {
    const r = await db.query(`SELECT valor FROM config WHERE clave = 'smtp'`);
    fila = r.rows[0] && r.rows[0].valor;
  } catch (_) {
    fila = null;
  }
  const host = (overrides && overrides.host) || (fila && fila.host) || config.smtp.host;
  const port = (overrides && overrides.port) || (fila && fila.port) || config.smtp.port;
  const user = (overrides && overrides.user) || (fila && fila.user) || config.smtp.user;
  const from = (overrides && overrides.from) || (fila && fila.from) || config.smtp.from;
  let pass = config.smtp.pass;
  if (fila && fila.pass_cifrada) {
    try {
      pass = descifrar(fila.pass_cifrada);
    } catch (_) {
      /* usa la de entorno */
    }
  }
  if (overrides && overrides.pass) pass = overrides.pass;
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

/**
 * Manda varios correos reutilizando UNA sola conexión/autenticación SMTP, en
 * vez de abrir una conexión nueva por cada uno (que es lo que hacía llamar a
 * enviar() en un for: cada handshake+auth con Gmail toma ~2s, y con 6-7
 * destinatarios eso solo ya sumaba 15-18s). Un correo que falle no aborta los
 * demás del lote.
 * @param {Array<{to,subject,text,html?,attachments?}>} mensajes
 * @returns {Promise<Array<{ok:boolean, simulado?:boolean, error?:string}>>}
 */
async function enviarLote(mensajes) {
  const smtp = await resolverSmtp();

  if (!smtp.user || !smtp.pass) {
    if (config.env === 'production') throw new Error('SMTP no configurado');
    const resultados = [];
    for (const m of mensajes) {
      console.log('\n[mailer:dev] (sin SMTP) correo simulado:');
      console.log(`  para:    ${m.to}`);
      console.log(`  asunto:  ${m.subject}`);
      resultados.push({ ok: true, simulado: true });
    }
    return resultados;
  }

  // Nota: se probó mandar varios a la vez con un pool de conexiones (hasta 3
  // en paralelo) y, contra lo esperado, salió más lento que uno por uno sobre
  // la misma conexión (Gmail parece penalizar/serializar las conexiones
  // simultáneas del mismo remitente) — se midió con 6 destinatarios reales:
  // ~8.6s secuencial en una sola conexión vs ~13.5s con 3 en paralelo. Por
  // eso aquí va secuencial, reutilizando una sola conexión ya autenticada.
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
    pool: true,
  });

  const resultados = [];
  for (const m of mensajes) {
    try {
      await transporter.sendMail({ from: smtp.from, ...m });
      marcarEnvio();
      resultados.push({ ok: true });
    } catch (err) {
      if (config.env === 'production') {
        console.error(`[mailer] no se pudo enviar a ${m.to}:`, err.message);
        resultados.push({ ok: false, error: err.message });
        continue;
      }
      console.log(`\n[mailer:dev] SMTP falló (%s) para ${m.to}. Correo NO enviado.`, err.message);
      resultados.push({ ok: false, simulado: true, error: err.message });
    }
  }
  transporter.close();
  return resultados;
}

/** Verifica credenciales SMTP sin enviar (para el botón "probar" de Configuración). */
async function verificar(overrides) {
  const smtp = await resolverSmtp(overrides);
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

module.exports = { enviar, enviarLote, verificar, contador, resolverSmtp };
