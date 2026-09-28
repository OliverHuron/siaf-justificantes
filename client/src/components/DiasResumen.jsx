import { useEffect, useRef, useState } from 'react';

const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MES_LARGO = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const fCorto = (s) => {
  const [, m, d] = String(s).slice(0, 10).split('-');
  return `${Number(d)} ${MES_CORTO[Number(m) - 1] || ''}`;
};

/** "24 ago", "3 días" — sin rango, para no saturar la fila con todas las fechas. */
export function resumenDias(fechas) {
  const f = fechas || [];
  if (f.length === 0) return '—';
  if (f.length === 1) return fCorto(f[0]);
  return `${f.length} días`;
}

/** Agrupa fechas ISO por mes para dibujar un mini-calendario por cada uno. */
function agruparPorMes(fechas) {
  const mapa = new Map();
  for (const s of fechas || []) {
    const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
    const clave = `${y}-${m}`;
    if (!mapa.has(clave)) mapa.set(clave, { y, m, dias: new Set() });
    mapa.get(clave).dias.add(d);
  }
  return [...mapa.values()];
}

/** Mini-calendario de solo lectura: marca los días de `dias` (Set de nº de día) del mes y-m. */
function MiniMes({ y, m, dias }) {
  const primero = new Date(y, m - 1, 1);
  const offset = primero.getDay();
  const diasEnMes = new Date(y, m, 0).getDate();
  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push(<div key={`e${i}`} className="rc-day off" />);
  for (let d = 1; d <= diasEnMes; d++) {
    celdas.push(
      <div key={d} className={`rc-day${dias.has(d) ? ' marcado' : ' no'}`}>{d}</div>
    );
  }
  return (
    <div className="dias-mes">
      <div className="rc-head"><span>{MES_LARGO[m - 1]} {y}</span></div>
      <div className="rc-grid">
        {DOW.map((d) => <div key={d} className="rc-dow">{d}</div>)}
        {celdas}
      </div>
    </div>
  );
}

/** Botón-icono que despliega un mini-calendario con los días a justificar. */
function DiasBtn({ fechas }) {
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  function toggle(e) {
    e.stopPropagation();
    if (pos) { setPos(null); return; }
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: Math.max(8, r.right - 260) });
  }
  useEffect(() => {
    if (!pos) return undefined;
    const close = () => setPos(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('mousedown', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('mousedown', close);
    };
  }, [pos]);
  const meses = agruparPorMes(fechas);
  return (
    <>
      <button ref={btnRef} type="button" className="nota-btn" title="Ver calendario" onClick={toggle}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>
      {pos && (
        <div className="dias-pop" style={{ top: pos.top, left: pos.left }}
          onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          {meses.map(({ y, m, dias }) => <MiniMes key={`${y}-${m}`} y={y} m={m} dias={dias} />)}
        </div>
      )}
    </>
  );
}

/** Resumen compacto de "días a justificar" (texto corto + calendario en popover). */
export default function DiasResumen({ fechas }) {
  return (
    <span className="dias-resumen">
      {resumenDias(fechas)}
      {(fechas || []).length > 0 && <DiasBtn fechas={fechas} />}
    </span>
  );
}
