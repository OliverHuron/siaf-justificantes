'use strict';

const { consultarGrupo } = require('./fcca');

const LICENCIATURAS = {
  LIA: 'Licenciatura en Informática Administrativa',
  LC: 'Licenciatura en Contaduría',
  LA: 'Licenciatura en Administración',
  LM: 'Licenciatura en Mercadotecnia',
};
const TURNOS = { MAT: 'Matutino', VESP: 'Vespertino', ABI: 'Abierto', LINEA: 'En línea' };
const MODALIDADES = { ESC: 'Escolarizado', ABI: 'Abierto', LINEA: 'En línea', LÍNEA: 'En línea' };

const MATRICULA_RE = /^\d{7}[A-Za-z]$/;

const ORD = {
  primero: '1', segundo: '2', tercero: '3', cuarto: '4', quinto: '5',
  sexto: '6', septimo: '7', 'séptimo': '7', octavo: '8', noveno: '9',
};
/** Normaliza 'septimo' | '7' | 7 → '7'. */
function semestreNum(v) {
  const s = String(v || '').trim().toLowerCase();
  if (ORD[s]) return ORD[s];
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? String(n) : s;
}

/** De 'LIA-2017' saca 'LIA'. */
function codigoLicenciatura(raw) {
  return String(raw || '').trim().toUpperCase().split(/[-\s]/)[0] || null;
}

/** Extrae y valida la matrícula de un correo institucional. */
function matriculaDeCorreo(email) {
  const local = String(email || '').trim().toLowerCase().split('@')[0];
  const m = local.toUpperCase();
  return MATRICULA_RE.test(m) ? m : null;
}

/** Nombres largos para mostrar. */
function expandirCodigos(g) {
  if (!g) return null;
  const lic = codigoLicenciatura(g.licenciatura || g.licenciatura_raw);
  const turno = String(g.turno || '').trim().toUpperCase();
  const modalidad = String(g.modalidad || '').trim().toUpperCase();
  return {
    licenciatura: lic,
    licenciatura_nombre: LICENCIATURAS[lic] || g.licenciatura_raw || lic || '—',
    turno,
    turno_nombre: TURNOS[turno] || turno || '—',
    salon: g.salon || '—',
    modalidad,
    modalidad_nombre: MODALIDADES[modalidad] || modalidad || '—',
    periodo: g.periodo || null,
  };
}

/**
 * Consulta EN VIVO el expediente del grupo en fcca.umich.mx (con caché en
 * memoria; nada se guarda en la BD). Devuelve códigos + nombres largos.
 */
async function resolverExpediente(semestre, seccion) {
  const sem = semestreNum(semestre);
  const sec = Number.isNaN(Number(seccion)) ? String(seccion) : String(Number(seccion));
  const g = await consultarGrupo(sem, sec);
  if (!g || !g.encontrado) {
    return { encontrado: false, semestre: sem, seccion: sec, ...(g && g.error ? { error: g.error } : {}) };
  }
  return {
    encontrado: true, semestre: sem, seccion: sec,
    licenciatura: codigoLicenciatura(g.licenciatura_raw),
    ...expandirCodigos({
      licenciatura: g.licenciatura_raw, licenciatura_raw: g.licenciatura_raw,
      turno: g.turno, salon: g.salon, modalidad: g.modalidad, periodo: g.periodo,
    }),
  };
}

module.exports = {
  LICENCIATURAS, TURNOS, MODALIDADES, MATRICULA_RE,
  codigoLicenciatura, matriculaDeCorreo, expandirCodigos, resolverExpediente, semestreNum,
};
