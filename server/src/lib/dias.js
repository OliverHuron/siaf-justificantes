'use strict';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** 'YYYY-MM-DD' -> Date a medianoche UTC (evita corrimientos de zona). */
function aFecha(s) {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function iso(d) {
  return d.toISOString().slice(0, 10);
}

function esFinDeSemana(d) {
  const g = d.getUTCDay(); // 0 dom … 6 sáb
  return g === 0 || g === 6;
}

/** Día de la semana ISO (1 lunes … 7 domingo) de un Date. */
function dowIso(d) {
  const g = d.getUTCDay(); // 0 dom … 6 sáb
  return g === 0 ? 7 : g;
}

/** Normaliza el conjunto de días hábiles de la semana (ISO 1–7). Def.: lun–vie. */
function normDias(dias) {
  if (!dias) return new Set([1, 2, 3, 4, 5]);
  return dias instanceof Set ? dias : new Set([].concat(dias).map(Number));
}

/**
 * Días de la semana hábiles según la modalidad del grupo:
 *  - ESC (escolarizada): lunes a viernes.
 *  - ABI (abierta) / cualquier otra: lunes a sábado.
 */
function diasSemanaDeModalidad(modalidad) {
  const m = String(modalidad || '').trim().toUpperCase();
  return m === 'ESC' || m === 'ESCOLARIZADO' || m === 'ESCOLARIZADA'
    ? [1, 2, 3, 4, 5]
    : [1, 2, 3, 4, 5, 6];
}

/**
 * Días hábiles (según `dias` de la semana, sin feriados) transcurridos DESPUÉS de
 * `desde` y hasta `hasta` inclusive. Si `hasta` <= `desde`, devuelve 0.
 * `feriados` = iterable de fechas ISO 'YYYY-MM-DD' a excluir.
 * `dias` = iterable de nº de día ISO (1 lun … 7 dom). Def.: lun–vie.
 */
function diasHabilesEntre(desde, hasta, feriados, dias) {
  const fer = feriados instanceof Set ? feriados : new Set(feriados || []);
  const dset = normDias(dias);
  const a = aFecha(desde);
  const b = aFecha(hasta);
  if (b <= a) return 0;
  let n = 0;
  const cur = new Date(a);
  while (cur < b) {
    cur.setUTCDate(cur.getUTCDate() + 1);
    if (dset.has(dowIso(cur)) && !fer.has(iso(cur))) n += 1;
  }
  return n;
}

/** ¿La fecha de la falta está dentro de la ventana para solicitar? */
function dentroDeVentana(fechaFalta, limiteHabiles, hoy = iso(new Date()), feriados) {
  return diasHabilesEntre(fechaFalta, hoy, feriados) <= limiteHabiles;
}

/** Texto para el oficio a partir de una lista de fechas ISO. */
function textoDias(fechasIso) {
  const fechas = [...new Set(fechasIso.map((f) => String(f).slice(0, 10)))].sort();
  if (fechas.length === 0) return '';
  const ds = fechas.map(aFecha);

  const mismoMes =
    ds.every((d) => d.getUTCMonth() === ds[0].getUTCMonth() && d.getUTCFullYear() === ds[0].getUTCFullYear());
  const consecutivas = ds.every((d, i) => {
    if (i === 0) return true;
    const prev = new Date(ds[i - 1]);
    prev.setUTCDate(prev.getUTCDate() + 1);
    return iso(prev) === iso(d);
  });

  const mes = MESES[ds[0].getUTCMonth()];
  const anio = ds[0].getUTCFullYear();

  if (fechas.length === 1) {
    return `el día ${ds[0].getUTCDate()} de ${mes} de ${anio}`;
  }
  if (mismoMes && consecutivas) {
    return `del ${ds[0].getUTCDate()} al ${ds[ds.length - 1].getUTCDate()} de ${mes} de ${anio}`;
  }
  if (mismoMes) {
    const nums = ds.map((d) => d.getUTCDate());
    const ult = nums.pop();
    return `los días ${nums.join(', ')} y ${ult} de ${mes} de ${anio}`;
  }
  const partes = ds.map((d) => `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`);
  const ult = partes.pop();
  return `los días ${partes.join('; ')} y ${ult}`;
}

/** Día de la semana ISO (1 lunes … 7 domingo) para una fecha ISO. */
function diaSemanaIso(fechaIso) {
  const g = aFecha(fechaIso).getUTCDay(); // 0 dom … 6 sáb
  return g === 0 ? 7 : g;
}

/** Días naturales inclusivos entre dos fechas ISO (inicio y fin incluidos). */
function diasNaturales(inicio, fin) {
  const a = aFecha(inicio);
  const b = aFecha(fin);
  if (b < a) return 0;
  return Math.round((b - a) / 86400000) + 1;
}

/**
 * Lista de fechas hábiles dentro de [inicio, fin] inclusive.
 * `dias` = nº de día ISO hábiles (1 lun … 7 dom). Def.: lun–vie.
 */
function expandirRangoHabil(inicio, fin, feriados, dias) {
  const fer = feriados instanceof Set ? feriados : new Set(feriados || []);
  const dset = normDias(dias);
  const out = [];
  const cur = aFecha(inicio);
  const b = aFecha(fin);
  while (cur <= b) {
    const s = iso(cur);
    if (dset.has(dowIso(cur)) && !fer.has(s)) out.push(s);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/**
 * Siguiente día hábil ESTRICTAMENTE posterior a `fechaIso` (salta días no
 * hábiles y feriados). `dias` = nº de día ISO hábiles. Def.: lun–vie.
 */
function siguienteDiaHabil(fechaIso, feriados, dias) {
  const fer = feriados instanceof Set ? feriados : new Set(feriados || []);
  const dset = normDias(dias);
  const cur = aFecha(fechaIso);
  do {
    cur.setUTCDate(cur.getUTCDate() + 1);
  } while (!dset.has(dowIso(cur)) || fer.has(iso(cur)));
  return iso(cur);
}

/** "Morelia, Michoacán, a 24 de agosto de 2026" para la fecha dada (hoy por defecto). */
function fechaOficio(d = new Date()) {
  return `Morelia, Michoacán, a ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

module.exports = {
  MESES, diasHabilesEntre, dentroDeVentana, textoDias, diaSemanaIso, fechaOficio, iso, aFecha,
  diasNaturales, expandirRangoHabil, siguienteDiaHabil, diasSemanaDeModalidad,
};
