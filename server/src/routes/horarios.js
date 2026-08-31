'use strict';

const express = require('express');
const multer = require('multer');
const db = require('../db');
const { ApiError } = require('../middleware/error');
const { requireStaff, requireRol } = require('../middleware/auth');

const router = express.Router();
router.use(requireStaff, requireRol('supervisor'));

const subirCsv = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const DIAS = { lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6, domingo: 7 };

function normDia(v) {
  const s = String(v || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, ''); // sin acentos
  if (/^[1-7]$/.test(s)) return Number(s);
  return DIAS[s] || null;
}

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

/** GET /api/horarios?ciclo=&semestre=&seccion= */
router.get('/', async (req, res, next) => {
  try {
    const cond = ['activo'];
    const val = [];
    for (const [k, col] of [['ciclo', 'ciclo_escolar'], ['semestre', 'semestre'], ['seccion', 'seccion']]) {
      if (req.query[k]) { val.push(req.query[k]); cond.push(`${col} = $${val.length}`); }
    }
    const r = await db.query(
      `SELECT id, ciclo_escolar, semestre, seccion, materia, profesor_nombre, profesor_correo,
              dia_semana, hora_inicio, hora_fin
         FROM horarios WHERE ${cond.join(' AND ')}
         ORDER BY ciclo_escolar, semestre, seccion, dia_semana, materia
         LIMIT 2000`,
      val
    );
    res.json(r.rows);
  } catch (e) {
    next(e);
  }
});

/** POST /api/horarios  — alta individual. */
router.post('/', async (req, res, next) => {
  try {
    const b = req.body || {};
    const dia = normDia(b.dia_semana);
    if (!b.ciclo_escolar || !b.semestre || !b.seccion || !b.materia || !b.profesor_correo || !dia) {
      throw new ApiError(400, 'Faltan campos (ciclo_escolar, semestre, seccion, materia, profesor_correo, dia_semana)');
    }
    const r = await db.query(
      `INSERT INTO horarios (ciclo_escolar, semestre, seccion, materia, profesor_nombre, profesor_correo, dia_semana, hora_inicio, hora_fin)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        String(b.ciclo_escolar), String(b.semestre), String(b.seccion), String(b.materia),
        b.profesor_nombre || null, String(b.profesor_correo).toLowerCase(), dia,
        b.hora_inicio || null, b.hora_fin || null,
      ]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    next(e);
  }
});

/** PATCH /api/horarios/:id */
router.patch('/:id', async (req, res, next) => {
  try {
    const b = req.body || {};
    const dia = b.dia_semana != null ? normDia(b.dia_semana) : null;
    const r = await db.query(
      `UPDATE horarios SET
         ciclo_escolar = COALESCE($2, ciclo_escolar),
         semestre = COALESCE($3, semestre),
         seccion = COALESCE($4, seccion),
         materia = COALESCE($5, materia),
         profesor_nombre = COALESCE($6, profesor_nombre),
         profesor_correo = COALESCE($7, profesor_correo),
         dia_semana = COALESCE($8, dia_semana),
         hora_inicio = COALESCE($9, hora_inicio),
         hora_fin = COALESCE($10, hora_fin),
         activo = COALESCE($11, activo)
       WHERE id = $1 RETURNING *`,
      [
        req.params.id, b.ciclo_escolar || null, b.semestre || null, b.seccion || null,
        b.materia || null, b.profesor_nombre || null,
        b.profesor_correo ? String(b.profesor_correo).toLowerCase() : null,
        dia, b.hora_inicio || null, b.hora_fin || null,
        typeof b.activo === 'boolean' ? b.activo : null,
      ]
    );
    if (!r.rowCount) throw new ApiError(404, 'Horario no encontrado');
    res.json(r.rows[0]);
  } catch (e) {
    next(e);
  }
});

/** DELETE /api/horarios/:id  (baja lógica) */
router.delete('/:id', async (req, res, next) => {
  try {
    const r = await db.query(`UPDATE horarios SET activo = false WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!r.rowCount) throw new ApiError(404, 'Horario no encontrado');
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/horarios/importar
 * multipart con campo `archivo` (CSV) o JSON { filas: [...] , reemplazar_ciclo?: "2026" }.
 * Encabezados CSV esperados: ciclo_escolar,semestre,seccion,materia,profesor_nombre,profesor_correo,dia_semana[,hora_inicio,hora_fin]
 */
router.post('/importar', subirCsv.single('archivo'), async (req, res, next) => {
  try {
    let filas = [];
    if (req.file) {
      const tabla = parseCsv(req.file.buffer.toString('utf8'));
      if (tabla.length < 2) throw new ApiError(400, 'El CSV no tiene datos');
      const head = tabla[0].map((h) => h.toLowerCase());
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

    const reemplazarCiclo = (req.body && req.body.reemplazar_ciclo) || null;
    let insertadas = 0;
    const errores = [];

    await db.withTransaction(async (client) => {
      if (reemplazarCiclo) {
        await client.query(`UPDATE horarios SET activo = false WHERE ciclo_escolar = $1`, [String(reemplazarCiclo)]);
      }
      for (let i = 0; i < filas.length; i++) {
        const f = filas[i];
        const dia = normDia(f.dia_semana);
        if (!f.ciclo_escolar || !f.semestre || !f.seccion || !f.materia || !f.profesor_correo || !dia) {
          errores.push({ fila: i + 2, motivo: 'campos incompletos o día inválido' });
          continue;
        }
        await client.query(
          `INSERT INTO horarios (ciclo_escolar, semestre, seccion, materia, profesor_nombre, profesor_correo, dia_semana, hora_inicio, hora_fin)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            String(f.ciclo_escolar).trim(), String(f.semestre).trim(), String(f.seccion).trim(),
            String(f.materia).trim(), (f.profesor_nombre || '').trim() || null,
            String(f.profesor_correo).trim().toLowerCase(), dia,
            f.hora_inicio || null, f.hora_fin || null,
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
