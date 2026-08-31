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
      nav(u.rol === 'enfermeria' ? '/enfermeria' : destino, { replace: true });
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="login-bg">
      <form className="login-card" onSubmit={enviar}>
        <img className="logo" src="/umsnh_logo.png" alt="UMSNH" />
        <h1>Justificantes FCCA</h1>
        <p className="sub">Acceso institucional</p>

        {err && <div className="aviso error">{err}</div>}

        <label>Usuario</label>
        <input type="text" value={usuario} required autoFocus autoComplete="username"
          onChange={(e) => setUsuario(e.target.value.trim())} />

        <label>Contraseña</label>
        <input type="password" value={password} required autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)} />

        <button type="submit" disabled={cargando}>{cargando ? 'Ingresando…' : 'Ingresar'}</button>
        <Link className="volver" to="/">← Volver al inicio</Link>
      </form>
    </div>
  );
}
