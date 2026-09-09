import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';

export default function Folios() {
  const { staff } = useAuth();
  const esSup = staff.rol === 'supervisor';
  return <ListaFolios esSup={esSup} />;
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
