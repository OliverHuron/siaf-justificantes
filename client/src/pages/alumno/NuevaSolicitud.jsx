import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import Chips from '../../components/Chips.jsx';
import Calendario from '../../components/Calendario.jsx';

export default function NuevaSolicitud() {
  const { alumno, setAlumnoToken } = useAuth();
  const nav = useNavigate();
  const [cat, setCat] = useState(null);
  const [f, setF] = useState({
    nombre: '', matricula: '', tipo: '', semestres: [], secciones: [], fechas: [], contexto_extra: '',
  });
  const [archivos, setArchivos] = useState({});
  const [consentimiento, setConsentimiento] = useState(false);
  const [err, setErr] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState(null);

  useEffect(() => {
    api('/catalogos').then(setCat).catch((e) => setErr(e.message));
  }, []);

  if (err && !cat) return <div className="wrap"><div className="aviso error">{err}</div></div>;
  if (!cat) return <div className="wrap"><p>Cargando…</p></div>;

  const tipoActual = cat.tipos.find((t) => t.clave === f.tipo);
  const adjNecesarios = tipoActual ? tipoActual.adjuntos : [];

  const ETIQUETA_ADJ = {
    receta: 'Receta médica',
    ticket: 'Ticket de compra de medicamentos',
    documento_medico: 'Documento del médico tratante (con firma autógrafa)',
  };

  function set(k, v) { setF((s) => ({ ...s, [k]: v })); }

  async function enviar(e) {
    e.preventDefault();
    setErr('');
    if (!consentimiento) { setErr('Debes aceptar el Aviso de Privacidad.'); return; }
    for (const a of adjNecesarios) {
      if (!archivos[a]) { setErr(`Falta adjuntar: ${ETIQUETA_ADJ[a] || a}`); return; }
    }
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append('nombre', f.nombre);
      fd.append('matricula', f.matricula);
      fd.append('tipo', f.tipo);
      fd.append('semestres', JSON.stringify(f.semestres));
      fd.append('secciones', JSON.stringify(f.secciones));
      fd.append('fechas', JSON.stringify(f.fechas));
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
        <div className="aviso exito">
          Tu solicitud quedó registrada. Recibirás un acuse por correo.
        </div>
        <div className="card">
          <p>Da seguimiento en cualquier momento:</p>
          <p><Link to={`/solicitud/${hecho.token_seguimiento}`}>Ver estado de mi solicitud</Link></p>
          {hecho.banderas?.length > 0 && (
            <p className="hint">La Secretaría revisará algunos puntos: {hecho.banderas.join(', ')}.</p>
          )}
        </div>
        <Link className="btn sec" to="/mis-solicitudes">Mis solicitudes</Link>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ maxWidth: 620 }}>
      <div className="fila fila-sep">
        <h1>Nueva solicitud de justificante</h1>
        <button className="plano mini" onClick={() => { setAlumnoToken(null); nav('/'); }}>Salir</button>
      </div>
      <p className="sub">Sesión: {alumno?.email}</p>

      {err && <div className="aviso error">{err}</div>}

      <form className="card" onSubmit={enviar}>
        <label>Nombre completo</label>
        <input type="text" required value={f.nombre} onChange={(e) => set('nombre', e.target.value)} />

        <label>Matrícula</label>
        <input type="text" required value={f.matricula}
          onChange={(e) => set('matricula', e.target.value.trim())} placeholder="1234567A" />

        <label>Tipo de justificante</label>
        <Chips
          unico
          opciones={cat.tipos.map((t) => ({ clave: t.clave, etiqueta: t.etiqueta }))}
          value={f.tipo ? [f.tipo] : []}
          onChange={(v) => set('tipo', v[0] || '')}
        />

        <label>Semestre(s)</label>
        <Chips opciones={cat.semestres} value={f.semestres} onChange={(v) => set('semestres', v)} />

        <label>Sección(es)</label>
        <Chips opciones={cat.secciones} value={f.secciones} onChange={(v) => set('secciones', v)} />

        <label>Día(s) a justificar</label>
        <p className="hint">
          Máximo {cat.reglas.dias_limite_solicitud} días hábiles después de la falta
          (no aplica a caso especial).
        </p>
        <Calendario value={f.fechas} onChange={(v) => set('fechas', v)} feriados={cat.feriados || []} />

        {f.tipo === 'caso_especial' && (
          <>
            <label>Contexto (caso especial)</label>
            <textarea value={f.contexto_extra} onChange={(e) => set('contexto_extra', e.target.value)}
              placeholder="Describe la situación. Es posible que debas entregar el documento original en ventanilla." />
          </>
        )}

        {adjNecesarios.map((a) => (
          <div key={a}>
            <label>{ETIQUETA_ADJ[a] || a}</label>
            <input
              type="file" accept="image/*,application/pdf"
              onChange={(e) => setArchivos((s) => ({ ...s, [a]: e.target.files[0] }))}
            />
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

        <div style={{ marginTop: 18 }}>
          <button disabled={enviando || !f.tipo || !f.fechas.length}>
            {enviando ? 'Enviando…' : 'Enviar solicitud'}
          </button>
        </div>
      </form>
    </div>
  );
}
