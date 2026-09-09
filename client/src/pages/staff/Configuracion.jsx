import { useEffect, useState } from 'react';
import { api } from '../../api.js';

const TABS = ['SMTP', 'Plantillas', 'Horarios', 'Parámetros', 'Usuarios'];

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
      {tab === 'Usuarios' && <Usuarios />}
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
      <label>Host</label><input value={v.host || ''} onChange={(e) => setV({ ...v, host: e.target.value })} />
      <label>Puerto</label><input value={v.port || ''} onChange={(e) => setV({ ...v, port: Number(e.target.value) })} />
      <label>Usuario</label><input value={v.user || ''} onChange={(e) => setV({ ...v, user: e.target.value })} />
      <label>Contraseña (App Password){v.pass_configurada ? ' (ya configurada)' : ''}</label>
      <input type="password" value={v.pass || ''} placeholder={v.pass_configurada ? '••••••••' : ''}
        onChange={(e) => setV({ ...v, pass: e.target.value })} />
      <label>Remitente</label><input value={v.from || ''} onChange={(e) => setV({ ...v, from: e.target.value })} />
      <div className="fila" style={{ marginTop: 12 }}>
        <button onClick={guardar}>Guardar</button>
        <button className="sec" onClick={probar}>Probar conexión</button>
      </div>
    </div>
  );
}

function Plantillas() {
  const [lista, setLista] = useState([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [nueva, setNueva] = useState({ ambito: 'correo', clave: '', titulo: '', asunto: '', cuerpo: '' });
  function cargar() { api('/plantillas').then(setLista).catch((e) => setErr(e.message)); }
  useEffect(cargar, []);

  async function guardar(p) {
    try {
      await api(`/plantillas/${p.id}`, { method: 'PATCH', body: { titulo: p.titulo, asunto: p.asunto, cuerpo: p.cuerpo, activo: p.activo } });
      setOk('Plantilla guardada'); cargar();
    } catch (e) { setErr(e.message); }
  }
  async function crear() {
    try { await api('/plantillas', { body: nueva }); setNueva({ ambito: 'correo', clave: '', titulo: '', asunto: '', cuerpo: '' }); setOk('Creada'); cargar(); }
    catch (e) { setErr(e.message); }
  }

  return (
    <div>
      <Aviso err={err} ok={ok} />
      {lista.map((p, i) => (
        <div className="card" key={p.id}>
          <div className="fila fila-sep">
            <strong>{p.ambito} · <span className="mono">{p.clave}</span></strong>
            <label style={{ fontWeight: 400, margin: 0 }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={p.activo}
                onChange={(e) => setLista((l) => l.map((x, j) => j === i ? { ...x, activo: e.target.checked } : x))} /> activo
            </label>
          </div>
          <label>Título</label>
          <input value={p.titulo} onChange={(e) => setLista((l) => l.map((x, j) => j === i ? { ...x, titulo: e.target.value } : x))} />
          {p.ambito === 'correo' && <>
            <label>Asunto</label>
            <input value={p.asunto || ''} onChange={(e) => setLista((l) => l.map((x, j) => j === i ? { ...x, asunto: e.target.value } : x))} />
          </>}
          <label>Cuerpo</label>
          <textarea value={p.cuerpo} onChange={(e) => setLista((l) => l.map((x, j) => j === i ? { ...x, cuerpo: e.target.value } : x))} />
          <button className="sec mini" style={{ marginTop: 8 }} onClick={() => guardar(lista[i])}>Guardar</button>
        </div>
      ))}
      <div className="card">
        <h3>Nueva plantilla</h3>
        <div className="fila">
          <select value={nueva.ambito} onChange={(e) => setNueva({ ...nueva, ambito: e.target.value })} style={{ width: 'auto' }}>
            <option value="correo">correo</option>
            <option value="cuerpo_oficio">cuerpo_oficio</option>
          </select>
          <input placeholder="clave" value={nueva.clave} onChange={(e) => setNueva({ ...nueva, clave: e.target.value })} />
          <input placeholder="título" value={nueva.titulo} onChange={(e) => setNueva({ ...nueva, titulo: e.target.value })} />
        </div>
        {nueva.ambito === 'correo' && <input placeholder="asunto" value={nueva.asunto} onChange={(e) => setNueva({ ...nueva, asunto: e.target.value })} style={{ marginTop: 8 }} />}
        <textarea placeholder="cuerpo" value={nueva.cuerpo} onChange={(e) => setNueva({ ...nueva, cuerpo: e.target.value })} style={{ marginTop: 8 }} />
        <button className="mini" style={{ marginTop: 8 }} onClick={crear}>Crear</button>
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
        <div className="fila">
          {['ciclo_escolar', 'semestre', 'seccion', 'materia', 'profesor_nombre', 'profesor_correo'].map((k) => (
            <input key={k} placeholder={k} value={n[k]} onChange={(e) => setN({ ...n, [k]: e.target.value })} />
          ))}
          <select value={n.dia_semana} onChange={(e) => setN({ ...n, dia_semana: e.target.value })}>
            {['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'].map((d, i) => (
              <option key={i} value={i + 1}>{d}</option>
            ))}
          </select>
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

function Usuarios() {
  const [lista, setLista] = useState([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [n, setN] = useState({ usuario: '', nombre: '', email: '', rol: 'coordinador' });
  function cargar() { api('/usuarios').then(setLista).catch((e) => setErr(e.message)); }
  useEffect(cargar, []);

  async function crear() {
    try { const r = await api('/usuarios', { body: n }); setOk(`Creado ${r.usuario}`); setN({ usuario: '', nombre: '', email: '', rol: 'coordinador' }); cargar(); }
    catch (e) { setErr(e.message); }
  }
  async function toggle(u) {
    try { await api(`/usuarios/${u.id}`, { method: 'PATCH', body: { activo: !u.activo } }); cargar(); } catch (e) { setErr(e.message); }
  }
  async function reset(u) {
    if (!confirm(`¿Restablecer la contraseña de ${u.usuario}?`)) return;
    try { const r = await api(`/usuarios/${u.id}`, { method: 'PATCH', body: { reset_password: true } }); setOk(`Contraseña temporal: ${r.password_temporal}`); } catch (e) { setErr(e.message); }
  }

  return (
    <div>
      <Aviso err={err} ok={ok} />
      <div className="card tabla-scroll">
        <table>
          <thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Activo</th><th></th></tr></thead>
          <tbody>
            {lista.map((u) => (
              <tr key={u.id}>
                <td className="mono">{u.usuario}</td><td>{u.nombre}</td><td>{u.rol}</td>
                <td>{u.activo ? 'sí' : 'no'}</td>
                <td className="fila">
                  <button className="plano mini" onClick={() => toggle(u)}>{u.activo ? 'Desactivar' : 'Activar'}</button>
                  <button className="plano mini" onClick={() => reset(u)}>Reset contraseña</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h3>Nuevo usuario</h3>
        <div className="fila">
          <input placeholder="usuario" value={n.usuario} onChange={(e) => setN({ ...n, usuario: e.target.value })} />
          <input placeholder="nombre" value={n.nombre} onChange={(e) => setN({ ...n, nombre: e.target.value })} />
          <input placeholder="email" value={n.email} onChange={(e) => setN({ ...n, email: e.target.value })} />
          <select value={n.rol} onChange={(e) => setN({ ...n, rol: e.target.value })}>
            {['encargada', 'supervisor', 'coordinador', 'enfermeria'].map((r) => <option key={r}>{r}</option>)}
          </select>
          <button className="mini" onClick={crear}>Crear</button>
        </div>
        <p className="hint">Contraseña temporal por defecto: 123456 (se pide cambiarla al ingresar).</p>
      </div>
    </div>
  );
}
