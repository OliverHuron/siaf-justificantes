import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth.jsx';

const I = {
  bandeja: <path d="M3 7h18M3 12h18M3 17h18" />,
  folios: <path d="M6 2h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM14 2v6h6" />,
  consolidado: <path d="M4 4h16v4H4zM4 12h10v8H4zM17 12h3v8h-3z" />,
  config: <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.4 2H9.6L9.2 4.6a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L5.1 11a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 2.6h4.8l.4-2.6a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6c.1-.3.1-.7.1-1z" />,
};

function Ic({ d }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round">{d}</svg>
  );
}

const TITULOS = [
  [/\/staff\/bandeja$/, 'Bandeja de solicitudes'],
  [/\/staff\/solicitud\//, 'Revisión de solicitud'],
  [/\/staff\/folios$/, 'Folios emitidos'],
  [/\/staff\/consolidado$/, 'Consolidado'],
  [/\/staff\/configuracion$/, 'Configuración'],
];

export default function StaffLayout() {
  const { staff, logoutStaff } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const esSup = staff.rol === 'supervisor';
  const titulo = (TITULOS.find(([re]) => re.test(loc.pathname)) || [, 'Justificantes FCCA'])[1];
  const iniciales = (staff.nombre || staff.usuario || '?').split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase();

  const link = ({ isActive }) => (isActive ? 'activo' : '');

  return (
    <div className="shell">
      <aside className="shell-side">
        <img className="logo" src="/umsnh_logo.png" alt="UMSNH" />
        <nav>
          <NavLink to="/staff/bandeja" className={link}><Ic d={I.bandeja} />Bandeja</NavLink>
          <NavLink to="/staff/folios" className={link}><Ic d={I.folios} />Folios</NavLink>
          <NavLink to="/staff/consolidado" className={link}><Ic d={I.consolidado} />Consolidado</NavLink>
          {esSup && <NavLink to="/staff/configuracion" className={link}><Ic d={I.config} />Configuración</NavLink>}
        </nav>
        <div className="pie">#HumanistaPorSiempre</div>
      </aside>

      <header className="shell-top">
        <span className="titulo">{titulo}</span>
        <div className="usuario">
          <div className="datos">
            <div className="n">{staff.nombre || staff.usuario}</div>
            <div className="r">{staff.rol}</div>
          </div>
          <div className="avatar">{iniciales}</div>
          <button onClick={() => { logoutStaff(); nav('/'); }}>Salir</button>
        </div>
      </header>

      <main className="shell-main">
        {staff.must_change_password && (
          <div className="aviso info">Tu contraseña es temporal. Cámbiala pronto (pendiente de UI).</div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
