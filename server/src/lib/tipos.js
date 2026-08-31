'use strict';

/**
 * Tipos de solicitud y su regla de evidencia (PLAN §3).
 * `adjuntos` = campos de archivo obligatorios en el formulario.
 * `origen` = quién puede crear ese tipo.
 * `exentoVentana` = no aplica la regla de días hábiles.
 */
const TIPOS = {
  receta_imss: {
    etiqueta: 'Receta IMSS',
    adjuntos: ['receta', 'ticket'],
    origen: 'alumno',
    exentoVentana: false,
  },
  receta_particular: {
    etiqueta: 'Receta particular',
    adjuntos: ['receta', 'ticket'],
    origen: 'alumno',
    exentoVentana: false,
  },
  caso_especial: {
    etiqueta: 'Caso especial',
    adjuntos: ['documento_medico'],
    origen: 'alumno',
    exentoVentana: true,
  },
  enfermeria_fcca: {
    etiqueta: 'Enfermería FCCA',
    adjuntos: ['constancia'],
    origen: 'enfermeria',
    exentoVentana: true,
  },
};

const MAPA_CAMPO_A_TIPO_ADJUNTO = {
  receta: 'receta',
  ticket: 'ticket',
  documento_medico: 'documento_medico',
  constancia: 'constancia',
};

/** Lista para el formulario del alumno (excluye enfermería). */
function tiposParaAlumno() {
  return Object.entries(TIPOS)
    .filter(([, v]) => v.origen === 'alumno')
    .map(([clave, v]) => ({ clave, etiqueta: v.etiqueta, adjuntos: v.adjuntos }));
}

module.exports = { TIPOS, MAPA_CAMPO_A_TIPO_ADJUNTO, tiposParaAlumno };
