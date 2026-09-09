import { Link } from 'react-router-dom';

export default function Inicio() {
  return (
    <>
      <div className="topbar">
        <div className="marca"><img src="/umsnh_logo.png" alt="UMSNH" /> Justificantes FCCA</div>
      </div>
      <div className="wrap">
        <h1>Sistema de justificantes de inasistencia</h1>
        <p className="sub">Facultad de Contaduría y Ciencias Administrativas — UMSNH.</p>

        <div className="card">
          <h2>Para alumnos</h2>
          <p>Solicita un justificante con tu correo institucional <code>@umich.mx</code>.</p>
          <div className="fila">
            <Link className="btn" to="/solicitar/acceso">Solicitar justificante</Link>
          </div>
          <p className="hint">Recibirás un acuse por correo. La Secretaría te contactará si hace falta.</p>
        </div>

        <div className="card">
          <h2>Verificar un justificante</h2>
          <p>Escanea el código QR del oficio o teclea el folio.</p>
          <Link className="btn sec" to="/validar">Verificar folio</Link>
        </div>

        <div className="card">
          <h2>Acceso institucional</h2>
          <div className="fila">
            <Link className="btn plano" to="/staff">Personal (Secretaría Académica)</Link>
            <Link className="btn plano" to="/enfermeria">Panel de Enfermería</Link>
          </div>
        </div>

        <p className="hint"><Link to="/aviso-de-privacidad">Aviso de Privacidad</Link></p>
      </div>
    </>
  );
}
