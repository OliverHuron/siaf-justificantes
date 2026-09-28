'use strict';

const express = require('express');
const multer = require('multer');
const db = require('../db');
const { ApiError } = require('../middleware/error');
const { requireStaff, requireRol } = require('../middleware/auth');

const router = express.Router();
router.use(requireStaff, requireRol('supervisor'));

const subirCsv = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

/** Parser CSV minimalista (comillas dobles, separador coma). */
function parseCsv(texto) {
  const filas = [];
  const lineas = texto.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim() !== '');
  for (const linea of lineas) {
    const campos = [];
    let cur = '';
    let enComillas = false;
    for (let i = 0; i < linea.length; i++) {
      const ch = linea[i];
      if (enComillas) {
        if (ch === '"' && linea[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') enComillas = false;
        else cur += ch;
      } else if (ch === '"') enComillas = true;
      else if (ch === ',') { campos.push(cur); cur = ''; }
      else cur += ch;
    }
    campos.push(cur);
    filas.push(campos.map((c) => c.trim()));
  }
  return filas;
}

// Normaliza un encabezado de columna: sin acentos, sin espacios/guiones, minúsculas.
// Así aceptamos tanto el CSV oficial (ProfAsigNombre, Sem, Secc, ...) como variantes.
function normEncabezado(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]/g, '');
}

const ALIAS = {
  nombre: 'nombre', profasignombre: 'nombre',
  apepate: 'ape_pate', profasigapepate: 'ape_pate',
  apemate: 'ape_mate', profasigapemate: 'ape_mate',
  correo: 'correo', email: 'correo',
  materia: 'materia',
  sem: 'sem', semestre: 'sem',
  secc: 'secc', seccion: 'secc',
};

/** GET /api/profesores?sem=&secc=&materia=&q= */
router.get('/', async (req, res, next) => {
  try {
    const cond = [];
    const val = [];
    if (req.query.sem) { val.push(Number(req.query.sem)); cond.push(`sem = $${val.length}`); }
    if (req.query.secc) { val.push(Number(req.query.secc)); cond.push(`secc = $${val.length}`); }
    if (req.query.q) {
      val.push(`%${req.query.q}%`);
      cond.push(`(materia ILIKE $${val.length} OR correo ILIKE $${val.length} OR prof_asig_nombre ILIKE $${val.length})`);
    }
    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
    const r = await db.query(
      `SELECT id, sem, secc, materia,
              trim(concat_ws(' ', prof_asig_nombre, prof_asig_ape_pate, prof_asig_ape_mate)) AS profesor_nombre,
              correo
         FROM profesores_asignatura
         ${where}
         ORDER BY sem, secc, materia
         LIMIT 2000`,
      val
    );
    res.json(r.rows);
  } catch (e) {
    next(e);
  }
});

/** POST /api/profesores  — alta individual. { sem, secc, materia, nombre, correo } */
router.post('/', async (req, res, next) => {
  try {
    const b = req.body || {};
    const sem = Number(b.sem);
    const secc = Number(b.secc);
    if (!sem || !secc || !b.materia || !b.nombre || !b.correo) {
      throw new ApiError(400, 'Faltan campos (sem, secc, materia, nombre, correo)');
    }
    const r = await db.query(
      `INSERT INTO profesores_asignatura (prof_asig_nombre, correo, materia, sem, secc)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (lower(correo), lower(materia), sem, secc) DO UPDATE SET prof_asig_nombre = EXCLUDED.prof_asig_nombre
       RETURNING id`,
      [String(b.nombre).trim(), String(b.correo).trim().toLowerCase(), String(b.materia).trim(), sem, secc]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    next(e);
  }
});

/** PATCH /api/profesores/:id  { sem?, secc?, materia?, nombre?, correo? } */
router.patch('/:id', async (req, res, next) => {
  try {
    const b = req.body || {};
    const sem = b.sem != null && b.sem !== '' ? Number(b.sem) : null;
    const secc = b.secc != null && b.secc !== '' ? Number(b.secc) : null;
    // El formulario maneja el nombre como un solo campo (prof_asig_nombre); si se
    // edita, se limpian apellido paterno/materno para no arrastrar datos viejos de
    // una importación CSV previa (que sí separa nombre/ape_pate/ape_mate) y que se
    // dupliquen al concatenarlos.
    const r = await db.query(
      `UPDATE profesores_asignatura SET
         sem = COALESCE($2, sem),
         secc = COALESCE($3, secc),
         materia = COALESCE($4, materia),
         prof_asig_nombre = COALESCE($5, prof_asig_nombre),
         prof_asig_ape_pate = CASE WHEN $5::text IS NOT NULL THEN NULL ELSE prof_asig_ape_pate END,
         prof_asig_ape_mate = CASE WHEN $5::text IS NOT NULL THEN NULL ELSE prof_asig_ape_mate END,
         correo = COALESCE($6, correo)
       WHERE id = $1
       RETURNING id`,
      [
        req.params.id, sem, secc,
        b.materia ? String(b.materia).trim() : null,
        b.nombre ? String(b.nombre).trim() : null,
        b.correo ? String(b.correo).trim().toLowerCase() : null,
      ]
    );
    if (!r.rowCount) throw new ApiError(404, 'Registro no encontrado');
    res.json({ ok: true });
  } catch (e) {
    if (e.code === '23505') return next(new ApiError(409, 'Ya existe ese profesor para esa materia/sección'));
    next(e);
  }
});

/** DELETE /api/profesores/:id */
router.delete('/:id', async (req, res, next) => {
  try {
    const r = await db.query(`DELETE FROM profesores_asignatura WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!r.rowCount) throw new ApiError(404, 'Registro no encontrado');
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/profesores/importar
 * multipart con campo `archivo` (CSV) o JSON { filas: [...] }.
 * Encabezados esperados (como el export oficial): ProfAsigNombre, ProfAsigApePate,
 * ProfAsigApeMate, Correo, Materia, Sem, Secc (acepta variantes en minúsculas/con guiones).
 * Reemplaza por completo el padrón de un semestre si viene `reemplazar_sem`.
 */
router.post('/importar', subirCsv.single('archivo'), async (req, res, next) => {
  try {
    let filas = [];
    if (req.file) {
      const tabla = parseCsv(req.file.buffer.toString('utf8'));
      if (tabla.length < 2) throw new ApiError(400, 'El CSV no tiene datos');
      const head = tabla[0].map(normEncabezado).map((h) => ALIAS[h] || h);
      filas = tabla.slice(1).map((cols) => {
        const o = {};
        head.forEach((h, i) => (o[h] = cols[i]));
        return o;
      });
    } else if (Array.isArray((req.body || {}).filas)) {
      filas = req.body.filas;
    } else {
      throw new ApiError(400, 'Envía un CSV en `archivo` o un arreglo `filas`');
    }

    const reemplazarSem = (req.body && req.body.reemplazar_sem) || null;
    let insertadas = 0;
    const errores = [];

    await db.withTransaction(async (client) => {
      if (reemplazarSem) {
        await client.query(`DELETE FROM profesores_asignatura WHERE sem = $1`, [Number(reemplazarSem)]);
      }
      for (let i = 0; i < filas.length; i++) {
        const f = filas[i];
        const sem = Number(f.sem);
        const secc = Number(f.secc);
        if (!sem || !secc || !f.materia || !f.correo || !(f.nombre || f.ape_pate || f.ape_mate)) {
          errores.push({ fila: i + 2, motivo: 'campos incompletos (sem, secc, materia, correo, nombre)' });
          continue;
        }
        await client.query(
          `INSERT INTO profesores_asignatura (prof_asig_nombre, prof_asig_ape_pate, prof_asig_ape_mate, correo, materia, sem, secc)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (lower(correo), lower(materia), sem, secc) DO UPDATE SET
             prof_asig_nombre = EXCLUDED.prof_asig_nombre,
             prof_asig_ape_pate = EXCLUDED.prof_asig_ape_pate,
             prof_asig_ape_mate = EXCLUDED.prof_asig_ape_mate`,
          [
            (f.nombre || '').trim() || null, (f.ape_pate || '').trim() || null, (f.ape_mate || '').trim() || null,
            String(f.correo).trim().toLowerCase(), String(f.materia).trim(), sem, secc,
          ]
        );
        insertadas += 1;
      }
    });

    res.json({ ok: true, insertadas, errores });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
