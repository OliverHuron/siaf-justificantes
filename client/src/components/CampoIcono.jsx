import { useState } from 'react';

const ICONOS = {
  usuario: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-3.3 3.6-6 8-6s8 2.7 8 6" />,
  correo: <path d="M4 6h16v12H4zM4 7l8 6 8-6" />,
  candado: <path d="M6 10V8a6 6 0 0 1 12 0v2M5 10h14v10H5z" />,
  codigo: <path d="M8 6l-4 6 4 6M16 6l4 6-4 6" />,
};

/**
 * Input con icono a la izquierda. Si `type === 'password'` agrega el toggle de
 * mostrar/ocultar. El resto de props se pasan al <input>.
 */
export default function CampoIcono({ icono = 'usuario', type = 'text', ...props }) {
  const [ver, setVer] = useState(false);
  const esPass = type === 'password';
  return (
    <div className="campo-icono">
      <svg className="ci-izq" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {ICONOS[icono] || ICONOS.usuario}
      </svg>
      <input type={esPass ? (ver ? 'text' : 'password') : type} {...props} />
      {esPass && (
        <button type="button" className="ci-eye" tabIndex={-1} onClick={() => setVer((v) => !v)}
          aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
          {ver ? (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10 10 0 0 1 12 4c6 0 10 8 10 8a17 17 0 0 1-3.2 4M6.6 6.6A17 17 0 0 0 2 12s4 8 10 8a10 10 0 0 0 4-.8" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8z" /><circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
