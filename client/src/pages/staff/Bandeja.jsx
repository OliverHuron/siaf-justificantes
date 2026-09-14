import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiBlob } from '../../api.js';
import RangoCalendario from '../../components/RangoCalendario.jsx';

const TODOS_DIAS = [1, 2, 3, 4, 5, 6, 7];

const PILL = {
  pendiente: 'alerta', aprobada: 'ok', rechazada: 'mal',
  requiere_ventanilla: 'azul', cancelada: 'neutro',
};

const ORD_SEM = {
  primero: '1°', segundo: '2°', tercero: '3°', cuarto: '4°', quinto: '5°',
  sexto: '6°', septimo: '7°', 'séptimo': '7°', octavo: '8°', noveno: '9°',
};
const semLabel = (v) => ORD_SEM[String(v).toLowerCase()] || (/^\d+$/.test(String(v)) ? `${v}°` : v);
const fmtFecha = (s) => {
  const d = String(s).slice(0, 10).split('-');
  return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : s;
};
const fmtFechaHora = (s) => {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

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
/** "24 ago", "3 días · 24–27 ago" (o con año si cruza de mes/año) para no saturar la fila. */
function resumenDias(fechas) {
  const f = fechas || [];
  if (f.length === 0) return '—';
  if (f.length === 1) return fCorto(f[0]);
  return `${f.length} días · ${fCorto(f[0])} – ${fCorto(f[f.length - 1])}`;
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

const ICONO = {
  receta: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M9 13h6M9 17h4" />
    </svg>
  ),
  ticket: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4h16v6a2 2 0 0 0 0 4v6H4v-6a2 2 0 0 0 0-4z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  ),
};

/** Botón-icono que despliega la nota interna en un popover. */
function NotaBtn({ texto }) {
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
  return (
    <>
      <button ref={btnRef} type="button" className="nota-btn" title="Ver nota interna" onClick={toggle}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 4h16v11l-5 5H4z" />
          <path d="M15 20v-5h5M8 9h8M8 13h5" />
        </svg>
      </button>
      {pos && (
        <div className="nota-pop" style={{ top: pos.top, left: pos.left }}
          onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          {texto}
        </div>
      )}
    </>
  );
}

/** Filtro por fecha (día o rango) con un calendario desplegable. */
function FiltroFecha({ value, onChange }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!abierto) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [abierto]);

  const dmy = (s) => (s ? s.split('-').reverse().join('/') : '');
  const etiqueta = !value.inicio
    ? 'Fecha: todas'
    : value.fin && value.fin !== value.inicio
      ? `${dmy(value.inicio)} a ${dmy(value.fin)}`
      : dmy(value.inicio);

  return (
    <span className="filtro-fecha" ref={ref}>
      <button type="button" className="plano" onClick={() => setAbierto((v) => !v)}>{etiqueta}</button>
      {abierto && (
        <div className="filtro-fecha-pop">
          <RangoCalendario value={value} onChange={onChange} feriados={[]} diasSemana={TODOS_DIAS} />
          <button type="button" className="sg-link" style={{ marginTop: 4 }}
            onClick={() => { onChange({ inicio: null, fin: null }); setAbierto(false); }}>
            Limpiar fecha
          </button>
        </div>
      )}
    </span>
  );
}

/** Botón-icono que abre un adjunto (receta/ticket) en pestaña nueva con el token de staff. */
function BotonAdjunto({ solicitudId, adjId, clase, titulo }) {
  const [cargando, setCargando] = useState(false);
  async function abrir(e) {
    e.stopPropagation();
    if (cargando) return;
    setCargando(true);
    try {
      const u = await apiBlob(`/revision/${solicitudId}/adjuntos/${adjId}`, 'staff');
      window.open(u, '_blank', 'noopener');
    } catch {
      /* noop: el detalle muestra el error si hace falta */
    } finally {
      setCargando(false);
    }
  }
  return (
    <button type="button" className="icono-btn" title={titulo} aria-label={titulo}
      onClick={abrir} disabled={cargando}>
      {ICONO[clase]}
    </button>
  );
}

export default function Bandeja() {
  const nav = useNavigate();
  const [filas, setFilas] = useState(null);
  const [err, setErr] = useState('');
  const [filtro, setFiltro] = useState({
    estado: 'pendiente', texto: '', notas: '', rango: { inicio: null, fin: null },
  });

  function cargar() {
    const q = new URLSearchParams();
    if (filtro.estado) q.set('estado', filtro.estado);
    if (filtro.texto) q.set('texto', filtro.texto);
    if (filtro.notas) q.set('notas', filtro.notas);
    if (filtro.rango.inicio) q.set('desde', filtro.rango.inicio);
    if (filtro.rango.fin || filtro.rango.inicio) q.set('hasta', filtro.rango.fin || filtro.rango.inicio);
    api(`/revision/cola?${q}`).then(setFilas).catch((e) => setErr(e.message));
  }
  useEffect(cargar, [filtro.estado, filtro.notas, filtro.rango.inicio, filtro.rango.fin]);

  return (
    <div>
      {err && <div className="aviso error">{err}</div>}

      <div className="card">
        <div className="fila">
          <select value={filtro.estado} onChange={(e) => setFiltro((f) => ({ ...f, estado: e.target.value }))} style={{ width: 'auto' }}>
            <option value="">Todas</option>
            <option value="pendiente">Pendientes</option>
            <option value="aprobada">Aprobadas</option>
            <option value="rechazada">Rechazadas</option>
            <option value="requiere_ventanilla">Requieren ventanilla</option>
          </select>
          <select value={filtro.notas} onChange={(e) => setFiltro((f) => ({ ...f, notas: e.target.value }))} style={{ width: 'auto' }}>
            <option value="">Todas las notas</option>
            <option value="con">Con nota</option>
            <option value="sin">Sin nota</option>
          </select>
          <FiltroFecha value={filtro.rango} onChange={(rango) => setFiltro((f) => ({ ...f, rango }))} />
          <form onSubmit={(e) => { e.preventDefault(); cargar(); }} style={{ flex: 1, minWidth: 160 }}>
            <input type="search" placeholder="Nombre o matrícula…" value={filtro.texto}
              onChange={(e) => setFiltro((f) => ({ ...f, texto: e.target.value }))} />
          </form>
        </div>
      </div>

      {!filas ? <p>Cargando…</p> : (
        <div className="card tabla-scroll tabla-siaf">
          <table>
            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th>Dirección de correo electrónico</th>
                <th>Nombre completo</th>
                <th>Matrícula</th>
                <th>Sección</th>
                <th>Semestre</th>
                <th>Día(s) a justificar</th>
                <th>Comprobantes</th>
                <th>Estado</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((s) => {
                const adj = s.adjuntos || {};
                const esPrivada = s.origen_atencion === 'privada';
                return (
                  <tr key={s.id} className="clic" onClick={() => nav(`/staff/solicitud/${s.id}`)}
                    style={s.color ? { boxShadow: `inset 4px 0 0 ${s.color}` } : undefined}>
                    <td className="nowrap">{fmtFechaHora(s.creado_en)}</td>
                    <td className="mono">{s.email_alumno}</td>
                    <td>{s.nombre_declarado}</td>
                    <td className="mono">{s.matricula_declarada}</td>
                    <td className="mono">{(s.secciones || []).join(', ')}</td>
                    <td className="mono">{(s.semestres || []).map(semLabel).join(', ')}</td>
                    <td className="mono nowrap">
                      <span className="dias-resumen">
                        {resumenDias(s.fechas)}
                        {(s.fechas || []).length > 0 && <DiasBtn fechas={s.fechas} />}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="icono-grupo">
                        {adj.receta
                          ? <BotonAdjunto solicitudId={s.id} adjId={adj.receta} clase="receta"
                              titulo="Ver receta / constancia" />
                          : <span className="hint">Sin receta</span>}
                        {esPrivada && adj.ticket && (
                          <BotonAdjunto solicitudId={s.id} adjId={adj.ticket} clase="ticket"
                            titulo="Ver ticket de compra" />
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`pill ${PILL[s.estado] || 'neutro'}`}>{s.estado}</span>
                      {s.folio && <div className="hint mono">{s.folio}</div>}
                    </td>
                    <td>
                      {Object.keys(s.banderas || {}).map((b) => (
                        <span key={b} className="pill mal" style={{ marginRight: 4 }}>{b}</span>
                      ))}
                      {s.recordatorio && <NotaBtn texto={s.recordatorio} />}
                      {s.requiere_ventanilla && !s.ventanilla_recibido && <span className="pill azul">ventanilla</span>}
                    </td>
                  </tr>
                );
              })}
              {filas.length === 0 && <tr><td colSpan={10} className="hint">Sin resultados.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
