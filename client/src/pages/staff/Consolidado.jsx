import { useState } from 'react';
import { api } from '../../api.js';

export default function Consolidado() {
  const [f, setF] = useState({ semestre: '', seccion: '', desde: '', hasta: '' });
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');

  async function consultar(e) {
    e.preventDefault();
    setErr('');
    const p = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => v && p.set(k, v));
    try { setRes(await api(`/consolidado?${p}`)); } catch (e2) { setErr(e2.message); }
  }

  function set(k, v) { setF((s) => ({ ...s, [k]: v })); }

  return (
    <div>
      <h1>Consolidado por sección / semestre</h1>
      <p className="sub">Lista de justificantes aprobados para repartir a coordinadores.</p>
      {err && <div className="aviso error">{err}</div>}
      <form className="card fila" onSubmit={consultar}>
        <div><label>Semestre</label><input value={f.semestre} onChange={(e) => set('semestre', e.target.value)} placeholder="primero" /></div>
        <div><label>Sección</label><input value={f.seccion} onChange={(e) => set('seccion', e.target.value)} placeholder="1" /></div>
        <div><label>Desde</label><input type="date" value={f.desde} onChange={(e) => set('desde', e.target.value)} /></div>
        <div><label>Hasta</label><input type="date" value={f.hasta} onChange={(e) => set('hasta', e.target.value)} /></div>
        <div style={{ alignSelf: 'end' }}><button>Consultar</button></div>
      </form>

      {res && (
        <div className="card tabla-scroll">
          <div className="fila fila-sep">
            <strong>{res.total} justificante(s)</strong>
            <button className="sec mini" onClick={() => window.print()}>Imprimir</button>
          </div>
          <table>
            <thead><tr><th>Folio</th><th>Alumno</th><th>Matrícula</th><th>Sem/Sec</th><th>Días</th><th>Motivo</th><th>Emitido</th></tr></thead>
            <tbody>
              {res.filas.map((r) => (
                <tr key={r.folio}>
                  <td className="mono">{r.folio}</td>
                  <td>{r.nombre_declarado}</td>
                  <td className="mono">{r.matricula_declarada}</td>
                  <td className="mono">{(r.semestres || []).join(',')}/{(r.secciones || []).join(',')}</td>
                  <td>{r.dias_texto_oficio || (r.fechas || []).join(', ')}</td>
                  <td>{r.tipo_etiqueta}</td>
                  <td>{new Date(r.emitido_en).toLocaleDateString()}</td>
                </tr>
              ))}
              {res.filas.length === 0 && <tr><td colSpan={7} className="hint">Sin resultados.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
