'use strict';
/**
 * Vista previa en vivo de server/templates/oficio.html (solo desarrollo local).
 * Abre http://localhost:5055, edita y guarda oficio.html: la pestaña se recarga sola.
 *
 *   npm run preview:oficio
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { render } = require('../src/lib/plantillas');

const TPL_PATH = path.join(__dirname, '..', 'templates', 'oficio.html');
const PORT = process.env.PREVIEW_PORT || 5055;

// Datos de ejemplo, solo para la vista previa.
const VARS = {
  fecha_oficio: 'Morelia, Michoacán, a 12 de septiembre de 2026',
  folio: 'F-2026-0004-XY',
  destinatario: 'Profesores del Semestre séptimo, Sección 45',
  nombre: 'Oliver Otoniel Virrueta Montero',
  matricula: '2211930X',
  dias_texto_oficio: 'el día 29 de agosto del año en curso',
  frase_cuerpo:
    'debido por su participación en acto de graduación del programa cursado en ' +
    'escolarizado., situación que ha sido justificada ante esta Secretaría.',
  qr_data_uri: '',
  url_validacion: 'https://justificantes.siafsystem.online/validar?folio=F-2026-0004-XY',
};

let clientes = [];
function avisarRecarga() {
  clientes.forEach((res) => { try { res.write('data: reload\n\n'); } catch (_) { /* cliente cerrado */ } });
}

let debounce = null;
fs.watch(TPL_PATH, { persistent: true }, () => {
  clearTimeout(debounce);
  debounce = setTimeout(avisarRecarga, 100);
});

const SCRIPT_RECARGA = `
<script>
  (function conectar() {
    var es = new EventSource('/__events');
    es.onmessage = function () { location.reload(); };
    es.onerror = function () { es.close(); setTimeout(conectar, 500); };
  })();
</script>`;

const server = http.createServer((req, res) => {
  if (req.url === '/__events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('\n');
    clientes.push(res);
    req.on('close', () => { clientes = clientes.filter((c) => c !== res); });
    return;
  }

  try {
    const tpl = fs.readFileSync(TPL_PATH, 'utf8');
    const html = render(tpl, VARS).replace('</body>', `${SCRIPT_RECARGA}\n</body>`);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Error al renderizar oficio.html:\n' + e.stack);
  }
});

server.listen(PORT, () => {
  console.log(`Vista previa en vivo:  http://localhost:${PORT}`);
  console.log('Edita y guarda server/templates/oficio.html — la pestaña se recarga sola.');
});
