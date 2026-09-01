import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';

export default function Cuenta() {
  const { staff, logoutStaff } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ actual: '', nueva: '', repetir: '' });
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setErr(''); setOk('');
    if (f.nueva.length < 8) { setErr('La nueva contraseña debe tener al menos 8 caracteres.'); return; }
    if (f.nueva !== f.repetir) { setErr('Las contraseñas no coinciden.'); return; }
    setBusy(true);
    try {
      await api('/auth/cambiar-password', { tipo: 'staff', body: { actual: f.actual, nueva: f.nueva } });
      setOk('Contraseña actualizada. Vuelve a iniciar sesión.');
      setTimeout(() => { logoutStaff(); nav('/staff/acceso', { replace: true }); }, 1400);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420 }}>
      <div className="card">
        <h2>Mi cuenta</h2>
        <p className="hint">{staff.nombre || staff.usuario} · {staff.rol}</p>
        {staff.must_change_password && (
          <div className="aviso info">Tu contraseña es temporal. Cámbiala para continuar usando el sistema con seguridad.</div>
        )}
        {err && <div className="aviso error">{err}</div>}
        {ok && <div className="aviso exito">{ok}</div>}
        <form onSubmit={enviar}>
          <label>Contraseña actual</label>
          <input type="password" required value={f.actual} autoComplete="current-password"
            onChange={(e) => setF({ ...f, actual: e.target.value })} />
          <label>Nueva contraseña (mín. 8)</label>
          <input type="password" required value={f.nueva} autoComplete="new-password"
            onChange={(e) => setF({ ...f, nueva: e.target.value })} />
          <label>Repetir nueva contraseña</label>
          <input type="password" required value={f.repetir} autoComplete="new-password"
            onChange={(e) => setF({ ...f, repetir: e.target.value })} />
          <div style={{ marginTop: 14 }}>
            <button disabled={busy}>{busy ? 'Guardando…' : 'Cambiar contraseña'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
