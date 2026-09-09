import { useState } from 'react';

const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * Calendario de RANGO: primer clic = inicio, segundo clic = fin.
 * `value` = { inicio: 'YYYY-MM-DD'|null, fin: 'YYYY-MM-DD'|null }.
 * No permite fechas futuras. `feriados` = ['YYYY-MM-DD', ...] (no seleccionables).
 */
export default function RangoCalendario({ value = {}, onChange, feriados = [] }) {
  const hoy = new Date();
  const [ver, setVer] = useState(() => {
    const base = value.inicio ? new Date(value.inicio) : hoy;
    return { y: base.getFullYear(), m: base.getMonth() };
  });
  const fer = new Set(feriados);
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

  function clic(s) {
    if (s > hoyIso || fer.has(s)) return;
    if (!inicio || (inicio && fin)) { onChange({ inicio: s, fin: null }); return; }
    if (s < inicio) { onChange({ inicio: s, fin: null }); return; }
    onChange({ inicio, fin: s });
  }

  const finEfectivo = fin || inicio;
  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push(<div key={`e${i}`} className="rc-day off" />);
  for (let d = 1; d <= diasEnMes; d++) {
    const s = iso(ver.y, ver.m, d);
    const futuro = s > hoyIso;
    const feriado = fer.has(s);
    const enRango = inicio && s >= inicio && s <= finEfectivo;
    const cls = [
      'rc-day',
      futuro || feriado ? 'no' : '',
      feriado ? 'feriado' : '',
      s === inicio ? 'ini' : '',
      s === fin ? 'fin' : '',
      enRango && s !== inicio && s !== fin ? 'rango' : '',
    ].filter(Boolean).join(' ');
    celdas.push(
      <div key={d} className={cls} title={feriado ? 'Día no hábil' : undefined} onClick={() => clic(s)}>
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
        Selecciona el día de inicio y luego el día de fin.
      </p>
    </div>
  );
}
