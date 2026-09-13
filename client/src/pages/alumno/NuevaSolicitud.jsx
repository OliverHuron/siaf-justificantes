import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import RangoCalendario from '../../components/RangoCalendario.jsx';
import { CLAVE_GRUPO } from './Login.jsx';

const ORD_NUM = {
  primero: 1, segundo: 2, tercero: 3, cuarto: 4, quinto: 5,
  sexto: 6, septimo: 7, 'séptimo': 7, octavo: 8, noveno: 9,
};
const numSemestre = (c, e) => ORD_NUM[c] ?? ORD_NUM[e] ?? Number(c) ?? c;
const ORD_TEXTO = {
  1: 'Primer semestre', 2: 'Segundo semestre', 3: 'Tercer semestre', 4: 'Cuarto semestre',
  5: 'Quinto semestre', 6: 'Sexto semestre', 7: 'Séptimo semestre', 8: 'Octavo semestre', 9: 'Noveno semestre',
};
const semestreTexto = (n) => ORD_TEXTO[n] || `${n}° semestre`;
const fmtFecha = (s) => (s ? s.split('-').reverse().join('/') : 'sin definir');

const p2 = (n) => String(n).padStart(2, '0');
const isoLocal = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

/** Cuenta días hábiles (según `dias` ISO 1–7) en [inicio, fin], sin feriados. */
function contarHabiles(inicio, fin, feriados, dias) {
  if (!inicio || !fin) return 0;
  const fer = new Set(feriados || []);
  const permit = new Set(dias);
  const cur = new Date(`${inicio}T00:00:00`);
  const end = new Date(`${fin}T00:00:00`);
  let n = 0;
  while (cur <= end) {
    const g = cur.getDay();
    const isoDow = g === 0 ? 7 : g;
    if (permit.has(isoDow) && !fer.has(isoLocal(cur))) n += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return n;
}

const ETIQUETA_ADJ = {
  receta: 'Receta / Constancia (Obligatorio)',
  ticket: 'Ticket de Compra / Pago (Obligatorio para privada)',
  documento_medico: 'Documento del médico tratante con firma autógrafa (Obligatorio)',
};
const ETIQUETA_ADJ_CORTA = {
  receta: 'Receta / constancia',
  ticket: 'Ticket de pago',
  documento_medico: 'Documento del médico',
};

export default function NuevaSolicitud() {
  const { alumno, setAlumnoToken } = useAuth();
  const nav = useNavigate();
  const [cat, setCat] = useState(null);
  const [f, setF] = useState({
    nombre: '', tipo: '', origen: '',
    rango: { inicio: null, fin: null }, contexto_extra: '',
  });
  const [archivos, setArchivos] = useState({});
  const [consentimiento, setConsentimiento] = useState(false);
  const [err, setErr] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState(null);

  const grupo = useMemo(() => {
    try {
      const g = JSON.parse(localStorage.getItem(CLAVE_GRUPO) || 'null');
      if (g && g.semestre && g.seccion) return g;
    } catch { /* nada */ }
    return null;
  }, []);

  const [exp, setExp] = useState(null);
  const [expCargando, setExpCargando] = useState(true);

  useEffect(() => { api('/catalogos').then(setCat).catch((e) => setErr(e.message)); }, []);

  useEffect(() => {
    if (!grupo) { setExpCargando(false); return undefined; }
    let vivo = true;
    setExpCargando(true);
    api(`/expediente?semestre=${encodeURIComponent(grupo.num || grupo.semestre)}&seccion=${encodeURIComponent(grupo.seccion)}`)
      .then((e) => { if (vivo) setExp(e); })
      .catch(() => { if (vivo) setExp({ encontrado: false }); })
      .finally(() => { if (vivo) setExpCargando(false); });
    return () => { vivo = false; };
  }, [grupo]);

  if (!grupo) {
    return (
      <div className="wrap" style={{ maxWidth: 520 }}>
        <div className="aviso error">
          No tenemos registrado tu semestre y sección.{' '}
          <Link to="/solicitar/acceso" onClick={() => setAlumnoToken(null)}>Vuelve a ingresar</Link>{' '}
          para elegirlos.
        </div>
      </div>
    );
  }
  if (err && !cat) return <div className="wrap"><div className="aviso error">{err}</div></div>;
  if (!cat) return <div className="wrap"><p>Cargando…</p></div>;

  const matricula = (alumno?.email || '').split('@')[0].toUpperCase();
  const nSem = grupo.num || numSemestre(grupo.semestre);
  const esCaso = f.tipo === 'caso_especial';
  const esMedico = f.tipo === 'medico';
  const origenObj = cat.motivo.origenes.find((o) => o.clave === f.origen);

  const adjNecesarios = esCaso
    ? cat.motivo.caso_especial_adjuntos
    : (esMedico && origenObj ? origenObj.adjuntos : []);

  const modalidad = String(exp?.modalidad || '').toUpperCase();
  const modalidadLista = !expCargando;
  const esAbierta = modalidad && modalidad !== 'ESC';
  const diasSemana = esAbierta ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];

  const totalDias = contarHabiles(f.rango.inicio, f.rango.fin, cat.feriados || [], diasSemana);
  const fechasListas = !!(f.rango.inicio && f.rango.fin);
  const topeDias = cat.reglas.dias_maximos || 15;
  const excede = !esCaso && totalDias > topeDias;

  const motivoTxt = esCaso
    ? 'Caso especial'
    : (esMedico && origenObj ? `Médico · ${origenObj.etiqueta.split(' (')[0]}` : (esMedico ? 'Médico' : null));

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  async function enviar(e) {
    e.preventDefault();
    setErr('');
    const fallo = (m) => { setErr(m); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    if (!f.rango.inicio || !f.rango.fin) { fallo('Selecciona al menos un día a justificar.'); return; }
    if (!f.nombre.trim()) { fallo('Escribe tu nombre completo.'); return; }
    if (!f.tipo) { fallo('Selecciona el tipo de justificante.'); return; }
    if (esMedico && !f.origen) { fallo('Selecciona el origen de atención.'); return; }
    if (excede) { fallo(`Solo puedes justificar hasta ${topeDias} días hábiles (elegiste ${totalDias}).`); return; }
    if (!consentimiento) { fallo('Debes aceptar el Aviso de Privacidad.'); return; }
    for (const a of adjNecesarios) {
      if (!archivos[a]) { fallo(`Falta adjuntar: ${ETIQUETA_ADJ[a] || a}`); return; }
    }
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append('nombre', f.nombre);
      fd.append('tipo', f.tipo);
      if (esMedico) fd.append('origen', f.origen);
      fd.append('grupos', JSON.stringify([{ semestre: grupo.semestre, seccion: grupo.seccion }]));
      fd.append('fecha_inicio', f.rango.inicio);
      fd.append('fecha_fin', f.rango.fin);
      if (f.contexto_extra) fd.append('contexto_extra', f.contexto_extra);
      for (const a of adjNecesarios) fd.append(a, archivos[a]);
      const r = await api('/solicitudes', { tipo: 'alumno', body: fd });
      setHecho(r);
    } catch (e2) {
      if (e2.status === 401) { setAlumnoToken(null); nav('/solicitar/acceso'); return; }
      setErr(e2.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setEnviando(false);
    }
  }

  if (hecho) {
    return (
      <div className="wrap" style={{ maxWidth: 560 }}>
        <h1>Solicitud enviada</h1>
        <div className="aviso exito">
          Tu solicitud quedó registrada. Recibirás un acuse en tu correo institucional y,
          si la Secretaría necesita algo más, te contactará por ese medio.
        </div>
        <Link className="btn sec" to="/">Volver al inicio</Link>
      </div>
    );
  }

  return (
    <>
      <header className="just-topbar">
        <div className="just-topbar-in">
          <img src="/fcca_vec.png" alt="FCCA" />
          <span className="tb-title">Solicitud de Justificante</span>
          <div className="tb-right">
            <span className="tb-mail">{alumno?.email}</span>
            <button type="button" className="plano mini" onClick={() => { setAlumnoToken(null); nav('/'); }}>Salir</button>
          </div>
        </div>
      </header>

      <div className="just-wrap">
        {err && <div className="aviso error">{err}</div>}

        <form onSubmit={enviar} className="just-grid">
          {/* ---------- columna izquierda: pasos ---------- */}
          <div className="just-col">
            <section className="paso">
              <div className="paso-head">
                <span className="paso-num">1</span>
                <h2>Fechas a justificar</h2>
                {cat.reglamento_url && (
                  <a className="sec-link" href={cat.reglamento_url} target="_blank" rel="noreferrer">
                    Reglamento (UMSNH)
                  </a>
                )}
              </div>

              {!modalidadLista ? (
                <p>Cargando la modalidad de tu grupo…</p>
              ) : (
                <div className="fechas-grid">
                  <RangoCalendario value={f.rango} onChange={(v) => set('rango', v)}
                    feriados={cat.feriados || []} diasSemana={diasSemana} />
                  <div className="fechas-info">
                    <p className="hint" style={{ margin: 0 }}>
                      Grupo <b>{nSem}° · Secc {grupo.seccion}</b>.{' '}
                      {esAbierta
                        ? 'Modalidad abierta: se cuentan de lunes a sábado (sin días inhábiles).'
                        : 'Modalidad escolarizada: se cuentan de lunes a viernes (sin sábados ni días inhábiles).'}
                    </p>
                    <p className="hint" style={{ margin: 0 }}>
                      Puedes justificar hasta <b>{topeDias} días hábiles</b> y solo dentro de{' '}
                      <b>{cat.reglas.dias_limite_solicitud} días hábiles</b> desde tu reincorporación
                      (no aplica a caso especial).
                    </p>
                    <div className="fechas-linea">
                      <span>Inicio <b>{fmtFecha(f.rango.inicio)}</b></span>
                      <span className="sep">·</span>
                      <span>Fin <b>{fmtFecha(f.rango.fin)}</b></span>
                      {fechasListas && (
                        <span className={`chip-dias${excede ? ' mal' : ''}`}>{totalDias} día(s) hábiles</span>
                      )}
                    </div>
                    {excede && (
                      <p className="hint" style={{ margin: 0, color: 'var(--mal)' }}>
                        Excede el máximo de {topeDias} días hábiles por solicitud.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </section>

            {!fechasListas ? (
              <section className="paso mudo">
                <p>Elige al menos un día para continuar con tus datos y el motivo.</p>
              </section>
            ) : (
              <>
                <section className="paso">
                  <div className="paso-head">
                    <span className="paso-num">2</span>
                    <h2>Datos del alumno</h2>
                  </div>
                  <label>Nombre completo</label>
                  <input type="text" required value={f.nombre}
                    onChange={(e) => set('nombre', e.target.value)}
                    placeholder="Como aparece en tu credencial" />
                  <p className="hint">Tu matrícula, correo y grupo se toman de tu acceso (ver Resumen).</p>
                </section>

                <section className="paso">
                  <div className="paso-head">
                    <span className="paso-num">3</span>
                    <h2>Motivo y comprobantes</h2>
                  </div>

                  <label>Tipo de Justificante</label>
                  <select value={f.tipo} onChange={(e) => set('tipo', e.target.value)}>
                    <option value="">Selecciona una opción</option>
                    {cat.motivo.tipos.map((t) => <option key={t.clave} value={t.clave}>{t.etiqueta}</option>)}
                  </select>

                  {esMedico && (
                    <>
                      <label>Origen de Atención</label>
                      <select value={f.origen} onChange={(e) => set('origen', e.target.value)}>
                        <option value="">Selecciona una opción</option>
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
              </>
            )}
          </div>

          {/* ---------- columna derecha: resumen fijo ---------- */}
          <aside className="just-resumen">
            <h2>Resumen</h2>

            <div className="res-blk">
              <div className="res-k">Grupo</div>
              <div className="res-v">{semestreTexto(nSem)}</div>
              <div className="res-v">Sección {grupo.seccion}</div>
              {expCargando ? (
                <div className="res-v mudo">Consultando expediente…</div>
              ) : exp?.encontrado ? (
                <span className="al-meta-badges">
                  {(exp.licenciatura_nombre || exp.licenciatura) && (
                    <span className="mbadge mb-lic">{exp.licenciatura_nombre || exp.licenciatura}</span>
                  )}
                  {exp.turno_nombre && exp.turno !== exp.modalidad && (
                    <span className="mbadge mb-turno">{exp.turno_nombre}</span>
                  )}
                  {exp.salon && <span className="mbadge mb-salon">{exp.salon}</span>}
                  {exp.modalidad_nombre && <span className="mbadge mb-mod">{exp.modalidad_nombre}</span>}
                </span>
              ) : (
                <div className="res-v mudo">La Secretaría verificará el expediente.</div>
              )}
            </div>

            <div className="res-blk">
              <div className="res-k">Alumno</div>
              <div className="res-v">
                {f.nombre.trim() || <span className="mudo">Falta tu nombre</span>}
              </div>
              <div className="res-line"><span>Matrícula</span><span>{matricula}</span></div>
              <div className="res-line"><span>Correo</span><span>{alumno?.email}</span></div>
            </div>

            <div className="res-blk">
              <div className="res-k">Fechas</div>
              {fechasListas ? (
                <>
                  <div className="res-line"><span>Inicio</span><span>{fmtFecha(f.rango.inicio)}</span></div>
                  <div className="res-line"><span>Fin</span><span>{fmtFecha(f.rango.fin)}</span></div>
                  <div className="res-line">
                    <span>Días hábiles</span>
                    <span style={{ color: excede ? 'var(--mal)' : undefined }}>{totalDias}</span>
                  </div>
                </>
              ) : (
                <div className="res-v mudo">Elige al menos un día</div>
              )}
            </div>

            <div className="res-blk">
              <div className="res-k">Motivo</div>
              {motivoTxt ? <div className="res-v">{motivoTxt}</div> : <div className="res-v mudo">Sin seleccionar</div>}
              {adjNecesarios.map((a) => (
                <div key={a} className={`res-check${archivos[a] ? ' ok' : ''}`}>
                  <i>{archivos[a] ? '✓' : ''}</i>{ETIQUETA_ADJ_CORTA[a] || a}
                </div>
              ))}
              <div className={`res-check${consentimiento ? ' ok' : ''}`}>
                <i>{consentimiento ? '✓' : ''}</i>Aviso de privacidad
              </div>
            </div>

            {err && <div className="aviso error">{err}</div>}

            <button className="btn-enviar" disabled={enviando || !fechasListas}>
              {enviando ? 'Enviando…' : 'Enviar solicitud'}
            </button>
          </aside>
        </form>
      </div>
    </>
  );
}
