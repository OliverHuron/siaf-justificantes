import { useEffect, useState } from 'react';
import { apiBlob } from '../api.js';

const IMG_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'heic', 'avif'];

/** Visor de un adjunto (imagen o PDF) traído con el token de staff. */
export default function Adjunto({ url, mime, nombre }) {
  const [src, setSrc] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let vivo = true;
    let objUrl;
    setSrc(null);
    setErr('');
    apiBlob(url, 'staff')
      .then((u) => { if (vivo) { objUrl = u; setSrc(u); } })
      .catch((e) => vivo && setErr(e.message));
    return () => { vivo = false; if (objUrl) URL.revokeObjectURL(objUrl); };
  }, [url]);

  const ext = String(nombre || '').toLowerCase().split('.').pop();
  const m = String(mime || '').toLowerCase();
  const esImg = m.startsWith('image/') || IMG_EXT.includes(ext);
  const esPdf = m.includes('pdf') || ext === 'pdf';

  if (err) return <div className="aviso error">No se pudo cargar {nombre}: {err}</div>;

  return (
    <div className="adj-visor">
      <div className="adj-visor-top">
        <span className="hint mono">{nombre}</span>
        {src && <a href={src} target="_blank" rel="noreferrer">Abrir en pestaña nueva</a>}
      </div>
      <div className="adj-visor-box">
        {!src ? (
          <p className="hint">Cargando…</p>
        ) : esImg ? (
          <a href={src} target="_blank" rel="noreferrer"><img src={src} alt={nombre} /></a>
        ) : esPdf ? (
          <iframe title={nombre} src={`${src}#toolbar=1&view=FitH`} />
        ) : (
          <p className="hint">
            No se puede previsualizar este formato.{' '}
            <a href={src} target="_blank" rel="noreferrer">Descargar</a>.
          </p>
        )}
      </div>
    </div>
  );
}
