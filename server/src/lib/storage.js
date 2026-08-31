'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const config = require('../config');
const { ApiError } = require('../middleware/error');

const DIR_ADJUNTOS = path.join(config.storagePath, 'adjuntos');
const DIR_FOLIOS = path.join(config.storagePath, 'folios');

for (const d of [config.storagePath, DIR_ADJUNTOS, DIR_FOLIOS]) {
  fs.mkdirSync(d, { recursive: true });
}

const MIMES_OK = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
]);

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB (alineado con client_max_body_size de nginx)

const almacenamiento = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DIR_ADJUNTOS),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 10) || '';
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

function filtro(req, file, cb) {
  if (!MIMES_OK.has(file.mimetype)) {
    return cb(new ApiError(400, `Tipo de archivo no permitido: ${file.mimetype}. Usa JPG, PNG o PDF.`));
  }
  cb(null, true);
}

const upload = multer({
  storage: almacenamiento,
  fileFilter: filtro,
  limits: { fileSize: MAX_BYTES, files: 6 },
});

/** Borra físicamente un archivo de adjunto (best-effort). */
function borrarArchivo(rutaRelativa) {
  try {
    fs.unlinkSync(path.join(config.storagePath, rutaRelativa));
  } catch (_) {
    /* ignore */
  }
}

/** Ruta absoluta a partir de la ruta relativa guardada en BD. */
function rutaAbsoluta(rutaRelativa) {
  return path.join(config.storagePath, rutaRelativa);
}

/** Ruta relativa (para BD) a partir del archivo que dejó multer. */
function relativaDeMulter(file) {
  return path.relative(config.storagePath, file.path).split(path.sep).join('/');
}

module.exports = {
  upload,
  borrarArchivo,
  rutaAbsoluta,
  relativaDeMulter,
  DIR_ADJUNTOS,
  DIR_FOLIOS,
};
