import { useState } from 'react';

const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
/** nº de día ISO (1 lun … 7 dom) para un año/mes(0-based)/día. */
const dowIso = (y, m, d) => {
  const g = new Date(y, m, d).getDay(); // 0 dom … 6 sáb
  return g === 0 ? 7 : g;
};

/**
 * Calendario de día o RANGO.
 * - 1er clic: selecciona ese día  → { inicio: D, fin: D }.
 * - 2º clic en el mismo día: lo deselecciona → { inicio: null, fin: null }.
 * - 2º clic en otro día: forma el rango ordenado → { inicio: min, fin: max }.
 * - con un rango, clic en un extremo lo quita (colapsa al otro día);
 *   clic en cualquier otro día reinicia a un día único.
 * `value` = { inicio: 'YYYY-MM-DD'|null, fin: 'YYYY-MM-DD'|null }.
 * No permite fechas futuras. `feriados` = ['YYYY-MM-DD', ...] (no seleccionables).
 * `diasSemana` = nº de día ISO hábiles (1 lun … 7 dom); los demás no se pueden
 * elegir. Def.: lun–vie (modalidad escolarizada).
 */
export default function RangoCalendario({
  value = {}, onChange, feriados = [], diasSemana = [1, 2, 3, 4, 5],
}) {
  const hoy = new Date();
  const [ver, setVer] = useState(() => {
    const base = value.inicio ? new Date(value.inicio) : hoy;
    return { y: base.getFullYear(), m: base.getMonth() };
  });
  const fer = new Set(feriados);
  const habilDow = new Set(diasSemana);
  const hoyIso = iso(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const { inicio = null, fin = null } = value;

  const primero = new Date(ver.y, ver.m, 1);
  const offset = primero.getDay(); // domingo = 0
  const diasEnMes = new Date(ver.y, ver.m + 1, 0).getDate();

  function mover(delta) {
    setVer((v) => {
      const nm = v.m + delta;
      return { y: v.y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 };
    });
  }

  function clic(s, seleccionable) {
    if (!seleccionable) return;
    const A = inicio;
    const B = fin || inicio; // un día suelto = inicio === fin

    if (!A) { onChange({ inicio: s, fin: s }); return; }

    if (A === B) {
      // hay un solo día: mismo día → deselecciona; otro día → rango ordenado
      if (s === A) { onChange({ inicio: null, fin: null }); return; }
      onChange(s < A ? { inicio: s, fin: A } : { inicio: A, fin: s });
      return;
    }

    // hay un rango A..B: clic en un extremo lo quita; en otro día, reinicia
    if (s === A) { onChange({ inicio: B, fin: B }); return; }
    if (s === B) { onChange({ inicio: A, fin: A }); return; }
    onChange({ inicio: s, fin: s });
  }

  const finEfectivo = fin || inicio;
  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push(<div key={`e${i}`} className="rc-day off" />);
  for (let d = 1; d <= diasEnMes; d++) {
    const s = iso(ver.y, ver.m, d);
    const futuro = s > hoyIso;
    const feriado = fer.has(s);
    const habil = habilDow.has(dowIso(ver.y, ver.m, d)) && !feriado;
    const seleccionable = habil && !futuro;
    const enRango = inicio && s >= inicio && s <= finEfectivo;
    const cls = [
      'rc-day',
      !seleccionable ? 'no' : '',
      feriado ? 'feriado' : '',
      s === inicio ? 'ini' : '',
      s === fin ? 'fin' : '',
      enRango && habil && s !== inicio && s !== fin ? 'rango' : '',
    ].filter(Boolean).join(' ');
    celdas.push(
      <div key={d} className={cls}
        title={feriado ? 'Día no hábil' : (!habil ? 'No cuenta para tu modalidad' : undefined)}
        onClick={() => clic(s, seleccionable)}>
        {d}
      </div>
    );
  }

  return (
    <div className="rc">
      <div className="rc-head">
        <button type="button" onClick={() => mover(-1)}>‹</button>
        <span>{MESES[ver.m]} {ver.y}</span>
        <button type="button" onClick={() => mover(1)}>›</button>
      </div>
      <div className="rc-grid">
        {DOW.map((d) => <div key={d} className="rc-dow">{d}</div>)}
        {celdas}
      </div>
      <p className="hint" style={{ textAlign: 'center', marginTop: 8 }}>
        Toca un día. Toca otro para hacer un rango; toca el mismo para quitarlo.
      </p>
    </div>
  );
}
