'use strict';

/**
 * Pub/sub muy simple en memoria para avisar al personal por SSE de dos tipos
 * de cosas:
 * - 'cambio' / 'nueva_solicitud' / 'sesion': "algo cambió", sin datos extra —
 *   el cliente vuelve a pedir lo que ya pedía (Bandeja, Usuarios).
 * - 'notificacion': un aviso puntual con `nivel` ('exito'|'error') y
 *   `mensaje` para mostrar como toast (p. ej. que terminó de emitirse un
 *   folio en segundo plano, o que no se pudo después de reintentar).
 */
const clientes = new Set();

function suscribir(res) {
  clientes.add(res);
  return () => clientes.delete(res);
}

function emitir(tipo = 'cambio', extra = {}) {
  const linea = `data: ${JSON.stringify({ tipo, en: new Date().toISOString(), ...extra })}\n\n`;
  for (const res of clientes) {
    try {
      res.write(linea);
    } catch (_) {
      clientes.delete(res);
    }
  }
}

module.exports = { suscribir, emitir };
