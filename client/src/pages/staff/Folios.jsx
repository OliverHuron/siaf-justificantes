import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';

export default function Folios() {
  const { staff } = useAuth();
  const esSup = staff.rol === 'supervisor';
  const [vista, setVista] = useState('folios');

  return (
    <div>
      <div className="fila" style={{ marginBottom: 14 }}>
        <button className={vista === 'folios' ? '' : 'plano'} onClick={() => setVista('folios')}>Folios</button>
        <button className={vista === 'alertas' ? '' : 'plano'} onClick={() => setVista('alertas')}>Alertas de reventa</button>
      </div>
      {vista === 'folios' ? <ListaFolios esSup={esSup} /> : <Alertas />}
    </div>
  );
}

function ListaFolios({ esSup }) {
  const [q, setQ] = useState('');
  const [filas, setFilas] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  function cargar() {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    api(`/folios?${p}`).then(setFilas).catch((e) => setErr(e.message));
  }
  useEffect(cargar, []);

  async function anular(f) {
    const motivo = prompt(`Motivo de anulación del folio ${f.folio}:`);
    if (!motivo) return;
    try {
      await api(`/folios/${f.id}/anular`, { body: { motivo } });
      setOk(`Folio ${f.folio} anulado`); cargar();
    } catch (e) { setErr(e.message); }
  }

  return (
    <div>
      {err && <div className="aviso error">{err}</div>}
      {ok && <div className="aviso exito">{ok}</div>}
      <div className="card">
        <form className="fila" onSubmit={(e) => { e.preventDefault(); cargar(); }}>
          <input type="search" placeholder="Folio, nombre o matrícula…" value={q}
            onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} />
          <button>Buscar</button>
        </form>
      </div>
      {!filas ? <p>Cargando…</p> : (
        <div className="card tabla-scroll">
          <table>
            <thead><tr><th>Folio</th><th>Alumno</th><th>Tipo</th><th>Emitido</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id}>
                  <td className="mono">{f.folio}</td>
                  <td>{f.nombre_declarado}<br /><span className="hint mono">{f.matricula_declarada}</span></td>
                  <td>{f.tipo_etiqueta}</td>
                  <td>{new Date(f.emitido_en).toLocaleDateString()}<br /><span className="hint">{f.emitido_por}</span></td>
                  <td>{f.anulado_en
                    ? <span className="pill mal">anulado</span>
                    : <span className="pill ok">vigente</span>}</td>
                  <td>{esSup && !f.anulado_en && <button className="peligro mini" onClick={() => anular(f)}>Anular</button>}</td>
                </tr>
              ))}
              {filas.length === 0 && <tr><td colSpan={6} className="hint">Sin folios.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Alertas() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    api('/folios/alertas').then(setData).catch((e) => setErr(e.message));
  }, []);

  return (
    <div>
      {err && <div className="aviso error">{err}</div>}
      <p className="sub">
        Folios con patrón de escaneo anómalo en los últimos {data?.dias || 90} días
        (muchas IP distintas, muchos escaneos o varios intentos con token inválido).
        No implica fraude por sí solo: revisa el contexto.
      </p>
      {!data ? <p>Cargando…</p> : data.alertas.length === 0 ? (
        <div className="card">Sin alertas.</div>
      ) : (
        <div className="card tabla-scroll">
          <table>
            <thead>
              <tr><th>Folio</th><th>Alumno</th><th>Escaneos</th><th>IP distintas</th><th>Fallidos</th><th>Último</th><th></th></tr>
            </thead>
            <tbody>
              {data.alertas.map((a) => (
                <tr key={a.folio}>
                  <td className="mono">{a.folio}</td>
                  <td>{a.nombre_declarado || 'sin nombre'}<br /><span className="hint mono">{a.matricula_declarada || ''}</span></td>
                  <td>{a.escaneos} <span className="hint">({a.escaneos_ok} ok)</span></td>
                  <td>{a.ips_distintas >= 4 ? <span className="pill mal">{a.ips_distintas}</span> : a.ips_distintas}</td>
                  <td>{a.intentos_fallidos >= 5 ? <span className="pill alerta">{a.intentos_fallidos}</span> : a.intentos_fallidos}</td>
                  <td>{new Date(a.ultimo).toLocaleString()}</td>
                  <td>{a.anulado && <span className="pill mal">anulado</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
