import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import SelectorGrid from '../../components/SelectorGrid.jsx';
import RangoCalendario from '../../components/RangoCalendario.jsx';

const ORD_NUM = {
  primero: 1, segundo: 2, tercero: 3, cuarto: 4, quinto: 5,
  sexto: 6, septimo: 7, 'séptimo': 7, octavo: 8, noveno: 9,
};
const numSemestre = (c, e) => ORD_NUM[c] ?? ORD_NUM[e] ?? Number(c) ?? c;
const fmtFecha = (s) => (s ? s.split('-').reverse().join('/') : '—');

function diasNaturales(a, b) {
  if (!a || !b) return 0;
  return Math.round((new Date(b) - new Date(a)) / 86400000) + 1;
}

export default function NuevaSolicitud() {
  const { alumno, setAlumnoToken } = useAuth();
  const nav = useNavigate();
  const [cat, setCat] = useState(null);
  const [f, setF] = useState({
    nombre: '', tipo: '', origen: '',
    semestres: [], secciones: [], rango: { inicio: null, fin: null }, contexto_extra: '',
  });
  const [exp, setExp] = useState(null); // expediente resuelto
  const [archivos, setArchivos] = useState({});
  const [consentimiento, setConsentimiento] = useState(false);
  const [err, setErr] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState(null);

  useEffect(() => { api('/catalogos').then(setCat).catch((e) => setErr(e.message)); }, []);

  const semPrimario = f.semestres[0];
  const secPrimaria = f.secciones[0];
  useEffect(() => {
    if (!semPrimario || !secPrimaria) { setExp(null); return; }
    const n = numSemestre(semPrimario);
    api(`/expediente?semestre=${encodeURIComponent(n)}&seccion=${encodeURIComponent(secPrimaria)}`)
      .then(setExp).catch(() => setExp({ encontrado: false }));
  }, [semPrimario, secPrimaria]);

  if (err && !cat) return <div className="wrap"><div className="aviso error">{err}</div></div>;
  if (!cat) return <div className="wrap"><p>Cargando…</p></div>;

  const matricula = (alumno?.email || '').split('@')[0].toUpperCase();
  const esCaso = f.tipo === 'caso_especial';
  const esMedico = f.tipo === 'medico';
  const origenObj = cat.motivo.origenes.find((o) => o.clave === f.origen);

  const adjNecesarios = esCaso
    ? cat.motivo.caso_especial_adjuntos
    : (esMedico && origenObj ? origenObj.adjuntos : []);

  const ETIQUETA_ADJ = {
    receta: 'Receta / Constancia (Obligatorio)',
    ticket: 'Ticket de Compra / Pago (Obligatorio para privada)',
    documento_medico: 'Documento del médico tratante con firma autógrafa (Obligatorio)',
  };

  const totalDias = diasNaturales(f.rango.inicio, f.rango.fin);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const semOpciones = cat.semestres.map((s) => {
    const n = numSemestre(s.clave, s.etiqueta);
    return { clave: s.clave, etiqueta: `${n}°` };
  });
  const secOpciones = cat.secciones.filter((s) => s.clave !== 'otro');

  async function enviar(e) {
    e.preventDefault();
    setErr('');
    if (!f.tipo) { setErr('Selecciona el tipo de justificante.'); return; }
    if (esMedico && !f.origen) { setErr('Selecciona el origen de atención.'); return; }
    if (!f.semestres.length || !f.secciones.length) { setErr('Elige semestre y sección.'); return; }
    if (!f.rango.inicio || !f.rango.fin) { setErr('Selecciona el rango de fechas (inicio y fin).'); return; }
    if (!consentimiento) { setErr('Debes aceptar el Aviso de Privacidad.'); return; }
    for (const a of adjNecesarios) {
      if (!archivos[a]) { setErr(`Falta adjuntar: ${ETIQUETA_ADJ[a] || a}`); return; }
    }
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append('nombre', f.nombre);
      fd.append('tipo', f.tipo);
      if (esMedico) fd.append('origen', f.origen);
      fd.append('semestres', JSON.stringify(f.semestres));
      fd.append('secciones', JSON.stringify(f.secciones));
      fd.append('fecha_inicio', f.rango.inicio);
      fd.append('fecha_fin', f.rango.fin);
      if (f.contexto_extra) fd.append('contexto_extra', f.contexto_extra);
      for (const a of adjNecesarios) fd.append(a, archivos[a]);
      const r = await api('/solicitudes', { tipo: 'alumno', body: fd });
      setHecho(r);
    } catch (e2) {
      if (e2.status === 401) { setAlumnoToken(null); nav('/solicitar/acceso'); return; }
      setErr(e2.message);
    } finally {
      setEnviando(false);
    }
  }

  if (hecho) {
    return (
      <div className="wrap" style={{ maxWidth: 560 }}>
        <h1>Solicitud enviada</h1>
        <div className="aviso exito">Tu solicitud quedó registrada. Recibirás un acuse por correo.</div>
        <div className="card">
          <p><Link to={`/solicitud/${hecho.token_seguimiento}`}>Ver estado de mi solicitud</Link></p>
          {hecho.banderas?.length > 0 && (
            <p className="hint">La Secretaría revisará algunos puntos: {hecho.banderas.join(', ')}.</p>
          )}
        </div>
        <Link className="btn sec" to="/mis-solicitudes">Mis solicitudes</Link>
      </div>
    );
  }

  const cardExp = (rot, val) => (
    <div className="exp-card"><div className="exp-rot">{rot}</div><div className="exp-val">{val || '—'}</div></div>
  );

  return (
    <div className="wrap-ancho form-just">
      <div className="fila fila-sep" style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Solicitud de Justificante</h1>
        <button className="plano mini" onClick={() => { setAlumnoToken(null); nav('/'); }}>Salir</button>
      </div>
      {err && <div className="aviso error">{err}</div>}

      <form onSubmit={enviar}>
        {/* ---------- FECHAS ---------- */}
        <section className="sec-panel">
          <div className="sec-head-row">
            <span className="sec-head">FECHAS A JUSTIFICAR</span>
            {cat.reglamento_url && (
              <a className="sec-link" href={cat.reglamento_url} target="_blank" rel="noreferrer">
                📄 Reglamento Oficial de Justificantes (UMSNH)
              </a>
            )}
          </div>
          <p className="hint">
            Solo se pueden justificar {cat.reglas.dias_maximos} días y dentro de {cat.reglas.dias_limite_solicitud} días
            hábiles desde tu reincorporación (no aplica a caso especial).
          </p>
          <div className="fechas-grid">
            <RangoCalendario value={f.rango} onChange={(v) => set('rango', v)} feriados={cat.feriados || []} />
            <div className="fechas-cards">
              <div className="fc"><div className="fc-rot">FECHA DE INICIO</div><div className="fc-val">{fmtFecha(f.rango.inicio)}</div></div>
              <div className="fc"><div className="fc-rot">FECHA DE FIN</div><div className="fc-val">{fmtFecha(f.rango.fin)}</div></div>
              <div className="fc fc-total"><div className="fc-rot">TOTAL DÍAS A JUSTIFICAR</div><div className="fc-val">{totalDias} día(s)</div></div>
            </div>
          </div>
        </section>

        {/* ---------- EXPEDIENTE ---------- */}
        <section className="sec-panel">
          <span className="sec-head">EXPEDIENTE ACADÉMICO DEL ALUMNO</span>

          <label style={{ marginTop: 12 }}>Nombre completo</label>
          <input type="text" required value={f.nombre} onChange={(e) => set('nombre', e.target.value)} />

          <div className="grid2" style={{ marginTop: 12 }}>
            <div>
              <label>Semestre</label>
              <SelectorGrid
                label="Selecciona el/los semestre(s)" opciones={semOpciones}
                value={f.semestres} onChange={(v) => set('semestres', v)} columnas={5}
                placeholder="Elegir semestre" resumen={(a) => a.join('  ')}
              />
            </div>
            <div>
              <label>Sección</label>
              <SelectorGrid
                label="Selecciona la(s) sección(es)" opciones={secOpciones}
                value={f.secciones} onChange={(v) => set('secciones', v)} columnas={7}
                placeholder="Elegir sección"
                resumen={(a) => (a.length > 5 ? `${a.length} secciones` : a.join(', '))}
              />
            </div>
          </div>

          <div className="exp-cards">
            {cardExp('LICENCIATURA', exp?.encontrado ? exp.licenciatura_nombre : (semPrimario && secPrimaria ? 'No disponible' : '—'))}
            {cardExp('TURNO', exp?.encontrado ? exp.turno_nombre : '—')}
            {cardExp('SALÓN', exp?.encontrado ? exp.salon : '—')}
            {cardExp('MODALIDAD', exp?.encontrado ? exp.modalidad_nombre : '—')}
            {cardExp('PERIODO', exp?.encontrado ? exp.periodo : '—')}
          </div>
          <div className="exp-cards">
            {cardExp('MATRÍCULA', matricula)}
            {cardExp('CORREO INSTITUCIONAL', alumno?.email)}
          </div>
          {semPrimario && secPrimaria && exp && !exp.encontrado && (
            <p className="hint">No hay datos cargados para ese grupo; la Secretaría lo verificará.</p>
          )}
        </section>

        {/* ---------- MOTIVO Y COMPROBANTES ---------- */}
        <section className="sec-panel">
          <span className="sec-head">MOTIVO Y COMPROBANTES</span>

          <label style={{ marginTop: 12 }}>Tipo de Justificante</label>
          <select value={f.tipo} onChange={(e) => set('tipo', e.target.value)}>
            <option value="">— Selecciona —</option>
            {cat.motivo.tipos.map((t) => <option key={t.clave} value={t.clave}>{t.etiqueta}</option>)}
          </select>

          {esMedico && (
            <>
              <label>Origen de Atención</label>
              <select value={f.origen} onChange={(e) => set('origen', e.target.value)}>
                <option value="">— Selecciona —</option>
                {cat.motivo.origenes.map((o) => <option key={o.clave} value={o.clave}>{o.etiqueta}</option>)}
              </select>
            </>
          )}

          {esCaso && (
            <>
              <label>Contexto (caso especial)</label>
              <textarea value={f.contexto_extra} onChange={(e) => set('contexto_extra', e.target.value)}
                placeholder="Describe la situación. Es posible que debas entregar el documento original en ventanilla." />
            </>
          )}

          {adjNecesarios.map((a) => (
            <div key={a}>
              <label>{ETIQUETA_ADJ[a] || a}</label>
              <input type="file" accept="image/*,application/pdf"
                onChange={(e) => setArchivos((s) => ({ ...s, [a]: e.target.files[0] }))} />
            </div>
          ))}

          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 16, fontWeight: 400 }}>
            <input type="checkbox" style={{ width: 'auto', marginTop: 3 }}
              checked={consentimiento} onChange={(e) => setConsentimiento(e.target.checked)} />
            <span>
              {cat.textos?.aviso_corto || 'Autorizo el tratamiento de mis datos personales, incluidos datos de salud.'}
              {' '}<Link to="/aviso-de-privacidad" target="_blank">Ver Aviso de Privacidad</Link>.
            </span>
          </label>
        </section>

        <button className="btn-enviar" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Enviar Solicitud de Justificante'}
        </button>
      </form>
    </div>
  );
}
