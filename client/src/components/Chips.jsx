/** Grupo de opciones seleccionables (multi). `opciones` = [{clave,etiqueta}]. */
export default function Chips({ opciones, value = [], onChange, unico = false }) {
  const sel = new Set(value);
  function toggle(clave) {
    if (unico) {
      onChange(sel.has(clave) ? [] : [clave]);
      return;
    }
    const next = new Set(sel);
    if (next.has(clave)) next.delete(clave);
    else next.add(clave);
    onChange([...next]);
  }
  return (
    <div className="chips">
      {opciones.map((o) => (
        <span
          key={o.clave}
          className={`chip${sel.has(o.clave) ? ' on' : ''}`}
          onClick={() => toggle(o.clave)}
        >
          {o.etiqueta}
        </span>
      ))}
    </div>
  );
}
