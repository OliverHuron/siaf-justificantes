/**
 * Apps Script para vincular los folios de SIAF Justificantes con una hoja de
 * Google Sheets. El servidor manda un POST cada vez que se emite o se anula
 * un folio (ver server/src/lib/sheets.js), y este script agrega/actualiza
 * una fila en la hoja.
 *
 * Instalación:
 * 1. Crea (o abre) la hoja de cálculo donde quieres ver los folios. De su URL
 *    copia el ID: https://docs.google.com/spreadsheets/d/ESTE-ES-EL-ID/edit
 * 2. En el proyecto de Apps Script (da igual si es independiente o si lo
 *    abriste desde Extensiones > Apps Script), borra Code.gs y pega este archivo.
 * 3. Proyecto > Configuración del proyecto > Propiedades del script > agrega:
 *    - SECRETO: un valor largo y aleatorio (el mismo que vas a poner en
 *      Configuración > Google Sheets > Secreto, en el panel de SIAF).
 *    - SPREADSHEET_ID: el ID que copiaste en el paso 1.
 * 4. Implementar > Nueva implementación > tipo "Aplicación web".
 *    - Ejecutar como: Yo (tu cuenta).
 *    - Quién tiene acceso: Cualquier usuario.
 * 5. Copia la URL que termina en /exec y pégala en Configuración > Google
 *    Sheets > URL del Web App, en el panel de SIAF. Marca "Activo" y guarda.
 * 6. Usa el botón "Probar conexión" en esa misma pantalla para confirmar.
 *
 * Cada vez que se vuelve a implementar (Nueva implementación) la URL /exec
 * cambia solo si se crea una implementación nueva desde cero; al usar
 * "Gestionar implementaciones" > editar la existente, la URL se mantiene.
 */

var NOMBRE_HOJA = 'Folios';
var ENCABEZADOS = [
  'Registrado en', 'Folio', 'Alumno', 'Matrícula', 'Tipo', 'Días',
  'Fechas', 'Emitido en', 'Estado', 'Motivo anulación',
];

function doPost(e) {
  var datos;
  try {
    datos = JSON.parse(e.postData.contents);
  } catch (err) {
    return responder(400, { ok: false, error: 'JSON inválido' });
  }

  var secretoEsperado = PropertiesService.getScriptProperties().getProperty('SECRETO');
  if (secretoEsperado && datos.secreto !== secretoEsperado) {
    return responder(401, { ok: false, error: 'Secreto inválido' });
  }

  if (datos.accion === 'prueba') {
    return responder(200, { ok: true, mensaje: 'Conexión correcta' });
  }
  if (datos.accion === 'emitido') {
    registrarEmision(datos);
    return responder(200, { ok: true });
  }
  if (datos.accion === 'anulado') {
    registrarAnulacion(datos);
    return responder(200, { ok: true });
  }
  return responder(400, { ok: false, error: 'Acción no reconocida: ' + datos.accion });
}

function hoja() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  var libro = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!libro) {
    throw new Error('Falta la propiedad del script SPREADSHEET_ID (o abre este script desde Extensiones > Apps Script dentro de la hoja).');
  }
  var h = libro.getSheetByName(NOMBRE_HOJA);
  if (!h) {
    h = libro.insertSheet(NOMBRE_HOJA);
  }
  if (h.getLastRow() === 0) {
    h.appendRow(ENCABEZADOS);
    h.setFrozenRows(1);
  }
  return h;
}

function registrarEmision(d) {
  var h = hoja();
  h.appendRow([
    new Date(),
    d.folio || '',
    d.alumno || '',
    d.matricula || '',
    d.tipo || '',
    d.dias || '',
    Array.isArray(d.fechas) ? d.fechas.join(', ') : '',
    d.emitido_en || '',
    'Vigente',
    '',
  ]);
}

function registrarAnulacion(d) {
  var h = hoja();
  var colFolio = 2; // columna B
  var colEstado = 9; // columna I
  var colMotivo = 10; // columna J
  var valores = h.getRange(2, colFolio, Math.max(h.getLastRow() - 1, 0), 1).getValues();
  for (var i = 0; i < valores.length; i++) {
    if (valores[i][0] === d.folio) {
      var fila = i + 2;
      h.getRange(fila, colEstado).setValue('Anulado');
      h.getRange(fila, colMotivo).setValue(d.motivo || '');
      return;
    }
  }
  // No se encontró la fila (folio emitido antes de vincular Sheets): se agrega igual.
  h.appendRow([new Date(), d.folio || '', '', '', '', '', '', '', 'Anulado', d.motivo || '']);
}

function responder(codigo, obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
