import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

/**
 * Marco de las pantallas de acceso (estilo InvPatrimonio): panel izquierdo
 * institucional (foto + overlay azul diagonal + escudo + lema) y panel derecho
 * blanco con el escudo del zorro (que se orienta hacia el cursor) y la tarjeta.
 */
export default function LoginShell({ children }) {
  const anio = new Date().getFullYear();
  const zorro = useRef(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    let raf = 0;
    let mx = 0;
    let my = 0;
    const MAX = 14; // grados de inclinación máx.
    const RADIO = 420; // px: distancia a la que se alcanza el máximo

    function aplicar() {
      raf = 0;
      const el = zorro.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const nx = Math.max(-1, Math.min(1, (mx - cx) / RADIO));
      const ny = Math.max(-1, Math.min(1, (my - cy) / RADIO));
      el.style.setProperty('--rx', `${(nx * MAX).toFixed(2)}deg`);   // rotateY
      el.style.setProperty('--ry', `${(-ny * MAX).toFixed(2)}deg`);  // rotateX
      el.style.setProperty('--tx', `${(nx * 3).toFixed(2)}px`);
      el.style.setProperty('--ty', `${(ny * 3).toFixed(2)}px`);
    }
    function onMove(e) {
      mx = e.clientX;
      my = e.clientY;
      if (!raf) raf = requestAnimationFrame(aplicar);
    }
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="login2">
      <aside className="login2-brand">
        <div className="login2-brand-overlay" />
        <span className="login2-glow login2-glow--top" />
        <span className="login2-glow login2-glow--bottom" />

        <div className="login2-brand-content">
          <div className="login2-brand-top">
            <img src="/fcca_vec.png" alt="Logo FCCA" className="escudo" />
            <div>
              <h1 className="marca">FCCA</h1>
              <p className="marca-sub">Facultad de Contaduría y Ciencias Administrativas</p>
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
          <div className="login2-zorro" ref={zorro} aria-hidden="true">
            <img src="/zorro.png" alt="" />
          </div>

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
