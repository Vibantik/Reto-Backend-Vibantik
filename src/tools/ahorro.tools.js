/**
 * ahorro.tools.js
 *
 * Tools agentic para el sub-módulo de Ahorro.
 * El ahorro está ligado a las metas: registra aportes hacia una meta específica.
 *
 * Tabla: ahorro (id_ahorro, id_meta, cantidad, fecha)
 */

const pool = require("../connect");

const MODULE = "ahorro";

// ─── Tool: ver_progreso_ahorro ────────────────────────────────────────────────

const verProgresoAhorro = {
  name: "ver_progreso_ahorro",
  module: MODULE,
  description:
    "Muestra el progreso de ahorro de una meta específica: cuánto se ha acumulado, cuánto falta y el porcentaje completado.",
  parameters: {
    type: "OBJECT",
    properties: {
      uuid_de_usuario: {
        type: "STRING",
        description: "UUID del usuario",
      },
      id_meta: {
        type: "INTEGER",
        description: "ID de la meta de la que quiere ver el progreso",
      },
    },
    required: ["uuid_de_usuario", "id_meta"],
  },
  requiresConfirmation: false,
  isDestructive: false,
  handler: async ({ uuid_de_usuario, id_meta }) => {
    const { rows } = await pool.query(
      `SELECT
         m.id_meta,
         m."nombreMeta" AS nombre_meta,
         m.monto_meta,
         m.fecha_fin,
         COALESCE(SUM(a.cantidad), 0) AS ahorro_actual
       FROM meta m
       LEFT JOIN ahorro a ON a.id_meta = m.id_meta
       WHERE m.id_meta = $1 AND m.uuid_de_usuario = $2
       GROUP BY m.id_meta, m."nombreMeta", m.monto_meta, m.fecha_fin`,
      [id_meta, uuid_de_usuario]
    );

    if (rows.length === 0) return null;

    const row = rows[0];
    const montoMeta = Number(row.monto_meta);
    const ahorroActual = Number(row.ahorro_actual);
    const faltante = Math.max(0, montoMeta - ahorroActual);
    const progreso = montoMeta > 0 ? Math.min(ahorroActual / montoMeta, 1) : 0;

    return {
      id_meta: row.id_meta,
      nombre_meta: row.nombre_meta,
      monto_meta: montoMeta,
      ahorro_actual: ahorroActual,
      faltante,
      progreso_porcentaje: Math.round(progreso * 100),
      fecha_fin: row.fecha_fin,
    };
  },
};

// ─── Tool: agregar_ahorro ─────────────────────────────────────────────────────

const agregarAhorro = {
  name: "agregar_ahorro",
  module: MODULE,
  description:
    "Registra un aporte de ahorro hacia una meta. Úsala cuando el usuario diga que ahorró, que depositó o que quiere agregar dinero a una de sus metas.",
  parameters: {
    type: "OBJECT",
    properties: {
      uuid_de_usuario: {
        type: "STRING",
        description: "UUID del usuario",
      },
      id_meta: {
        type: "INTEGER",
        description: "ID de la meta a la que se hace el aporte",
      },
      cantidad: {
        type: "NUMBER",
        description: "Monto del aporte en pesos mexicanos",
      },
    },
    required: ["uuid_de_usuario", "id_meta", "cantidad"],
  },
  requiresConfirmation: true,
  isDestructive: false,
  handler: async ({ uuid_de_usuario, id_meta, cantidad }) => {
    // Verificar que la meta existe y pertenece al usuario
    const { rows: metaRows } = await pool.query(
      `SELECT id_meta, "nombreMeta", monto_meta FROM meta WHERE id_meta = $1 AND uuid_de_usuario = $2`,
      [id_meta, uuid_de_usuario]
    );

    if (metaRows.length === 0) {
      throw new Error("Meta no encontrada o no pertenece al usuario");
    }

    // Insertar el aporte
    const fecha = new Date().toISOString().split("T")[0];
    const { rows } = await pool.query(
      `INSERT INTO ahorro (id_meta, cantidad, fecha)
       VALUES ($1, $2, $3)
       RETURNING id_ahorro, id_meta, cantidad, fecha`,
      [id_meta, cantidad, fecha]
    );

    return {
      ...rows[0],
      nombre_meta: metaRows[0].nombreMeta,
      monto_meta: Number(metaRows[0].monto_meta),
    };
  },
};

module.exports = [verProgresoAhorro, agregarAhorro];
