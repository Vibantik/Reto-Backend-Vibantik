/**
 * response-builder.js
 *
 * Construye respuestas estructuradas y consistentes para todas las
 * respuestas del agente. El frontend siempre recibe el mismo shape.
 */

/**
 * Propuesta de acción (requiere confirmación del usuario).
 *
 * @param {object} opts
 * @param {string} opts.intent            - intent detectado (ej. "crear_meta")
 * @param {string} opts.module            - módulo (ej. "metas")
 * @param {string} opts.tool              - nombre de la tool
 * @param {object} opts.params            - parámetros extraídos
 * @param {string} opts.confirmationToken - token HMAC firmado
 * @param {string} opts.message           - mensaje en lenguaje natural para el usuario
 */
function buildProposal({ intent, module, tool, params, confirmationToken, message }) {
  return {
    type: "action_proposal",
    intent,
    module,
    tool,
    params,
    requires_confirmation: true,
    confirmation_token: confirmationToken,
    message,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Resultado de ejecución de una acción.
 *
 * @param {object} opts
 * @param {string} opts.intent   - intent ejecutado
 * @param {string} opts.module   - módulo
 * @param {string} opts.tool     - tool ejecutada
 * @param {boolean} opts.success - éxito de la operación
 * @param {any}    opts.result   - datos devueltos por el servicio
 * @param {string} opts.message  - mensaje en lenguaje natural
 */
function buildResult({ intent, module, tool, success, result, message }) {
  return {
    type: "action_result",
    intent,
    module,
    tool,
    success,
    result: result ?? null,
    message,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Respuesta de error estructurada.
 *
 * @param {string} code    - código de error legible (ej. "PARAM_INVALID")
 * @param {string} message - mensaje en lenguaje natural para el usuario
 * @param {object} [meta]  - detalles adicionales (no exponer stack traces)
 */
function buildError(code, message, meta = {}) {
  return {
    type: "agent_error",
    code,
    message,
    meta,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Respuesta de texto puro (el agente no detectó ninguna acción,
 * el controller debe caer al stream normal de la IA).
 * Este shape se usa cuando el orchestrator devuelve null y el
 * controller decide responder con un mensaje de texto sin stream.
 */
function buildTextResponse(message) {
  return {
    type: "text",
    message,
    timestamp: new Date().toISOString(),
  };
}

module.exports = { buildProposal, buildResult, buildError, buildTextResponse };
