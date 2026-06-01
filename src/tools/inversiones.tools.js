/**
 * inversiones.tools.js
 *
 * Tools agentic para el módulo de Inversiones.
 * Soporta listar, consultar y crear inversiones.
 * La eliminación no está expuesta al agente (por decisión de diseño).
 */

const {
  getInversionesByUser,
  getInversionById,
  createInversion,
} = require("../services/inversiones.service");

const MODULE = "inversiones";

// ─── Tool: listar_inversiones ─────────────────────────────────────────────────

const listarInversiones = {
  name: "listar_inversiones",
  module: MODULE,
  description:
    "Lista todas las inversiones del usuario. Úsala cuando el usuario quiera ver sus inversiones, portafolio o rendimientos actuales.",
  parameters: {
    type: "OBJECT",
    properties: {
      uuid_de_usuario: {
        type: "STRING",
        description: "UUID del usuario",
      },
    },
    required: ["uuid_de_usuario"],
  },
  requiresConfirmation: false,
  isDestructive: false,
  handler: async ({ uuid_de_usuario }) => {
    return getInversionesByUser(uuid_de_usuario);
  },
};

// ─── Tool: ver_inversion ──────────────────────────────────────────────────────

const verInversion = {
  name: "ver_inversion",
  module: MODULE,
  description:
    "Muestra el detalle de una inversión específica por su ID.",
  parameters: {
    type: "OBJECT",
    properties: {
      uuid_de_usuario: {
        type: "STRING",
        description: "UUID del usuario",
      },
      id_inversion: {
        type: "INTEGER",
        description: "ID de la inversión a consultar",
      },
    },
    required: ["uuid_de_usuario", "id_inversion"],
  },
  requiresConfirmation: false,
  isDestructive: false,
  handler: async ({ id_inversion }) => {
    return getInversionById(id_inversion);
  },
};

// ─── Tool: crear_inversion ────────────────────────────────────────────────────

const crearInversion = {
  name: "crear_inversion",
  module: MODULE,
  description:
    "Registra una nueva inversión para el usuario. Úsala cuando el usuario quiera agregar una inversión, registrar que compró acciones, CETES, fondos u otro instrumento financiero.",
  parameters: {
    type: "OBJECT",
    properties: {
      uuid_de_usuario: {
        type: "STRING",
        description: "UUID del usuario",
      },
      nombre: {
        type: "STRING",
        description: "Nombre o descripción de la inversión (ej. 'CETES 28 días', 'Fondo GBM')",
      },
      valor: {
        type: "NUMBER",
        description: "Valor o monto invertido en pesos mexicanos",
      },
      fecha_inicio: {
        type: "STRING",
        description: "Fecha en que se realizó la inversión (YYYY-MM-DD). Default hoy.",
      },
      fecha_fin: {
        type: "STRING",
        description: "Fecha de vencimiento o plazo de la inversión (YYYY-MM-DD)",
      },
      tipo: {
        type: "STRING",
        description: "Tipo de inversión: 'CETES', 'Acciones', 'Fondos', 'Crypto', etc.",
      },
    },
    required: ["uuid_de_usuario", "nombre", "valor"],
  },
  requiresConfirmation: true,
  isDestructive: false,
  handler: async ({ uuid_de_usuario, nombre, valor, fecha_inicio, fecha_fin, tipo }) => {
    // Intentar mapear el tipo a un id_tipo si se proporcionó
    let idTipo = null;
    if (tipo) {
      const pool = require("../connect");
      const { rows } = await pool.query(
        `SELECT "id_tipo_inversión" FROM tipo_inversiones WHERE LOWER(nombre) = LOWER($1) LIMIT 1`,
        [tipo]
      );
      idTipo = rows[0]?.["id_tipo_inversión"] || null;
    }

    return createInversion({
      uuidDeUsuario: uuid_de_usuario,
      nombre,
      valor,
      fechaInicio: fecha_inicio || new Date().toISOString().split("T")[0],
      fechaFin: fecha_fin || null,
      idTipo,
    });
  },
};

module.exports = [listarInversiones, verInversion, crearInversion];
