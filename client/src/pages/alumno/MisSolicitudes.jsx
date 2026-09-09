import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';

const PILL = {
  pendiente: 'alerta', aprobada: 'ok', rechazada: 'mal',
  requiere_ventanilla: 'azul', cancelada: 'neutro',
};

export default function MisSolicitudes() {
  const { setAlumnoToken } = useAuth();
  const nav = useNavigate();
  const [filas, setFilas] = useState(null);
  const [err, setErr] = useState('');

  function cargar() {
    api('/solicitudes/mias', { tipo: 'alumno' })
      .then(setFilas)
      .catch((e) => {
        if (e.status === 401) { setAlumnoToken(null); nav('/solicitar/acceso'); return; }
        setErr(e.message);
      });
  }
  useEffect(cargar, []);

  async function cancelar(id) {
    if (!confirm('¿Cancelar esta solicitud pendiente?')) return;
    try {
      await api(`/solicitudes/${id}/cancelar`, { tipo: 'alumno', method: 'POST' });
      cargar();
    } catch (e) { setErr(e.message); }
  }

  return (
    <div className="wrap">
      <div className="fila fila-sep">
        <h1>Mis solicitudes</h1>
        <Link className="btn sec" to="/solicitar/acceso">Nueva solicitud</Link>
      </div>
      {err && <div className="aviso error">{err}</div>}
      {!filas ? <p>Cargando…</p> : filas.length === 0 ? (
        <div className="card">Aún no tienes solicitudes.</div>
      ) : (
        <div className="card tabla-scroll">
          <table>
            <thead>
              <tr><th>Fecha</th><th>Tipo</th><th>Días</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              {filas.map((s) => (
                <tr key={s.id}>
                  <td>{new Date(s.creado_en).toLocaleDateString()}</td>
                  <td>{s.tipo}</td>
                  <td className="mono">{(s.fechas || []).join(', ')}</td>
                  <td><span className={`pill ${PILL[s.estado] || 'neutro'}`}>{s.estado}</span></td>
                  <td className="fila">
                    <Link to={`/solicitud/${s.token_seguimiento}`}>Ver</Link>
                    {s.estado === 'pendiente' && (
                      <button className="plano mini" onClick={() => cancelar(s.id)}>Cancelar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
