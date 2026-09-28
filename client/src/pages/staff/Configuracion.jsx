import { useEffect, useState } from 'react';
import { api } from '../../api.js';

const TABS = ['SMTP', 'Plantillas', 'Profesores', 'Parámetros', 'Adjuntos', 'Google Sheets'];

// Categorías de plantillas de correo: definen en qué dropdown del expediente
// aparece cada una (Rechazar / Requerir presencialmente), para no revolverlas.
const CATEGORIAS = {
  aprobado: 'Aprobado',
  rechazo: 'Rechazo',
  ventanilla: 'Ventanilla',
  informacion: 'Solicitud de información',
};

export default function Configuracion() {
  const [tab, setTab] = useState('SMTP');
  return (
    <div>
      <div className="fila" style={{ marginBottom: 16 }}>
        {TABS.map((t) => (
          <button key={t} className={t === tab ? '' : 'plano'} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {tab === 'SMTP' && <Smtp />}
      {tab === 'Plantillas' && <Plantillas />}
      {tab === 'Profesores' && <Profesores />}
      {tab === 'Parámetros' && <Parametros />}
      {tab === 'Adjuntos' && <AdjuntosLimpieza />}
      {tab === 'Google Sheets' && <SheetsConfig />}
    </div>
  );
}

function Aviso({ err, ok }) {
  return <>
    {err && <div className="aviso error">{err}</div>}
    {ok && <div className="aviso exito">{ok}</div>}
  </>;
}

function Smtp() {
  const [v, setV] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  useEffect(() => { api('/config/smtp').then((r) => setV(r.valor)).catch((e) => setErr(e.message)); }, []);
  if (!v) return <p>Cargando…</p>;
  async function guardar() {
    setErr(''); setOk('');
    try {
      await api('/config/smtp', { method: 'PUT', body: { valor: v } });
      setOk('Guardado'); setV((s) => ({ ...s, pass: '' }));
    } catch (e) { setErr(e.message); }
  }
  async function probar() {
    setErr(''); setOk('');
    try {
      const body = { host: v.host, port: v.port, user: v.user, from: v.from };
      if (v.pass) body.pass = v.pass;
      const r = await api('/config/smtp/test', { method: 'POST', body });
      setOk(`OK: ${r.user}@${r.host}`);
    } catch (e) { setErr(e.message); }
  }
  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <Aviso err={err} ok={ok} />
      <label>Host</label><input type="text" value={v.host || ''} onChange={(e) => setV({ ...v, host: e.target.value })} />
      <label>Puerto</label><input type="number" value={v.port || ''} onChange={(e) => setV({ ...v, port: Number(e.target.value) })} />
      <label>Usuario</label><input type="text" value={v.user || ''} onChange={(e) => setV({ ...v, user: e.target.value })} />
      <label>Contraseña (App Password){v.pass_configurada ? ' (ya configurada)' : ''}</label>
      <input type="password" value={v.pass || ''} placeholder={v.pass_configurada ? '••••••••' : ''}
        onChange={(e) => setV({ ...v, pass: e.target.value })} />
      <label>Remitente</label><input type="text" value={v.from || ''} onChange={(e) => setV({ ...v, from: e.target.value })} />
      <div className="fila" style={{ marginTop: 12 }}>
        <button onClick={guardar}>Guardar</button>
        <button className="sec" onClick={probar}>Probar conexión</button>
      </div>
    </div>
  );
}

function PlantillaCard({ p, onGuardar, onEliminar }) {
  const [f, setF] = useState({
    titulo: p.titulo, asunto: p.asunto || '', cuerpo: p.cuerpo,
    activo: p.activo, categoria: p.categoria || '',
  });
  const [abierta, setAbierta] = useState(false);
  const sucio = f.titulo !== p.titulo || f.asunto !== (p.asunto || '') || f.cuerpo !== p.cuerpo
    || f.activo !== p.activo || f.categoria !== (p.categoria || '');
  const esOficio = p.ambito === 'cuerpo_oficio';

  return (
    <div className="tpl-card">
      <div className="tpl-card-head">
        <span className={`pill ${p.ambito === 'correo' ? 'azul' : 'neutro'}`}>{p.ambito}</span>
        {p.categoria && <span className="pill neutro">{CATEGORIAS[p.categoria] || p.categoria}</span>}
        <span className={`pill ${f.activo ? 'ok' : 'neutro'}`}>{f.activo ? 'Activa' : 'Inactiva'}</span>
      </div>
      <div className="mono hint" style={{ margin: '6px 0 2px' }}>{p.clave}</div>
      {!abierta ? (
        <>
          <div className="tpl-card-titulo">{f.titulo}</div>
          {p.ambito === 'correo' && f.asunto && <div className="tpl-card-preview">{f.asunto}</div>}
          <div className="tpl-card-preview">{f.cuerpo}</div>
          <div className="fila" style={{ marginTop: 10 }}>
            <button className="plano mini" onClick={() => setAbierta(true)}>Editar</button>
            <button className="plano mini" onClick={() => onGuardar(p.id, { ...f, activo: !f.activo })}>
              {f.activo ? 'Desactivar' : 'Activar'}
            </button>
            <button className="plano mini" style={{ borderColor: 'var(--mal)', color: 'var(--mal)' }}
              onClick={() => onEliminar(p)}>Eliminar</button>
          </div>
        </>
      ) : (
        <>
          <label>Título</label>
          <input type="text" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} />
          {p.ambito === 'correo' && <>
            <label>Asunto</label>
            <input type="text" value={f.asunto} onChange={(e) => setF({ ...f, asunto: e.target.value })} />
            <label>Categoría</label>
            <select value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>
              <option value="">Sin categoría</option>
              {Object.entries(CATEGORIAS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </>}
          <label>Cuerpo{esOficio ? ' (máx. 167 caracteres)' : ''}</label>
          <textarea value={f.cuerpo} maxLength={esOficio ? 167 : undefined}
            onChange={(e) => setF({ ...f, cuerpo: esOficio ? e.target.value.slice(0, 167) : e.target.value })}
            style={{ minHeight: 140 }} />
          {esOficio && <p className="hint" style={{ textAlign: 'right', margin: '2px 0 0' }}>{f.cuerpo.length}/167</p>}
          <div className="fila" style={{ marginTop: 10 }}>
            <button className="mini" disabled={!sucio} onClick={() => onGuardar(p.id, f)}>Guardar</button>
            <button className="plano mini" onClick={() => setAbierta(false)}>Cerrar</button>
          </div>
        </>
      )}
    </div>
  );
}

function Plantillas() {
  const [lista, setLista] = useState([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nueva, setNueva] = useState({ ambito: 'correo', clave: '', titulo: '', asunto: '', cuerpo: '', categoria: '' });
  function cargar() { api('/plantillas').then(setLista).catch((e) => setErr(e.message)); }
  useEffect(cargar, []);

  async function guardar(id, f) {
    setErr(''); setOk('');
    try {
      await api(`/plantillas/${id}`, { method: 'PATCH', body: f });
      setOk('Plantilla guardada'); cargar();
    } catch (e) { setErr(e.message); }
  }
  async function eliminar(p) {
    if (!confirm(`¿Eliminar la plantilla "${p.titulo}"? Esta acción no se puede deshacer.`)) return;
    setErr(''); setOk('');
    try { await api(`/plantillas/${p.id}`, { method: 'DELETE' }); setOk('Plantilla eliminada'); cargar(); }
    catch (e) { setErr(e.message); }
  }
  async function crear() {
    setErr(''); setOk('');
    try {
      const body = { ...nueva };
      if (body.ambito !== 'correo') delete body.categoria;
      await api('/plantillas', { body });
      setNueva({ ambito: 'correo', clave: '', titulo: '', asunto: '', cuerpo: '', categoria: '' });
      setMostrarForm(false);
      setOk('Creada'); cargar();
    } catch (e) { setErr(e.message); }
  }
  const nuevaValida = nueva.clave.trim() && nueva.titulo.trim() && nueva.cuerpo.trim();
  const nuevaEsOficio = nueva.ambito === 'cuerpo_oficio';

  return (
    <div>
      <Aviso err={err} ok={ok} />
      <div className="fila fila-sep" style={{ marginBottom: 14 }}>
        <h3 style={{ margin: 0 }}>Plantillas</h3>
        <button className="mini" onClick={() => setMostrarForm((v) => !v)}>
          {mostrarForm ? 'Cancelar' : '+ Nueva plantilla'}
        </button>
      </div>
      {mostrarForm && (
        <div className="card">
          <div className="form-grid">
            <select value={nueva.ambito} onChange={(e) => setNueva({ ...nueva, ambito: e.target.value })}>
              <option value="correo">correo</option>
              <option value="cuerpo_oficio">cuerpo_oficio</option>
            </select>
            <input type="text" placeholder="clave" value={nueva.clave} onChange={(e) => setNueva({ ...nueva, clave: e.target.value })} />
            <input type="text" placeholder="título" value={nueva.titulo} onChange={(e) => setNueva({ ...nueva, titulo: e.target.value })} />
          </div>
          {nueva.ambito === 'correo' && (
            <div className="form-grid" style={{ marginTop: 10 }}>
              <input type="text" placeholder="asunto" value={nueva.asunto}
                onChange={(e) => setNueva({ ...nueva, asunto: e.target.value })} />
              <select value={nueva.categoria} onChange={(e) => setNueva({ ...nueva, categoria: e.target.value })}>
                <option value="">Sin categoría</option>
                {Object.entries(CATEGORIAS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </div>
          )}
          <textarea placeholder="cuerpo" value={nueva.cuerpo} maxLength={nuevaEsOficio ? 167 : undefined}
            onChange={(e) => setNueva({ ...nueva, cuerpo: nuevaEsOficio ? e.target.value.slice(0, 167) : e.target.value })}
            style={{ marginTop: 10 }} />
          {nuevaEsOficio && <p className="hint" style={{ textAlign: 'right', margin: '2px 0 0' }}>{nueva.cuerpo.length}/167</p>}
          <button className="mini" style={{ marginTop: 10 }} disabled={!nuevaValida} onClick={crear}>Crear</button>
        </div>
      )}
      <div className="tpl-grid">
        {lista.map((p) => <PlantillaCard key={p.id} p={p} onGuardar={guardar} onEliminar={eliminar} />)}
        {lista.length === 0 && <p className="hint">Sin plantillas.</p>}
      </div>
    </div>
  );
}

const PLANTILLA_PROFESORES_CSV =
  'ProfAsigNombre,ProfAsigApePate,ProfAsigApeMate,Correo,Materia,Sem,Secc\n' +
  'JUAN,PEREZ,LOPEZ,juan.perez@ejemplo.com,CONTABILIDAD I,1,45\n';

function descargarPlantillaProfesores() {
  const blob = new Blob([PLANTILLA_PROFESORES_CSV], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla_profesores.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function Profesores() {
  const [lista, setLista] = useState([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [n, setN] = useState({ sem: '', secc: '', materia: '', nombre: '', correo: '' });
  const [archivoNombre, setArchivoNombre] = useState('');
  function cargar() { api('/profesores').then(setLista).catch((e) => setErr(e.message)); }
  useEffect(cargar, []);

  async function agregar() {
    try { await api('/profesores', { body: n }); setOk('Agregado'); cargar(); }
    catch (e) { setErr(e.message); }
  }
  async function eliminar(id) {
    if (!confirm('¿Eliminar a este profesor de esta materia/sección? Ya no se le notificará en folios futuros.')) return;
    try { await api(`/profesores/${id}`, { method: 'DELETE' }); cargar(); } catch (e) { setErr(e.message); }
  }
  async function guardarEdicion(id, cambios) {
    try { await api(`/profesores/${id}`, { method: 'PATCH', body: cambios }); cargar(); }
    catch (e) { setErr(e.message); }
  }
  async function importar(e) {
    const file = e.target.files[0];
    if (!file) return;
    setArchivoNombre(file.name);
    const fd = new FormData();
    fd.append('archivo', file);
    try { const r = await api('/profesores/importar', { body: fd }); setOk(`Importadas ${r.insertadas}, errores ${r.errores.length}`); cargar(); }
    catch (e2) { setErr(e2.message); }
  }

  return (
    <div>
      <Aviso err={err} ok={ok} />
      <p className="hint">
        Este es el padrón que de verdad usa el sistema para saber a qué profesor(es) avisar cuando
        se emite un folio: se busca por semestre + sección del alumno. Si un profesor no aparece
        aquí para la materia/sección que le corresponde, no le va a llegar ningún correo.
      </p>
      <div className="card">
        <h3>Importar CSV</h3>
        <div className="fila" style={{ marginBottom: 10 }}>
          <button type="button" className="sec mini" onClick={descargarPlantillaProfesores}>Descargar plantilla</button>
        </div>
        <label className="archivo-drop">
          <input type="file" accept=".csv,text/csv" onChange={importar} style={{ display: 'none' }} />
          <span>{archivoNombre || 'Seleccionar archivo CSV…'}</span>
        </label>
      </div>
      <div className="card">
        <h3>Agregar profesor</h3>
        <div className="form-grid">
          <input type="number" placeholder="Semestre (1-9)" value={n.sem} onChange={(e) => setN({ ...n, sem: e.target.value })} />
          <input type="number" placeholder="Sección" value={n.secc} onChange={(e) => setN({ ...n, secc: e.target.value })} />
          <input type="text" placeholder="Materia" value={n.materia} onChange={(e) => setN({ ...n, materia: e.target.value })} />
          <input type="text" placeholder="Nombre del profesor" value={n.nombre} onChange={(e) => setN({ ...n, nombre: e.target.value })} />
          <input type="text" placeholder="Correo del profesor" value={n.correo} onChange={(e) => setN({ ...n, correo: e.target.value })} />
        </div>
        <div className="fila" style={{ marginTop: 12 }}>
          <button className="mini" onClick={agregar}>Agregar</button>
        </div>
      </div>
      <div className="card tabla-scroll">
        <table>
          <thead><tr><th>Sem</th><th>Sec</th><th>Materia</th><th>Profesor</th><th>Correo</th><th></th></tr></thead>
          <tbody>
            {lista.map((h) => (
              <FilaProfesor key={h.id} p={h} onGuardar={guardarEdicion} onEliminar={eliminar} />
            ))}
            {lista.length === 0 && <tr><td colSpan={6} className="hint">Sin profesores dados de alta.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilaProfesor({ p, onGuardar, onEliminar }) {
  const [editando, setEditando] = useState(false);
  const [f, setF] = useState({ sem: p.sem, secc: p.secc, materia: p.materia, nombre: p.profesor_nombre, correo: p.correo });

  if (!editando) {
    return (
      <tr>
        <td>{p.sem}</td><td>{p.secc}</td>
        <td>{p.materia}</td><td>{p.profesor_nombre}</td><td className="mono">{p.correo}</td>
        <td>
          <button className="plano mini" style={{ marginRight: 6 }} onClick={() => setEditando(true)}>Editar</button>
          <button className="plano mini" onClick={() => onEliminar(p.id)}>Eliminar</button>
        </td>
      </tr>
    );
  }
  return (
    <tr>
      <td><input className="tabla-input" type="number" value={f.sem} onChange={(e) => setF({ ...f, sem: e.target.value })} /></td>
      <td><input className="tabla-input" type="number" value={f.secc} onChange={(e) => setF({ ...f, secc: e.target.value })} /></td>
      <td><input className="tabla-input" type="text" value={f.materia} onChange={(e) => setF({ ...f, materia: e.target.value })} /></td>
      <td><input className="tabla-input" type="text" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></td>
      <td><input className="tabla-input mono" type="text" value={f.correo} onChange={(e) => setF({ ...f, correo: e.target.value })} /></td>
      <td>
        <button className="mini" style={{ marginRight: 6 }} onClick={async () => { await onGuardar(p.id, f); setEditando(false); }}>Guardar</button>
        <button className="plano mini" onClick={() => setEditando(false)}>Cancelar</button>
      </td>
    </tr>
  );
}

function Parametros() {
  const [lista, setLista] = useState([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  function cargar() { api('/config').then(setLista).catch((e) => setErr(e.message)); }
  useEffect(cargar, []);

  async function guardar(clave, texto) {
    try {
      const valor = JSON.parse(texto);
      await api(`/config/${clave}`, { method: 'PUT', body: { valor } });
      setOk(`${clave} guardado`); cargar();
    } catch (e) { setErr(`${clave}: ${e.message}`); }
  }

  return (
    <div>
      <Aviso err={err} ok={ok} />
      <p className="hint">
        Editor JSON. Claves: ciclo_activo, folio, reglas, textos, feriados.
        <br /><code>feriados</code>: arreglo de fechas <code>["2026-09-16", "2026-11-20"]</code> que
        no cuentan como días hábiles ni son seleccionables en el calendario.
      </p>
      {lista.filter((c) => c.clave !== 'smtp').map((c) => (
        <ParametroItem key={c.clave} clave={c.clave} valor={c.valor} onGuardar={guardar} />
      ))}
    </div>
  );
}

function ParametroItem({ clave, valor, onGuardar }) {
  const [txt, setTxt] = useState(JSON.stringify(valor, null, 2));
  return (
    <div className="card">
      <strong className="mono">{clave}</strong>
      <textarea value={txt} onChange={(e) => setTxt(e.target.value)} style={{ minHeight: 120, fontFamily: 'ui-monospace, monospace' }} />
      <button className="sec mini" style={{ marginTop: 8 }} onClick={() => onGuardar(clave, txt)}>Guardar</button>
    </div>
  );
}

function tamanoLegible(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function AdjuntosLimpieza() {
  const [f, setF] = useState({ desde: '', hasta: '', matricula: '', folio: '' });
  const [filas, setFilas] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  function qs() {
    const p = new URLSearchParams();
    if (f.desde) p.set('desde', f.desde);
    if (f.hasta) p.set('hasta', f.hasta);
    if (f.matricula) p.set('matricula', f.matricula);
    if (f.folio) p.set('folio', f.folio);
    return p;
  }
  const hayFiltro = !!(f.desde || f.hasta || f.matricula || f.folio);

  async function buscar() {
    setErr('');
    try { setFilas(await api(`/adjuntos?${qs()}`)); }
    catch (e) { setErr(e.message); }
  }
  useEffect(() => { buscar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function eliminarUno(a) {
    if (!confirm(`¿Eliminar el adjunto "${a.nombre_original}"? Esta acción no se puede deshacer.`)) return;
    setBusy(true); setErr(''); setOk('');
    try {
      await api(`/adjuntos/${a.id}`, { method: 'DELETE' });
      setOk('Adjunto eliminado'); await buscar();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function eliminarLote() {
    if (!hayFiltro) { setErr('Indica al menos un filtro (fecha, matrícula o folio) para eliminar en lote.'); return; }
    const n = filas ? filas.length : 0;
    if (!confirm(`¿Eliminar los ${n} adjunto(s) que coinciden con el filtro? Esta acción no se puede deshacer.`)) return;
    setBusy(true); setErr(''); setOk('');
    try {
      const r = await api(`/adjuntos?${qs()}`, { method: 'DELETE' });
      setOk(`${r.eliminados} adjunto(s) eliminado(s)`); await buscar();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <Aviso err={err} ok={ok} />
      <p className="hint">
        Elimina archivos adjuntos (recetas, tickets, documentos médicos) del almacenamiento del
        servidor. Los folios y las solicitudes no se ven afectados, solo la evidencia adjunta.
      </p>
      <div className="card">
        <div className="form-grid">
          <label>Desde
            <input type="date" value={f.desde} onChange={(e) => setF((s) => ({ ...s, desde: e.target.value }))} />
          </label>
          <label>Hasta
            <input type="date" value={f.hasta} onChange={(e) => setF((s) => ({ ...s, hasta: e.target.value }))} />
          </label>
          <label>Matrícula
            <input type="text" value={f.matricula} onChange={(e) => setF((s) => ({ ...s, matricula: e.target.value }))} />
          </label>
          <label>Folio
            <input type="text" value={f.folio} onChange={(e) => setF((s) => ({ ...s, folio: e.target.value }))} />
          </label>
        </div>
        <div className="fila" style={{ marginTop: 10 }}>
          <button className="sec" disabled={busy} onClick={buscar}>Buscar</button>
          <button className="peligro" disabled={busy || !hayFiltro} onClick={eliminarLote}>
            Eliminar todos los resultados del filtro
          </button>
        </div>
      </div>
      {!filas ? <p>Cargando…</p> : (
        <div className="card tabla-scroll">
          <table>
            <thead><tr><th>Subido</th><th>Tipo</th><th>Archivo</th><th>Tamaño</th><th>Alumno</th><th>Folio</th><th></th></tr></thead>
            <tbody>
              {filas.map((a) => (
                <tr key={a.id}>
                  <td>{new Date(a.subido_en).toLocaleString()}</td>
                  <td>{a.tipo}</td>
                  <td className="mono">{a.nombre_original}</td>
                  <td>{tamanoLegible(a.tamano)}</td>
                  <td>{a.nombre_declarado}<br /><span className="hint mono">{a.matricula_declarada}</span></td>
                  <td className="mono">{a.folio || '—'}</td>
                  <td><button className="peligro mini" disabled={busy} onClick={() => eliminarUno(a)}>Eliminar</button></td>
                </tr>
              ))}
              {filas.length === 0 && <tr><td colSpan={7} className="hint">Sin adjuntos.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SheetsConfig() {
  const [v, setV] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  useEffect(() => {
    api('/config/sheets').then((r) => setV(r.valor)).catch((e) => {
      if (e.status === 404) setV({ url: '', secreto: '', activo: true });
      else setErr(e.message);
    });
  }, []);
  if (!v) return <p>Cargando…</p>;

  async function guardar() {
    setErr(''); setOk('');
    try {
      await api('/config/sheets', { method: 'PUT', body: { valor: v } });
      setOk('Guardado');
    } catch (e) { setErr(e.message); }
  }
  async function probar() {
    setErr(''); setOk('');
    try {
      const r = await api('/config/sheets/test', { method: 'POST', body: { url: v.url, secreto: v.secreto } });
      setOk(`Conexión OK${r.respuesta ? `: ${r.respuesta}` : ''}`);
    } catch (e) { setErr(e.message); }
  }

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <Aviso err={err} ok={ok} />
      <p className="hint">
        Al emitir o anular un folio se manda un aviso a un Web App de Google Apps Script,
        que agrega/actualiza una fila en una hoja de cálculo. Ver <code>server/scripts/apps-script-sheets.gs</code>
        para el script a pegar en Apps Script.
      </p>
      <label>URL del Web App</label>
      <input type="text" value={v.url || ''} placeholder="https://script.google.com/macros/s/…/exec"
        onChange={(e) => setV({ ...v, url: e.target.value })} />
      <label>Secreto (debe coincidir con el del script)</label>
      <input type="text" value={v.secreto || ''} onChange={(e) => setV({ ...v, secreto: e.target.value })} />
      <label className="fila" style={{ alignItems: 'center', gap: 8, marginTop: 10 }}>
        <input type="checkbox" checked={v.activo !== false}
          onChange={(e) => setV({ ...v, activo: e.target.checked })} />
        Activo
      </label>
      <div className="fila" style={{ marginTop: 12 }}>
        <button onClick={guardar}>Guardar</button>
        <button className="sec" disabled={!v.url} onClick={probar}>Probar conexión</button>
      </div>
    </div>
  );
}
