import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api.js';

const PILL = {
  pendiente: 'alerta', aprobada: 'ok', rechazada: 'mal',
  requiere_ventanilla: 'azul', cancelada: 'neutro',
};

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
      <h1>Bandeja de solicitudes</h1>
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
              <tr><th>Fecha</th><th>Alumno</th><th>Tipo</th><th>Sem/Sec</th><th>Días</th><th>Estado</th><th>Señales</th></tr>
            </thead>
            <tbody>
              {filas.map((s) => (
                <tr key={s.id} className="clic" onClick={() => nav(`/staff/solicitud/${s.id}`)}
                  style={s.color ? { boxShadow: `inset 4px 0 0 ${s.color}` } : undefined}>
                  <td>{new Date(s.creado_en).toLocaleDateString()}</td>
                  <td>{s.nombre_declarado}<br /><span className="hint mono">{s.matricula_declarada}</span></td>
                  <td><span className="pill neutro">{s.tipo_etiqueta}</span></td>
                  <td className="mono">{(s.semestres || []).join(',')} / {(s.secciones || []).join(',')}</td>
                  <td className="mono">{(s.fechas || []).join(', ')}</td>
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
              ))}
              {filas.length === 0 && <tr><td colSpan={7} className="hint">Sin resultados.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
