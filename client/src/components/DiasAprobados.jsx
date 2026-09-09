import { useState } from 'react';

const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * Calendario donde la encargada marca cuáles de los días PEDIDOS por el alumno
 * quedan aprobados. Solo los días de `pedidos` son interactivos.
 * @param {string[]} pedidos  fechas ISO que solicitó el alumno
 * @param {string[]} value    fechas ISO aprobadas
 * @param {Function} onChange
 */
export default function DiasAprobados({ pedidos = [], value = [], onChange }) {
  const setPed = new Set(pedidos);
  const setApr = new Set(value);
  const base = pedidos[0] ? new Date(`${pedidos[0]}T00:00:00`) : new Date();
  const [ver, setVer] = useState({ y: base.getFullYear(), m: base.getMonth() });

  const primero = new Date(ver.y, ver.m, 1);
  const offset = primero.getDay();
  const diasEnMes = new Date(ver.y, ver.m + 1, 0).getDate();

  function mover(delta) {
    setVer((v) => {
      const nm = v.m + delta;
      return { y: v.y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 };
    });
  }
  function toggle(s) {
    if (!setPed.has(s)) return;
    const n = new Set(setApr);
    if (n.has(s)) n.delete(s); else n.add(s);
    onChange([...n].sort());
  }

  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push(<div key={`e${i}`} className="dc-day off" />);
  for (let d = 1; d <= diasEnMes; d++) {
    const s = iso(ver.y, ver.m, d);
    const pedido = setPed.has(s);
    const aprob = setApr.has(s);
    const cls = ['dc-day', aprob ? 'aprob' : (pedido ? 'pedido' : '')].filter(Boolean).join(' ');
    celdas.push(
      <div key={d} className={cls} onClick={() => toggle(s)}
        title={pedido ? (aprob ? 'Aprobado — clic para quitar' : 'Pedido — clic para aprobar') : undefined}>
        {d}
      </div>
    );
  }

  return (
    <div className="dc">
      <div className="dc-head">
        <button type="button" onClick={() => mover(-1)}>‹</button>
        <span>{MESES[ver.m]} {ver.y}</span>
        <button type="button" onClick={() => mover(1)}>›</button>
      </div>
      <div className="dc-grid">
        {DOW.map((x) => <div key={x} className="dc-dow">{x}</div>)}
        {celdas}
      </div>
      <p className="hint" style={{ textAlign: 'center', marginTop: 8 }}>
        Marca los días que <b>sí</b> proceden según la evidencia.
      </p>
    </div>
  );
}
