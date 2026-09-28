-- El código OTP ya era de un solo uso, pero el JWT de sesión resultante (2h)
-- se podía reutilizar para enviar varias solicitudes sin volver a pedir OTP.
-- Ahora, al enviar una solicitud, el jti del token se marca como usado aquí;
-- cualquier petición posterior con ese mismo token es rechazada.

BEGIN;

CREATE TABLE IF NOT EXISTS alumno_tokens_usados (
  jti       text PRIMARY KEY,
  email     text NOT NULL,
  usado_en  timestamptz NOT NULL DEFAULT now()
);

COMMIT;
