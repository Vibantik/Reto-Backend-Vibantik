/**
 * param-validator.js
 *
 * Valida y normaliza los parámetros extraídos por el intent-detector
 * antes de pasarlos al guardrail y al handler de la tool.
 *
 * Cada tool en el registry declara un `parameters` schema (al estilo
 * JSON Schema / Gemini function-calling). Este módulo evalúa los
 * required fields y hace coerciones seguras de tipos.
 */

const MAX_AMOUNT = 10_000_000;
const MIN_AMOUNT = 0.01;

// ─── Validadores atómicos ──────────────────────────────────────────────────────

function isPositiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= MIN_AMOUNT && n <= MAX_AMOUNT;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidDate(value) {
  if (!value) return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
}

function isDateAfter(dateA, dateB) {
  return new Date(dateA) > new Date(dateB);
}

// ─── Normalizadores ────────────────────────────────────────────────────────────

function normalizeAmount(value) {
  return Math.round(Number(value) * 100) / 100;
}

function normalizeDate(value) {
  // Devuelve siempre ISO 8601 date string (YYYY-MM-DD)
  const d = new Date(value);
  return d.toISOString().split("T")[0];
}

function normalizeString(value) {
  return String(value).trim();
}

// ─── Validación por tipo de campo ─────────────────────────────────────────────

/**
 * Valida un campo individual según su tipo declarado en el schema.
 *
 * @param {string} name   - nombre del campo
 * @param {any}    value  - valor recibido
 * @param {object} schema - definición del campo ({ type, description })
 * @returns {{ valid: boolean, error?: string, normalized?: any }}
 */
function validateField(name, value, schema) {
  const type = (schema.type || "STRING").toUpperCase();

  if (value === undefined || value === null || value === "") {
    return { valid: false, error: `El campo '${name}' es requerido` };
  }

  if (type === "NUMBER") {
    if (!isPositiveNumber(value)) {
      return {
        valid: false,
        error: `El campo '${name}' debe ser un número entre ${MIN_AMOUNT} y ${MAX_AMOUNT.toLocaleString()}`,
      };
    }
    return { valid: true, normalized: normalizeAmount(value) };
  }

  if (type === "STRING") {
    if (!isNonEmptyString(value)) {
      return { valid: false, error: `El campo '${name}' no puede estar vacío` };
    }
    return { valid: true, normalized: normalizeString(value) };
  }

  if (type === "DATE") {
    if (!isValidDate(value)) {
      return { valid: false, error: `El campo '${name}' no es una fecha válida` };
    }
    return { valid: true, normalized: normalizeDate(value) };
  }

  if (type === "INTEGER") {
    const n = parseInt(value, 10);
    if (!Number.isInteger(n) || n <= 0) {
      return { valid: false, error: `El campo '${name}' debe ser un entero positivo` };
    }
    return { valid: true, normalized: n };
  }

  if (type === "BOOLEAN") {
    const b = value === true || value === "true";
    return { valid: true, normalized: b };
  }

  // Tipo desconocido: pasar tal cual
  return { valid: true, normalized: value };
}

// ─── Validador principal ───────────────────────────────────────────────────────

/**
 * Valida todos los parámetros de una tool contra su schema declarado.
 *
 * @param {object} tool   - definición de la tool (del registry)
 * @param {object} params - parámetros extraídos por el intent-detector
 * @returns {{ valid: boolean, errors: string[], normalizedParams: object }}
 */
function validate(tool, params = {}) {
  const schema = tool.parameters || {};
  const properties = schema.properties || {};
  const required = schema.required || [];
  const errors = [];
  const normalizedParams = { ...params };

  // Validar campos requeridos y normalizarlos
  for (const [name, fieldSchema] of Object.entries(properties)) {
    const isRequired = required.includes(name);
    const value = params[name];

    if (value === undefined || value === null || value === "") {
      if (isRequired) {
        errors.push(`El campo '${name}' es requerido`);
      }
      continue;
    }

    const { valid, error, normalized } = validateField(name, value, fieldSchema);
    if (!valid) {
      errors.push(error);
    } else {
      normalizedParams[name] = normalized;
    }
  }

  // Validaciones cruzadas específicas
  if (normalizedParams.fecha_inicio && normalizedParams.fecha_fin) {
    if (!isDateAfter(normalizedParams.fecha_fin, normalizedParams.fecha_inicio)) {
      errors.push("La fecha_fin debe ser posterior a la fecha_inicio");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    normalizedParams,
  };
}

module.exports = { validate, isPositiveNumber, isValidDate, isNonEmptyString };
