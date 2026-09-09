import { useEffect, useState } from 'react';
import { api } from '../api.js';
import SelectorGrid from './SelectorGrid.jsx';

/**
 * Lista de grupos (semestre + sección) del alumno. Cada grupo se resuelve en
 * vivo contra la FCCA y se muestra como una fila compacta. `onChange` recibe el
 * arreglo completo: [{ semestre, seccion, exp:{...}|null, estado }].
 *
 * @param {Array}    semOpciones  [{clave, etiqueta}]  (7° … 1°)
 * @param {Array}    secOpciones  [{clave, etiqueta}]
 * @param {Function} numSemestre  (clave) => número
 */
export default function GruposSelector({ semOpciones, secOpciones, numSemestre, onChange }) {
  const [grupos, setGrupos] = useState([]);
  const [sem, setSem] = useState('');
  const [sec, setSec] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => { onChange(grupos); }, [grupos]); // eslint-disable-line react-hooks/exhaustive-deps

  const etiqSem = (c) => semOpciones.find((o) => o.clave === c)?.etiqueta || c;

  function quitar(i) { setGrupos((g) => g.filter((_, k) => k !== i)); }

  async function agregar() {
    if (!sem || !sec) return;
    if (grupos.some((g) => g.semestre === sem && g.seccion === sec)) {
      setErr('Ese grupo ya está en la lista.'); return;
    }
    setErr('');
    const g = { semestre: sem, seccion: sec, exp: null, estado: 'cargando' };
    setGrupos((prev) => [...prev, g]);
    setSem(''); setSec('');
    try {
      const exp = await api(`/expediente?semestre=${numSemestre(sem)}&seccion=${encodeURIComponent(sec)}`);
      setGrupos((prev) => prev.map((x) =>
        x.semestre === sem && x.seccion === sec ? { ...x, exp, estado: 'listo' } : x));
    } catch (e) {
      setGrupos((prev) => prev.map((x) =>
        x.semestre === sem && x.seccion === sec ? { ...x, exp: { encontrado: false }, estado: 'listo' } : x));
    }
  }

  return (
    <div className="grupos">
      <div className="grupos-add">
        <div className="grupos-add-f">
          <label>Semestre</label>
          <SelectorGrid label="Elige el semestre" unico columnas={5}
            opciones={semOpciones} value={sem ? [sem] : []}
            onChange={(v) => setSem(v[0] || '')} placeholder="Semestre" />
        </div>
        <div className="grupos-add-f">
          <label>Sección</label>
          <SelectorGrid label="Elige la sección" unico columnas={7}
            opciones={secOpciones} value={sec ? [sec] : []}
            onChange={(v) => setSec(v[0] || '')} placeholder="Sección" />
        </div>
        <button type="button" className="btn sec grupos-add-btn" disabled={!sem || !sec} onClick={agregar}>
          + Agregar
        </button>
      </div>
      {err && <p className="hint" style={{ color: 'var(--mal)' }}>{err}</p>}

      {grupos.length === 0 ? (
        <p className="hint">Agrega el o los grupos en los que estás inscrito.</p>
      ) : (
        <div className="grupos-list">
          {grupos.map((g, i) => {
            const e = g.exp;
            const datos = g.estado === 'cargando'
              ? 'Consultando expediente…'
              : e?.encontrado
                ? [e.licenciatura_nombre, e.turno_nombre, e.salon, e.modalidad_nombre].filter(Boolean).join(' · ')
                : 'Expediente no disponible — la Secretaría lo verificará';
            return (
              <div className={`grupo-row${e && !e.encontrado ? ' sin' : ''}`} key={`${g.semestre}-${g.seccion}`}>
                <span className="grupo-id">
                  {numSemestre(g.semestre)}° · Secc {g.seccion}
                  {i === 0 && <span className="grupo-tag">Principal</span>}
                </span>
                <span className="grupo-datos">{datos}</span>
                <button type="button" className="grupo-x" aria-label="Quitar grupo" onClick={() => quitar(i)}>×</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
