import { Link } from 'react-router-dom';

export default function Inicio() {
  return (
    <div className="wrap">
      <h1>Justificantes FCCA</h1>
      <p className="sub">
        Sistema de control y emisión de justificantes de inasistencia — Facultad de
        Contaduría y Ciencias Administrativas, UMSNH.
      </p>

      <div className="card">
        <h2>Para alumnos</h2>
        <p>Solicita un justificante con tu correo institucional <code>@umich.mx</code>.</p>
        <div className="fila">
          <Link className="btn" to="/solicitar">Solicitar justificante</Link>
          <Link className="btn sec" to="/mis-solicitudes">Ver mis solicitudes</Link>
        </div>
      </div>

      <div className="card">
        <h2>Verificar un justificante</h2>
        <p>Escanea el código QR del oficio o teclea el folio.</p>
        <Link className="btn sec" to="/validar">Verificar folio</Link>
      </div>

      <div className="card">
        <h2>Acceso institucional</h2>
        <div className="fila">
          <Link to="/staff">Personal (Secretaría Académica)</Link>
          <Link to="/enfermeria">Panel de Enfermería</Link>
        </div>
      </div>

      <p className="hint">
        <Link to="/aviso-de-privacidad">Aviso de Privacidad</Link>
      </p>
    </div>
  );
}
