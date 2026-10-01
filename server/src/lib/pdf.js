'use strict';

/**
 * Genera el PDF del oficio con pdf-lib (sin navegador headless). Antes esto
 * renderizaba templates/oficio.html con Puppeteer/Chromium; en el VPS de
 * producción (poca RAM) eso tardaba segundos y a veces truena por timeout.
 * Esta versión dibuja el mismo diseño directamente (texto + imágenes ya
 * incrustadas en oficio.html, extraídas una sola vez al cargar el módulo) en
 * milisegundos. Las coordenadas están tomadas tal cual de oficio.html (medidas
 * con getBoundingClientRect sobre esa plantilla) para que el resultado se vea
 * igual; si se necesita volver a ajustar el diseño, lo más simple es seguir
 * editando oficio.html y remedir, no tocar los números de aquí a ciegas.
 */

const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const QRCode = require('qrcode');
const config = require('../config');

const PLANTILLA = path.join(__dirname, '..', '..', 'templates', 'oficio.html');
const FONDO_ARCHIVO = path.join(__dirname, '..', '..', 'templates', 'oficio-fondo.jpg');

const PAGE_W = 612; // Letter, pt
const PAGE_H = 792;
const PX_A_PT = 0.75; // oficio.html usa 816x1056 px @ 96dpi = 612x792 pt (Letter)
// Offset del origen de .page dentro del viewport con el que se midieron las
// coordenadas (margin:20px auto en pantalla; en impresión .page es 0,0).
const ORIGEN = { x: 42, y: 20 };

function aPt(pxRelativo) {
  return pxRelativo * PX_A_PT;
}

/** y (desde arriba, en px relativos a .page) -> y de pdf-lib (desde abajo, en pt). */
function yPdf(topPx) {
  return PAGE_H - aPt(topPx);
}

/** Aproxima dónde cae la línea base dentro de una caja de línea CSS. */
function baselineDesdeArriba(topPx, fontSizePx, lineHeightPx) {
  const lh = lineHeightPx || fontSizePx * 1.2;
  return topPx + (lh - fontSizePx) / 2 + fontSizePx * 0.72;
}

/** Extrae las imágenes base64 embebidas en oficio.html, en orden de aparición. */
function extraerImagenes(html) {
  const out = [];
  const re = /data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)/g;
  let m;
  while ((m = re.exec(html))) {
    out.push({ tipo: m[1] === 'jpeg' ? 'jpg' : m[1], buffer: Buffer.from(m[2], 'base64') });
  }
  return out;
}

// Se leen una sola vez al cargar el módulo (no en cada request/aprobación).
// El fondo ya no sale de oficio.html (quedó obsoleto, baja resolución):
// viene de un archivo aparte, hecho a partir del diseño vectorial en Corel.
// Logo chico y firma siguen saliendo del html, en orden de aparición ahí.
const [, IMG_LOGO, IMG_FIRMA] = extraerImagenes(fs.readFileSync(PLANTILLA, 'utf8'));
const IMG_FONDO = { tipo: 'jpg', buffer: fs.readFileSync(FONDO_ARCHIVO) };

/**
 * Envuelve `tramos` (con negrita por tramo) a líneas que quepan en `anchoPt`.
 * Una palabra que empieza con puntuación (",", ".", etc.) se pega a la
 * anterior sin espacio, para no dejar "2211930X ," cuando un tramo nuevo
 * arranca justo con una coma.
 */
function envolver(tramos, fontRegular, fontBold, fontSizePt, anchoPt) {
  const palabras = [];
  for (const t of tramos) {
    const partes = t.texto.split(/\s+/).filter(Boolean);
    partes.forEach((palabra, i) => {
      const pegada = i === 0 && /^[,.;:]/.test(palabra);
      palabras.push({ texto: palabra, negrita: t.negrita, pegada });
    });
  }
  const lineas = [];
  let actual = [];
  let anchoActual = 0;
  const anchoEspacio = fontRegular.widthOfTextAtSize(' ', fontSizePt);
  for (const p of palabras) {
    const f = p.negrita ? fontBold : fontRegular;
    const w = f.widthOfTextAtSize(p.texto, fontSizePt);
    const extra = actual.length && !p.pegada ? anchoEspacio : 0;
    if (anchoActual + extra + w > anchoPt && actual.length) {
      lineas.push(actual);
      actual = [{ ...p, pegada: false }];
      anchoActual = w;
    } else {
      actual.push(p);
      anchoActual += extra + w;
    }
  }
  if (actual.length) lineas.push(actual);
  return lineas;
}

/** Ancho de una línea ya armada (para decidir el espaciado al justificar). */
function anchoLinea(tokens, fontRegular, fontBold, size) {
  const anchoEspacio = fontRegular.widthOfTextAtSize(' ', size);
  let w = 0;
  tokens.forEach((t, i) => {
    const f = t.negrita ? fontBold : fontRegular;
    w += f.widthOfTextAtSize(t.texto, size);
    if (i > 0 && !t.pegada) w += anchoEspacio;
  });
  return w;
}

/** Dibuja una línea ya envuelta; si se da `anchoPt`, la justifica a ese ancho. */
function dibujarLinea(page, tokens, x, yBase, fontRegular, fontBold, size, anchoPt) {
  const anchoEspacioNormal = fontRegular.widthOfTextAtSize(' ', size);
  const huecos = tokens.filter((t, i) => i > 0 && !t.pegada).length;
  const anchoEspacio = anchoPt && huecos
    ? anchoEspacioNormal + Math.max(0, anchoPt - anchoLinea(tokens, fontRegular, fontBold, size)) / huecos
    : anchoEspacioNormal;
  let cursor = x;
  tokens.forEach((t, i) => {
    const f = t.negrita ? fontBold : fontRegular;
    page.drawText(t.texto, { x: cursor, y: yBase, size, font: f, color: rgb(0.1, 0.1, 0.1) });
    cursor += f.widthOfTextAtSize(t.texto, size) + (i < tokens.length - 1 && !tokens[i + 1].pegada ? anchoEspacio : 0);
  });
}

/**
 * Genera el PDF del oficio y lo escribe en `destino`.
 * @param {object} datos  variables del oficio (nombre, matricula, folio, …)
 * @param {string} datos.token_qr  token para la URL de validación
 * @param {string} destino  ruta absoluta del .pdf a escribir
 */
async function generarOficio(datos, destino) {
  const urlValidacion = `${config.publicUrl}/validar?folio=${encodeURIComponent(datos.folio)}&token=${encodeURIComponent(datos.token_qr)}`;
  const qrDataUri = await QRCode.toDataURL(urlValidacion, { margin: 1, width: 240 });
  const qrBuffer = Buffer.from(qrDataUri.split(',')[1], 'base64');

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const fontR = await pdf.embedFont(StandardFonts.Helvetica);
  const fontB = await pdf.embedFont(StandardFonts.HelveticaBold);

  // --- fondo (membrete de página completa) ---
  const imgFondo = await pdf.embedJpg(IMG_FONDO.buffer);
  page.drawImage(imgFondo, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });

  // --- logo FCCA chico (top:48 right:110, 62x60, dentro de .page) ---
  const imgLogo = await pdf.embedJpg(IMG_LOGO.buffer);
  const logoW = aPt(62), logoH = aPt(60);
  page.drawImage(imgLogo, { x: aPt(816 - 110 - 62), y: yPdf(48) - logoH, width: logoW, height: logoH });

  const contentLeftPx = 112 - ORIGEN.x; // = 70 (left:70 de .content)
  const contentRightPx = 816 - 70; // right:70
  const anchoContentPx = contentRightPx - contentLeftPx;

  // --- institution-title: 3 líneas fijas, bold, 11px, right, lineHeight 14.85 ---
  {
    const lineas = [
      'Universidad Michoacana de San Nicolás de Hidalgo',
      'Facultad de Contaduría y Ciencias Administrativas',
      'Secretaría Académica',
    ];
    const size = 11, lh = 14.85, topPx = 130 - ORIGEN.y;
    lineas.forEach((texto, i) => {
      const w = fontB.widthOfTextAtSize(texto, aPt(size));
      const x = aPt(contentLeftPx + anchoContentPx) - w;
      const y = yPdf(baselineDesdeArriba(topPx + i * lh, size, lh));
      page.drawText(texto, { x, y, size: aPt(size), font: fontB });
    });
  }

  // --- fecha + folio (right, bold, 16px) ---
  {
    const topFecha = 194.53125 - ORIGEN.y;
    const topFolio = 255.328125 - ORIGEN.y;
    const size = 16;
    for (const [texto, top] of [[datos.fecha_oficio, topFecha], [`No. ${datos.folio}.`, topFolio]]) {
      const w = fontB.widthOfTextAtSize(texto, aPt(size));
      const x = aPt(contentLeftPx + anchoContentPx) - w;
      const y = yPdf(baselineDesdeArriba(top, size, size * 1.3));
      page.drawText(texto, { x, y, size: aPt(size), font: fontB });
    }
  }

  // --- destinatario (bold, 15.5px, left, 4 líneas, lineHeight 18.6, la 1a puede envolver) ---
  {
    const size = 15.5, lh = 18.6;
    const topPx = 278.328125 - ORIGEN.y;
    const anchoPt = aPt(anchoContentPx);
    const lineasDestinatario = envolver([{ texto: datos.destinatario, negrita: true }], fontR, fontB, aPt(size), anchoPt);
    const fijas = [
      'Facultad de Contaduría y Ciencias Administrativas',
      'Universidad Michoacana de San Nicolás de Hidalgo',
      'Presente',
    ];
    let linea = 0;
    for (const tokens of lineasDestinatario) {
      dibujarLinea(page, tokens, aPt(contentLeftPx), yPdf(baselineDesdeArriba(topPx + linea * lh, size, lh)), fontR, fontB, aPt(size));
      linea += 1;
    }
    for (const texto of fijas) {
      page.drawText(texto, { x: aPt(contentLeftPx), y: yPdf(baselineDesdeArriba(topPx + linea * lh, size, lh)), size: aPt(size), font: fontB });
      linea += 1;
    }
  }

  // --- cuerpo (justificado, 17px, lineHeight 27.2, sangría en la 1a línea, con tramos en negrita) ---
  {
    const size = 17, lh = 27.2;
    const topPx = 412.703125 - ORIGEN.y;
    const anchoPt = aPt(anchoContentPx);
    const sangriaPt = aPt(34);
    const tramos = [
      { texto: 'La que suscribe, Secretaria Académica de la Facultad de Contaduría y Ciencias Administrativas de la Universidad Michoacana de San Nicolás de Hidalgo, por medio del presente, solicito el justificar las inasistencias del alumno', negrita: false },
      { texto: `C. ${datos.nombre}`, negrita: true },
      { texto: 'matrícula', negrita: false },
      { texto: datos.matricula, negrita: true },
      { texto: ', ya que no le fue posible presentarse a clases', negrita: false },
      { texto: datos.dias_texto_oficio, negrita: true },
      { texto: `, ${datos.frase_cuerpo}`, negrita: false },
    ];
    const lineas = envolver(tramos, fontR, fontB, aPt(size), anchoPt);
    lineas.forEach((tokens, i) => {
      const esUltima = i === lineas.length - 1;
      const sangria = i === 0 ? sangriaPt : 0;
      dibujarLinea(
        page, tokens, aPt(contentLeftPx) + sangria,
        yPdf(baselineDesdeArriba(topPx + i * lh, size, lh)),
        fontR, fontB, aPt(size),
        esUltima ? null : anchoPt - sangria
      );
    });
  }

  // --- despedida (17px, left, indent) ---
  {
    const size = 17;
    const topPx = 587.828125 - ORIGEN.y;
    const x = aPt(157 - ORIGEN.x);
    page.drawText('Sin otro particular por el momento, le envió un cordial saludo.', {
      x, y: yPdf(baselineDesdeArriba(topPx, size, size * 1.2)), size: aPt(size), font: fontR,
    });
  }

  // --- bloque de firma (centrado) ---
  {
    const size = 16;
    const centroPx = (112 - ORIGEN.x) + 676 / 2;
    const centrar = (texto, f) => aPt(centroPx) - f.widthOfTextAtSize(texto, aPt(size)) / 2;

    // La firma se dibuja antes que "Atentamente" para que el texto quede
    // encima (no tapado) donde se superponen un poco, igual que el original.
    const imgFirma = await pdf.embedPng(IMG_FIRMA.buffer);
    const fw = aPt(210), fh = fw * (imgFirma.height / imgFirma.width);
    const firmaTopPx = 642.828125 - ORIGEN.y;
    page.drawImage(imgFirma, { x: aPt(345 - ORIGEN.x), y: yPdf(firmaTopPx) - fh, width: fw, height: fh });

    page.drawText('Atentamente', { x: centrar('Atentamente', fontB), y: yPdf(baselineDesdeArriba(640 - ORIGEN.y, size, size * 1.2)), size: aPt(size), font: fontB });
    page.drawText('M.A. María Luisa Jiménez López', { x: centrar('M.A. María Luisa Jiménez López', fontB), y: yPdf(baselineDesdeArriba(762.953125 - ORIGEN.y, size, size * 1.2)), size: aPt(size), font: fontB });
    page.drawText('Secretaria Académica', { x: centrar('Secretaria Académica', fontB), y: yPdf(baselineDesdeArriba(780.953125 - ORIGEN.y, size, size * 1.2)), size: aPt(size), font: fontB });
  }

  // --- pie (MLJL/sav.) ---
  {
    const size = 17;
    page.drawText('MLJL/sav.', { x: aPt(122 - ORIGEN.x), y: yPdf(baselineDesdeArriba(868.953125 - ORIGEN.y, size, size * 1.2)), size: aPt(size), font: fontB });
  }

  // --- validación: QR + texto ---
  {
    const imgQr = await pdf.embedPng(qrBuffer);
    const qrTopPx = 928 - ORIGEN.y;
    const qrSize = aPt(86);
    page.drawImage(imgQr, { x: aPt(112 - ORIGEN.x), y: yPdf(qrTopPx) - qrSize, width: qrSize, height: qrSize });

    const size = 12, lh = 15.6;
    const xTexto = aPt(212 - ORIGEN.x);
    const topTexto = 947.609375 - ORIGEN.y;
    const lineas = [
      'Verifica la autenticidad de este documento en:',
      urlValidacion,
      `Folio: ${datos.folio}`,
    ];
    lineas.forEach((texto, i) => {
      const f = i === 2 ? fontB : fontR;
      page.drawText(texto, { x: xTexto, y: yPdf(baselineDesdeArriba(topTexto + i * lh, size, lh)), size: aPt(size), font: f });
    });
  }

  const bytes = await pdf.save();
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, bytes);
  return { ruta: destino, url_validacion: urlValidacion };
}

module.exports = { generarOficio };
