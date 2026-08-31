'use strict';

require('dotenv').config();

const path = require('path');

function req(name) {
  const v = process.env[name];
  if (!v && process.env.NODE_ENV === 'production') {
    throw new Error(`Falta la variable de entorno obligatoria: ${name}`);
  }
  return v;
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5004', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  publicUrl: process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || '5004'}`,

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: req('DB_USER'),
    password: req('DB_PASSWORD'),
    database: req('DB_NAME'),
  },

  jwt: {
    secret: req('JWT_SECRET') || 'dev-insecure-secret',
    expire: process.env.JWT_EXPIRE || '7d',
    alumnoExpire: process.env.JWT_ALUMNO_EXPIRE || '2h',
  },

  otp: {
    ttlMin: parseInt(process.env.OTP_TTL_MIN || '10', 10),
    maxIntentos: parseInt(process.env.OTP_MAX_INTENTOS || '5', 10),
  },

  reglas: {
    pendientesMax: parseInt(process.env.PENDIENTES_MAX || '2', 10),
    diasLimiteSolicitud: parseInt(process.env.DIAS_LIMITE_SOLICITUD || '10', 10),
  },

  storagePath: path.resolve(process.env.STORAGE_PATH || './storage'),
  configEncKey: process.env.CONFIG_ENC_KEY || '',
  folioHmacSecret: process.env.FOLIO_HMAC_SECRET || 'dev-insecure-folio-secret',

  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'Justificantes FCCA <no-reply@umich.mx>',
  },

  seedPassword: process.env.SEED_PASSWORD || '123456',

  // Dominio institucional exigido a los alumnos.
  dominioAlumno: '@umich.mx',
};

module.exports = config;
