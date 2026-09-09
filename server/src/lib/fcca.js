'use strict';

/**
 * Consulta EN VIVO el expediente de un grupo (semestre + sección) contra
 * https://www.fcca.umich.mx/Horarios.php. No se guarda nada en la BD: solo
 * caché en memoria del proceso (sesión ~10 min, resultado por grupo ~12 h).
 * Porta la lógica de Desktop/ObtenerHorarios/ObtenerHorarioSeccion.py.
 */

const https = require('https');
const cheerio = require('cheerio');

const URL_HORARIOS = 'https://www.fcca.umich.mx/Horarios.php';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const TTL_SESION = 10 * 60 * 1000;
const TTL_RESULTADO = 12 * 60 * 60 * 1000;
const TIMEOUT = 12000;

const agente = new https.Agent({
  keepAlive: true,
  rejectUnauthorized: false,
  minVersion: 'TLSv1',
  ciphers: 'ALL@SECLEVEL=0',
});

let sesion = null;                 // { cookies, secciones:[{value,semestre,seccion}], expira }
const cacheResultado = new Map();  // 'sem|secc' -> { data, expira }
let sesionEnCurso = null;          // promesa compartida mientras se abre la sesión

function pedir(metodo, form, cookies) {
  return new Promise((resolve, reject) => {
    const body = form ? new URLSearchParams(form).toString() : null;
    const req = https.request(
      URL_HORARIOS,
      {
        method: metodo,
        agent: agente,
        timeout: TIMEOUT,
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
        const ck = set ? set.map((c) => c.split(';')[0]).join('; ') : cookies || '';
        let data = '';
        res.setEncoding('latin1');
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ html: data, cookies: ck }));
      }
    );
    req.on('timeout', () => req.destroy(new Error('timeout FCCA')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const norm = (s) =>
  String(s || '').normalize('NFKD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();

const LABELS = ['semestre', 'seccion', 'salon', 'turno', 'licenciatura', 'modalidad', 'periodo'];

function extraerInfoGeneral($) {
  const filas = $('tr').toArray();
  for (let i = 0; i < filas.length - 1; i++) {
    const celdas = $(filas[i]).find('th,td').toArray().map((c) => norm($(c).text()));
    if (celdas.length < 7) continue;
    if (!LABELS.every((l, k) => celdas[k] === l)) continue;
    const valores = $(filas[i + 1]).find('th,td').toArray().map((c) => $(c).text().trim());
    if (valores.slice(0, 7).every((v, k) => norm(v) === LABELS[k])) continue; // fila de etiquetas repetida
    if (valores.length >= 7) {
      return {
        semestre: valores[0], seccion: valores[1], salon: valores[2], turno: valores[3],
        licenciatura: valores[4], modalidad: valores[5], periodo: valores[6],
      };
    }
  }
  return null;
}

async function abrirSesion() {
  const g = await pedir('GET');
  const $0 = cheerio.load(g.html);
  const sel = $0('select').first();
  const namePeriodo = sel.attr('name') || 'ID_Periodo';
  const valPeriodo = sel.find('option[value]').filter((_, o) => $0(o).attr('value')).first().attr('value');
  const btn = $0('input[type=submit]').first();
  const nameBtn = btn.attr('name') || 'Consultar';
  const valBtn = btn.attr('value') || 'Consultar';

  const p = await pedir('POST', { [namePeriodo]: valPeriodo, [nameBtn]: valBtn }, g.cookies);
  const $1 = cheerio.load(p.html);
  let selSecc = null;
  $1('select').each((_, s) => { if (/Sem\s|Secc/.test($1(s).text())) selSecc = $1(s); });
  if (!selSecc) throw new Error('FCCA no devolvió el listado de secciones');

  const secciones = [];
  selSecc.find('option').each((_, o) => {
    const v = $1(o).attr('value');
    const t = $1(o).text().trim();
    if (v && v.trim()) {
      const m = t.match(/Sem\s*(\d+)\s*-\s*Secc\s*(\d+)/i);
      if (m) secciones.push({ value: v, semestre: m[1], seccion: String(Number(m[2])) });
    }
  });
  return { cookies: p.cookies, secciones, expira: Date.now() + TTL_SESION };
}

async function asegurarSesion() {
  if (sesion && sesion.expira > Date.now()) return sesion;
  if (!sesionEnCurso) {
    sesionEnCurso = abrirSesion()
      .then((s) => { sesion = s; return s; })
      .finally(() => { sesionEnCurso = null; });
  }
  return sesionEnCurso;
}

/**
 * @returns {Promise<{encontrado:boolean, salon?, turno?, licenciatura_raw?, modalidad?, periodo?, error?}>}
 */
async function consultarGrupo(semestre, seccion) {
  const key = `${semestre}|${seccion}`;
  const hit = cacheResultado.get(key);
  if (hit && hit.expira > Date.now()) return hit.data;

  let data;
  try {
    const s = await asegurarSesion();
    const opt = s.secciones.find((o) => o.semestre === String(semestre) && o.seccion === String(Number(seccion)));
    if (!opt) {
      data = { encontrado: false, motivo: 'grupo_no_listado' };
    } else {
      const r = await pedir('POST', { ID_Seccion: opt.value }, s.cookies);
      const g = extraerInfoGeneral(cheerio.load(r.html));
      data = g
        ? {
            encontrado: true,
            salon: g.salon || null,
            turno: (g.turno || '').toUpperCase() || null,
            licenciatura_raw: g.licenciatura || null,
            modalidad: (g.modalidad || '').toUpperCase() || null,
            periodo: g.periodo || null,
          }
        : { encontrado: false, motivo: 'sin_datos' };
    }
    cacheResultado.set(key, { data, expira: Date.now() + TTL_RESULTADO });
  } catch (e) {
    // No cacheamos los errores de red: se reintenta en la siguiente consulta.
    data = { encontrado: false, error: e.message || 'FCCA no disponible' };
  }
  return data;
}

module.exports = { consultarGrupo };
