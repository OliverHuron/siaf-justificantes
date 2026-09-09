import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth.jsx';
import LoginShell from '../../components/LoginShell.jsx';
import CampoIcono from '../../components/CampoIcono.jsx';

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
    <LoginShell>
      <h2>Bienvenido</h2>
      <p className="card-sub">Ingresa tus credenciales institucionales para acceder</p>

      {err && <div className="aviso error">{err}</div>}

      <form onSubmit={enviar}>
        <label>Usuario</label>
        <CampoIcono icono="usuario" type="text" value={usuario} required autoFocus
          autoComplete="username" placeholder="Ingresa tu usuario"
          onChange={(e) => setUsuario(e.target.value.trim())} />

        <label>Contraseña</label>
        <CampoIcono icono="candado" type="password" value={password} required
          autoComplete="current-password" placeholder="Ingresa tu contraseña"
          onChange={(e) => setPassword(e.target.value)} />

        <button type="submit" className="login2-btn" disabled={cargando}>
          {cargando ? 'Ingresando…' : 'Iniciar Sesión'}
        </button>
      </form>
    </LoginShell>
  );
}
