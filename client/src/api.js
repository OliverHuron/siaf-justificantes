const TOKENS = {
  staff: 'sj_staff_token',
  alumno: 'sj_alumno_token',
};

export function getToken(tipo) {
  try {
    return localStorage.getItem(TOKENS[tipo]) || null;
  } catch {
    return null;
  }
}
export function setToken(tipo, val) {
  try {
    if (val) localStorage.setItem(TOKENS[tipo], val);
    else localStorage.removeItem(TOKENS[tipo]);
  } catch {
    /* modo privado */
  }
}

/** Antepone /api salvo que la ruta ya lo traiga (tolera urls tipo `/api/revision/…`). */
function conBase(path) {
  const p = String(path || '');
  return p.startsWith('/api/') || p === '/api' ? p : `/api${p}`;
}

class ApiError extends Error {
  constructor(status, message, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/**
 * Llama a /api. `opts.tipo` = 'staff' | 'alumno' para adjuntar el bearer.
 * `opts.body` objeto -> JSON; si es FormData se envía tal cual.
 */
export async function api(path, opts = {}) {
  const { tipo, body, method, headers = {}, ...rest } = opts;
  const h = { ...headers };
  // Si no se especifica `tipo`, se adjunta el token de staff si existe, si no el
  // de alumno. Los endpoints públicos ignoran el header; los protegidos validan
  // el tipo del token, así que un token equivocado simplemente da 401.
  const tok = tipo ? getToken(tipo) : (getToken('staff') || getToken('alumno'));
  if (tok) h.Authorization = `Bearer ${tok}`;

  let payload = body;
  if (body && !(body instanceof FormData)) {
    h['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(conBase(path), {
    method: method || (body ? 'POST' : 'GET'),
    headers: h,
    body: payload,
    ...rest,
  });

  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const msg = (data && data.error) || `Error ${res.status}`;
    throw new ApiError(res.status, msg, data);
  }
  return data;
}

/** Descarga binaria autenticada; devuelve un objectURL (recuerda revocarlo). */
export async function apiBlob(path, tipo) {
  const h = {};
  const tok = tipo ? getToken(tipo) : null;
  if (tok) h.Authorization = `Bearer ${tok}`;
  const res = await fetch(conBase(path), { headers: h });
  if (!res.ok) throw new ApiError(res.status, `Error ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export { ApiError };
