import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, apiBlob } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import Adjunto from '../../components/Adjunto.jsx';
import DiasAprobados from '../../components/DiasAprobados.jsx';

const PILL = {
  pendiente: 'alerta', aprobada: 'ok', rechazada: 'mal',
  requiere_ventanilla: 'azul', cancelada: 'neutro',
};
const ORD_SEM = {
  primero: '1°', segundo: '2°', tercero: '3°', cuarto: '4°', quinto: '5°',
  sexto: '6°', septimo: '7°', 'séptimo': '7°', octavo: '8°', noveno: '9°',
};
const semLabel = (v) => ORD_SEM[String(v).toLowerCase()] || (/^\d+$/.test(String(v)) ? `${v}°` : v);
const fFecha = (s) => {
  const d = String(s || '').slice(0, 10).split('-');
  return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : (s || '—');
};

// Portal público para verificar recetas / incapacidades de instituciones públicas.
const URL_RECETA_PUBLICA = 'https://serviciosdigitales.imss.gob.mx/portal-ciudadano/incapacidades';

function adjLabel(tipo, esImss) {
  if (tipo === 'receta') return esImss ? 'Receta IMSS' : 'Receta / Constancia';
  if (tipo === 'ticket') return 'Ticket de compra';
  if (tipo === 'documento_medico') return 'Documento médico';
  return tipo;
}

export default function ExpedienteModal() {
  const { id } = useParams();
  const nav = useNavigate();
  const { staff } = useAuth();
  const puedeActuar = ['encargada', 'supervisor'].includes(staff.rol);

  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [plCuerpo, setPlCuerpo] = useState([]);
  const [plCorreo, setPlCorreo] = useState([]);

  const [adjSel, setAdjSel] = useState(0);
  const [diasAprob, setDiasAprob] = useState([]);
  const [aprob, setAprob] = useState({ plantilla_cuerpo_id: '', frase_cuerpo: '', fechas_verificadas_receta: false });
  const [rech, setRech] = useState({ abierto: false, plantilla_clave: '', motivo: '' });
  const [vent, setVent] = useState({ abierto: false, plantilla_clave: 'pasar_ventanilla', nota: '' });
  const [nota, setNota] = useState({ color: '', recordatorio: '' });

  const cerrar = useCallback(() => nav('/staff/bandeja'), [nav]);

  const cargar = useCallback(() => {
    api(`/revision/${id}`).then((data) => {
      setD(data);
      const s = data.solicitud;
      setDiasAprob(
        Array.isArray(s.fechas_aprobadas) && s.fechas_aprobadas.length
          ? s.fechas_aprobadas.map((x) => String(x).slice(0, 10))
          : (s.fechas || []).map((x) => String(x).slice(0, 10))
      );
      setNota({ color: s.color || '', recordatorio: s.recordatorio || '' });
    }).catch((e) => setErr(e.message));
  }, [id]);

  useEffect(cargar, [cargar]);
  useEffect(() => {
    api('/plantillas?ambito=cuerpo_oficio&activo=true').then(setPlCuerpo).catch(() => {});
    api('/plantillas?ambito=correo&activo=true').then(setPlCorreo).catch(() => {});
  }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') cerrar(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [cerrar]);

  const s = d?.solicitud;
  const esImss = s?.tipo === 'receta_imss';
  const editable = s && s.estado === 'pendiente' && puedeActuar;
  const grupos = useMemo(() => (Array.isArray(s?.grupos) ? s.grupos : []), [s]);

  async function accion(fn) {
    setErr(''); setOk(''); setBusy(true);
    try { await fn(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  async function verOficio() {
    setErr('');
    try {
      const q = new URLSearchParams({ dias: diasAprob.join(',') });
      if (aprob.plantilla_cuerpo_id) q.set('plantilla_cuerpo_id', aprob.plantilla_cuerpo_id);
      if (aprob.frase_cuerpo) q.set('frase_cuerpo', aprob.frase_cuerpo);
      const u = await apiBlob(`/revision/${id}/oficio-preview?${q}`, 'staff');
      window.open(u, '_blank', 'noopener');
    } catch (e) { setErr(e.message); }
  }

  return (
    <div className="modal-ovl" onClick={cerrar}>
      <div className="modal-exp" onClick={(e) => e.stopPropagation()}>
        <div className="modal-exp-head">
          <h2>Expediente de Solicitud — Folio: {s?.folio || (s ? `#${s.id}` : '…')}</h2>
          <button className="modal-exp-x" aria-label="Cerrar" onClick={cerrar}>×</button>
        </div>

        {!d ? (
          <div className="modal-exp-body" style={{ display: 'block' }}>
            {err ? <div className="aviso error">{err}</div> : <p>Cargando…</p>}
          </div>
        ) : (
          <>
            <div className="modal-exp-body">
              {/* ---------- Comprobantes ---------- */}
              <div className="exp-col">
                <div className="exp-block">
                  <span className="pill-head">Comprobantes adjuntos</span>
                  <div style={{ marginTop: 12 }} />
                  {esImss && (
                    <div className="exp-valida">
                      <span>📋 Validación oficial</span>
                      <a href={URL_RECETA_PUBLICA} target="_blank" rel="noreferrer">
                        Consultar receta médica pública ↗
                      </a>
                    </div>
                  )}
                  {d.adjuntos.length === 0 ? (
                    <p className="hint">Sin comprobantes adjuntos.</p>
                  ) : (
                    <>
                      <div className="exp-adj-tabs">
                        {d.adjuntos.map((a, i) => (
                          <button key={a.id} type="button"
                            className={`exp-adj-tab${i === adjSel ? ' on' : ''}`}
                            onClick={() => setAdjSel(i)}>
                            {adjLabel(a.tipo, esImss)}
                          </button>
                        ))}
                      </div>
                      {d.adjuntos[adjSel] && (
                        <Adjunto key={d.adjuntos[adjSel].id} url={d.adjuntos[adjSel].url}
                          mime={d.adjuntos[adjSel].mime}
                          nombre={d.adjuntos[adjSel].nombre_original} />
                      )}
                    </>
                  )}
                </div>

                <details className="exp-acc">
                  <summary>Historial de la matrícula ({d.historial_matricula.length})</summary>
                  <div className="exp-acc-body">
                    {d.historial_matricula.length === 0 ? (
                      <p className="hint">Sin solicitudes previas.</p>
                    ) : (
                      <div className="tabla-scroll">
                        <table>
                          <tbody>
                            {d.historial_matricula.map((h) => (
                              <tr key={h.id}>
                                <td>{new Date(h.creado_en).toLocaleDateString()}</td>
                                <td>{h.tipo}</td>
                                <td className="mono">{(h.fechas || []).map(fFecha).join(', ')}</td>
                                <td><span className={`pill ${PILL[h.estado] || 'neutro'}`}>{h.estado}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </details>
              </div>

              {/* ---------- Detalle del alumno ---------- */}
              <div className="exp-col">
                <div className="exp-block">
                  <span className="pill-head">Detalle del alumno</span>

                  <div className="exp-cards2" style={{ marginTop: 12 }}>
                    <div className="exp-card"><div className="exp-mini-label">Alumno</div><div className="exp-val">{s.nombre_declarado}</div></div>
                    <div className="exp-card"><div className="exp-mini-label">Matrícula</div><div className="exp-val">{s.matricula_declarada}</div></div>
                    <div className="exp-card"><div className="exp-mini-label">Correo institucional</div><div className="exp-val">{s.email_alumno}</div></div>
                    {grupos.map((g, i) => (
                      <div className="exp-card" key={i}>
                        <div className="exp-mini-label">Grupo</div>
                        <div className="exp-val">
                          {semLabel(g.semestre)} · Secc {g.seccion}
                          {[g.licenciatura, g.turno, g.salon, g.modalidad].filter(Boolean).length
                            ? <div className="hint">{[g.licenciatura, g.turno, g.salon, g.modalidad].filter(Boolean).join(' · ')}</div>
                            : null}
                        </div>
                      </div>
                    ))}
                    {grupos.length === 0 && (
                      <div className="exp-card">
                        <div className="exp-mini-label">Sem / Secc</div>
                        <div className="exp-val">{(s.semestres || []).map(semLabel).join(', ')} / {(s.secciones || []).join(', ')}</div>
                      </div>
                    )}
                  </div>

                  <h3>Periodo solicitado por el alumno</h3>
                  <div className="exp-cards2">
                    <div className="exp-card"><div className="exp-mini-label">Inicio</div><div className="exp-val">{fFecha(s.fecha_inicio || (s.fechas || [])[0])}</div></div>
                    <div className="exp-card"><div className="exp-mini-label">Fin</div><div className="exp-val">{fFecha(s.fecha_fin || (s.fechas || [])[(s.fechas || []).length - 1])}</div></div>
                    <div className="exp-card"><div className="exp-mini-label">Días pedidos</div><div className="exp-val">{(s.fechas || []).length}</div></div>
                  </div>

                  <h3>Motivo / detalle</h3>
                  <p style={{ margin: 0 }}>
                    <span className="pill neutro">{s.tipo_etiqueta}</span>
                    {s.origen_atencion ? <span className="hint"> · {s.origen_atencion}</span> : null}
                  </p>
                  {s.contexto_extra && <p style={{ marginTop: 6 }}>{s.contexto_extra}</p>}
                  {Object.keys(s.banderas || {}).length > 0 && (
                    <p style={{ marginTop: 8 }}>
                      {Object.keys(s.banderas).map((b) => <span key={b} className="pill mal" style={{ marginRight: 4 }}>{b}</span>)}
                    </p>
                  )}
                </div>

                <div className="exp-block">
                  <h3 style={{ marginTop: 0 }}>Gestión y selección de días aprobados</h3>
                  <p className="hint" style={{ marginTop: 0 }}>
                    Que el alumno pida un día o rango no obliga a aprobarlo: marca solo los días que proceden.
                  </p>
                  <DiasAprobados pedidos={(s.fechas || []).map((x) => String(x).slice(0, 10))}
                    value={diasAprob} onChange={setDiasAprob} />
                  <div className="dias-aprob-card" style={{ marginTop: 12 }}>
                    <div className="exp-mini-label">Días aprobados por administrador</div>
                    <div className="n">{diasAprob.length} día(s)</div>
                    {diasAprob.length > 0 && (
                      <div className="hint mono">{diasAprob.map(fFecha).join(', ')}</div>
                    )}
                  </div>
                </div>

                {s.estado === 'aprobada' && (
                  <div className="exp-block">
                    <h3 style={{ marginTop: 0 }}>Oficio emitido</h3>
                    <button className="sec" onClick={() => accion(async () => {
                      const u = await apiBlob(`/revision/${id}/pdf`, 'staff');
                      window.open(u, '_blank');
                    })}>Ver / descargar PDF</button>
                  </div>
                )}

                {editable && (
                  <div className="exp-block">
                    <h3 style={{ marginTop: 0 }}>Dictamen de la solicitud</h3>

                    <label>Plantilla del oficio</label>
                    <select value={aprob.plantilla_cuerpo_id}
                      onChange={(e) => setAprob((a) => ({ ...a, plantilla_cuerpo_id: e.target.value }))}>
                      <option value="">— genérica —</option>
                      {plCuerpo.map((p) => <option key={p.id} value={p.id}>{p.titulo}</option>)}
                    </select>
                    <label>…o texto libre para el oficio</label>
                    <textarea value={aprob.frase_cuerpo}
                      onChange={(e) => setAprob((a) => ({ ...a, frase_cuerpo: e.target.value }))}
                      placeholder="por motivos de salud acreditados ante esta Secretaría…" />
                    <label style={{ fontWeight: 400, display: 'flex', gap: 8, marginTop: 8 }}>
                      <input type="checkbox" style={{ width: 'auto' }} checked={aprob.fechas_verificadas_receta}
                        onChange={(e) => setAprob((a) => ({ ...a, fechas_verificadas_receta: e.target.checked }))} />
                      Verifiqué que las fechas coinciden con la receta / comprobante
                    </label>

                    <div style={{ margin: '10px 0' }}>
                      <button type="button" className="plano mini" onClick={verOficio}>Vista previa del oficio ↗</button>
                    </div>

                    <div className="dictamen-btns">
                      <button className="btn-aprobar" disabled={busy || diasAprob.length === 0}
                        onClick={() => accion(async () => {
                          const r = await api(`/revision/${id}/aprobar`, {
                            body: {
                              plantilla_cuerpo_id: aprob.plantilla_cuerpo_id || undefined,
                              frase_cuerpo: aprob.frase_cuerpo || undefined,
                              fechas_aprobadas: diasAprob,
                              fechas_verificadas_receta: aprob.fechas_verificadas_receta,
                            },
                          });
                          setOk(`Aprobada con ${diasAprob.length} día(s). Folio ${r.folio}. Notificados ${r.profesores_notificados}/${r.profesores_total}.`);
                          cargar();
                        })}>Aprobar</button>
                      <button className="btn-rechazar" disabled={busy}
                        onClick={() => setRech((r) => ({ ...r, abierto: !r.abierto }))}>Rechazar</button>
                      <button className="btn-ventanilla" disabled={busy}
                        onClick={() => setVent((v) => ({ ...v, abierto: !v.abierto }))}>Requerir presencialmente</button>
                    </div>

                    {rech.abierto && (
                      <div style={{ marginTop: 12 }}>
                        <label>Plantilla de rechazo</label>
                        <select value={rech.plantilla_clave}
                          onChange={(e) => setRech((r) => ({ ...r, plantilla_clave: e.target.value }))}>
                          <option value="">— sin plantilla —</option>
                          {plCorreo.map((p) => <option key={p.id} value={p.clave}>{p.titulo}</option>)}
                        </select>
                        <textarea value={rech.motivo} onChange={(e) => setRech((r) => ({ ...r, motivo: e.target.value }))}
                          placeholder="Motivo del rechazo (se envía al alumno por correo)" />
                        <button className="btn-rechazar" style={{ marginTop: 6 }} disabled={busy}
                          onClick={() => accion(async () => {
                            await api(`/revision/${id}/rechazar`, { body: { plantilla_clave: rech.plantilla_clave || undefined, motivo: rech.motivo || undefined } });
                            setOk('Solicitud rechazada'); cargar();
                          })}>Confirmar rechazo</button>
                      </div>
                    )}

                    {vent.abierto && (
                      <div style={{ marginTop: 12 }}>
                        <label>Plantilla / instrucciones</label>
                        <select value={vent.plantilla_clave}
                          onChange={(e) => setVent((v) => ({ ...v, plantilla_clave: e.target.value }))}>
                          {plCorreo.map((p) => <option key={p.id} value={p.clave}>{p.titulo}</option>)}
                          <option value="pasar_ventanilla">pasar_ventanilla (predeterminada)</option>
                        </select>
                        <textarea value={vent.nota} onChange={(e) => setVent((v) => ({ ...v, nota: e.target.value }))}
                          placeholder="Qué debe llevar el alumno a ventanilla" />
                        <button className="btn-ventanilla" style={{ marginTop: 6 }} disabled={busy}
                          onClick={() => accion(async () => {
                            await api(`/revision/${id}/ventanilla`, { body: { plantilla_clave: vent.plantilla_clave || undefined, nota: vent.nota || undefined } });
                            setOk('Marcada: requiere ventanilla'); cargar();
                          })}>Confirmar</button>
                      </div>
                    )}
                  </div>
                )}

                {puedeActuar && (
                  <details className="exp-acc">
                    <summary>Nota interna y color</summary>
                    <div className="exp-acc-body">
                      <div className="fila" style={{ alignItems: 'center' }}>
                        <input type="color" value={nota.color || '#ffffff'} style={{ width: 44, padding: 2 }}
                          onChange={(e) => setNota((n) => ({ ...n, color: e.target.value }))} />
                        <input type="text" value={nota.recordatorio} style={{ flex: 1 }}
                          onChange={(e) => setNota((n) => ({ ...n, recordatorio: e.target.value }))}
                          placeholder="p. ej. revisar receta con dirección" />
                      </div>
                      <button className="sec mini" style={{ marginTop: 8 }} disabled={busy}
                        onClick={() => accion(async () => {
                          await api(`/revision/${id}/triage`, { method: 'PATCH', body: { color: nota.color || null, recordatorio: nota.recordatorio || '' } });
                          setOk('Nota guardada'); cargar();
                        })}>Guardar nota</button>
                    </div>
                  </details>
                )}

                {err && <div className="aviso error">{err}</div>}
                {ok && <div className="aviso exito">{ok}</div>}
              </div>
            </div>

            <div className="modal-exp-foot">
              <button className="plano" onClick={cerrar}>Cerrar expediente</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
