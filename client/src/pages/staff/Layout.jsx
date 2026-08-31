import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth.jsx';

export default function StaffLayout() {
  const { staff, logoutStaff } = useAuth();
  const nav = useNavigate();
  const esSup = staff.rol === 'supervisor';

  return (
    <div className="app">
      <nav className="side">
        <div className="marca">Justificantes FCCA</div>
        <div className="rol">{staff.nombre || staff.usuario} · {staff.rol}</div>
        <NavLink to="/staff/bandeja" className={({ isActive }) => (isActive ? 'activo' : '')}>Bandeja</NavLink>
        <NavLink to="/staff/folios" className={({ isActive }) => (isActive ? 'activo' : '')}>Folios</NavLink>
        <NavLink to="/staff/consolidado" className={({ isActive }) => (isActive ? 'activo' : '')}>Consolidado</NavLink>
        {esSup && (
          <NavLink to="/staff/configuracion" className={({ isActive }) => (isActive ? 'activo' : '')}>Configuración</NavLink>
        )}
        <div className="salir">
          <button className="plano mini" onClick={() => { logoutStaff(); nav('/'); }}>Cerrar sesión</button>
        </div>
      </nav>
      <main className="main">
        {staff.must_change_password && (
          <div className="aviso info">Tu contraseña es temporal. Cámbiala pronto (pendiente de UI).</div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
