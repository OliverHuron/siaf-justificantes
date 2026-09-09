import { useEffect, useState } from 'react';

/**
 * Disparador tipo lista desplegable que abre un diálogo con las opciones en
 * cuadrícula y permite selección múltiple.
 *
 * @param {string}  label        título del diálogo
 * @param {Array}   opciones     [{ clave, etiqueta, marcado? }]
 * @param {string[]} value       claves seleccionadas
 * @param {Function} onChange
 * @param {number}  columnas     columnas de la cuadrícula (def. 6)
 * @param {string}  placeholder  texto cuando no hay selección
 * @param {string}  nota         texto de ayuda dentro del diálogo
 * @param {string[]} sugeridos   claves que se pueden marcar con un botón rápido
 * @param {string}  sugerirTexto etiqueta de ese botón
 * @param {Function} resumen     (etiquetasSeleccionadas[]) => string  para el disparador
 */
export default function SelectorGrid({
  label, opciones, value = [], onChange,
  columnas = 6, placeholder = 'Seleccionar…', nota,
  sugeridos, sugerirTexto = 'Marcar sugeridos', resumen,
}) {
  const [abierto, setAbierto] = useState(false);
  const sel = new Set(value);

  useEffect(() => {
    if (!abierto) return;
    const onKey = (e) => { if (e.key === 'Escape') setAbierto(false); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [abierto]);

  function toggle(clave) {
    const n = new Set(sel);
    if (n.has(clave)) n.delete(clave); else n.add(clave);
    onChange([...n]);
  }

  const etiquetasSel = opciones.filter((o) => sel.has(o.clave)).map((o) => o.etiqueta);
  const texto = etiquetasSel.length
    ? (resumen ? resumen(etiquetasSel) : etiquetasSel.join(', '))
    : placeholder;

  return (
    <>
      <button type="button" className={`sg-trigger${etiquetasSel.length ? '' : ' vacio'}`}
        onClick={() => setAbierto(true)}>
        <span className="sg-trigger-txt">{texto}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>

      {abierto && (
        <div className="sg-overlay" onClick={() => setAbierto(false)}>
          <div className="sg-dialog" role="dialog" aria-modal="true" aria-label={label}
            onClick={(e) => e.stopPropagation()}>
            <div className="sg-dialog-head">
              <strong>{label}</strong>
              <button type="button" className="sg-x" aria-label="Cerrar" onClick={() => setAbierto(false)}>×</button>
            </div>
            {nota && <p className="sg-nota">{nota}</p>}

            <div className="sg-grid" style={{ '--cols': columnas }}>
              {opciones.map((o) => (
                <button key={o.clave} type="button"
                  className={`sg-cell${sel.has(o.clave) ? ' on' : ''}${o.marcado ? ' curso' : ''}`}
                  onClick={() => toggle(o.clave)}>
                  {o.etiqueta}
                </button>
              ))}
            </div>

            {sugeridos && sugeridos.length > 0 && (
              <div className="sg-sugerir">
                <button type="button" onClick={() => onChange([...new Set([...value, ...sugeridos])])}>
                  {sugerirTexto}
                </button>
              </div>
            )}

            <div className="sg-dialog-foot">
              <button type="button" className="sg-link" onClick={() => onChange([])}>Limpiar</button>
              <button type="button" className="sg-ok" onClick={() => setAbierto(false)}>Listo</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
