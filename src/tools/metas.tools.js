/**
 * metas.tools.js
 *
 * Definición de las tools agentic para el módulo de Metas.
 * Cada tool expone:
 *   - name, module, description  → para el intent-detector / Gemini
 *   - parameters                 → schema de parámetros (estilo JSON Schema)
 *   - requiresConfirmation       → si el agente debe pedir OK al usuario
 *   - isDestructive              → si elimina datos (fuerza confirmación)
 *   - handler(params)            → función que ejecuta la acción real
 *
 * Los handlers invocan directamente los servicios de negocio existentes,
 * manteniendo la separación de responsabilidades.
 */

const {
  getMetasByUser,
  addMeta,
  updateMetaById,
  deleteMetaById,
} = require("../services/metas.service");

const MODULE = "metas";

// ─── Tool: listar_metas ────────────────────────────────────────────────────────

const listarMetas = {
  name: "listar_metas",
  module: MODULE,
  description:
    "Lista todas las metas de ahorro del usuario con su progreso actual. Úsala cuando el usuario pregunte por sus metas, objetivos de ahorro o quiera ver en qué va.",
  parameters: {
    type: "OBJECT",
    properties: {
      uuid_de_usuario: {
        type: "STRING",
        description: "UUID del usuario autenticado",
      },
    },
    required: ["uuid_de_usuario"],
  },
  requiresConfirmation: false,
  isDestructive: false,
  handler: async ({ uuid_de_usuario }) => {
    return getMetasByUser(uuid_de_usuario);
  },
};

// ─── Tool: crear_meta ─────────────────────────────────────────────────────────

const crearMeta = {
  name: "crear_meta",
  module: MODULE,
  description:
    "Crea una nueva meta de ahorro para el usuario. Úsala cuando el usuario quiera guardar para algo específico, poner un objetivo de ahorro o planificar un gasto futuro.",
  parameters: {
    type: "OBJECT",
    properties: {
      uuid_de_usuario: {
        type: "STRING",
        description: "UUID del usuario",
      },
      nombreMeta: {
        type: "STRING",
        description: "Nombre descriptivo de la meta (ej. 'Vacaciones Cancún')",
      },
      monto_meta: {
        type: "NUMBER",
        description: "Monto total a ahorrar en pesos mexicanos",
      },
      fecha_inicio: {
        type: "STRING",
        description: "Fecha de inicio del ahorro (YYYY-MM-DD). Default hoy si no se menciona.",
      },
      fecha_fin: {
        type: "STRING",
        description: "Fecha límite para alcanzar la meta (YYYY-MM-DD)",
      },
      plazo_dias: {
        type: "INTEGER",
        description: "Días de plazo para cumplir la meta. Se puede calcular si se tienen ambas fechas.",
      },
    },
    required: ["uuid_de_usuario", "nombreMeta", "monto_meta", "fecha_fin"],
  },
  requiresConfirmation: true,
  isDestructive: false,
  handler: async ({ uuid_de_usuario, nombreMeta, monto_meta, fecha_inicio, fecha_fin, plazo_dias }) => {
    const inicio = fecha_inicio || new Date().toISOString().split("T")[0];
    const dias =
      plazo_dias ||
      Math.max(
        1,
        Math.ceil((new Date(fecha_fin) - new Date(inicio)) / (1000 * 60 * 60 * 24))
      );

    return addMeta({
      uuidDeUsuario: uuid_de_usuario,
      nombreMeta,
      montoMeta: monto_meta,
      fechaInicio: inicio,
      fechaFin: fecha_fin,
      plazoDias: dias,
    });
  },
};

// ─── Tool: actualizar_meta ────────────────────────────────────────────────────

const actualizarMeta = {
  name: "actualizar_meta",
  module: MODULE,
  description:
    "Actualiza una meta de ahorro existente. Úsala cuando el usuario quiera cambiar el nombre, monto o fechas de una meta que ya creó.",
  parameters: {
    type: "OBJECT",
    properties: {
      uuid_de_usuario: {
        type: "STRING",
        description: "UUID del usuario",
      },
      id_meta: {
        type: "INTEGER",
        description: "ID de la meta a actualizar",
      },
      nombreMeta: {
        type: "STRING",
        description: "Nuevo nombre de la meta",
      },
      monto_meta: {
        type: "NUMBER",
        description: "Nuevo monto objetivo",
      },
      fecha_inicio: {
        type: "STRING",
        description: "Nueva fecha de inicio",
      },
      fecha_fin: {
        type: "STRING",
        description: "Nueva fecha límite",
      },
      plazo_dias: {
        type: "INTEGER",
        description: "Nuevo plazo en días",
      },
    },
    required: ["uuid_de_usuario", "id_meta", "nombreMeta", "monto_meta", "fecha_inicio", "fecha_fin", "plazo_dias"],
  },
  requiresConfirmation: true,
  isDestructive: false,
  handler: async ({ uuid_de_usuario, id_meta, nombreMeta, monto_meta, fecha_inicio, fecha_fin, plazo_dias }) => {
    return updateMetaById({
      idMeta: id_meta,
      uuidDeUsuario: uuid_de_usuario,
      nombreMeta,
      montoMeta: monto_meta,
      fechaInicio: fecha_inicio,
      fechaFin: fecha_fin,
      plazoDias: plazo_dias,
    });
  },
};

// ─── Tool: eliminar_meta ──────────────────────────────────────────────────────

const eliminarMeta = {
  name: "eliminar_meta",
  module: MODULE,
  description:
    "Elimina permanentemente una meta de ahorro. Úsala solo cuando el usuario pida explícitamente borrar o eliminar una meta.",
  parameters: {
    type: "OBJECT",
    properties: {
      uuid_de_usuario: {
        type: "STRING",
        description: "UUID del usuario",
      },
      id_meta: {
        type: "INTEGER",
        description: "ID de la meta a eliminar",
      },
    },
    required: ["uuid_de_usuario", "id_meta"],
  },
  requiresConfirmation: true,
  isDestructive: true,
  handler: async ({ uuid_de_usuario, id_meta }) => {
    return deleteMetaById({ idMeta: id_meta, uuidDeUsuario: uuid_de_usuario });
  },
};

module.exports = [listarMetas, crearMeta, actualizarMeta, eliminarMeta];
