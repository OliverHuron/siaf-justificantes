import { Link } from 'react-router-dom';

export default function AvisoPrivacidad() {
  return (
    <div className="wrap doc">
      <h1>Aviso de Privacidad Integral</h1>
      <p className="sub">Sistema de Justificantes de Inasistencia. FCCA, UMSNH. Última actualización: agosto de 2026.</p>

      <h2>1. Responsable del tratamiento</h2>
      <p>
        La <strong>Universidad Michoacana de San Nicolás de Hidalgo (UMSNH)</strong>, a través de la
        Secretaría Académica de la Facultad de Contaduría y Ciencias Administrativas (FCCA), con
        domicilio en <em>[domicilio de la FCCA, Ciudad Universitaria, Morelia, Michoacán (por confirmar)]</em>,
        es la responsable del tratamiento de los datos personales que se recaban a través de este sistema.
      </p>

      <h2>2. Datos personales que se tratan</h2>
      <p>Para tramitar y emitir el justificante de inasistencia se recaban:</p>
      <ul>
        <li><strong>De identificación y contacto:</strong> nombre completo, matrícula, correo electrónico institucional.</li>
        <li><strong>Académicos:</strong> semestre(s), sección(es) y días de inasistencia.</li>
        <li>
          <strong>Datos personales sensibles (de salud):</strong> la información contenida en la receta médica,
          la constancia de enfermería o el documento del médico tratante que usted adjunta, así como el
          comprobante de compra de medicamentos.
        </li>
        <li><strong>De la solicitud:</strong> fecha, hora y dirección IP desde la que se envía.</li>
      </ul>
      <p>
        Los <strong>datos sensibles</strong> se tratan únicamente con su <strong>consentimiento expreso</strong>,
        que usted otorga al marcar la casilla correspondiente en el formulario.
      </p>

      <h2>3. Finalidades</h2>
      <p><strong>Primarias</strong> (necesarias para el servicio):</p>
      <ul>
        <li>Recibir, revisar y resolver su solicitud de justificante.</li>
        <li>Emitir el oficio de justificación con folio y firma institucional.</li>
        <li>Notificar la justificación a los profesores de las materias afectadas y a control escolar.</li>
        <li>Llevar el control de folios y la trazabilidad (bitácora) de cada trámite.</li>
        <li>Comunicarnos con usted sobre el estado de su solicitud.</li>
      </ul>
      <p><strong>Secundarias</strong> (usted puede oponerse sin que afecte el trámite): elaboración de
        estadísticas internas y mejora del proceso, siempre en forma disociada.</p>

      <h2>4. Fundamento legal</h2>
      <p>
        El tratamiento se realiza con fundamento en la Ley General de Protección de Datos Personales en
        Posesión de Sujetos Obligados, la Ley de Protección de Datos Personales en Posesión de Sujetos
        Obligados del Estado de Michoacán de Ocampo, la Ley Orgánica y la normativa universitaria de la
        UMSNH, y demás disposiciones aplicables.
      </p>

      <h2>5. Transferencias y comunicaciones</h2>
      <p>
        Sus datos <strong>no se transfieren</strong> a terceros ajenos a la UMSNH. Dentro de la propia
        Universidad se comunican al personal docente de las materias afectadas y a las áreas de control
        escolar, para el registro de la inasistencia justificada. Podrán comunicarse a autoridades
        competentes cuando exista mandato legal.
      </p>

      <h2>6. Conservación</h2>
      <p>
        La solicitud, sus adjuntos y el folio emitido se conservan como <strong>evidencia académica y para
        efectos de auditoría</strong> durante los plazos que fije la normativa de archivo de la UMSNH.
        Concluidos esos plazos, se realiza su baja documental conforme a los instrumentos de control
        archivístico aplicables.
      </p>

      <h2>7. Derechos ARCO y revocación del consentimiento</h2>
      <p>
        Usted puede ejercer sus derechos de <strong>Acceso, Rectificación, Cancelación y Oposición</strong>,
        así como revocar el consentimiento otorgado, ante la Unidad de Transparencia de la UMSNH
        (Departamento de Transparencia y Acceso a la Información):
      </p>
      <ul>
        <li>Correo: <strong>infopub@umich.mx</strong></li>
        <li>Plataforma Nacional de Transparencia: <a href="https://www.plataformadetransparencia.org.mx" target="_blank" rel="noreferrer">plataformadetransparencia.org.mx</a></li>
        <li>Portal: <a href="https://www.informacionpublica.umich.mx" target="_blank" rel="noreferrer">informacionpublica.umich.mx</a></li>
      </ul>
      <p>
        La autoridad garante en la entidad es el Instituto Michoacano de Transparencia, Acceso a la
        Información y Protección de Datos Personales (IMAIP).
      </p>

      <h2>8. Tecnologías de rastreo</h2>
      <p>
        Este sitio utiliza únicamente almacenamiento local del navegador para mantener su sesión
        iniciada. No se emplean cookies de publicidad ni de rastreo de terceros.
      </p>

      <h2>9. Cambios al aviso</h2>
      <p>
        Cualquier modificación a este aviso se publicará en esta misma página, indicando la fecha de la
        última actualización.
      </p>

      <p style={{ marginTop: 28 }}><Link to="/">← Inicio</Link></p>
    </div>
  );
}
