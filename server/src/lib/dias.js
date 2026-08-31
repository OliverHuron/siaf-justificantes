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

/**
 * Días hábiles (lun–vie) transcurridos DESPUÉS de `desde` y hasta `hasta`
 * inclusive. Si `hasta` <= `desde`, devuelve 0. No considera días feriados
 * (lista opcional prevista para Fase 2).
 */
function diasHabilesEntre(desde, hasta) {
  let a = aFecha(desde);
  const b = aFecha(hasta);
  if (b <= a) return 0;
  let n = 0;
  const cur = new Date(a);
  while (cur < b) {
    cur.setUTCDate(cur.getUTCDate() + 1);
    if (!esFinDeSemana(cur)) n += 1;
  }
  return n;
}

/** ¿La fecha de la falta está dentro de la ventana para solicitar? */
function dentroDeVentana(fechaFalta, limiteHabiles, hoy = iso(new Date())) {
  return diasHabilesEntre(fechaFalta, hoy) <= limiteHabiles;
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

/** "Morelia, Michoacán, a 24 de agosto de 2026" para la fecha dada (hoy por defecto). */
function fechaOficio(d = new Date()) {
  return `Morelia, Michoacán, a ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

module.exports = {
  MESES, diasHabilesEntre, dentroDeVentana, textoDias, diaSemanaIso, fechaOficio, iso, aFecha,
};
