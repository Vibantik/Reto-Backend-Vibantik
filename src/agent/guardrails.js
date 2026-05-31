/**
 * guardrails.js
 *
 * Capa de seguridad del agente. Verifica:
 *   1. Ownership: que el recurso pertenece al usuario.
 *   2. Amount limits: montos dentro de rangos razonables.
 *   3. Forced confirmation: acciones destructivas siempre confirman.
 *
 * Todas las funciones lanzan un Error con código adjunto si la
 * verificación falla, para que el orchestrator lo capture limpiamente.
 */

const pool = require("../connect");

// ─── Errores tipados ───────────────────────────────────────────────────────────

class GuardrailError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "GuardrailError";
  }
}

// ─── Mapeo módulo → tabla + columna de usuario ────────────────────────────────

const OWNERSHIP_MAP = {
  metas: {
    table: "meta",
    idColumn: "id_meta",
    userColumn: "uuid_de_usuario",
    paramKey: "id_meta",
  },
  presupuestos: {
    table: "presupuesto",
    idColumn: "id_presupuesto",
    userColumn: "uuid_de_usuario",
    paramKey: "id_presupuesto",
  },
  inversiones: {
    table: "inversiones",
    idColumn: '"id_inversión"',
    userColumn: "uuid_de_usuario",
    paramKey: "id_inversion",
  },
};

// ─── Verificación de ownership ────────────────────────────────────────────────

/**
 * Verifica que el recurso con `resourceId` pertenece a `uuidDeUsuario`.
 * Solo aplica para operaciones sobre recursos específicos (update, delete).
 *
 * @param {string} module      - módulo de la tool ("metas", "presupuestos", etc.)
 * @param {any}    resourceId  - ID del recurso
 * @param {string} uuidDeUsuario
 */
async function verifyOwnership(module, resourceId, uuidDeUsuario) {
  const mapping = OWNERSHIP_MAP[module];
  if (!mapping) return; // módulo sin tabla de ownership (ej. movimientos solo-lectura)
  if (!resourceId) return; // tool de creación, no hay ID aún

  const { table, idColumn, userColumn } = mapping;
  const query = `SELECT 1 FROM ${table} WHERE ${idColumn} = $1 AND ${userColumn} = $2 LIMIT 1`;

  const { rowCount } = await pool.query(query, [resourceId, uuidDeUsuario]);

  if (rowCount === 0) {
    throw new GuardrailError(
      "OWNERSHIP_DENIED",
      "No tienes permiso para modificar este recurso"
    );
  }
}

// ─── Validación de monto ──────────────────────────────────────────────────────

const MAX_SAFE_AMOUNT = 10_000_000;
const MIN_SAFE_AMOUNT = 0.01;

/**
 * Verifica que un monto esté dentro de rangos seguros.
 *
 * @param {number} amount
 */
function checkAmountLimits(amount) {
  if (amount === undefined || amount === null) return; // campo opcional
  const n = Number(amount);
  if (!Number.isFinite(n) || n < MIN_SAFE_AMOUNT || n > MAX_SAFE_AMOUNT) {
    throw new GuardrailError(
      "AMOUNT_OUT_OF_RANGE",
      `El monto debe estar entre $${MIN_SAFE_AMOUNT} y $${MAX_SAFE_AMOUNT.toLocaleString()}`
    );
  }
}

// ─── Guard contra acciones destructivas ──────────────────────────────────────

/**
 * Las tools marcadas como `isDestructive: true` SIEMPRE deben pasar por
 * confirmación. Si llegaron aquí sin confirmation_token, algo falló en el
 * orchestrator; lanzamos error por seguridad.
 *
 * @param {object} tool           - definición de la tool
 * @param {boolean} isConfirmed   - viene de /agent/execute (true) o /agent/chat (false)
 */
function enforceDestructiveConfirmation(tool, isConfirmed) {
  if (tool.isDestructive && !isConfirmed) {
    throw new GuardrailError(
      "DESTRUCTIVE_UNCONFIRMED",
      "Esta acción requiere confirmación explícita del usuario"
    );
  }
}

// ─── Runner de todos los guardrails ──────────────────────────────────────────

/**
 * Ejecuta todos los guardrails relevantes para la tool y los parámetros dados.
 *
 * @param {object} tool           - definición de la tool (del registry)
 * @param {object} params         - parámetros normalizados
 * @param {string} uuidDeUsuario
 * @param {boolean} isConfirmed   - si viene del endpoint /execute
 */
async function runAll(tool, params, uuidDeUsuario, isConfirmed = false) {
  // 1. Forzar confirmación para acciones destructivas
  enforceDestructiveConfirmation(tool, isConfirmed);

  // 2. Verificar ownership si aplica
  const mapping = OWNERSHIP_MAP[tool.module];
  if (mapping && params[mapping.paramKey]) {
    await verifyOwnership(tool.module, params[mapping.paramKey], uuidDeUsuario);
  }

  // 3. Límites de monto
  if (params.monto_meta !== undefined) checkAmountLimits(params.monto_meta);
  if (params.monto_limite !== undefined) checkAmountLimits(params.monto_limite);
  if (params.valor !== undefined) checkAmountLimits(params.valor);
  if (params.cantidad !== undefined) checkAmountLimits(params.cantidad);
}

module.exports = { runAll, verifyOwnership, checkAmountLimits, GuardrailError };
