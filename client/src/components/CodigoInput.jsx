import { useRef } from 'react';

/**
 * Entrada de código tipo OTP: `n` cuadros redondeados, un dígito por cuadro,
 * con auto-avance, borrado hacia atrás y pegado.
 * `value` es el string completo; `onChange` recibe el string.
 */
export default function CodigoInput({ value = '', onChange, n = 6, autoFocus = true }) {
  const refs = useRef([]);
  const chars = Array.from({ length: n }, (_, i) => value[i] || '');

  function setChar(i, ch) {
    const arr = value.padEnd(n, ' ').split('');
    arr[i] = ch || ' ';
    onChange(arr.join('').replace(/ /g, ''));
  }

  function onKey(i, e) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (chars[i]) setChar(i, '');
      else if (i > 0) { setChar(i - 1, ''); refs.current[i - 1]?.focus(); }
    } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    else if (e.key === 'ArrowRight' && i < n - 1) refs.current[i + 1]?.focus();
  }

  function onInput(i, e) {
    const d = e.target.value.replace(/\D/g, '');
    if (!d) return;
    if (d.length > 1) {
      // pegado
      const nuevo = (value.slice(0, i) + d).replace(/\D/g, '').slice(0, n);
      onChange(nuevo);
      refs.current[Math.min(nuevo.length, n - 1)]?.focus();
      return;
    }
    setChar(i, d);
    if (i < n - 1) refs.current[i + 1]?.focus();
  }

  return (
    <div className="otp">
      {chars.map((c, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className="otp-box"
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={c}
          autoFocus={autoFocus && i === 0}
          onChange={(e) => onInput(i, e)}
          onKeyDown={(e) => onKey(i, e)}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
