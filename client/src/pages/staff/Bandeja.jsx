import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiBlob } from '../../api.js';

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
  const [filtro, setFiltro] = useState({ estado: 'pendiente', texto: '', solo_marcadas: false });

  function cargar() {
    const q = new URLSearchParams();
    if (filtro.estado) q.set('estado', filtro.estado);
    if (filtro.texto) q.set('texto', filtro.texto);
    if (filtro.solo_marcadas) q.set('solo_marcadas', 'true');
    api(`/revision/cola?${q}`).then(setFilas).catch((e) => setErr(e.message));
  }
  useEffect(cargar, [filtro.estado, filtro.solo_marcadas]);

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
          <form onSubmit={(e) => { e.preventDefault(); cargar(); }} style={{ flex: 1, minWidth: 180 }}>
            <input type="search" placeholder="Nombre o matrícula…" value={filtro.texto}
              onChange={(e) => setFiltro((f) => ({ ...f, texto: e.target.value }))} />
          </form>
          <label style={{ fontWeight: 400, margin: 0, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={filtro.solo_marcadas}
              onChange={(e) => setFiltro((f) => ({ ...f, solo_marcadas: e.target.checked }))} />
            Con banderas/recordatorio
          </label>
        </div>
      </div>

      {!filas ? <p>Cargando…</p> : (
        <div className="card tabla-scroll">
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
                <th>Señales</th>
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
                    <td className="mono">{(s.fechas || []).map(fmtFecha).join(', ')}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="icono-grupo">
                        {adj.receta
                          ? <BotonAdjunto solicitudId={s.id} adjId={adj.receta} clase="receta"
                              titulo="Ver receta / constancia" />
                          : <span className="hint">—</span>}
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
                      {s.recordatorio && <span className="pill alerta">nota</span>}
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
