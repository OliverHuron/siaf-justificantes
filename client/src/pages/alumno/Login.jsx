import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import LoginShell from '../../components/LoginShell.jsx';
import CampoIcono from '../../components/CampoIcono.jsx';
import CodigoInput from '../../components/CodigoInput.jsx';
import SelectorGrid from '../../components/SelectorGrid.jsx';

const ORD_NUM = {
  primero: 1, segundo: 2, tercero: 3, cuarto: 4, quinto: 5,
  sexto: 6, septimo: 7, 'séptimo': 7, octavo: 8, noveno: 9,
};
const numSem = (c, e) => ORD_NUM[c] ?? ORD_NUM[e] ?? Number(c) ?? c;

/** Clave del grupo elegido, para pasarlo al formulario tras verificar el código. */
export const CLAVE_GRUPO = 'sj_alumno_grupo';

/** El periodo en curso es NON (semestres impares) del 2-ago al 30-ene; PAR del 1-feb al 1-ago. */
function periodoEnCursoEsNon(d = new Date()) {
  const mes = d.getMonth();
  const dia = d.getDate();
  const esPar = (mes >= 1 && mes < 7) || (mes === 7 && dia <= 1);
  return !esPar;
}

export default function AlumnoLogin() {
  const { setAlumnoToken } = useAuth();
  const [paso, setPaso] = useState('correo');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [cargando, setCargando] = useState(false);

  const [cat, setCat] = useState(null);
  const [sem, setSem] = useState('');
  const [sec, setSec] = useState('');
  // { estado: 'idle' | 'cargando' | 'ok' | 'nohay' | 'error', exp? }
  const [chk, setChk] = useState({ estado: 'idle' });

  useEffect(() => { api('/catalogos').then(setCat).catch(() => {}); }, []);

  // Verificación en vivo del grupo elegido contra la FCCA.
  useEffect(() => {
    if (!sem || !sec) { setChk({ estado: 'idle' }); return undefined; }
    let vivo = true;
    setChk({ estado: 'cargando' });
    api(`/expediente?semestre=${encodeURIComponent(numSem(sem))}&seccion=${encodeURIComponent(sec)}`)
      .then((e) => {
        if (!vivo) return;
        setChk(e && e.encontrado ? { estado: 'ok', exp: e } : { estado: 'nohay' });
      })
      .catch(() => { if (vivo) setChk({ estado: 'error' }); });
    return () => { vivo = false; };
  }, [sem, sec]);

  const nSem = numSem(sem);
  const nonEnCurso = useMemo(() => periodoEnCursoEsNon(), []);

  // Solo los semestres del periodo en curso: NON (1,3,5,7,9) del 2-ago al 30-ene;
  // PAR (2,4,6,8) del 1-feb al 1-ago.
  const semOpciones = (cat?.semestres || [])
    .map((s) => ({ clave: s.clave, n: numSem(s.clave, s.etiqueta) }))
    .filter((s) => (s.n % 2 === 1) === nonEnCurso)
    .map((s) => ({ clave: s.clave, etiqueta: `${s.n}°` }));
  const semNota = nonEnCurso
    ? 'Periodo en curso: semestres nones (1°, 3°, 5°, 7°, 9°).'
    : 'Periodo en curso: semestres pares (2°, 4°, 6°, 8°).';
  const secOpciones = (cat?.secciones || []).filter((s) => s.clave !== 'otro');

  async function pedirCodigo(e) {
    e.preventDefault();
    if (chk.estado !== 'ok') { setErr('Elige un semestre y sección válidos antes de continuar.'); return; }
    setErr(''); setMsg(''); setCargando(true);
    try {
      const r = await api('/auth/alumno/solicitar-codigo', { body: { email } });
      try {
        localStorage.setItem(CLAVE_GRUPO, JSON.stringify({ semestre: sem, seccion: sec, num: nSem }));
      } catch { /* modo privado */ }
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
            placeholder="matricula@umich.mx" onChange={(ev) => setEmail(ev.target.value.trim())} />

          <div className="login-grupo">
            <div className="login-grupo-f">
              <label>Semestre</label>
              <SelectorGrid label="Elige tu semestre" unico columnas={5}
                opciones={semOpciones} value={sem ? [sem] : []}
                onChange={(v) => setSem(v[0] || '')} placeholder="Semestre"
                nota={semNota} />
            </div>
            <div className="login-grupo-f">
              <label>Sección</label>
              <SelectorGrid label="Elige tu sección" unico columnas={6}
                opciones={secOpciones} value={sec ? [sec] : []}
                onChange={(v) => setSec(v[0] || '')} placeholder="Sección" />
            </div>
          </div>

          {chk.estado === 'cargando' && <div className="aviso info">Verificando tu grupo…</div>}
          {chk.estado === 'ok' && (
            <div className="aviso exito">Grupo {nSem}° · Secc {sec} verificado.</div>
          )}
          {chk.estado === 'nohay' && (
            <div className="aviso error">
              No existe el grupo {nSem}° · Secc {sec} en la FCCA. Revisa tu semestre y sección.
            </div>
          )}
          {chk.estado === 'error' && (
            <div className="aviso error">No se pudo verificar el grupo ahora. Inténtalo de nuevo.</div>
          )}

          <button type="submit" className="login2-btn"
            disabled={cargando || !email || chk.estado !== 'ok'}>
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
