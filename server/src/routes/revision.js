'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const config = require('../config');
const { ApiError } = require('../middleware/error');
const { requireStaff, requireRol } = require('../middleware/auth');
const { TIPOS } = require('../lib/tipos');
const { resolverProfesores } = require('../lib/horarios');
const folioLib = require('../lib/folio');
const pdfLib = require('../lib/pdf');
const plantillas = require('../lib/plantillas');
const mailer = require('../lib/mailer');
const bitacora = require('../lib/bitacora');
const { fechaOficio, textoDias, inicioPeriodoActual } = require('../lib/dias');
const { rutaAbsoluta, DIR_FOLIOS } = require('../lib/storage');
const { asegurarPdf } = require('../lib/oficio');
const eventos = require('../lib/eventos');
const sheets = require('../lib/sheets');

const router = express.Router();
router.use(requireStaff);

const puedeLeer = requireRol('encargada', 'supervisor', 'coordinador');
const puedeActuar = requireRol('encargada', 'supervisor');
const soloSupervisor = requireRol('supervisor');

// -- helpers --------------------------------------------------------------

function listaEspanol(arr) {
  const a = arr.filter(Boolean);
  if (a.length <= 1) return a.join('');
  return `${a.slice(0, -1).join(', ')} y ${a[a.length - 1]}`;
}

function destinatarioOficio(semestres, secciones) {
  const s = semestres || [];
  const c = secciones || [];
  const semTxt = `${s.length > 1 ? 'de los Semestres' : 'del Semestre'} ${listaEspanol(s)}`;
  const secTxt = `${c.length > 1 ? 'Secciones' : 'Sección'} ${listaEspanol(c)}`;
  return `Profesores ${semTxt}, ${secTxt}`;
}

async function cargarSolicitud(id) {
  const r = await db.query(`SELECT * FROM solicitudes WHERE id = $1`, [id]);
  return r.rows[0] || null;
}

function varsPlantilla(s, extra = {}) {
  return {
    nombre: s.nombre_declarado,
    matricula: s.matricula_declarada,
    semestre: listaEspanol(s.semestres),
    seccion: listaEspanol(s.secciones),
    dias: s.dias_texto_oficio || textoDias(s.fechas || []),
    tipo: (TIPOS[s.tipo] && TIPOS[s.tipo].etiqueta) || s.tipo,
    enlace_seguimiento: `${config.publicUrl}/solicitud/${s.token_seguimiento}`,
    ...extra,
  };
}

async function construirCorreoAlumno(s, { plantilla_clave, motivo, nota, asunto }, extraVars = {}) {
  const { asunto: asu, cuerpo } = await plantillas.correo({
    clave: plantilla_clave || null,
    libre: motivo || nota || '',
    asuntoLibre: asunto,
    vars: varsPlantilla(s, { motivo_rechazo: motivo || '', nota: nota || '', ...extraVars }),
  });
  return { to: s.email_alumno, subject: asu, text: cuerpo };
}

async function correoAlAlumno(s, opts, extraVars = {}) {
  await mailer.enviar(await construirCorreoAlumno(s, opts, extraVars));
}

// -- cola y detalle -----------------------------------------------------

/** GET /api/revision/cola */
router.get('/cola', puedeLeer, async (req, res, next) => {
  try {
    const { estado, estado_triage, semestre, seccion, desde, hasta, texto, solo_marcadas, notas } = req.query;
    const cond = [];
    const val = [];
    const p = (v) => { val.push(v); return `$${val.length}`; };

    if (estado) {
      // Admite una lista separada por comas (p. ej. el supervisor viendo
      // "pendiente,aprobada_pendiente_confirmacion" como un solo filtro).
      const lista = String(estado).split(',').map((x) => x.trim()).filter(Boolean);
      cond.push(lista.length > 1 ? `s.estado = ANY(${p(lista)}::text[])` : `s.estado = ${p(lista[0])}`);
    }
    if (estado_triage) cond.push(`s.estado_triage = ${p(estado_triage)}`);
    if (semestre) cond.push(`${p(semestre)} = ANY(s.semestres)`);
    if (seccion) cond.push(`${p(seccion)} = ANY(s.secciones)`);
    if (desde) cond.push(`s.creado_en >= ${p(desde)}`);
    if (hasta) cond.push(`s.creado_en < (${p(hasta)}::date + 1)`);
    if (texto) {
      const ph = p(`%${texto}%`);
      cond.push(`(s.nombre_declarado ILIKE ${ph} OR s.matricula_declarada ILIKE ${ph} OR f.folio ILIKE ${ph})`);
    }
    if (solo_marcadas === 'true' || solo_marcadas === '1') {
      cond.push(`(s.banderas <> '{}'::jsonb OR coalesce(s.recordatorio,'') <> '')`);
    }
    if (notas === 'con') cond.push(`coalesce(s.recordatorio, '') <> ''`);
    else if (notas === 'sin') cond.push(`coalesce(s.recordatorio, '') = ''`);

    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
    const r = await db.query(
      `SELECT s.id, s.origen, s.email_alumno, s.nombre_declarado, s.matricula_declarada, s.tipo,
              s.origen_atencion, s.semestres, s.secciones, s.fechas, s.estado, s.estado_triage, s.color,
              s.recordatorio, s.banderas, s.requiere_ventanilla, s.ventanilla_recibido,
              s.enfermeria_confirmada, s.creado_en, s.decidido_en, f.folio,
              adj.adj AS adjuntos
         FROM solicitudes s
         LEFT JOIN folios f ON f.solicitud_id = s.id
         LEFT JOIN LATERAL (
           SELECT jsonb_object_agg(t.tipo, t.id) AS adj
             FROM (
               SELECT DISTINCT ON (a.tipo) a.tipo, a.id
                 FROM adjuntos a
                WHERE a.solicitud_id = s.id AND a.tipo IN ('receta', 'ticket', 'documento_medico')
                ORDER BY a.tipo, a.id DESC
             ) t
         ) adj ON true
         ${where}
         ORDER BY (s.estado = 'pendiente') DESC, s.creado_en DESC
         LIMIT 300`,
      val
    );
    res.json(r.rows.map((row) => ({
      ...row,
      adjuntos: row.adjuntos || {},
      tipo_etiqueta: (TIPOS[row.tipo] || {}).etiqueta || row.tipo,
    })));
  } catch (e) {
    next(e);
  }
});

/** GET /api/revision/:id */
router.get('/:id', puedeLeer, async (req, res, next) => {
  try {
    const s = await cargarSolicitud(req.params.id);
    if (!s) throw new ApiError(404, 'Solicitud no encontrada');

    const inicioPeriodo = inicioPeriodoActual();
    const [adj, hilo, hist, profFrozen, folioRow, periodoRow] = await Promise.all([
      db.query(`SELECT id, tipo, nombre_original, mime, tamano, subido_en FROM adjuntos WHERE solicitud_id = $1 ORDER BY id`, [s.id]),
      db.query(`SELECT autor, autor_usuario, cuerpo, creado_en FROM mensajes WHERE solicitud_id = $1 ORDER BY creado_en`, [s.id]),
      db.query(
        `SELECT id, tipo, estado, fechas, creado_en, decidido_en
           FROM solicitudes
          WHERE upper(matricula_declarada) = upper($1) AND id <> $2
          ORDER BY creado_en DESC LIMIT 20`,
        [s.matricula_declarada, s.id]
      ),
      db.query(`SELECT materia, profesor_nombre, profesor_correo, incluir, origen, enviado_en FROM solicitud_profesores WHERE solicitud_id = $1 ORDER BY materia`, [s.id]),
      db.query(`SELECT folio FROM folios WHERE solicitud_id = $1`, [s.id]),
      // Días ya justificados (aprobados) por esta matrícula en el periodo semestral en
      // curso; informativo para la encargada, no bloquea nada. Caso especial no cuenta
      // (está exento de las reglas de fecha).
      db.query(
        `SELECT coalesce(sum(cardinality(coalesce(fechas_aprobadas, fechas))), 0)::int AS dias
           FROM solicitudes
          WHERE upper(matricula_declarada) = upper($1)
            AND estado = 'aprobada' AND tipo <> 'caso_especial'
            AND decidido_en >= $2::date`,
        [s.matricula_declarada, inicioPeriodo]
      ),
    ]);

    let profesores = profFrozen.rows;
    if (!profesores.length && s.estado === 'pendiente') {
      const auto = await resolverProfesores(s);
      profesores = auto.map((p) => ({ ...p, incluir: true, origen: 'auto', enviado_en: null }));
    }

    res.json({
      solicitud: {
        ...s,
        folio: (folioRow.rows[0] && folioRow.rows[0].folio) || null,
        tipo_etiqueta: (TIPOS[s.tipo] || {}).etiqueta || s.tipo,
        tipo_reglas: TIPOS[s.tipo] || null,
      },
      adjuntos: adj.rows.map((a) => ({ ...a, url: `/revision/${s.id}/adjuntos/${a.id}` })),
      hilo: hilo.rows,
      historial_matricula: hist.rows,
      profesores,
      periodo_matricula: { inicio: inicioPeriodo, dias_usados: periodoRow.rows[0].dias },
    });
  } catch (e) {
    next(e);
  }
});

/** GET /api/revision/:id/adjuntos/:adjId  — stream del archivo. */
router.get('/:id/adjuntos/:adjId', puedeLeer, async (req, res, next) => {
  try {
    const r = await db.query(
      `SELECT ruta_archivo, mime, nombre_original FROM adjuntos WHERE id = $1 AND solicitud_id = $2`,
      [req.params.adjId, req.params.id]
    );
    const a = r.rows[0];
    if (!a) throw new ApiError(404, 'Adjunto no encontrado');
    const abs = rutaAbsoluta(a.ruta_archivo);
    if (!fs.existsSync(abs)) throw new ApiError(410, 'El archivo ya no está disponible');
    res.setHeader('Content-Type', a.mime);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(a.nombre_original)}"`);
    fs.createReadStream(abs).pipe(res);
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/revision/:id/oficio-preview?dias=ISO,ISO&plantilla_cuerpo_id=&frase_cuerpo=
 * Renderiza el oficio (HTML, sin QR) para previsualizarlo antes de aprobar.
 */
router.get('/:id/oficio-preview', puedeLeer, async (req, res, next) => {
  try {
    const s = await cargarSolicitud(req.params.id);
    if (!s) throw new ApiError(404, 'Solicitud no encontrada');
    const pedidas = (s.fechas || []).map((x) => String(x).slice(0, 10));
    const dias = String(req.query.dias || '')
      .split(',').map((x) => x.trim()).filter((x) => pedidas.includes(x));
    const fechasAprob = dias.length ? [...new Set(dias)].sort() : pedidas;
    const diasTxt = textoDias(fechasAprob);
    const frase = await plantillas.cuerpoOficio({
      plantillaId: req.query.plantilla_cuerpo_id || null,
      libre: req.query.frase_cuerpo || '',
      vars: varsPlantilla(s, { dias: diasTxt }),
    });
    const tpl = fs.readFileSync(path.join(__dirname, '..', '..', 'templates', 'oficio.html'), 'utf8');
    const html = plantillas.render(tpl, {
      fecha_oficio: fechaOficio(),
      folio: '(se asigna al aprobar)',
      destinatario: destinatarioOficio(s.semestres, s.secciones),
      nombre: s.nombre_declarado,
      matricula: s.matricula_declarada,
      dias_texto_oficio: diasTxt,
      frase_cuerpo: frase,
      qr_data_uri: '',
      url_validacion: '',
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e) {
    next(e);
  }
});

// -- triage, mensajes, notas -----------------------------------------------

router.patch('/:id/triage', puedeActuar, async (req, res, next) => {
  try {
    const { estado_triage, color, recordatorio } = req.body || {};
    const r = await db.query(
      `UPDATE solicitudes SET
         estado_triage = COALESCE($2, estado_triage),
         color = $3,
         recordatorio = $4
       WHERE id = $1 RETURNING id, estado_triage, color, recordatorio`,
      [req.params.id, estado_triage || null, color ?? null, recordatorio ?? null]
    );
    if (!r.rowCount) throw new ApiError(404, 'Solicitud no encontrada');
    res.json(r.rows[0]);
  } catch (e) {
    next(e);
  }
});

router.post('/:id/nota', puedeActuar, async (req, res, next) => {
  try {
    const texto = String((req.body || {}).texto || '');
    const r = await db.query(
      `UPDATE solicitudes SET nota_interna = $2 WHERE id = $1 RETURNING id`,
      [req.params.id, texto]
    );
    if (!r.rowCount) throw new ApiError(404, 'Solicitud no encontrada');
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/mensajes', puedeActuar, async (req, res, next) => {
  try {
    const s = await cargarSolicitud(req.params.id);
    if (!s) throw new ApiError(404, 'Solicitud no encontrada');
    const { cuerpo, plantilla_clave } = req.body || {};
    if (!cuerpo && !plantilla_clave) throw new ApiError(400, 'Falta el cuerpo o la plantilla');

    let texto = cuerpo;
    let asunto = 'Sobre tu solicitud de justificante';
    if (plantilla_clave) {
      const r = await plantillas.correo({ clave: plantilla_clave, vars: varsPlantilla(s, { nota: cuerpo || '' }) });
      texto = r.cuerpo;
      asunto = r.asunto;
    }
    await db.query(
      `INSERT INTO mensajes (solicitud_id, autor, autor_usuario, cuerpo) VALUES ($1,'staff',$2,$3)`,
      [s.id, req.usuario.sub, texto]
    );
    await mailer.enviar({ to: s.email_alumno, subject: asunto, text: texto });
    await bitacora.registrar({
      actorTipo: 'staff', actorRef: req.usuario.usuario, accion: 'mensaje_staff', solicitudId: s.id, ip: req.ip,
    });
    res.status(201).json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// -- profesores ---------------------------------------------------------

router.get('/:id/profesores', puedeActuar, async (req, res, next) => {
  try {
    const s = await cargarSolicitud(req.params.id);
    if (!s) throw new ApiError(404, 'Solicitud no encontrada');
    const frozen = await db.query(`SELECT materia, profesor_nombre, profesor_correo, incluir, origen FROM solicitud_profesores WHERE solicitud_id = $1 ORDER BY materia`, [s.id]);
    if (frozen.rowCount) return res.json({ profesores: frozen.rows, congelado: true });
    const auto = await resolverProfesores(s);
    res.json({ profesores: auto.map((p) => ({ ...p, incluir: true, origen: 'auto' })), congelado: false });
  } catch (e) {
    next(e);
  }
});

router.patch('/:id/profesores', puedeActuar, async (req, res, next) => {
  try {
    const s = await cargarSolicitud(req.params.id);
    if (!s) throw new ApiError(404, 'Solicitud no encontrada');
    if (s.estado !== 'pendiente') throw new ApiError(409, 'La solicitud ya fue resuelta');
    const items = Array.isArray((req.body || {}).items) ? req.body.items : [];
    await db.withTransaction(async (client) => {
      await client.query(`DELETE FROM solicitud_profesores WHERE solicitud_id = $1`, [s.id]);
      for (const it of items) {
        if (!it.profesor_correo || !it.materia) continue;
        await client.query(
          `INSERT INTO solicitud_profesores (solicitud_id, materia, profesor_nombre, profesor_correo, incluir, origen)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [s.id, it.materia, it.profesor_nombre || null, String(it.profesor_correo).toLowerCase(),
           it.incluir !== false, it.origen === 'manual' ? 'manual' : 'auto']
        );
      }
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// -- confirmaciones previas -------------------------------------------------

router.post('/:id/enfermeria-confirmar', puedeActuar, async (req, res, next) => {
  try {
    const r = await db.query(
      `UPDATE solicitudes SET enfermeria_confirmada = true
        WHERE id = $1 AND tipo = 'enfermeria_fcca' RETURNING id`,
      [req.params.id]
    );
    if (!r.rowCount) throw new ApiError(404, 'Solicitud de enfermería no encontrada');
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/ventanilla-recibido', puedeActuar, async (req, res, next) => {
  try {
    const r = await db.query(
      `UPDATE solicitudes SET ventanilla_recibido = true WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!r.rowCount) throw new ApiError(404, 'Solicitud no encontrada');
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// -- decisiones -------------------------------------------------------------

router.post('/:id/rechazar', puedeActuar, async (req, res, next) => {
  try {
    const s = await cargarSolicitud(req.params.id);
    if (!s) throw new ApiError(404, 'Solicitud no encontrada');
    if (!['pendiente', 'aprobada_pendiente_confirmacion'].includes(s.estado)) {
      throw new ApiError(409, 'La solicitud ya fue resuelta');
    }
    const { plantilla_clave, motivo } = req.body || {};
    if (!plantilla_clave && !motivo) throw new ApiError(400, 'Indica un motivo o una plantilla');

    await db.query(
      `UPDATE solicitudes SET estado='rechazada', estado_triage='atendida',
         decidido_en=now(), decidido_por=$2, motivo_rechazo=$3 WHERE id=$1`,
      [s.id, req.usuario.sub, motivo || null]
    );
    await correoAlAlumno(s, { plantilla_clave, motivo, asunto: 'Tu solicitud de justificante fue rechazada' });
    await bitacora.registrar({
      actorTipo: 'staff', actorRef: req.usuario.usuario, accion: 'solicitud_rechazada',
      solicitudId: s.id, detalle: { motivo: motivo || plantilla_clave }, ip: req.ip,
    });
    eventos.emitir('cambio');
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/ventanilla', puedeActuar, async (req, res, next) => {
  try {
    const s = await cargarSolicitud(req.params.id);
    if (!s) throw new ApiError(404, 'Solicitud no encontrada');
    const { plantilla_clave, nota } = req.body || {};
    await db.query(
      `UPDATE solicitudes SET estado='requiere_ventanilla', requiere_ventanilla=true,
         estado_triage='espera_alumno' WHERE id=$1`,
      [s.id]
    );
    await correoAlAlumno(s, { plantilla_clave: plantilla_clave || 'pasar_ventanilla', nota,
      asunto: 'Tu solicitud requiere asistencia en ventanilla' });
    await bitacora.registrar({
      actorTipo: 'staff', actorRef: req.usuario.usuario, accion: 'solicitud_ventanilla', solicitudId: s.id, ip: req.ip,
    });
    eventos.emitir('cambio');
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/**
 * Resuelve (y congela si hacía falta) los profesores a notificar de una solicitud.
 */
async function resolverYCongelarProfesores(s) {
  let dest = (await db.query(
    `SELECT id, materia, profesor_nombre, profesor_correo FROM solicitud_profesores
      WHERE solicitud_id = $1 AND incluir = true`,
    [s.id]
  )).rows;
  if (!dest.length) {
    const yaHay = await db.query(`SELECT 1 FROM solicitud_profesores WHERE solicitud_id = $1 LIMIT 1`, [s.id]);
    if (!yaHay.rowCount) {
      const auto = await resolverProfesores(s);
      if (auto.length) {
        for (const p of auto) {
          await db.query(
            `INSERT INTO solicitud_profesores (solicitud_id, materia, profesor_nombre, profesor_correo, incluir, origen)
             VALUES ($1,$2,$3,$4,true,'auto')`,
            [s.id, p.materia, p.profesor_nombre || null, p.profesor_correo]
          );
        }
        dest = auto;
      }
    }
  }
  return dest;
}

/**
 * Crea el folio y deja la solicitud en estado='aprobada'. Es la parte rápida
 * (solo BD, sin PDF ni correos) — lo único que el "Aprobar"/"Confirmar" del
 * supervisor espera antes de responder.
 */
async function crearFolio(s, { usuario, ip, dest }) {
  return db.withTransaction(async (client) => {
    const cfgPrefijo = await client.query(`SELECT valor FROM config WHERE clave='folio'`);
    const prefijo = (cfgPrefijo.rows[0] && cfgPrefijo.rows[0].valor && cfgPrefijo.rows[0].valor.prefijo) || 'F';
    const f = await folioLib.emitir(client, prefijo);

    await client.query(
      `INSERT INTO folios (solicitud_id, folio, token_qr, emitido_por) VALUES ($1,$2,$3,$4)`,
      [s.id, f.folio, f.token_qr, usuario.sub]
    );
    await client.query(
      `UPDATE solicitudes SET estado='aprobada', estado_triage='atendida', decidido_en=now(), decidido_por=$2
       WHERE id=$1`,
      [s.id, usuario.sub]
    );
    await bitacora.registrar({
      actorTipo: 'staff', actorRef: usuario.usuario, accion: 'solicitud_aprobada',
      solicitudId: s.id, detalle: { folio: f.folio, profesores: dest.map((d) => d.profesor_correo) }, ip,
    }, client);
    return f;
  });
}

const REINTENTOS_NOTIFICACION = [5000, 15000, 40000]; // 5s, 15s, 40s

/**
 * Parte lenta (PDF + correos): se llama SIN esperarla desde la ruta, para que
 * "Aprobar"/"Confirmar" respondan en cuanto el folio existe. Si algo falla
 * (PDF o SMTP), reintenta sola unas veces; si al final no puede, avisa por
 * SSE (toast) para que el supervisor sepa que hace falta revisar ese folio.
 * El folio y los profesores a notificar ya quedaron fijos en `crearFolio`,
 * así que un reintento no duplica nada, solo repite PDF+envío.
 */
async function procesarPdfYCorreos(s, emitido, { diasTxt, frase, dest }, intento = 0) {
  try {
    const destinoPdf = path.join(DIR_FOLIOS, `${emitido.folio}.pdf`);
    await pdfLib.generarOficio(
      {
        folio: emitido.folio,
        token_qr: emitido.token_qr,
        fecha_oficio: fechaOficio(),
        destinatario: destinatarioOficio(s.semestres, s.secciones),
        nombre: s.nombre_declarado,
        matricula: s.matricula_declarada,
        dias_texto_oficio: diasTxt,
        frase_cuerpo: frase,
      },
      destinoPdf
    );
    await db.query(`UPDATE folios SET pdf_ruta = $2 WHERE folio = $1`, [
      emitido.folio, path.relative(config.storagePath, destinoPdf).split(path.sep).join('/'),
    ]);

    // Un solo lote de correos (oficio a cada profesor + acuse al alumno),
    // reutilizando una sola conexión SMTP en vez de abrir una por correo.
    const attachments = [{ filename: `Oficio-${emitido.folio}.pdf`, path: destinoPdf }];
    const mensajesProf = dest.map((p) => ({
      to: p.profesor_correo,
      subject: `Justificación de inasistencia: ${s.nombre_declarado} (${emitido.folio})`,
      text:
        `Estimado(a) profesor(a) de "${p.materia}":\n\n` +
        `Se adjunta el oficio No. ${emitido.folio} que justifica la inasistencia de ` +
        `${s.nombre_declarado} (matrícula ${s.matricula_declarada}) ${diasTxt}.\n\n` +
        `Puede verificar su autenticidad en ${config.publicUrl}/validar?folio=${encodeURIComponent(emitido.folio)}&token=${encodeURIComponent(emitido.token_qr)}\n\n` +
        `Secretaría Académica, FCCA, UMSNH.`,
      attachments,
    }));
    const mensajeAlumno = await construirCorreoAlumno(s, { plantilla_clave: 'aprobado' }, { folio: emitido.folio });
    const resultados = await mailer.enviarLote([...mensajesProf, mensajeAlumno]);
    const enviados = resultados.slice(0, dest.length).filter((r) => r.ok).length;

    await db.query(
      `UPDATE solicitud_profesores SET enviado_en = now() WHERE solicitud_id = $1 AND incluir = true`,
      [s.id]
    );

    const fechasEmitidas = (Array.isArray(s.fechas_aprobadas) && s.fechas_aprobadas.length
      ? s.fechas_aprobadas : s.fechas || []).map((x) => String(x).slice(0, 10));
    sheets.notificar({
      accion: 'emitido',
      folio: emitido.folio,
      alumno: s.nombre_declarado,
      matricula: s.matricula_declarada,
      tipo: (TIPOS[s.tipo] || {}).etiqueta || s.tipo,
      dias: fechasEmitidas.length,
      fechas: fechasEmitidas,
      emitido_en: new Date().toISOString(),
    });

    eventos.emitir('cambio');
    eventos.emitir('notificacion', {
      nivel: 'exito',
      mensaje: `Folio ${emitido.folio} emitido: PDF listo y ${enviados}/${dest.length} profesor(es) notificado(s).`,
    });
  } catch (e) {
    console.error(`[procesarPdfYCorreos] folio ${emitido.folio}, intento ${intento + 1} falló:`, e.message);
    if (intento < REINTENTOS_NOTIFICACION.length) {
      setTimeout(
        () => procesarPdfYCorreos(s, emitido, { diasTxt, frase, dest }, intento + 1),
        REINTENTOS_NOTIFICACION[intento]
      );
    } else {
      eventos.emitir('notificacion', {
        nivel: 'error',
        mensaje: `No se pudo terminar de emitir el folio ${emitido.folio} (PDF o correos). El folio ya existe; entra a Folios para revisarlo.`,
      });
    }
  }
}

/**
 * POST /api/revision/:id/aprobar
 * { plantilla_cuerpo_id?, frase_cuerpo?, dias_texto_oficio?, fechas_verificadas_receta? }
 *
 * Doble aprobación (control de seguridad): si quien aprueba es la encargada,
 * esto solo dictamina y congela todo (días, plantilla del oficio, profesores a
 * notificar) pero NO emite folio ni manda ningún correo — queda en
 * 'aprobada_pendiente_confirmacion' hasta que el supervisor la confirme
 * (POST /:id/confirmar). Si quien aprueba ya es el supervisor, se hace todo de
 * una vez (como antes), porque su propia aprobación ya es la verificación.
 * Desde el panel de la encargada esto se ve y se siente igual que antes: un
 * solo botón "Aprobar" que saca la solicitud de su cola de pendientes.
 */
router.post('/:id/aprobar', puedeActuar, async (req, res, next) => {
  try {
    const s = await cargarSolicitud(req.params.id);
    if (!s) throw new ApiError(404, 'Solicitud no encontrada');
    if (s.estado !== 'pendiente') throw new ApiError(409, 'La solicitud ya fue resuelta');
    if (s.tipo === 'enfermeria_fcca' && !s.enfermeria_confirmada) {
      throw new ApiError(409, 'Falta confirmar con enfermería antes de emitir');
    }
    if (s.requiere_ventanilla && !s.ventanilla_recibido) {
      throw new ApiError(409, 'Falta registrar la recepción del documento en ventanilla');
    }

    const { plantilla_cuerpo_id, frase_cuerpo, dias_texto_oficio, fechas_verificadas_receta } = req.body || {};
    if (frase_cuerpo && frase_cuerpo.length > 167) {
      throw new ApiError(400, 'El texto libre del oficio no puede superar 167 caracteres');
    }

    // Días aprobados por la encargada: subconjunto de los que pidió el alumno.
    // Si no se envían, se aprueban todos.
    const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
    const pedidas = (s.fechas || []).map((x) => String(x).slice(0, 10));
    let fechasAprob = pedidas;
    if (req.body && req.body.fechas_aprobadas !== undefined) {
      const arr = Array.isArray(req.body.fechas_aprobadas) ? req.body.fechas_aprobadas : [];
      fechasAprob = [...new Set(arr.map((x) => String(x).slice(0, 10)))]
        .filter((x) => FECHA_RE.test(x) && pedidas.includes(x))
        .sort();
      if (!fechasAprob.length) {
        throw new ApiError(400, 'Selecciona al menos un día a aprobar (de los que pidió el alumno)');
      }
    }

    const dest = await resolverYCongelarProfesores(s);
    const diasTxt = (dias_texto_oficio && dias_texto_oficio.trim()) || textoDias(fechasAprob);
    const frase = await plantillas.cuerpoOficio({
      plantillaId: plantilla_cuerpo_id || null,
      libre: frase_cuerpo || '',
      vars: varsPlantilla(s, { dias: diasTxt }),
    });

    if (req.usuario.rol !== 'supervisor') {
      // Encargada: solo deja el dictamen listo, para que el supervisor confirme.
      await db.query(
        `UPDATE solicitudes SET estado='aprobada_pendiente_confirmacion', estado_triage='atendida',
           preaprobado_en=now(), preaprobado_por=$2, dias_texto_oficio=$3, frase_cuerpo=$4,
           plantilla_cuerpo_id=$5, fechas_verificadas_receta=$6, fechas_aprobadas=$7::date[]
         WHERE id=$1`,
        [s.id, req.usuario.sub, diasTxt, frase, plantilla_cuerpo_id || null,
         !!fechas_verificadas_receta, fechasAprob]
      );
      await bitacora.registrar({
        actorTipo: 'staff', actorRef: req.usuario.usuario, accion: 'solicitud_preaprobada',
        solicitudId: s.id, detalle: { profesores: dest.map((d) => d.profesor_correo) }, ip: req.ip,
      });
      eventos.emitir('cambio');
      return res.json({ ok: true, estado: 'aprobada_pendiente_confirmacion', dias: fechasAprob.length });
    }

    const emitido = await crearFolio(s, { usuario: req.usuario, ip: req.ip, dest });
    eventos.emitir('cambio');
    res.json({ ok: true, folio: emitido.folio, procesando: true });
    // PDF + correos van después de responder (puede tardar varios segundos
    // mandando uno por uno a cada profesor); si falla, procesarPdfYCorreos
    // reintenta sola y al final avisa por SSE (toast) en vez de tumbar esta
    // respuesta.
    procesarPdfYCorreos(s, emitido, { diasTxt, frase, dest });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/revision/:id/confirmar  (solo supervisor)
 * Confirma una solicitud que la encargada ya pre-aprobó: emite el folio,
 * genera el PDF y envía los correos (esto es lo que de verdad sale del
 * sistema). Usa el dictamen que la encargada ya dejó congelado.
 */
router.post('/:id/confirmar', soloSupervisor, async (req, res, next) => {
  try {
    const s = await cargarSolicitud(req.params.id);
    if (!s) throw new ApiError(404, 'Solicitud no encontrada');
    if (s.estado !== 'aprobada_pendiente_confirmacion') {
      throw new ApiError(409, 'Esta solicitud no está pendiente de confirmación');
    }
    const dest = await resolverYCongelarProfesores(s);
    const fechasAprob = (Array.isArray(s.fechas_aprobadas) && s.fechas_aprobadas.length
      ? s.fechas_aprobadas : s.fechas || []).map((x) => String(x).slice(0, 10));
    const diasTxt = s.dias_texto_oficio || textoDias(fechasAprob);
    const frase = s.frase_cuerpo || await plantillas.cuerpoOficio({
      plantillaId: s.plantilla_cuerpo_id, libre: '', vars: varsPlantilla(s, { dias: diasTxt }),
    });

    const emitido = await crearFolio(s, { usuario: req.usuario, ip: req.ip, dest });
    eventos.emitir('cambio');
    res.json({ ok: true, folio: emitido.folio, procesando: true });
    procesarPdfYCorreos(s, emitido, { diasTxt, frase, dest });
  } catch (e) {
    next(e);
  }
});

/** GET /api/revision/:id/pdf  — descarga/regenera el oficio. */
router.get('/:id/pdf', puedeLeer, async (req, res, next) => {
  try {
    const { abs, folio } = await asegurarPdf(req.params.id);
    if (!fs.existsSync(abs)) throw new ApiError(500, 'No se pudo preparar el PDF');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Oficio-${folio}.pdf"`);
    fs.createReadStream(abs).pipe(res);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
