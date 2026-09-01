import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, apiBlob } from '../api.js';

const PILL = {
  pendiente: 'alerta', aprobada: 'ok', rechazada: 'mal',
  requiere_ventanilla: 'azul', cancelada: 'neutro',
};

export default function Seguimiento() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [enviando, setEnviando] = useState(false);

  function cargar() {
    api(`/seguimiento/${token}`).then(setData).catch((e) => setErr(e.message));
  }
  useEffect(cargar, [token]);

  async function enviar(e) {
    e.preventDefault();
    if (!msg.trim()) return;
    setEnviando(true);
    try {
      await api(`/seguimiento/${token}/mensajes`, { body: { cuerpo: msg } });
      setMsg('');
      cargar();
    } catch (e2) { setErr(e2.message); } finally { setEnviando(false); }
  }

  if (err) return <div className="wrap"><div className="aviso error">{err}</div><Link to="/">← Inicio</Link></div>;
  if (!data) return <div className="wrap"><p>Cargando…</p></div>;

  const s = data.solicitud;
  return (
    <div className="wrap" style={{ maxWidth: 640 }}>
      <h1>Seguimiento de solicitud</h1>
      <div className="card">
        <div className="fila fila-sep">
          <strong>{s.tipo_etiqueta}</strong>
          <span className={`pill ${PILL[s.estado] || 'neutro'}`}>{s.estado}</span>
        </div>
        <p style={{ margin: '10px 0 0' }}>
          {s.nombre} · matrícula {s.matricula}<br />
          Semestre(s): {s.semestres?.join(', ')} · Sección(es): {s.secciones?.join(', ')}<br />
          Días: <span className="mono">{s.fechas?.join(', ')}</span>
        </p>
        {s.folio && (
          <div className="aviso exito" style={{ marginTop: 12 }}>
            Folio emitido: <strong>{s.folio}</strong>{s.anulado ? ' (ANULADO)' : ''}. Se notificó a tus profesores.
            {!s.anulado && (
              <div style={{ marginTop: 8 }}>
                <button className="sec mini" onClick={async () => {
                  try {
                    const u = await apiBlob(`/seguimiento/${token}/pdf`);
                    window.open(u, '_blank');
                  } catch (e2) { setErr(e2.message); }
                }}>Ver / descargar oficio (PDF)</button>
              </div>
            )}
          </div>
        )}
        {s.estado === 'rechazada' && s.motivo_rechazo && (
          <p className="aviso error" style={{ marginTop: 12 }}>Motivo: {s.motivo_rechazo}</p>
        )}
        {s.estado === 'requiere_ventanilla' && (
          <p className="aviso info" style={{ marginTop: 12 }}>
            Debes presentarte en ventanilla de la Secretaría Académica{s.ventanilla_recibido ? ' (documento recibido)' : ''}.
          </p>
        )}
      </div>

      <div className="card">
        <h2>Mensajes con la Secretaría</h2>
        <div className="hilo">
          {data.mensajes.length === 0 && <p className="hint">Sin mensajes.</p>}
          {data.mensajes.map((m, i) => (
            <div key={i} className={`msg ${m.autor === 'staff' ? 'staff' : 'alumno'}`}>
              <div className="quien">{m.autor === 'staff' ? 'Secretaría' : 'Tú'} · {new Date(m.creado_en).toLocaleString()}</div>
              {m.cuerpo}
            </div>
          ))}
        </div>
        <form onSubmit={enviar}>
          <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Escribe un mensaje…" />
          <div style={{ marginTop: 8 }}>
            <button disabled={enviando || !msg.trim()}>{enviando ? 'Enviando…' : 'Enviar'}</button>
          </div>
        </form>
      </div>

      <Link to="/">← Inicio</Link>
    </div>
  );
}
