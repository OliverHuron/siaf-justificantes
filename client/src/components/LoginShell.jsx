import { Link } from 'react-router-dom';

/**
 * Marco de las pantallas de acceso: panel izquierdo institucional (foto + overlay
 * azul + escudo + lema) y panel derecho blanco donde va el formulario (`children`).
 */
export default function LoginShell({ children }) {
  const anio = new Date().getFullYear();
  return (
    <div className="login2">
      <aside className="login2-brand">
        <div className="login2-brand-top">
          <img src="/UMSNHLogo1.png" alt="" className="escudo" />
          <div>
            <div className="marca">UMSNH</div>
            <div className="marca-sub">Universidad Michoacana de San Nicolás de Hidalgo</div>
          </div>
        </div>

        <div className="login2-brand-mid">
          <h1>Sistema de Justificantes<br />de Inasistencia</h1>
          <p className="lead">Facultad de Contaduría y Ciencias Administrativas</p>
          <blockquote>
            «Cuna de héroes, crisol de pensadores»
            <span>Formando profesionales con compromiso social desde 1917</span>
          </blockquote>
        </div>

        <div className="login2-brand-foot">© {anio} UMSNH — Todos los derechos reservados</div>
      </aside>

      <section className="login2-panel">
        <div className="login2-card">{children}</div>
        <div className="ssl-pill">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Conexión segura con cifrado SSL
        </div>
        <Link className="login2-volver" to="/">← Volver al inicio</Link>
      </section>
    </div>
  );
}
