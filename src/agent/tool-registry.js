/**
 * tool-registry.js
 *
 * Registro central de todas las tools agentic del sistema.
 *
 * Para agregar un nuevo módulo:
 *   1. Crear src/tools/<modulo>.tools.js con el mismo formato.
 *   2. Importarlo aquí y agregarlo al array de módulos en buildRegistry().
 *
 * El registry expone:
 *   - getAll()       → todas las tools como array plano
 *   - getByName(n)   → tool por nombre exacto
 *   - getByModule(m) → tools de un módulo específico
 *   - toGeminiFunctionDeclarations() → formato que consume Gemini API
 */

const metasTools        = require("../tools/metas.tools");
const presupuestosTools = require("../tools/presupuestos.tools");
const inversionesTools  = require("../tools/inversiones.tools");
const movimientosTools  = require("../tools/movimientos.tools");
const ahorroTools       = require("../tools/ahorro.tools");

// ─── Construcción del registry ─────────────────────────────────────────────────

const ALL_TOOLS = [
  ...metasTools,
  ...ahorroTools,
  ...presupuestosTools,
  ...inversionesTools,
  ...movimientosTools,
];

// Validar unicidad de nombres en startup
(function validateRegistry() {
  const names = ALL_TOOLS.map((t) => t.name);
  const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
  if (duplicates.length > 0) {
    throw new Error(`[tool-registry] Nombres de tool duplicados: ${duplicates.join(", ")}`);
  }
})();

// ─── API pública ───────────────────────────────────────────────────────────────

/**
 * Devuelve todas las tools registradas.
 * @returns {object[]}
 */
function getAll() {
  return ALL_TOOLS;
}

/**
 * Busca una tool por nombre exacto.
 * @param {string} name
 * @returns {object|undefined}
 */
function getByName(name) {
  return ALL_TOOLS.find((t) => t.name === name);
}

/**
 * Filtra tools por módulo.
 * @param {string} module
 * @returns {object[]}
 */
function getByModule(module) {
  return ALL_TOOLS.filter((t) => t.module === module);
}

/**
 * Convierte las tools al formato functionDeclarations que espera Gemini.
 * Solo exporta el subconjunto de campos que la API necesita.
 *
 * @returns {object[]}
 */
function toGeminiFunctionDeclarations() {
  return ALL_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}

/**
 * Genera un resumen de todas las tools para el system prompt de la IA.
 * Útil para dar contexto al modelo cuando no se usa function-calling.
 *
 * @returns {string}
 */
function toSystemPromptSummary() {
  return ALL_TOOLS.map(
    (t) =>
      `- ${t.name} [${t.module}]: ${t.description.split(".")[0]}.`
  ).join("\n");
}

module.exports = { getAll, getByName, getByModule, toGeminiFunctionDeclarations, toSystemPromptSummary };
