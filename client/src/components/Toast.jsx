import { useEffect, useRef, useState } from 'react';
import { urlEventosStaff } from '../api.js';

let siguienteId = 1;

/**
 * Avisos flotantes (toast) para el personal, alimentados por el mismo SSE de
 * "algo cambió" (eventos tipo 'notificacion'): usado sobre todo para avisar
 * cuando termina (o falla) el envío en segundo plano del PDF/correos de un
 * folio, ya que esa parte ya no bloquea la respuesta de Aprobar/Confirmar.
 */
export default function Toast() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const url = urlEventosStaff();
    if (!url) return undefined;
    const es = new EventSource(url);
    es.onmessage = (e) => {
      let datos;
      try { datos = JSON.parse(e.data); } catch { return; }
      if (datos.tipo !== 'notificacion') return;
      const id = siguienteId++;
      setItems((lista) => [...lista, { id, nivel: datos.nivel || 'exito', mensaje: datos.mensaje || '' }]);
      const duracion = datos.nivel === 'error' ? 12000 : 6000;
      setTimeout(() => setItems((lista) => lista.filter((t) => t.id !== id)), duracion);
    };
    return () => es.close();
  }, []);

  function cerrar(id) {
    setItems((lista) => lista.filter((t) => t.id !== id));
  }

  if (!items.length) return null;
  return (
    <div className="toast-pila">
      {items.map((t) => (
        <div key={t.id} className={`toast toast-${t.nivel}`}>
          <span>{t.mensaje}</span>
          <button type="button" className="toast-x" aria-label="Cerrar" onClick={() => cerrar(t.id)}>×</button>
        </div>
      ))}
    </div>
  );
}
