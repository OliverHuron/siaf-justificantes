'use strict';

/**
 * Sincroniza la tabla `grupos` (licenciatura/turno/salón/modalidad/periodo por
 * semestre y sección) desde https://www.fcca.umich.mx/Horarios.php.
 *
 * Porta la lógica de Desktop/ObtenerHorarios/ObtenerHorarioSeccion.py a Node.
 * El sitio usa TLS antiguo y HTML sin normalizar; por eso el agente https
 * relajado y el parseo tolerante con cheerio.
 *
 *   npm run sync:fcca            # todas las secciones del periodo vigente
 *   npm run sync:fcca -- 7 26    # solo Sem 7 - Secc 26
 */

require('dotenv').config();
const https = require('https');
const { URLSearchParams } = require('url');
const cheerio = require('cheerio');
const { pool } = require('../src/db');
const { codigoLicenciatura } = require('../src/lib/expediente');

const URL_HORARIOS = 'https://www.fcca.umich.mx/Horarios.php';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const agente = new https.Agent({
  keepAlive: true,
  rejectUnauthorized: false,
  minVersion: 'TLSv1',
  ciphers: 'ALL@SECLEVEL=0',
});

let cookies = '';

function pedir(metodo, form) {
  return new Promise((resolve, reject) => {
    const body = form ? new URLSearchParams(form).toString() : null;
    const req = https.request(
      URL_HORARIOS,
      {
        method: metodo,
        agent: agente,
        headers: {
          'User-Agent': UA,
          Referer: URL_HORARIOS,
          ...(cookies ? { Cookie: cookies } : {}),
          ...(body
            ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
            : {}),
        },
      },
      (res) => {
        const set = res.headers['set-cookie'];
        if (set) cookies = set.map((c) => c.split(';')[0]).join('; ');
        let data = '';
        res.setEncoding('latin1'); // el sitio no declara utf-8 de forma fiable
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve(data));
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const norm = (s) =>
  String(s || '')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();

const LABELS = ['semestre', 'seccion', 'salon', 'turno', 'licenciatura', 'modalidad', 'periodo'];

/**
 * Busca una fila cuyas celdas normalizadas sean exactamente
 * [semestre, seccion, salon, turno, licenciatura, modalidad, periodo]
 * y toma las 7 primeras celdas de la fila siguiente como valores.
 */
function extraerInfoGeneral($) {
  const filas = $('tr').toArray();
  for (let i = 0; i < filas.length - 1; i++) {
    const celdas = $(filas[i]).find('th,td').toArray().map((c) => norm($(c).text()));
    if (celdas.length < 7) continue;
    const primeras7 = celdas.slice(0, 7);
    if (LABELS.every((l, k) => primeras7[k] === l)) {
      const valores = $(filas[i + 1]).find('th,td').toArray().map((c) => $(c).text().trim());
      // La fila siguiente a veces repite las etiquetas; sáltala.
      const esEtiquetas = valores.slice(0, 7).every((v, k) => norm(v) === LABELS[k]);
      if (esEtiquetas) continue;
      if (valores.length >= 7) {
        return {
          semestre: valores[0], seccion: valores[1], salon: valores[2], turno: valores[3],
          licenciatura: valores[4], modalidad: valores[5], periodo: valores[6],
        };
      }
    }
  }
  return {};
}

async function abrirSesion() {
  const html0 = await pedir('GET');
  const $0 = cheerio.load(html0);
  const sel = $0('select').first();
  const namePeriodo = sel.attr('name') || 'ID_Periodo';
  const valPeriodo = sel.find('option[value]').filter((_, o) => $0(o).attr('value')).first().attr('value');
  const btn = $0('input[type=submit]').first();
  const nameBtn = btn.attr('name') || 'Consultar';
  const valBtn = btn.attr('value') || 'Consultar';

  const html1 = await pedir('POST', { [namePeriodo]: valPeriodo, [nameBtn]: valBtn });
  const $1 = cheerio.load(html1);
  let selSecc = null;
  $1('select').each((_, s) => {
    const t = $1(s).text();
    if (/Sem\s|Secc/.test(t)) selSecc = $1(s);
  });
  if (!selSecc) throw new Error('El servidor no devolvió el listado de secciones.');

  const secciones = [];
  selSecc.find('option').each((_, o) => {
    const v = $1(o).attr('value');
    const t = $1(o).text().trim();
    if (v && v.trim()) {
      const m = t.match(/Sem\s*(\d+)\s*-\s*Secc\s*(\d+)/i);
      secciones.push({ value: v, texto: t, semestre: m && m[1], seccion: m && String(Number(m[2])) });
    }
  });
  return secciones;
}

async function descargarSeccion(opt) {
  const html = await pedir('POST', { ID_Seccion: opt.value });
  const $ = cheerio.load(html);
  const g = extraerInfoGeneral($);
  return {
    semestre: opt.semestre || (g.semestre && String(Number(g.semestre))),
    seccion: opt.seccion || (g.seccion && String(Number(g.seccion))),
    licenciatura_raw: g.licenciatura || null,
    licenciatura: codigoLicenciatura(g.licenciatura),
    turno: (g.turno || '').toUpperCase() || null,
    salon: g.salon || null,
    modalidad: (g.modalidad || '').toUpperCase() || null,
    periodo: g.periodo || null,
  };
}

async function main() {
  const [semArg, seccArg] = process.argv.slice(2);

  const cfg = await pool.query(`SELECT valor FROM config WHERE clave = 'ciclo_activo'`);
  const ciclo = (cfg.rows[0] && String(cfg.rows[0].valor).replace(/"/g, '')) || String(new Date().getFullYear());

  console.log('Abriendo sesión en fcca.umich.mx/Horarios.php …');
  let secciones = await abrirSesion();
  console.log(`  ${secciones.length} secciones en el periodo vigente.`);

  if (semArg && seccArg) {
    const sN = String(Number(seccArg));
    secciones = secciones.filter((o) => o.semestre === String(semArg) && o.seccion === sN);
    if (!secciones.length) { console.error('No se encontró esa Sem/Secc en el listado.'); process.exitCode = 1; return; }
  }

  let ok = 0;
  const errores = [];
  for (const opt of secciones) {
    try {
      const d = await descargarSeccion(opt);
      if (!d.semestre || !d.seccion) { errores.push(`${opt.texto}: sin semestre/sección`); continue; }
      await pool.query(
        `INSERT INTO grupos (ciclo_escolar, semestre, seccion, licenciatura, licenciatura_raw, turno, salon, modalidad, periodo, actualizado_en)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
         ON CONFLICT (ciclo_escolar, semestre, seccion) DO UPDATE SET
           licenciatura = EXCLUDED.licenciatura, licenciatura_raw = EXCLUDED.licenciatura_raw,
           turno = EXCLUDED.turno, salon = EXCLUDED.salon, modalidad = EXCLUDED.modalidad,
           periodo = EXCLUDED.periodo, actualizado_en = now()`,
        [ciclo, d.semestre, d.seccion, d.licenciatura, d.licenciatura_raw, d.turno, d.salon, d.modalidad, d.periodo]
      );
      ok++;
      process.stdout.write(`  ✓ Sem ${d.semestre} Secc ${d.seccion.padStart(2, '0')}  ${d.licenciatura || '?'} / ${d.turno || '?'} / ${d.salon || '?'} / ${d.modalidad || '?'}\n`);
    } catch (e) {
      errores.push(`${opt.texto}: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 1500)); // no saturar el Apache viejo
  }

  console.log(`\nListo. ${ok} grupos actualizados (ciclo ${ciclo}).`);
  if (errores.length) console.log(`Errores (${errores.length}):\n  ` + errores.join('\n  '));
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => pool.end());
