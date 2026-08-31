import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../api.js';

export default function Validar() {
  const [sp, setSp] = useSearchParams();
  const [folio, setFolio] = useState(sp.get('folio') || '');
  const [token, setToken] = useState(sp.get('token') || '');
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [cargando, setCargando] = useState(false);

  async function consultar(fol, tok) {
    setErr(''); setRes(null); setCargando(true);
    try {
      const q = new URLSearchParams({ folio: fol, ...(tok ? { token: tok } : {}) });
      setRes(await api(`/validar?${q}`));
    } catch (e) { setErr(e.message); } finally { setCargando(false); }
  }

  useEffect(() => {
    if (sp.get('folio')) consultar(sp.get('folio'), sp.get('token') || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(e) {
    e.preventDefault();
    setSp(folio ? { folio } : {});
    consultar(folio, token);
  }

  const estadoPill = res && ({
    VALIDO: 'ok', ANULADO: 'mal', NO_ENCONTRADO: 'mal', DATOS_INCOMPLETOS: 'neutro',
  }[res.estado] || 'neutro');

  return (
    <div className="wrap" style={{ maxWidth: 520 }}>
      <h1>Verificar justificante</h1>
      <p className="sub">Escanea el QR del oficio o teclea el folio impreso.</p>

      <form className="card" onSubmit={onSubmit}>
        <label>Folio</label>
        <input type="text" value={folio} onChange={(e) => setFolio(e.target.value.trim().toUpperCase())}
          placeholder="F-2026-0001-XX" required />
        <label>Token (opcional, viene en el QR)</label>
        <input type="text" value={token} onChange={(e) => setToken(e.target.value.trim())} />
        <div style={{ marginTop: 12 }}>
          <button disabled={cargando}>{cargando ? 'Consultando…' : 'Verificar'}</button>
        </div>
      </form>

      {err && <div className="aviso error">{err}</div>}

      {res && (
        <div className="card">
          <div className="fila fila-sep">
            <strong>Resultado</strong>
            <span className={`pill ${estadoPill}`}>{res.estado}</span>
          </div>
          {res.estado === 'NO_ENCONTRADO' && (
            <p style={{ marginTop: 10 }}>No existe un folio válido con ese identificador.</p>
          )}
          {res.detalle_limitado && (
            <p className="aviso info" style={{ marginTop: 10 }}>
              El folio existe y fue emitido el {new Date(res.emitido_en).toLocaleDateString()}.
              Para ver los datos completos, escanea el código QR del oficio.
            </p>
          )}
          {(res.estado === 'VALIDO' || res.estado === 'ANULADO') && !res.detalle_limitado && (
            <table style={{ marginTop: 10 }}>
              <tbody>
                <tr><th>Folio</th><td className="mono">{res.folio}</td></tr>
                <tr><th>Alumno</th><td>{res.nombre}</td></tr>
                <tr><th>Matrícula</th><td>{res.matricula}</td></tr>
                <tr><th>Semestre(s)</th><td>{res.semestres?.join(', ')}</td></tr>
                <tr><th>Sección(es)</th><td>{res.secciones?.join(', ')}</td></tr>
                <tr><th>Motivo</th><td>{res.tipo}</td></tr>
                <tr><th>Días</th><td>{res.dias}</td></tr>
                <tr><th>Emitido</th><td>{new Date(res.emitido_en).toLocaleString()}</td></tr>
                <tr><th>Emitió</th><td>{res.emitido_por || '—'}</td></tr>
                {res.estado === 'ANULADO' && (
                  <tr><th>Anulado</th><td>{new Date(res.anulado_en).toLocaleString()} — {res.motivo_anulacion}</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      <Link to="/">← Inicio</Link>
    </div>
  );
}
