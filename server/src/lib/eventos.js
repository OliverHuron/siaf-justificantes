'use strict';

/**
 * Pub/sub muy simple en memoria para avisar a la Bandeja del personal que
 * "algo cambió" (nueva solicitud, aprobación, rechazo, confirmación) y así
 * pueda refrescarse sola por SSE en vez de necesitar F5. No manda datos, solo
 * la señal — el cliente vuelve a pedir /revision/cola como ya hacía.
 */
const clientes = new Set();

function suscribir(res) {
  clientes.add(res);
  return () => clientes.delete(res);
}

function emitir(tipo = 'cambio') {
  const linea = `data: ${JSON.stringify({ tipo, en: new Date().toISOString() })}\n\n`;
  for (const res of clientes) {
    try {
      res.write(linea);
    } catch (_) {
      clientes.delete(res);
    }
  }
}

module.exports = { suscribir, emitir };
