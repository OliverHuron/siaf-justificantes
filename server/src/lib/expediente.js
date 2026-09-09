'use strict';

const db = require('./../db');

const LICENCIATURAS = {
  LIA: 'Licenciatura en Informática Administrativa',
  LC: 'Licenciatura en Contaduría',
  LA: 'Licenciatura en Administración',
  LM: 'Licenciatura en Mercadotecnia',
};
const TURNOS = { MAT: 'Matutino', VESP: 'Vespertino' };
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

/** Busca el grupo (semestre, seccion) del ciclo activo y devuelve el expediente. */
async function resolverExpediente(semestre, seccion) {
  const cfg = await db.query(`SELECT valor FROM config WHERE clave = 'ciclo_activo'`);
  const ciclo = (cfg.rows[0] && String(cfg.rows[0].valor).replace(/"/g, '')) || String(new Date().getFullYear());
  const sem = semestreNum(semestre);
  const sec = String(Number(seccion)) === 'NaN' ? String(seccion) : String(Number(seccion));
  const r = await db.query(
    `SELECT licenciatura, licenciatura_raw, turno, salon, modalidad, periodo
       FROM grupos WHERE ciclo_escolar = $1 AND semestre = $2 AND seccion = $3`,
    [ciclo, sem, sec]
  );
  if (!r.rows[0]) return { encontrado: false, ciclo, semestre: sem, seccion: sec };
  return { encontrado: true, ciclo, semestre: sem, seccion: sec, ...expandirCodigos(r.rows[0]) };
}

module.exports = {
  LICENCIATURAS, TURNOS, MODALIDADES, MATRICULA_RE,
  codigoLicenciatura, matriculaDeCorreo, expandirCodigos, resolverExpediente, semestreNum,
};
