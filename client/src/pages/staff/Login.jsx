import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../auth.jsx';

export default function StaffLogin({ destino = '/staff' }) {
  const { loginStaff } = useAuth();
  const nav = useNavigate();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [cargando, setCargando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setErr(''); setCargando(true);
    try {
      const u = await loginStaff(usuario, password);
      const esEnfermeria = u.rol === 'enfermeria';
      nav(esEnfermeria ? '/enfermeria' : destino, { replace: true });
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="wrap" style={{ maxWidth: 400 }}>
      <h1>Acceso institucional</h1>
      <p className="sub">Personal de la Secretaría Académica / Enfermería.</p>
      {err && <div className="aviso error">{err}</div>}
      <form className="card" onSubmit={enviar}>
        <label>Usuario</label>
        <input type="text" value={usuario} required autoFocus
          onChange={(e) => setUsuario(e.target.value.trim())} />
        <label>Contraseña</label>
        <input type="password" value={password} required
          onChange={(e) => setPassword(e.target.value)} />
        <div style={{ marginTop: 14 }}>
          <button disabled={cargando}>{cargando ? 'Entrando…' : 'Entrar'}</button>
        </div>
      </form>
      <p className="hint"><Link to="/">← Inicio</Link></p>
    </div>
  );
}
