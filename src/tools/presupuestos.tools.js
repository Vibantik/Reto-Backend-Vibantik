/**
 * presupuestos.tools.js
 *
 * Tools agentic para el módulo de Presupuestos.
 * Reutiliza los servicios existentes en presupuestos.service.js.
 */

const {
  getAllPresupuestos,
  getLatestPresupuesto,
  getPresupuestoById,
  createPresupuesto,
  updatePresupuesto,
  deletePresupuesto,
} = require("../services/presupuestos.service");

const MODULE = "presupuestos";

// ─── Tool: listar_presupuestos ────────────────────────────────────────────────

const listarPresupuestos = {
  name: "listar_presupuestos",
  module: MODULE,
  description:
    "Lista todos los presupuestos del usuario. Úsala cuando el usuario quiera ver sus presupuestos, cuánto lleva gastado o cómo va su presupuesto mensual.",
  parameters: {
    type: "OBJECT",
    properties: {
      uuid_de_usuario: {
        type: "STRING",
        description: "UUID del usuario",
      },
      solo_activos: {
        type: "BOOLEAN",
        description: "Si true, devuelve solo presupuestos vigentes (dentro de su rango de fechas)",
      },
    },
    required: ["uuid_de_usuario"],
  },
  requiresConfirmation: false,
  isDestructive: false,
  handler: async ({ uuid_de_usuario, solo_activos }) => {
    return getAllPresupuestos(uuid_de_usuario, { soloActivos: solo_activos === true });
  },
};

// ─── Tool: ver_presupuesto_activo ─────────────────────────────────────────────

const verPresupuestoActivo = {
  name: "ver_presupuesto_activo",
  module: MODULE,
  description:
    "Muestra el detalle completo del presupuesto más reciente del usuario, incluyendo categorías asignadas y transacciones vinculadas.",
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
    return getLatestPresupuesto(uuid_de_usuario);
  },
};

// ─── Tool: crear_presupuesto ──────────────────────────────────────────────────

const crearPresupuesto = {
  name: "crear_presupuesto",
  module: MODULE,
  description:
    "Crea un nuevo presupuesto mensual o por periodo. Úsala cuando el usuario quiera planear su gasto, poner límites de gasto o crear un presupuesto nuevo.",
  parameters: {
    type: "OBJECT",
    properties: {
      uuid_de_usuario: {
        type: "STRING",
        description: "UUID del usuario",
      },
      nombre: {
        type: "STRING",
        description: "Nombre del presupuesto (ej. 'Presupuesto Mayo 2025')",
      },
      monto_limite: {
        type: "NUMBER",
        description: "Límite de gasto total en pesos mexicanos",
      },
      descripcion: {
        type: "STRING",
        description: "Descripción opcional del presupuesto",
      },
      inicio: {
        type: "STRING",
        description: "Fecha de inicio del presupuesto (YYYY-MM-DD). Default hoy.",
      },
      fin: {
        type: "STRING",
        description: "Fecha de fin del presupuesto (YYYY-MM-DD). Default fin de mes.",
      },
    },
    required: ["uuid_de_usuario", "nombre", "monto_limite"],
  },
  requiresConfirmation: true,
  isDestructive: false,
  handler: async ({ uuid_de_usuario, nombre, monto_limite, descripcion, inicio, fin }) => {
    return createPresupuesto(uuid_de_usuario, {
      nombre,
      monto_limite,
      descripción: descripcion || "",
      inicio,
      fin,
      categorias: [],
    });
  },
};

// ─── Tool: actualizar_presupuesto ─────────────────────────────────────────────

const actualizarPresupuesto = {
  name: "actualizar_presupuesto",
  module: MODULE,
  description:
    "Actualiza los datos de un presupuesto existente. Úsala cuando el usuario quiera cambiar el límite, nombre o fechas de un presupuesto.",
  parameters: {
    type: "OBJECT",
    properties: {
      uuid_de_usuario: {
        type: "STRING",
        description: "UUID del usuario (para verificar ownership)",
      },
      id_presupuesto: {
        type: "INTEGER",
        description: "ID del presupuesto a actualizar",
      },
      nombre: {
        type: "STRING",
        description: "Nuevo nombre del presupuesto",
      },
      monto_limite: {
        type: "NUMBER",
        description: "Nuevo límite de gasto",
      },
      fin: {
        type: "STRING",
        description: "Nueva fecha de fin",
      },
    },
    required: ["uuid_de_usuario", "id_presupuesto"],
  },
  requiresConfirmation: true,
  isDestructive: false,
  handler: async ({ id_presupuesto, nombre, monto_limite, fin }) => {
    const data = {};
    if (nombre !== undefined) data.nombre = nombre;
    if (monto_limite !== undefined) data.monto_limite = monto_limite;
    if (fin !== undefined) data.fin = fin;
    return updatePresupuesto(id_presupuesto, data);
  },
};

// ─── Tool: eliminar_presupuesto ───────────────────────────────────────────────

const eliminarPresupuesto = {
  name: "eliminar_presupuesto",
  module: MODULE,
  description:
    "Elimina un presupuesto permanentemente junto con sus categorías vinculadas. Úsala solo cuando el usuario pida explícitamente borrar un presupuesto.",
  parameters: {
    type: "OBJECT",
    properties: {
      uuid_de_usuario: {
        type: "STRING",
        description: "UUID del usuario (para verificar ownership)",
      },
      id_presupuesto: {
        type: "INTEGER",
        description: "ID del presupuesto a eliminar",
      },
    },
    required: ["uuid_de_usuario", "id_presupuesto"],
  },
  requiresConfirmation: true,
  isDestructive: true,
  handler: async ({ id_presupuesto }) => {
    const deleted = await deletePresupuesto(id_presupuesto);
    return { deleted, id_presupuesto };
  },
};

module.exports = [
  listarPresupuestos,
  verPresupuestoActivo,
  crearPresupuesto,
  actualizarPresupuesto,
  eliminarPresupuesto,
];
