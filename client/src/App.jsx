import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth.jsx';

import Inicio from './pages/Inicio.jsx';
import AlumnoLogin from './pages/alumno/Login.jsx';
import NuevaSolicitud from './pages/alumno/NuevaSolicitud.jsx';
import Validar from './pages/Validar.jsx';
import AvisoPrivacidad from './pages/AvisoPrivacidad.jsx';
import StaffLogin from './pages/staff/Login.jsx';
import StaffLayout from './pages/staff/Layout.jsx';
import Bandeja from './pages/staff/Bandeja.jsx';
import Cuenta from './pages/staff/Cuenta.jsx';
import ExpedienteModal from './pages/staff/ExpedienteModal.jsx';
import Folios from './pages/staff/Folios.jsx';
import Consolidado from './pages/staff/Consolidado.jsx';
import Configuracion from './pages/staff/Configuracion.jsx';
import EnfermeriaPanel from './pages/enfermeria/Panel.jsx';

/** En /solicitar/acceso: pide el código si no hay sesión; ya autenticado, muestra el formulario. */
function SolicitarAcceso() {
  const { alumno } = useAuth();
  return alumno ? <NuevaSolicitud /> : <AlumnoLogin />;
}

function RequiereStaff({ roles, children }) {
  const { staff } = useAuth();
  if (!staff) return <Navigate to="/staff/acceso" replace />;
  if (roles && !roles.includes(staff.rol)) {
    return (
      <div className="wrap">
        <h1>Sin permiso</h1>
        <p className="sub">Tu rol ({staff.rol}) no tiene acceso a esta sección.</p>
        <Link to="/staff">← Volver</Link>
      </div>
    );
  }
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Inicio />} />

        {/* Alumno */}
        <Route path="/solicitar/acceso" element={<SolicitarAcceso />} />
        <Route path="/solicitar" element={<Navigate to="/solicitar/acceso" replace />} />

        {/* Público */}
        <Route path="/validar" element={<Validar />} />
        <Route path="/aviso-de-privacidad" element={<AvisoPrivacidad />} />

        {/* Enfermería */}
        <Route path="/enfermeria/acceso" element={<StaffLogin destino="/enfermeria" />} />
        <Route
          path="/enfermeria"
          element={<RequiereStaff roles={['enfermeria']}><EnfermeriaPanel /></RequiereStaff>}
        />

        {/* Staff */}
        <Route path="/staff/acceso" element={<StaffLogin destino="/staff" />} />
        <Route
          path="/staff"
          element={<RequiereStaff roles={['encargada', 'supervisor', 'coordinador']}><StaffLayout /></RequiereStaff>}
        >
          <Route index element={<Navigate to="bandeja" replace />} />
          <Route path="bandeja" element={<Bandeja />} />
          <Route path="cuenta" element={<Cuenta />} />
          <Route path="solicitud/:id" element={<><Bandeja /><ExpedienteModal /></>} />
          <Route path="folios" element={<Folios />} />
          <Route path="consolidado" element={<Consolidado />} />
          <Route
            path="configuracion"
            element={<RequiereStaff roles={['supervisor']}><Configuracion /></RequiereStaff>}
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
