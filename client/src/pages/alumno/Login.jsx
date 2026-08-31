import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';

export default function AlumnoLogin() {
  const { setAlumnoToken } = useAuth();
  const nav = useNavigate();
  const [paso, setPaso] = useState('correo');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [cargando, setCargando] = useState(false);

  async function pedirCodigo(e) {
    e.preventDefault();
    setErr(''); setMsg(''); setCargando(true);
    try {
      const r = await api('/auth/alumno/solicitar-codigo', { body: { email } });
      setMsg(`Te enviamos un código a ${email}. Vence en ${r.expira_min} minutos.`);
      setPaso('codigo');
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setCargando(false);
    }
  }

  async function verificar(e) {
    e.preventDefault();
    setErr(''); setCargando(true);
    try {
      const r = await api('/auth/alumno/verificar-codigo', { body: { email, code } });
      setAlumnoToken(r.token);
      nav('/solicitar', { replace: true });
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="wrap" style={{ maxWidth: 460 }}>
      <h1>Acceso de alumno</h1>
      <p className="sub">Solo correos institucionales <code>@umich.mx</code>.</p>

      {err && <div className="aviso error">{err}</div>}
      {msg && <div className="aviso info">{msg}</div>}

      {paso === 'correo' ? (
        <form className="card" onSubmit={pedirCodigo}>
          <label>Correo institucional</label>
          <input
            type="email" value={email} required autoFocus
            placeholder="matricula@umich.mx"
            onChange={(e) => setEmail(e.target.value.trim())}
          />
          <div style={{ marginTop: 14 }}>
            <button disabled={cargando}>{cargando ? 'Enviando…' : 'Enviar código'}</button>
          </div>
        </form>
      ) : (
        <form className="card" onSubmit={verificar}>
          <label>Código de 6 dígitos</label>
          <input
            type="text" value={code} required autoFocus inputMode="numeric"
            maxLength={6} placeholder="______"
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <div className="fila" style={{ marginTop: 14 }}>
            <button disabled={cargando || code.length !== 6}>
              {cargando ? 'Verificando…' : 'Entrar'}
            </button>
            <button type="button" className="plano" onClick={() => setPaso('correo')}>
              Cambiar correo
            </button>
          </div>
        </form>
      )}

      <p className="hint"><Link to="/">← Inicio</Link></p>
    </div>
  );
}
