import { Link } from 'react-router-dom';

/**
 * Marco de las pantallas de acceso (estilo InvPatrimonio): panel izquierdo
 * institucional (foto + overlay azul diagonal + escudo + lema) y panel derecho
 * blanco con la tarjeta del formulario (`children`) y el sello SSL.
 */
export default function LoginShell({ children }) {
  const anio = new Date().getFullYear();
  return (
    <div className="login2">
      <aside className="login2-brand">
        <div className="login2-brand-overlay" />
        <span className="login2-glow login2-glow--top" />
        <span className="login2-glow login2-glow--bottom" />

        <div className="login2-brand-content">
          <div className="login2-brand-top">
            <img src="/UMSNHLogo1.png" alt="Logo UMSNH" className="escudo" />
            <div>
              <h1 className="marca">UMSNH</h1>
              <p className="marca-sub">Universidad Michoacana de San Nicolás de Hidalgo</p>
            </div>
          </div>

          <div className="login2-brand-mid">
            <h2>Sistema de Justificantes de Inasistencia</h2>
            <p className="lead">Facultad de Contaduría y Ciencias Administrativas</p>
            <div className="login2-quote">
              <p className="q">«Cuna de héroes, crisol de pensadores»</p>
              <p className="q-sub">Formando profesionales con compromiso social desde 1917</p>
            </div>
          </div>

          <div className="login2-brand-foot">© {anio} FCCA - Todos los derechos reservados</div>
        </div>
      </aside>

      <section className="login2-panel">
        <div className="login2-right-inner">
          <img src="/zorro.png" alt="" className="login2-zorro" />
          <div className="login2-card">{children}</div>

          <div className="login2-ssl">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>Conexión segura con cifrado SSL</span>
          </div>

          <Link className="login2-volver" to="/">← Volver al inicio</Link>
        </div>
      </section>
    </div>
  );
}
