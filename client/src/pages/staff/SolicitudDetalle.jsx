import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, apiBlob } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import Adjunto from '../../components/Adjunto.jsx';

const PILL = {
  pendiente: 'alerta', aprobada: 'ok', rechazada: 'mal',
  requiere_ventanilla: 'azul', cancelada: 'neutro',
};

export default function SolicitudDetalle() {
  const { id } = useParams();
  const nav = useNavigate();
  const { staff } = useAuth();
  const puedeActuar = ['encargada', 'supervisor'].includes(staff.rol);

  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [plCorreo, setPlCorreo] = useState([]);
  const [plCuerpo, setPlCuerpo] = useState([]);

  // formularios de decisión
  const [profes, setProfes] = useState([]);
  const [nuevoProf, setNuevoProf] = useState({ materia: '', profesor_nombre: '', profesor_correo: '' });
  const [aprob, setAprob] = useState({ plantilla_cuerpo_id: '', frase_cuerpo: '', dias_texto_oficio: '', fechas_verificadas_receta: false });
  const [rech, setRech] = useState({ plantilla_clave: '', motivo: '' });
  const [vent, setVent] = useState({ plantilla_clave: 'pasar_ventanilla', nota: '' });
  const [msg, setMsg] = useState({ plantilla_clave: '', cuerpo: '' });
  const [triage, setTriage] = useState({ estado_triage: '', color: '', recordatorio: '' });
  const [busy, setBusy] = useState(false);

  const cargar = useCallback(() => {
    api(`/revision/${id}`).then((data) => {
      setD(data);
      setProfes(data.profesores || []);
      setTriage({
        estado_triage: data.solicitud.estado_triage || 'nueva',
        color: data.solicitud.color || '',
        recordatorio: data.solicitud.recordatorio || '',
      });
      setAprob((a) => ({ ...a, dias_texto_oficio: data.solicitud.dias_texto_oficio || '' }));
    }).catch((e) => setErr(e.message));
  }, [id]);

  useEffect(cargar, [cargar]);
  useEffect(() => {
    api('/plantillas?ambito=correo&activo=true').then(setPlCorreo).catch(() => {});
    api('/plantillas?ambito=cuerpo_oficio&activo=true').then(setPlCuerpo).catch(() => {});
  }, []);

  async function accion(fn) {
    setErr(''); setOk(''); setBusy(true);
    try { await fn(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  if (err && !d) return <div><div className="aviso error">{err}</div><Link to="/staff/bandeja">← Bandeja</Link></div>;
  if (!d) return <p>Cargando…</p>;
  const s = d.solicitud;
  const editable = s.estado === 'pendiente' && puedeActuar;

  return (
    <div className="wrap-ancho" style={{ maxWidth: 980 }}>
      <div className="fila fila-sep">
        <h1>{s.nombre_declarado} <span className="hint mono">{s.matricula_declarada}</span></h1>
        <Link to="/staff/bandeja">← Bandeja</Link>
      </div>
      <div className="fila" style={{ marginBottom: 12 }}>
        <span className={`pill ${PILL[s.estado] || 'neutro'}`}>{s.estado}</span>
        <span className="pill neutro">{s.tipo_etiqueta}</span>
        {Object.keys(s.banderas || {}).map((b) => <span key={b} className="pill mal">{b}</span>)}
      </div>

      {err && <div className="aviso error">{err}</div>}
      {ok && <div className="aviso exito">{ok}</div>}

      <div className="grid2">
        <div>
          <div className="card">
            <h2>Datos</h2>
            <table>
              <tbody>
                <tr><th>Matrícula</th><td className="mono">{s.matricula_declarada}</td></tr>
                <tr><th>Semestre(s)</th><td>{s.semestres?.join(', ')}</td></tr>
                <tr><th>Sección(es)</th><td>{s.secciones?.join(', ')}</td></tr>
                {(s.licenciatura || s.turno || s.salon || s.modalidad) && (
                  <tr><th>Expediente</th><td>
                    {[s.licenciatura, s.turno, s.salon, s.modalidad].filter(Boolean).join(' · ')}
                    {s.periodo ? ` (${s.periodo})` : ''}
                  </td></tr>
                )}
                {s.fecha_inicio && s.fecha_fin && (
                  <tr><th>Rango</th><td className="mono">{s.fecha_inicio} → {s.fecha_fin}</td></tr>
                )}
                <tr><th>Días hábiles</th><td className="mono">{s.fechas?.join(', ')}</td></tr>
                <tr><th>Origen atención</th><td>{s.origen_atencion || '—'}</td></tr>
                <tr><th>Enviada</th><td>{new Date(s.creado_en).toLocaleString()}</td></tr>
                {s.contexto_extra && <tr><th>Contexto</th><td>{s.contexto_extra}</td></tr>}
                {s.folio && <tr><th>Folio</th><td className="mono">{s.folio}</td></tr>}
              </tbody>
            </table>
            {Object.keys(s.banderas || {}).length > 0 && (
              <pre style={{ fontSize: '.78rem', background: 'var(--gris-suave)', padding: 8, borderRadius: 6, overflowX: 'auto' }}>
                {JSON.stringify(s.banderas, null, 1)}
              </pre>
            )}
          </div>

          <div className="card">
            <h2>Evidencia</h2>
            {d.adjuntos.length === 0 && <p className="hint">Sin adjuntos.</p>}
            {d.adjuntos.map((a) => (
              <Adjunto key={a.id} url={a.url} mime={a.mime} nombre={`${a.tipo} — ${a.nombre_original}`} />
            ))}
          </div>

          {d.historial_matricula.length > 0 && (
            <div className="card">
              <h2>Historial de la matrícula</h2>
              <table>
                <tbody>
                  {d.historial_matricula.map((h) => (
                    <tr key={h.id}>
                      <td>{new Date(h.creado_en).toLocaleDateString()}</td>
                      <td>{h.tipo}</td>
                      <td className="mono">{(h.fechas || []).join(', ')}</td>
                      <td><span className={`pill ${PILL[h.estado] || 'neutro'}`}>{h.estado}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          {puedeActuar && (
            <div className="card">
              <h2>Triage</h2>
              <div className="fila">
                <select value={triage.estado_triage} style={{ width: 'auto' }}
                  onChange={(e) => setTriage((t) => ({ ...t, estado_triage: e.target.value }))}>
                  <option value="nueva">nueva</option>
                  <option value="en_revision">en revisión</option>
                  <option value="atendida">atendida</option>
                  <option value="espera_alumno">espera alumno</option>
                </select>
                <input type="color" value={triage.color || '#ffffff'} style={{ width: 44, padding: 2 }}
                  onChange={(e) => setTriage((t) => ({ ...t, color: e.target.value }))} />
              </div>
              <label>Recordatorio</label>
              <input type="text" value={triage.recordatorio}
                onChange={(e) => setTriage((t) => ({ ...t, recordatorio: e.target.value }))}
                placeholder="p. ej. pasar a ventanilla" />
              <div style={{ marginTop: 8 }}>
                <button className="sec mini" disabled={busy} onClick={() => accion(async () => {
                  await api(`/revision/${id}/triage`, { method: 'PATCH', body: triage });
                  setOk('Triage guardado'); cargar();
                })}>Guardar triage</button>
              </div>
            </div>
          )}

          <div className="card">
            <h2>Profesores a notificar</h2>
            {profes.length === 0 && <p className="hint">No se resolvió ningún profesor por horario. Agrega manualmente.</p>}
            {profes.map((p, i) => (
              <label key={i} style={{ fontWeight: 400, display: 'flex', gap: 8, alignItems: 'center', margin: '4px 0' }}>
                <input type="checkbox" style={{ width: 'auto' }} disabled={!editable}
                  checked={p.incluir !== false}
                  onChange={(e) => setProfes((arr) => arr.map((x, j) => j === i ? { ...x, incluir: e.target.checked } : x))} />
                <span>{p.materia} — <span className="mono">{p.profesor_correo}</span> {p.origen === 'manual' && <em>(manual)</em>}</span>
              </label>
            ))}
            {editable && (
              <>
                <div className="fila" style={{ marginTop: 8 }}>
                  <input placeholder="Materia" value={nuevoProf.materia}
                    onChange={(e) => setNuevoProf((n) => ({ ...n, materia: e.target.value }))} style={{ flex: 1 }} />
                  <input placeholder="Correo" value={nuevoProf.profesor_correo}
                    onChange={(e) => setNuevoProf((n) => ({ ...n, profesor_correo: e.target.value }))} style={{ flex: 1 }} />
                  <button className="plano mini" type="button" onClick={() => {
                    if (!nuevoProf.materia || !nuevoProf.profesor_correo) return;
                    setProfes((arr) => [...arr, { ...nuevoProf, incluir: true, origen: 'manual' }]);
                    setNuevoProf({ materia: '', profesor_nombre: '', profesor_correo: '' });
                  }}>Agregar</button>
                </div>
                <button className="sec mini" style={{ marginTop: 8 }} disabled={busy} onClick={() => accion(async () => {
                  await api(`/revision/${id}/profesores`, { method: 'PATCH', body: { items: profes } });
                  setOk('Lista de profesores guardada'); cargar();
                })}>Guardar lista</button>
              </>
            )}
          </div>

          {editable && (
            <>
              {s.tipo === 'enfermeria_fcca' && !s.enfermeria_confirmada && (
                <div className="card">
                  <button disabled={busy} onClick={() => accion(async () => {
                    await api(`/revision/${id}/enfermeria-confirmar`, { method: 'POST' });
                    setOk('Enfermería confirmada'); cargar();
                  })}>Confirmar con enfermería</button>
                </div>
              )}
              {s.requiere_ventanilla && !s.ventanilla_recibido && (
                <div className="card">
                  <button disabled={busy} onClick={() => accion(async () => {
                    await api(`/revision/${id}/ventanilla-recibido`, { method: 'POST' });
                    setOk('Documento recibido en ventanilla'); cargar();
                  })}>Marcar documento recibido</button>
                </div>
              )}

              <div className="card">
                <h2>Aprobar</h2>
                <label>Cuerpo del oficio</label>
                <select value={aprob.plantilla_cuerpo_id} style={{ width: '100%' }}
                  onChange={(e) => setAprob((a) => ({ ...a, plantilla_cuerpo_id: e.target.value }))}>
                  <option value="">— plantilla genérica —</option>
                  {plCuerpo.map((p) => <option key={p.id} value={p.id}>{p.titulo}</option>)}
                </select>
                <label>…o texto libre</label>
                <textarea value={aprob.frase_cuerpo} onChange={(e) => setAprob((a) => ({ ...a, frase_cuerpo: e.target.value }))}
                  placeholder="por motivos de salud acreditados ante esta Secretaría…" />
                <label>Texto de días en el oficio</label>
                <input type="text" value={aprob.dias_texto_oficio}
                  onChange={(e) => setAprob((a) => ({ ...a, dias_texto_oficio: e.target.value }))} />
                <label style={{ fontWeight: 400, display: 'flex', gap: 8, marginTop: 8 }}>
                  <input type="checkbox" style={{ width: 'auto' }} checked={aprob.fechas_verificadas_receta}
                    onChange={(e) => setAprob((a) => ({ ...a, fechas_verificadas_receta: e.target.checked }))} />
                  Verifiqué que las fechas coinciden con la receta
                </label>
                <div style={{ marginTop: 10 }}>
                  <button disabled={busy} onClick={() => accion(async () => {
                    const r = await api(`/revision/${id}/aprobar`, {
                      body: {
                        plantilla_cuerpo_id: aprob.plantilla_cuerpo_id || undefined,
                        frase_cuerpo: aprob.frase_cuerpo || undefined,
                        dias_texto_oficio: aprob.dias_texto_oficio || undefined,
                        fechas_verificadas_receta: aprob.fechas_verificadas_receta,
                      },
                    });
                    setOk(`Aprobada. Folio ${r.folio}. Notificados ${r.profesores_notificados}/${r.profesores_total}.`);
                    cargar();
                  })}>Aprobar y emitir folio</button>
                </div>
              </div>

              <div className="card">
                <h2>Rechazar</h2>
                <select value={rech.plantilla_clave} style={{ width: '100%' }}
                  onChange={(e) => setRech((r) => ({ ...r, plantilla_clave: e.target.value }))}>
                  <option value="">— sin plantilla —</option>
                  {plCorreo.map((p) => <option key={p.id} value={p.clave}>{p.titulo}</option>)}
                </select>
                <textarea value={rech.motivo} onChange={(e) => setRech((r) => ({ ...r, motivo: e.target.value }))}
                  placeholder="Motivo del rechazo (se envía al alumno)" />
                <button className="peligro" disabled={busy} onClick={() => accion(async () => {
                  await api(`/revision/${id}/rechazar`, { body: { plantilla_clave: rech.plantilla_clave || undefined, motivo: rech.motivo || undefined } });
                  setOk('Solicitud rechazada'); cargar();
                })}>Rechazar</button>
              </div>

              <div className="card">
                <h2>Requiere ventanilla</h2>
                <textarea value={vent.nota} onChange={(e) => setVent((v) => ({ ...v, nota: e.target.value }))}
                  placeholder="Instrucciones para el alumno" />
                <button className="sec" disabled={busy} onClick={() => accion(async () => {
                  await api(`/revision/${id}/ventanilla`, { body: { plantilla_clave: vent.plantilla_clave, nota: vent.nota || undefined } });
                  setOk('Marcada: requiere ventanilla'); cargar();
                })}>Enviar a ventanilla</button>
              </div>
            </>
          )}

          {s.estado === 'aprobada' && (
            <div className="card">
              <h2>Oficio</h2>
              <button className="sec" onClick={async () => {
                try {
                  const u = await apiBlob(`/revision/${id}/pdf`, 'staff');
                  window.open(u, '_blank');
                } catch (e) { setErr(e.message); }
              }}>Ver / descargar PDF</button>
            </div>
          )}

          <div className="card">
            <h2>Mensajes con el alumno</h2>
            <div className="hilo">
              {d.hilo.length === 0 && <p className="hint">Sin mensajes.</p>}
              {d.hilo.map((m, i) => (
                <div key={i} className={`msg ${m.autor === 'staff' ? 'staff' : 'alumno'}`}>
                  <div className="quien">{m.autor === 'staff' ? 'Secretaría' : 'Alumno'} · {new Date(m.creado_en).toLocaleString()}</div>
                  {m.cuerpo}
                </div>
              ))}
            </div>
            {puedeActuar && (
              <>
                <select value={msg.plantilla_clave} style={{ width: '100%' }}
                  onChange={(e) => setMsg((m) => ({ ...m, plantilla_clave: e.target.value }))}>
                  <option value="">— mensaje libre —</option>
                  {plCorreo.map((p) => <option key={p.id} value={p.clave}>{p.titulo}</option>)}
                </select>
                <textarea value={msg.cuerpo} onChange={(e) => setMsg((m) => ({ ...m, cuerpo: e.target.value }))}
                  placeholder="Mensaje (o nota para la plantilla)" />
                <button className="sec mini" disabled={busy} onClick={() => accion(async () => {
                  await api(`/revision/${id}/mensajes`, { body: { plantilla_clave: msg.plantilla_clave || undefined, cuerpo: msg.cuerpo || undefined } });
                  setMsg({ plantilla_clave: '', cuerpo: '' }); setOk('Mensaje enviado'); cargar();
                })}>Enviar mensaje</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
