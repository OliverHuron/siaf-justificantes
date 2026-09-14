import { useEffect, useState } from 'react';
import { api } from '../../api.js';

const ROLES = ['encargada', 'supervisor', 'coordinador', 'enfermeria'];

function Aviso({ err, ok }) {
  return <>
    {err && <div className="aviso error">{err}</div>}
    {ok && <div className="aviso exito">{ok}</div>}
  </>;
}

function FilaUsuario({ u, onGuardar, onEliminar, onCambiarPassword, onResetTemporal, onToggleActivo }) {
  const [f, setF] = useState({ usuario: u.usuario, nombre: u.nombre, email: u.email || '', rol: u.rol });
  const [pass, setPass] = useState('');
  const [mostrarPass, setMostrarPass] = useState(false);
  const sucio = f.usuario !== u.usuario || f.nombre !== u.nombre || f.email !== (u.email || '') || f.rol !== u.rol;

  return (
    <>
      <tr>
        <td><input type="text" className="tabla-input" value={f.usuario} onChange={(e) => setF({ ...f, usuario: e.target.value })} /></td>
        <td><input type="text" className="tabla-input" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></td>
        <td><input type="text" className="tabla-input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></td>
        <td>
          <select className="tabla-input" value={f.rol} onChange={(e) => setF({ ...f, rol: e.target.value })}>
            {ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </td>
        <td><span className={`pill ${u.activo ? 'ok' : 'neutro'}`}>{u.activo ? 'Activo' : 'Inactivo'}</span></td>
        <td className="fila" style={{ flexWrap: 'wrap' }}>
          <button className="mini" disabled={!sucio} onClick={() => onGuardar(u.id, f)}>Guardar</button>
          <button className="plano mini" onClick={() => onToggleActivo(u)}>{u.activo ? 'Desactivar' : 'Activar'}</button>
          <button className="plano mini" onClick={() => setMostrarPass((v) => !v)}>Contraseña</button>
          <button className="plano mini" style={{ borderColor: 'var(--mal)', color: 'var(--mal)' }}
            onClick={() => onEliminar(u)}>Eliminar</button>
        </td>
      </tr>
      {mostrarPass && (
        <tr>
          <td colSpan={6}>
            <div className="fila">
              <input type="password" placeholder="Nueva contraseña (mín. 8)" value={pass}
                onChange={(e) => setPass(e.target.value)} style={{ maxWidth: 240 }} />
              <button className="mini" disabled={pass.length < 8}
                onClick={() => { onCambiarPassword(u.id, pass); setPass(''); setMostrarPass(false); }}>
                Cambiar contraseña
              </button>
              <button className="plano mini" onClick={() => onResetTemporal(u)}>
                Restablecer a temporal
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function Usuarios() {
  const [lista, setLista] = useState([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [n, setN] = useState({ usuario: '', nombre: '', email: '', rol: 'coordinador', password: '' });

  function cargar() { api('/usuarios').then(setLista).catch((e) => setErr(e.message)); }
  useEffect(cargar, []);

  const nuevoValido = n.usuario && n.nombre && n.email && n.password.length >= 8;

  async function crear() {
    if (!nuevoValido) return;
    setErr(''); setOk('');
    try {
      const r = await api('/usuarios', { body: n });
      setOk(`Creado ${r.usuario}`);
      setN({ usuario: '', nombre: '', email: '', rol: 'coordinador', password: '' });
      cargar();
    } catch (e) { setErr(e.message); }
  }

  async function guardar(id, f) {
    setErr(''); setOk('');
    try {
      await api(`/usuarios/${id}`, { method: 'PATCH', body: f });
      setOk('Usuario actualizado'); cargar();
    } catch (e) { setErr(e.message); }
  }

  async function toggleActivo(u) {
    setErr(''); setOk('');
    try { await api(`/usuarios/${u.id}`, { method: 'PATCH', body: { activo: !u.activo } }); cargar(); }
    catch (e) { setErr(e.message); }
  }

  async function cambiarPassword(id, nueva_password) {
    setErr(''); setOk('');
    try {
      await api(`/usuarios/${id}`, { method: 'PATCH', body: { nueva_password } });
      setOk('Contraseña actualizada');
    } catch (e) { setErr(e.message); }
  }

  async function resetTemporal(u) {
    if (!confirm(`¿Restablecer la contraseña de ${u.usuario} a la temporal?`)) return;
    setErr(''); setOk('');
    try {
      const r = await api(`/usuarios/${u.id}`, { method: 'PATCH', body: { reset_password: true } });
      setOk(`Contraseña temporal: ${r.password_temporal}`);
    } catch (e) { setErr(e.message); }
  }

  async function eliminar(u) {
    if (!confirm(`¿Eliminar definitivamente a ${u.usuario}? Esta acción no se puede deshacer.`)) return;
    setErr(''); setOk('');
    try {
      await api(`/usuarios/${u.id}`, { method: 'DELETE' });
      setOk('Usuario eliminado'); cargar();
    } catch (e) { setErr(e.message); }
  }

  return (
    <div>
      <Aviso err={err} ok={ok} />
      <div className="card">
        <h3>Nuevo usuario</h3>
        <div className="form-grid">
          <input type="text" placeholder="usuario" value={n.usuario} onChange={(e) => setN({ ...n, usuario: e.target.value })} />
          <input type="text" placeholder="nombre" value={n.nombre} onChange={(e) => setN({ ...n, nombre: e.target.value })} />
          <input type="email" placeholder="email" value={n.email} onChange={(e) => setN({ ...n, email: e.target.value })} />
          <select value={n.rol} onChange={(e) => setN({ ...n, rol: e.target.value })}>
            {ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
          <input type="password" placeholder="contraseña (mín. 8)" required value={n.password}
            onChange={(e) => setN({ ...n, password: e.target.value })} />
        </div>
        <div className="fila" style={{ marginTop: 12 }}>
          <button className="mini" disabled={!nuevoValido} onClick={crear}>Crear</button>
        </div>
      </div>
      <div className="card tabla-scroll">
        <table>
          <thead>
            <tr><th>Usuario</th><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {lista.map((u) => (
              <FilaUsuario key={u.id} u={u} onGuardar={guardar} onEliminar={eliminar}
                onCambiarPassword={cambiarPassword} onResetTemporal={resetTemporal}
                onToggleActivo={toggleActivo} />
            ))}
            {lista.length === 0 && <tr><td colSpan={6} className="hint">Sin usuarios.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
