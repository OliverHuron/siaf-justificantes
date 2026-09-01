'use strict';

/**
 * Siembra datos iniciales. Idempotente: se puede correr varias veces.
 *  - 4 cuentas de personal (contraseña temporal SEED_PASSWORD)
 *  - catálogo de secciones (lista del Google Form actual) y semestres
 *  - horario de PRUEBA para validar el envío de correos a profesores
 *  - plantillas base (correo + una de cuerpo del oficio)
 *  - configuración por defecto
 */

const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');
const config = require('../src/config');

// Lista de secciones tal cual aparece en el formulario actual (con huecos) + "Otro".
const SECCIONES = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
  16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
  31, 32, 33, 39, 40, 42, 44, 45, 46, 47, 48,
  60, 61, 74, 75, 80, 81, 82, 83, 90, 91, 92, 93,
];

const SEMESTRES = [
  'primero', 'segundo', 'tercero', 'cuarto', 'quinto',
  'sexto', 'septimo', 'octavo', 'noveno',
];
const SEMESTRE_ETIQUETA = {
  septimo: 'séptimo',
};

const USUARIOS = [
  { usuario: 'ventanilla',  nombre: 'Ventanilla (Encargada)', email: 'ventanilla@umich.mx',  rol: 'encargada' },
  { usuario: 'direccion',   nombre: 'Dirección (Supervisor)', email: 'direccion@umich.mx',   rol: 'supervisor' },
  { usuario: 'coordinador', nombre: 'Coordinación',           email: 'coordinador@umich.mx', rol: 'coordinador' },
  { usuario: 'enfermeria',  nombre: 'Enfermería FCCA',        email: 'enfermeria@umich.mx',  rol: 'enfermeria' },
];

// Horario de PRUEBA: semestre primero, sección 1. Lunes y martes.
const HORARIO_PRUEBA = [
  {
    ciclo_escolar: '2026', semestre: 'primero', seccion: '1',
    materia: 'Contabilidad 1', profesor_nombre: 'Profesor 1',
    profesor_correo: 'themr.hurongameplay@gmail.com', dia_semana: 1,
  },
  {
    ciclo_escolar: '2026', semestre: 'primero', seccion: '1',
    materia: 'Práctica Contable', profesor_nombre: null,
    profesor_correo: 'oliver2000.oovm@gmail.com', dia_semana: 2,
  },
];

const PLANTILLAS_CORREO = [
  { clave: 'acuse_recibido', titulo: 'Acuse de recibido',
    asunto: 'Recibimos tu solicitud de justificante ({{folio_o_id}})',
    cuerpo: 'Hola {{nombre}}:\n\nRecibimos tu solicitud de justificante. Puedes dar seguimiento aquí: {{enlace_seguimiento}}\n\nSecretaría Académica, FCCA.' },
  { clave: 'aprobado', titulo: 'Solicitud aprobada',
    asunto: 'Tu justificante fue aprobado ({{folio}})',
    cuerpo: 'Hola {{nombre}}:\n\nTu solicitud fue aprobada con folio {{folio}}. Se notificó a tus profesores.\n\nSecretaría Académica, FCCA.' },
  { clave: 'rechazo_receta_ilegible', titulo: 'Rechazo — receta ilegible',
    asunto: 'Tu solicitud de justificante requiere corrección',
    cuerpo: 'Hola {{nombre}}:\n\nNo fue posible aprobar tu solicitud porque la receta es ilegible. Vuelve a enviarla con una imagen clara.\n\n{{motivo_rechazo}}' },
  { clave: 'rechazo_falta_ticket', titulo: 'Rechazo — falta ticket',
    asunto: 'Tu solicitud de justificante requiere corrección',
    cuerpo: 'Hola {{nombre}}:\n\nFalta el ticket de compra de los medicamentos. Adjúntalo y vuelve a enviar la solicitud.' },
  { clave: 'rechazo_fechas', titulo: 'Rechazo — fechas no coinciden',
    asunto: 'Tu solicitud de justificante requiere corrección',
    cuerpo: 'Hola {{nombre}}:\n\nLas fechas señaladas no coinciden con las de la receta.\n\n{{motivo_rechazo}}' },
  { clave: 'pasar_ventanilla', titulo: 'Pasar a ventanilla',
    asunto: 'Tu solicitud requiere asistencia en ventanilla',
    cuerpo: 'Hola {{nombre}}:\n\nPara continuar, presenta el documento original en ventanilla de la Secretaría Académica.\n\n{{nota}}' },
  { clave: 'solicitud_informacion', titulo: 'Solicitud de información',
    asunto: 'Necesitamos más información sobre tu solicitud',
    cuerpo: 'Hola {{nombre}}:\n\nPara poder continuar necesitamos que aclares lo siguiente:\n\n{{nota}}' },
];

const PLANTILLA_CUERPO = {
  clave: 'generica',
  titulo: 'Cuerpo genérico (editar)',
  cuerpo:
    'por motivos de salud debidamente acreditados ante esta Secretaría de acuerdo a los ' +
    'documentos que nos presenta.',
};

const CONFIG_DEFAULT = [
  ['ciclo_activo', JSON.stringify('2026')],
  ['folio', JSON.stringify({ prefijo: 'F', reinicia_por_anio: true })],
  ['reglas', JSON.stringify({
    pendientes_max: config.reglas.pendientesMax,
    dias_limite_solicitud: config.reglas.diasLimiteSolicitud,
    dias_habiles: true,
  })],
  ['smtp', JSON.stringify({
    host: config.smtp.host, port: config.smtp.port,
    user: config.smtp.user, from: config.smtp.from, pass_cifrada: null,
  })],
  ['textos', JSON.stringify({
    aviso_corto:
      'Tus datos personales (incluidos datos de salud) se tratan conforme al Aviso de ' +
      'Privacidad. La UMSNH es responsable de su tratamiento.',
    form_dominio_rechazado:
      'Solo se aceptan correos institucionales que terminen en @umich.mx.',
  })],
  ['feriados', JSON.stringify([])], // ['2026-09-16', ...] — días no hábiles adicionales
];

async function upsertUsuarios() {
  const hash = await bcrypt.hash(config.seedPassword, 12);
  for (const u of USUARIOS) {
    await pool.query(
      `INSERT INTO usuarios (usuario, nombre, email, password_hash, rol, must_change_password)
       VALUES ($1,$2,$3,$4,$5,true)
       ON CONFLICT (usuario) DO UPDATE
         SET nombre = EXCLUDED.nombre, email = EXCLUDED.email, rol = EXCLUDED.rol`,
      [u.usuario, u.nombre, u.email, hash, u.rol]
    );
  }
  console.log(`  usuarios: ${USUARIOS.length} (contraseña temporal "${config.seedPassword}")`);
}

async function upsertCatalogos() {
  for (let i = 0; i < SECCIONES.length; i++) {
    const s = String(SECCIONES[i]);
    await pool.query(
      `INSERT INTO secciones (clave, etiqueta, orden) VALUES ($1,$2,$3)
       ON CONFLICT (clave) DO UPDATE SET etiqueta = EXCLUDED.etiqueta, orden = EXCLUDED.orden`,
      [s, s, i]
    );
  }
  await pool.query(
    `INSERT INTO secciones (clave, etiqueta, orden) VALUES ('otro','Otro',999)
     ON CONFLICT (clave) DO NOTHING`
  );
  for (let i = 0; i < SEMESTRES.length; i++) {
    const s = SEMESTRES[i];
    await pool.query(
      `INSERT INTO semestres (clave, etiqueta, orden) VALUES ($1,$2,$3)
       ON CONFLICT (clave) DO UPDATE SET etiqueta = EXCLUDED.etiqueta, orden = EXCLUDED.orden`,
      [s, SEMESTRE_ETIQUETA[s] || s, i]
    );
  }
  console.log(`  catálogos: ${SECCIONES.length + 1} secciones, ${SEMESTRES.length} semestres`);
}

async function upsertHorarioPrueba() {
  for (const h of HORARIO_PRUEBA) {
    const dup = await pool.query(
      `SELECT 1 FROM horarios
        WHERE ciclo_escolar=$1 AND semestre=$2 AND seccion=$3 AND materia=$4 AND profesor_correo=$5`,
      [h.ciclo_escolar, h.semestre, h.seccion, h.materia, h.profesor_correo]
    );
    if (dup.rowCount) continue;
    await pool.query(
      `INSERT INTO horarios
        (ciclo_escolar, semestre, seccion, materia, profesor_nombre, profesor_correo, dia_semana)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [h.ciclo_escolar, h.semestre, h.seccion, h.materia, h.profesor_nombre, h.profesor_correo, h.dia_semana]
    );
  }
  console.log(`  horario de prueba: semestre primero / sección 1 (lunes y martes)`);
}

async function upsertPlantillas() {
  for (const p of PLANTILLAS_CORREO) {
    await pool.query(
      `INSERT INTO plantillas (ambito, clave, titulo, asunto, cuerpo)
       VALUES ('correo',$1,$2,$3,$4)
       ON CONFLICT (ambito, clave) DO NOTHING`,
      [p.clave, p.titulo, p.asunto, p.cuerpo]
    );
  }
  await pool.query(
    `INSERT INTO plantillas (ambito, clave, titulo, asunto, cuerpo)
     VALUES ('cuerpo_oficio',$1,$2,NULL,$3)
     ON CONFLICT (ambito, clave) DO NOTHING`,
    [PLANTILLA_CUERPO.clave, PLANTILLA_CUERPO.titulo, PLANTILLA_CUERPO.cuerpo]
  );
  console.log(`  plantillas: ${PLANTILLAS_CORREO.length} de correo, 1 de cuerpo`);
}

async function upsertConfig() {
  for (const [clave, valor] of CONFIG_DEFAULT) {
    await pool.query(
      `INSERT INTO config (clave, valor) VALUES ($1,$2::jsonb)
       ON CONFLICT (clave) DO NOTHING`,
      [clave, valor]
    );
  }
  const anio = new Date().getFullYear();
  await pool.query(
    `INSERT INTO folio_consecutivo (anio, siguiente) VALUES ($1, 1)
     ON CONFLICT (anio) DO NOTHING`,
    [anio]
  );
  console.log(`  config: ${CONFIG_DEFAULT.length} claves, consecutivo de folio ${anio}`);
}

async function main() {
  console.log('Sembrando datos iniciales…');
  await upsertUsuarios();
  await upsertCatalogos();
  await upsertHorarioPrueba();
  await upsertPlantillas();
  await upsertConfig();
  console.log('Listo.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
