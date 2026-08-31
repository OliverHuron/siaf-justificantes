import { createContext, useContext, useState, useCallback } from 'react';
import { api, getToken, setToken } from './api.js';

const Ctx = createContext(null);

function decodeJwt(t) {
  try {
    return JSON.parse(atob(t.split('.')[1]));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [staff, setStaff] = useState(() => {
    const t = getToken('staff');
    return t ? decodeJwt(t) : null;
  });
  const [alumno, setAlumno] = useState(() => {
    const t = getToken('alumno');
    return t ? decodeJwt(t) : null;
  });

  const loginStaff = useCallback(async (usuario, password) => {
    const r = await api('/auth/login', { body: { usuario, password } });
    setToken('staff', r.token);
    setStaff({ ...decodeJwt(r.token), ...r.usuario });
    return r.usuario;
  }, []);

  const logoutStaff = useCallback(() => {
    setToken('staff', null);
    setStaff(null);
  }, []);

  const setAlumnoToken = useCallback((token) => {
    setToken('alumno', token);
    setAlumno(token ? decodeJwt(token) : null);
  }, []);

  return (
    <Ctx.Provider value={{ staff, alumno, loginStaff, logoutStaff, setAlumnoToken }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
