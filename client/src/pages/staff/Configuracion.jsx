import { useEffect, useState } from 'react';
import { api } from '../../api.js';

const TABS = ['SMTP', 'Plantillas', 'Horarios', 'Parámetros'];

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
      {tab === 'Horarios' && <Horarios />}
      {tab === 'Parámetros' && <Parametros />}
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
    try { const r = await api('/config/smtp/test', { method: 'POST' }); setOk(`OK: ${r.user}@${r.host}`); }
    catch (e) { setErr(e.message); }
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
  const [f, setF] = useState({ titulo: p.titulo, asunto: p.asunto || '', cuerpo: p.cuerpo, activo: p.activo });
  const [abierta, setAbierta] = useState(false);
  const sucio = f.titulo !== p.titulo || f.asunto !== (p.asunto || '') || f.cuerpo !== p.cuerpo || f.activo !== p.activo;

  return (
    <div className="tpl-card">
      <div className="tpl-card-head">
        <span className={`pill ${p.ambito === 'correo' ? 'azul' : 'neutro'}`}>{p.ambito}</span>
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
          </>}
          <label>Cuerpo</label>
          <textarea value={f.cuerpo} onChange={(e) => setF({ ...f, cuerpo: e.target.value })} style={{ minHeight: 140 }} />
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
  const [nueva, setNueva] = useState({ ambito: 'correo', clave: '', titulo: '', asunto: '', cuerpo: '' });
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
      await api('/plantillas', { body: nueva });
      setNueva({ ambito: 'correo', clave: '', titulo: '', asunto: '', cuerpo: '' });
      setMostrarForm(false);
      setOk('Creada'); cargar();
    } catch (e) { setErr(e.message); }
  }
  const nuevaValida = nueva.clave.trim() && nueva.titulo.trim() && nueva.cuerpo.trim();

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
            <input type="text" placeholder="asunto" value={nueva.asunto}
              onChange={(e) => setNueva({ ...nueva, asunto: e.target.value })} style={{ marginTop: 10 }} />
          )}
          <textarea placeholder="cuerpo" value={nueva.cuerpo} onChange={(e) => setNueva({ ...nueva, cuerpo: e.target.value })} style={{ marginTop: 10 }} />
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

function Horarios() {
  const [lista, setLista] = useState([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [n, setN] = useState({ ciclo_escolar: '2026', semestre: '', seccion: '', materia: '', profesor_nombre: '', profesor_correo: '', dia_semana: '1' });
  function cargar() { api('/horarios').then(setLista).catch((e) => setErr(e.message)); }
  useEffect(cargar, []);

  async function agregar() {
    try { await api('/horarios', { body: n }); setOk('Agregado'); cargar(); }
    catch (e) { setErr(e.message); }
  }
  async function baja(id) {
    if (!confirm('¿Dar de baja este horario?')) return;
    try { await api(`/horarios/${id}`, { method: 'DELETE' }); cargar(); } catch (e) { setErr(e.message); }
  }
  async function importar(e) {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('archivo', file);
    try { const r = await api('/horarios/importar', { body: fd }); setOk(`Importadas ${r.insertadas}, errores ${r.errores.length}`); cargar(); }
    catch (e2) { setErr(e2.message); }
  }

  return (
    <div>
      <Aviso err={err} ok={ok} />
      <div className="card">
        <h3>Importar CSV</h3>
        <p className="hint">Encabezados: ciclo_escolar,semestre,seccion,materia,profesor_nombre,profesor_correo,dia_semana</p>
        <input type="file" accept=".csv,text/csv" onChange={importar} />
      </div>
      <div className="card">
        <h3>Agregar horario</h3>
        <div className="form-grid">
          {['ciclo_escolar', 'semestre', 'seccion', 'materia', 'profesor_nombre', 'profesor_correo'].map((k) => (
            <input key={k} type="text" placeholder={k} value={n[k]} onChange={(e) => setN({ ...n, [k]: e.target.value })} />
          ))}
          <select value={n.dia_semana} onChange={(e) => setN({ ...n, dia_semana: e.target.value })}>
            {['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'].map((d, i) => (
              <option key={i} value={i + 1}>{d}</option>
            ))}
          </select>
        </div>
        <div className="fila" style={{ marginTop: 12 }}>
          <button className="mini" onClick={agregar}>Agregar</button>
        </div>
      </div>
      <div className="card tabla-scroll">
        <table>
          <thead><tr><th>Ciclo</th><th>Sem</th><th>Sec</th><th>Materia</th><th>Profesor</th><th>Día</th><th></th></tr></thead>
          <tbody>
            {lista.map((h) => (
              <tr key={h.id}>
                <td>{h.ciclo_escolar}</td><td>{h.semestre}</td><td>{h.seccion}</td>
                <td>{h.materia}</td><td className="mono">{h.profesor_correo}</td><td>{h.dia_semana}</td>
                <td><button className="plano mini" onClick={() => baja(h.id)}>Baja</button></td>
              </tr>
            ))}
            {lista.length === 0 && <tr><td colSpan={7} className="hint">Sin horarios.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
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
