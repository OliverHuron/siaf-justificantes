'use strict';

const express = require('express');
const db = require('../db');
const { TIPOS } = require('../lib/tipos');
const { esValido } = require('../lib/folio');
const { textoDias } = require('../lib/dias');

const router = express.Router();

/**
 * GET /api/validar?folio=&token=
 * Público. Registra el escaneo y devuelve el estado del folio.
 */
router.get('/', async (req, res, next) => {
  try {
    const folio = String(req.query.folio || '').trim().toUpperCase();
    const token = String(req.query.token || '').trim();

    if (!folio) return res.status(400).json({ estado: 'DATOS_INCOMPLETOS' });

    const r = await db.query(
      `SELECT f.folio, f.token_qr, f.emitido_en, f.anulado_en, f.motivo_anulacion,
              s.nombre_declarado, s.matricula_declarada, s.semestres, s.secciones,
              s.tipo, s.fechas, s.dias_texto_oficio,
              u.nombre AS emitido_por
         FROM folios f
         JOIN solicitudes s ON s.id = f.solicitud_id
         LEFT JOIN usuarios u ON u.id = f.emitido_por
        WHERE f.folio = $1`,
      [folio]
    );
    const row = r.rows[0];
    const tokenOk = !!row && !!token && token === row.token_qr;

    await db.query(
      `INSERT INTO verificaciones_qr (folio, token_ok, ip, user_agent) VALUES ($1,$2,$3,$4)`,
      [folio, tokenOk, req.ip, String(req.headers['user-agent'] || '').slice(0, 300)]
    );

    if (!row || !esValido(folio)) {
      return res.json({ estado: 'NO_ENCONTRADO', folio });
    }
    // Con folio válido pero token ausente/incorrecto: se confirma existencia,
    // sin exponer los datos personales.
    if (!tokenOk) {
      return res.json({
        estado: row.anulado_en ? 'ANULADO' : 'VALIDO',
        folio: row.folio,
        emitido_en: row.emitido_en,
        detalle_limitado: true,
      });
    }

    res.json({
      estado: row.anulado_en ? 'ANULADO' : 'VALIDO',
      folio: row.folio,
      nombre: row.nombre_declarado,
      matricula: row.matricula_declarada,
      semestres: row.semestres,
      secciones: row.secciones,
      tipo: (TIPOS[row.tipo] || {}).etiqueta || row.tipo,
      dias: row.dias_texto_oficio || textoDias(row.fechas || []),
      emitido_en: row.emitido_en,
      emitido_por: row.emitido_por || null,
      anulado_en: row.anulado_en || null,
      motivo_anulacion: row.motivo_anulacion || null,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
