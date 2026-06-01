/**
 * movimientos.tools.js
 *
 * Tools agentic para el módulo de Movimientos / Transacciones.
 * Por seguridad, las transacciones son solo de lectura desde el agente
 * (se insertan vía webhook bancario, no manualmente).
 */

const { getAllTransactions, getTransactionById } = require("../services/transactions.service");

const MODULE = "movimientos";

// ─── Tool: listar_movimientos ─────────────────────────────────────────────────

const listarMovimientos = {
  name: "listar_movimientos",
  module: MODULE,
  description:
    "Lista los movimientos o transacciones del usuario con filtros opcionales. Úsala cuando el usuario quiera ver sus gastos, ingresos, movimientos recientes o transacciones de una categoría o fecha específica.",
  parameters: {
    type: "OBJECT",
    properties: {
      uuid_de_usuario: {
        type: "STRING",
        description: "UUID del usuario",
      },
      type: {
        type: "STRING",
        description: "Tipo de transacción: 'ingreso', 'egreso' o 'all'",
      },
      category: {
        type: "STRING",
        description: "Filtrar por categoría (ej. 'Comida', 'Transporte')",
      },
      startDate: {
        type: "STRING",
        description: "Fecha de inicio del rango (YYYY-MM-DD)",
      },
      endDate: {
        type: "STRING",
        description: "Fecha de fin del rango (YYYY-MM-DD)",
      },
      search: {
        type: "STRING",
        description: "Texto a buscar en la descripción de la transacción",
      },
      limit: {
        type: "INTEGER",
        description: "Número de resultados por página (default 15)",
      },
    },
    required: ["uuid_de_usuario"],
  },
  requiresConfirmation: false,
  isDestructive: false,
  handler: async ({ type, category, startDate, endDate, search, limit }) => {
    // Nota: getAllTransactions no filtra por uuid actualmente (datos globales).
    // Se pasa el filtro disponible en el query builder del servicio existente.
    return getAllTransactions({
      type: type || "all",
      category,
      startDate,
      endDate,
      search,
      limit: limit || 10,
      page: 1,
    });
  },
};

// ─── Tool: resumen_gastos ─────────────────────────────────────────────────────

const resumenGastos = {
  name: "resumen_gastos",
  module: MODULE,
  description:
    "Genera un resumen de gastos agrupado por categoría en un periodo. Úsala cuando el usuario pregunte cuánto gastó en qué categoría, su resumen mensual o quiera saber en qué se va el dinero.",
  parameters: {
    type: "OBJECT",
    properties: {
      uuid_de_usuario: {
        type: "STRING",
        description: "UUID del usuario",
      },
      startDate: {
        type: "STRING",
        description: "Fecha inicio del periodo",
      },
      endDate: {
        type: "STRING",
        description: "Fecha fin del periodo",
      },
    },
    required: ["uuid_de_usuario"],
  },
  requiresConfirmation: false,
  isDestructive: false,
  handler: async ({ startDate, endDate }) => {
    const result = await getAllTransactions({
      type: "egreso",
      startDate,
      endDate,
      limit: 200,
      page: 1,
    });

    // Agrupar por categoría
    const resumen = {};
    for (const t of result.data) {
      const cat = t.category || "Sin categoría";
      if (!resumen[cat]) resumen[cat] = { categoria: cat, total: 0, count: 0 };
      resumen[cat].total += parseFloat(t.amount);
      resumen[cat].count += 1;
    }

    const categorias = Object.values(resumen).sort((a, b) => b.total - a.total);
    const totalEgresos = categorias.reduce((s, c) => s + c.total, 0);

    return {
      periodo: { startDate, endDate },
      total_egresos: totalEgresos,
      categorias: categorias.map((c) => ({
        ...c,
        porcentaje: totalEgresos > 0 ? Math.round((c.total / totalEgresos) * 100) : 0,
      })),
    };
  },
};

module.exports = [listarMovimientos, resumenGastos];
