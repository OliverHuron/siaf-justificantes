import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import Chips from '../../components/Chips.jsx';
import Calendario from '../../components/Calendario.jsx';

export default function EnfermeriaPanel() {
  const { staff, logoutStaff } = useAuth();
  const nav = useNavigate();
  const [cat, setCat] = useState(null);
  const [hist, setHist] = useState([]);
  const [f, setF] = useState({ nombre: '', matricula: '', email_alumno: '', semestres: [], secciones: [], fechas: [], contexto_extra: '' });
  const [archivo, setArchivo] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  function cargarHist() { api('/enfermeria/solicitudes').then(setHist).catch(() => {}); }
  useEffect(() => {
    api('/catalogos').then(setCat).catch((e) => setErr(e.message));
    cargarHist();
  }, []);

  function set(k, v) { setF((s) => ({ ...s, [k]: v })); }

  async function enviar(e) {
    e.preventDefault();
    setErr(''); setOk('');
    if (!archivo) { setErr('Adjunta la constancia de enfermería.'); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(f).forEach(([k, v]) => fd.append(k, Array.isArray(v) ? JSON.stringify(v) : v));
      fd.append('constancia', archivo);
      const r = await api('/enfermeria/solicitudes', { tipo: 'staff', body: fd });
      setOk(`Ficha registrada. Seguimiento: ${window.location.origin}/solicitud/${r.token_seguimiento}`);
      setF({ nombre: '', matricula: '', email_alumno: '', semestres: [], secciones: [], fechas: [], contexto_extra: '' });
      setArchivo(null);
      cargarHist();
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  if (!cat) return <div className="wrap"><p>Cargando…</p></div>;

  return (
    <>
      <div className="topbar">
        <div className="marca"><img src="/umsnh_logo.png" alt="UMSNH" /> Panel de Enfermería FCCA</div>
        <button onClick={() => { logoutStaff(); nav('/'); }}>Salir</button>
      </div>
      <div className="wrap" style={{ maxWidth: 640 }}>
      <p className="sub">{staff.nombre} · genera justificantes por atención en enfermería.</p>

      {err && <div className="aviso error">{err}</div>}
      {ok && <div className="aviso exito">{ok}</div>}

      <form className="card" onSubmit={enviar}>
        <h2>Nueva ficha</h2>
        <label>Nombre del alumno</label>
        <input required value={f.nombre} onChange={(e) => set('nombre', e.target.value)} />
        <div className="grid2">
          <div><label>Matrícula</label><input required value={f.matricula} onChange={(e) => set('matricula', e.target.value.trim())} /></div>
          <div><label>Correo del alumno</label><input required type="email" value={f.email_alumno} onChange={(e) => set('email_alumno', e.target.value.trim())} placeholder="matricula@umich.mx" /></div>
        </div>
        <label>Semestre(s)</label>
        <Chips opciones={cat.semestres} value={f.semestres} onChange={(v) => set('semestres', v)} />
        <label>Sección(es)</label>
        <Chips opciones={cat.secciones} value={f.secciones} onChange={(v) => set('secciones', v)} />
        <label>Día(s)</label>
        <Calendario value={f.fechas} onChange={(v) => set('fechas', v)} feriados={cat.feriados || []} permitirFuturo />
        <label>Observaciones</label>
        <textarea value={f.contexto_extra} onChange={(e) => set('contexto_extra', e.target.value)} />
        <label>Constancia de enfermería</label>
        <input type="file" accept="image/*,application/pdf" onChange={(e) => setArchivo(e.target.files[0])} />
        <div style={{ marginTop: 14 }}>
          <button disabled={busy || !f.fechas.length}>{busy ? 'Enviando…' : 'Registrar ficha'}</button>
        </div>
        <p className="hint">La ficha pasa a la Secretaría Académica para su confirmación y emisión del folio.</p>
      </form>

      <div className="card tabla-scroll">
        <h2>Fichas recientes</h2>
        <table>
          <thead><tr><th>Fecha</th><th>Alumno</th><th>Días</th><th>Estado</th><th>Folio</th></tr></thead>
          <tbody>
            {hist.map((s) => (
              <tr key={s.id}>
                <td>{new Date(s.creado_en).toLocaleDateString()}</td>
                <td>{s.nombre_declarado}<br /><span className="hint mono">{s.matricula_declarada}</span></td>
                <td className="mono">{(s.fechas || []).join(', ')}</td>
                <td><span className="pill neutro">{s.estado}</span></td>
                <td className="mono">{s.folio || '—'}</td>
              </tr>
            ))}
            {hist.length === 0 && <tr><td colSpan={5} className="hint">Sin fichas.</td></tr>}
          </tbody>
        </table>
      </div>
      </div>
    </>
  );
}
