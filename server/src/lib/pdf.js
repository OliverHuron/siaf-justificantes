'use strict';

const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const config = require('../config');
const { render } = require('./plantillas');

const PLANTILLA = path.join(__dirname, '..', '..', 'templates', 'oficio.html');

const RUTAS_CHROMIUM = [
  process.env.CHROMIUM_PATH,
  process.env.PUPPETEER_EXECUTABLE_PATH,
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

function resolverChromium() {
  for (const p of RUTAS_CHROMIUM) {
    if (p && fs.existsSync(p)) return p;
  }
  throw new Error(
    'No se encontró Chromium/Chrome. Instálalo o define CHROMIUM_PATH (ver DEPLOYMENT.md).'
  );
}

let navegador = null;
async function obtenerNavegador() {
  if (navegador && navegador.connected) return navegador;
  const puppeteer = require('puppeteer-core');
  navegador = await puppeteer.launch({
    executablePath: resolverChromium(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  return navegador;
}

/**
 * Genera el PDF del oficio y lo escribe en `destino`.
 * @param {object} datos  variables de la plantilla (nombre, matricula, folio, …)
 * @param {string} datos.token_qr  token para la URL de validación
 * @param {string} destino  ruta absoluta del .pdf a escribir
 */
async function generarOficio(datos, destino) {
  const urlValidacion = `${config.publicUrl}/validar?folio=${encodeURIComponent(datos.folio)}&token=${encodeURIComponent(datos.token_qr)}`;
  const qrDataUri = await QRCode.toDataURL(urlValidacion, { margin: 1, width: 240 });

  const html = render(fs.readFileSync(PLANTILLA, 'utf8'), {
    fecha_oficio: datos.fecha_oficio,
    folio: datos.folio,
    destinatario: datos.destinatario,
    nombre: datos.nombre,
    matricula: datos.matricula,
    dias_texto_oficio: datos.dias_texto_oficio,
    frase_cuerpo: datos.frase_cuerpo,
    qr_data_uri: qrDataUri,
    url_validacion: urlValidacion,
  });

  const browser = await obtenerNavegador();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    await page.pdf({
      path: destino,
      format: 'Letter',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  } finally {
    await page.close();
  }
  return { ruta: destino, url_validacion: urlValidacion };
}

async function cerrar() {
  if (navegador) {
    await navegador.close().catch(() => {});
    navegador = null;
  }
}

module.exports = { generarOficio, cerrar, resolverChromium };
