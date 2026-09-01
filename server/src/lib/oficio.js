'use strict';

const fs = require('fs');
const path = require('path');
const db = require('../db');
const config = require('../config');
const pdfLib = require('./pdf');
const { fechaOficio, textoDias } = require('./dias');
const { DIR_FOLIOS, rutaAbsoluta } = require('./storage');

function listaEspanol(arr) {
  const a = (arr || []).filter(Boolean);
  if (a.length <= 1) return a.join('');
  return `${a.slice(0, -1).join(', ')} y ${a[a.length - 1]}`;
}

function destinatarioOficio(semestres, secciones) {
  const s = semestres || [];
  const c = secciones || [];
  const semTxt = `${s.length > 1 ? 'de los Semestres' : 'del Semestre'} ${listaEspanol(s)}`;
  const secTxt = `${c.length > 1 ? 'Secciones' : 'Sección'} ${listaEspanol(c)}`;
  return `Profesores ${semTxt}, ${secTxt}`;
}

/**
 * Devuelve la ruta absoluta del PDF del oficio de `solicitudId`, generándolo si
 * no existe todavía. Lanza si la solicitud no tiene folio.
 */
async function asegurarPdf(solicitudId) {
  const r = await db.query(
    `SELECT f.folio, f.token_qr, f.pdf_ruta, s.nombre_declarado, s.matricula_declarada,
            s.semestres, s.secciones, s.fechas, s.dias_texto_oficio, s.frase_cuerpo, s.decidido_en
       FROM folios f JOIN solicitudes s ON s.id = f.solicitud_id
      WHERE f.solicitud_id = $1`,
    [solicitudId]
  );
  const row = r.rows[0];
  if (!row) {
    const e = new Error('Esta solicitud no tiene folio emitido');
    e.status = 404;
    throw e;
  }

  const abs = row.pdf_ruta ? rutaAbsoluta(row.pdf_ruta) : path.join(DIR_FOLIOS, `${row.folio}.pdf`);
  if (fs.existsSync(abs)) return { abs, folio: row.folio };

  await pdfLib.generarOficio(
    {
      folio: row.folio,
      token_qr: row.token_qr,
      fecha_oficio: row.decidido_en ? fechaOficio(new Date(row.decidido_en)) : fechaOficio(),
      destinatario: destinatarioOficio(row.semestres, row.secciones),
      nombre: row.nombre_declarado,
      matricula: row.matricula_declarada,
      dias_texto_oficio: row.dias_texto_oficio || textoDias(row.fechas || []),
      frase_cuerpo: row.frase_cuerpo || '',
    },
    abs
  );
  await db.query(
    `UPDATE folios SET pdf_ruta = $2 WHERE folio = $1`,
    [row.folio, path.relative(config.storagePath, abs).split(path.sep).join('/')]
  );
  return { abs, folio: row.folio };
}

module.exports = { asegurarPdf, destinatarioOficio, listaEspanol };
