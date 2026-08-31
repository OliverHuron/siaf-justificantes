import { useEffect, useState } from 'react';
import { apiBlob } from '../api.js';

/** Muestra un adjunto (imagen o PDF) trayéndolo con el token de staff. */
export default function Adjunto({ url, mime, nombre }) {
  const [src, setSrc] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let vivo = true;
    let objUrl;
    apiBlob(url, 'staff')
      .then((u) => { if (vivo) { objUrl = u; setSrc(u); } })
      .catch((e) => vivo && setErr(e.message));
    return () => { vivo = false; if (objUrl) URL.revokeObjectURL(objUrl); };
  }, [url]);

  if (err) return <div className="aviso error">No se pudo cargar {nombre}: {err}</div>;
  if (!src) return <p className="hint">Cargando {nombre}…</p>;

  const esImg = (mime || '').startsWith('image/');
  return (
    <div className="evidencia" style={{ marginBottom: 12 }}>
      <div className="hint">{nombre}</div>
      {esImg ? (
        <a href={src} target="_blank" rel="noreferrer"><img src={src} alt={nombre} /></a>
      ) : (
        <iframe title={nombre} src={src} style={{ width: '100%', height: 460, border: '1px solid var(--borde)', borderRadius: 8 }} />
      )}
      <div><a href={src} target="_blank" rel="noreferrer">Abrir en pestaña nueva</a></div>
    </div>
  );
}
