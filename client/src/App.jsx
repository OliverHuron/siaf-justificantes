import { useEffect, useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';

function Health() {
  const [estado, setEstado] = useState({ cargando: true });
  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => setEstado({ cargando: false, ok, j }))
      .catch((e) => setEstado({ cargando: false, ok: false, j: { error: String(e) } }));
  }, []);

  if (estado.cargando) return <span className="pill">consultando…</span>;
  return (
    <>
      <span className={'pill ' + (estado.ok ? 'ok' : 'mal')}>
        {estado.ok ? 'API en línea' : 'API con problemas'}
      </span>
      <pre style={{ marginTop: 12, fontSize: '.8rem', overflowX: 'auto' }}>
        {JSON.stringify(estado.j, null, 2)}
      </pre>
    </>
  );
}

function Home() {
  return (
    <div className="wrap">
      <h1>Justificantes FCCA</h1>
      <p className="sub">
        Sistema de control y emisión de justificantes de inasistencia — UMSNH.
        Andamiaje (Fase 0). Ver <code>PLAN.md</code>.
      </p>

      <div className="card">
        <h2>Estado del backend</h2>
        <Health />
      </div>

      <div className="card">
        <h2>Superficies previstas (Fase 1)</h2>
        <ul className="rutas">
          <li>Portal del alumno — login por código y formulario</li>
          <li>Seguimiento — <code>/solicitud/&lt;token&gt;</code></li>
          <li>Bandeja de revisión — encargada / supervisor</li>
          <li>Panel de enfermería</li>
          <li>Configuración — supervisor</li>
          <li>Validación pública — <Link to="/validar">/validar</Link></li>
          <li>Aviso de privacidad — <Link to="/aviso-de-privacidad">/aviso-de-privacidad</Link></li>
        </ul>
      </div>
    </div>
  );
}

function Pendiente({ titulo }) {
  return (
    <div className="wrap">
      <h1>{titulo}</h1>
      <p className="sub">Pendiente de implementar (Fase 1).</p>
      <p><Link to="/">← Inicio</Link></p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/validar" element={<Pendiente titulo="Validación de justificante" />} />
      <Route path="/aviso-de-privacidad" element={<Pendiente titulo="Aviso de Privacidad" />} />
      <Route path="*" element={<Pendiente titulo="Página no encontrada" />} />
    </Routes>
  );
}
