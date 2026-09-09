import { useState } from 'react';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import LoginShell from '../../components/LoginShell.jsx';
import CampoIcono from '../../components/CampoIcono.jsx';
import CodigoInput from '../../components/CodigoInput.jsx';

export default function AlumnoLogin() {
  const { setAlumnoToken } = useAuth();
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
      setAlumnoToken(r.token); // el contenedor de /solicitar/acceso muestra el formulario
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <LoginShell>
      {paso === 'correo' ? (
        <form onSubmit={pedirCodigo}>
          <h2>Solicitud de justificante</h2>
          <p className="card-sub">Ingresa con tu correo institucional <b>@umich.mx</b></p>
          {err && <div className="aviso error">{err}</div>}
          {msg && <div className="aviso info">{msg}</div>}
          <label>Correo institucional</label>
          <CampoIcono icono="correo" type="email" value={email} required autoFocus
            placeholder="matricula@umich.mx" onChange={(e) => setEmail(e.target.value.trim())} />
          <button type="submit" className="login2-btn" disabled={cargando}>
            {cargando ? 'Enviando…' : 'Enviar código'}
          </button>
        </form>
      ) : (
        <form onSubmit={verificar}>
          <h2>Verifica tu código</h2>
          <p className="card-sub">{email}</p>
          {err && <div className="aviso error">{err}</div>}
          {msg && <div className="aviso info">{msg}</div>}
          <label>Código de 6 dígitos</label>
          <CodigoInput value={code} onChange={setCode} n={6} />
          <button type="submit" className="login2-btn" disabled={cargando || code.length !== 6}>
            {cargando ? 'Verificando…' : 'Entrar'}
          </button>
          <button type="button" className="login2-btn plano" style={{ marginTop: 8 }}
            onClick={() => setPaso('correo')}>Cambiar correo</button>
        </form>
      )}
    </LoginShell>
  );
}
