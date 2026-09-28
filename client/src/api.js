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
 * Sesión de personal caducada/inválida: limpia el token y manda al login,
 * para que no se quede "viendo" el panel sin poder hacer nada.
 */
function sesionStaffExpirada() {
  setToken('staff', null);
  try {
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/staff/acceso')) {
      window.location.href = '/staff/acceso';
    }
  } catch { /* noop */ }
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
  const usoStaff = tipo ? tipo === 'staff' : !!getToken('staff');
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
    if (res.status === 401 && usoStaff) sesionStaffExpirada();
    const msg = (data && data.error) || `Error ${res.status}`;
    throw new ApiError(res.status, msg, data);
  }
  return data;
}

/**
 * URL del stream SSE de "algo cambió" para el personal (nueva solicitud,
 * aprobación, rechazo, confirmación...). El token va en la query porque
 * EventSource no puede mandar el header Authorization.
 */
export function urlEventosStaff() {
  const tok = getToken('staff');
  return tok ? conBase(`/eventos/stream?token=${encodeURIComponent(tok)}`) : null;
}

/** Descarga binaria autenticada; devuelve un objectURL (recuerda revocarlo). */
export async function apiBlob(path, tipo) {
  const h = {};
  const tok = tipo ? getToken(tipo) : null;
  if (tok) h.Authorization = `Bearer ${tok}`;
  const res = await fetch(conBase(path), { headers: h });
  if (!res.ok) {
    if (res.status === 401 && tipo === 'staff') sesionStaffExpirada();
    throw new ApiError(res.status, `Error ${res.status}`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export { ApiError };
