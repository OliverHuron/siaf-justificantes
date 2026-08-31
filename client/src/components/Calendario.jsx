import { useState } from 'react';

const DOW = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function iso(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Selector de días tipo mini-calendario. `value` = array de 'YYYY-MM-DD'.
 * No permite fechas futuras. `permitirFuturo` para relajarlo (enfermería).
 */
export default function Calendario({ value = [], onChange, permitirFuturo = false }) {
  const hoy = new Date();
  const [ver, setVer] = useState({ y: hoy.getFullYear(), m: hoy.getMonth() });
  const sel = new Set(value);
  const hoyIso = iso(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  const primerDia = new Date(ver.y, ver.m, 1);
  const offset = (primerDia.getDay() + 6) % 7; // lunes = 0
  const diasEnMes = new Date(ver.y, ver.m + 1, 0).getDate();

  function toggle(d) {
    const s = iso(ver.y, ver.m, d);
    if (!permitirFuturo && s > hoyIso) return;
    const next = new Set(sel);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    onChange([...next].sort());
  }

  function mover(delta) {
    setVer((v) => {
      const nm = v.m + delta;
      return { y: v.y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 };
    });
  }

  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push(<div key={`e${i}`} className="cal-day off" />);
  for (let d = 1; d <= diasEnMes; d++) {
    const s = iso(ver.y, ver.m, d);
    const futuro = !permitirFuturo && s > hoyIso;
    celdas.push(
      <div
        key={d}
        className={`cal-day${sel.has(s) ? ' sel' : ''}${futuro ? ' futuro' : ''}`}
        onClick={() => toggle(d)}
      >
        {d}
      </div>
    );
  }

  return (
    <div>
      <div className="cal">
        <div className="cal-head">
          <button type="button" onClick={() => mover(-1)}>‹</button>
          <span>{MESES[ver.m]} {ver.y}</span>
          <button type="button" onClick={() => mover(1)}>›</button>
        </div>
        <div className="cal-grid">
          {DOW.map((d, i) => <div key={i} className="cal-dow">{d}</div>)}
          {celdas}
        </div>
      </div>
      {value.length > 0 && (
        <p className="hint">Seleccionados: {value.join(', ')}</p>
      )}
    </div>
  );
}
