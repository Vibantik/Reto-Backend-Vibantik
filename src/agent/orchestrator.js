/**
 * orchestrator.js
 *
 * Motor central del agente. Coordina el flujo completo:
 *
 *   detect intent → validate params → run guardrails
 *     → [requiresConfirmation] → emitir action_proposal con token
 *     → [no confirmation]      → ejecutar handler → emitir action_result
 *
 * También expone executeConfirmed() para el endpoint /agent/execute,
 * que verifica el token, re-ejecuta guardrails y llama al handler.
 *
 * Tokens de confirmación:
 *   Se firman con HMAC-SHA256 usando AGENT_SECRET (o un default).
 *   El payload incluye: toolName, params, uuid_de_usuario, expiresAt.
 *   TTL: 5 minutos.
 */

const crypto = require("crypto");
const detector  = require("./intent-detector");
const registry  = require("./tool-registry");
const validator = require("./param-validator");
const guardrails = require("./guardrails");
const builder   = require("./response-builder");

// ─── Configuración ─────────────────────────────────────────────────────────────

const AGENT_SECRET = process.env.AGENT_SECRET || "vibantik-agent-secret-change-in-prod";
const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutos

// ─── Manejo de tokens ──────────────────────────────────────────────────────────

function signToken(payload) {
  const data = JSON.stringify(payload);
  const sig  = crypto
    .createHmac("sha256", AGENT_SECRET)
    .update(data)
    .digest("hex");
  // Codificar payload + firma en base64 para transporte limpio
  return Buffer.from(JSON.stringify({ payload, sig })).toString("base64url");
}

function verifyToken(token) {
  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
  } catch {
    throw Object.assign(new Error("Token inválido"), { code: "TOKEN_INVALID" });
  }

  const { payload, sig } = decoded;
  const expectedSig = crypto
    .createHmac("sha256", AGENT_SECRET)
    .update(JSON.stringify(payload))
    .digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    throw Object.assign(new Error("Firma del token inválida"), { code: "TOKEN_INVALID" });
  }

  if (Date.now() > payload.expiresAt) {
    throw Object.assign(new Error("El token de confirmación expiró"), { code: "TOKEN_EXPIRED" });
  }

  return payload;
}

function createConfirmationToken({ toolName, params, uuidDeUsuario }) {
  const payload = {
    toolName,
    params,
    uuidDeUsuario,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  };
  return signToken(payload);
}

// ─── Mensajes naturales ────────────────────────────────────────────────────────

/**
 * Genera un mensaje en lenguaje natural para presentar la propuesta al usuario.
 */
function buildProposalMessage(tool, params) {
  const messages = {
    crear_meta: `¿Quieres crear una meta "${params.nombreMeta}" por $${Number(params.monto_meta || 0).toLocaleString("es-MX")} con fecha límite el ${params.fecha_fin}?`,
    actualizar_meta: `¿Confirmas actualizar la meta #${params.id_meta}?`,
    eliminar_meta: `¿Estás seguro de que quieres eliminar la meta #${params.id_meta}? Esta acción es permanente.`,
    agregar_ahorro: `¿Confirmas agregar $${Number(params.cantidad || 0).toLocaleString("es-MX")} de ahorro a tu meta #${params.id_meta}?`,
    crear_presupuesto: `¿Quieres crear el presupuesto "${params.nombre}" con un límite de $${Number(params.monto_limite || 0).toLocaleString("es-MX")}?`,
    actualizar_presupuesto: `¿Confirmas actualizar el presupuesto #${params.id_presupuesto}?`,
    eliminar_presupuesto: `¿Seguro que quieres eliminar el presupuesto #${params.id_presupuesto}? Esta acción es permanente.`,
    crear_inversion: `¿Confirmas registrar la inversión "${params.nombre}" por $${Number(params.valor || 0).toLocaleString("es-MX")}?`,
  };

  return (
    messages[tool.name] ||
    `¿Confirmas ejecutar la acción "${tool.name}" con los parámetros detectados?`
  );
}

/**
 * Genera el mensaje de resultado en lenguaje natural.
 */
function buildResultMessage(tool, result, success) {
  if (!success) return `No pude completar la acción. Por favor intenta de nuevo.`;

  const messages = {
    listar_metas: `Aquí están tus metas de ahorro.`,
    crear_meta: `✅ Meta "${result?.nombreMeta || result?.nombre_meta}" creada exitosamente.`,
    actualizar_meta: `✅ Meta actualizada exitosamente.`,
    eliminar_meta: `✅ Meta eliminada correctamente.`,
    ver_progreso_ahorro: result
      ? `Tu meta "${result.nombre_meta}" lleva un ${result.progreso_porcentaje}% de progreso ($${Number(result.ahorro_actual).toLocaleString("es-MX")} de $${Number(result.monto_meta).toLocaleString("es-MX")}).`
      : `No encontré información de progreso para esa meta.`,
    agregar_ahorro: `✅ Se registraron $${Number(result?.cantidad || 0).toLocaleString("es-MX")} de ahorro.`,
    listar_presupuestos: `Aquí están tus presupuestos.`,
    ver_presupuesto_activo: result ? `Este es tu presupuesto activo.` : `No tienes un presupuesto activo actualmente.`,
    crear_presupuesto: `✅ Presupuesto "${result?.nombre}" creado con límite de $${Number(result?.monto_limite || 0).toLocaleString("es-MX")}.`,
    actualizar_presupuesto: `✅ Presupuesto actualizado correctamente.`,
    eliminar_presupuesto: `✅ Presupuesto eliminado.`,
    listar_inversiones: `Aquí están tus inversiones.`,
    ver_inversion: result ? `Detalle de la inversión "${result.nombre}".` : `No encontré esa inversión.`,
    crear_inversion: `✅ Inversión "${result?.nombre}" registrada por $${Number(result?.valor || 0).toLocaleString("es-MX")}.`,
    listar_movimientos: `Aquí están tus movimientos más recientes.`,
    resumen_gastos: `Aquí está tu resumen de gastos.`,
  };

  return messages[tool.name] || `✅ Acción completada exitosamente.`;
}

// ─── Plan de acción (endpoint /agent/chat) ─────────────────────────────────────

/**
 * Analiza el mensaje del usuario y devuelve:
 *   - un action_proposal (si la acción requiere confirmación)
 *   - un action_result  (si la acción se ejecuta directamente)
 *   - null              (si no se detectó intención → el controller hace stream normal)
 *
 * @param {object[]} messages       - historial [{ role, content }]
 * @param {string}   uuidDeUsuario
 * @returns {Promise<object|null>}
 */
async function planAction(messages, uuidDeUsuario) {
  // 1. Detectar intención
  const detected = await detector.detect(messages, uuidDeUsuario);
  if (!detected) return null;

  const { toolName, params } = detected;

  // 2. Obtener definición de la tool
  const tool = registry.getByName(toolName);
  if (!tool) {
    console.warn(`[orchestrator] Tool detectada no existe en el registry: ${toolName}`);
    return null;
  }

  // 3. Validar parámetros
  const { valid, errors, normalizedParams } = validator.validate(tool, params);

  if (!valid) {
    // Faltan parámetros → devolver propuesta incompleta para que el
    // frontend pueda solicitar los datos faltantes al usuario
    return builder.buildError("PARAMS_INCOMPLETE", errors.join(". "), {
      intent: toolName,
      module: tool.module,
      missing_fields: errors,
    });
  }

  // 4. Si la tool no requiere confirmación, ejecutar directamente
  if (!tool.requiresConfirmation) {
    try {
      await guardrails.runAll(tool, normalizedParams, uuidDeUsuario, false);
      const result = await tool.handler(normalizedParams);
      return builder.buildResult({
        intent: toolName,
        module: tool.module,
        tool: toolName,
        success: true,
        result,
        message: buildResultMessage(tool, result, true),
      });
    } catch (err) {
      const code = err.code || "EXECUTION_ERROR";
      return builder.buildError(code, err.message || "Error al ejecutar la acción");
    }
  }

  // 5. La tool requiere confirmación → generar token y devolver proposal
  try {
    await guardrails.runAll(tool, normalizedParams, uuidDeUsuario, false);
  } catch (err) {
    return builder.buildError(err.code || "GUARDRAIL_ERROR", err.message);
  }

  const confirmationToken = createConfirmationToken({
    toolName,
    params: normalizedParams,
    uuidDeUsuario,
  });

  return builder.buildProposal({
    intent: toolName,
    module: tool.module,
    tool: toolName,
    params: normalizedParams,
    confirmationToken,
    message: buildProposalMessage(tool, normalizedParams),
  });
}

// ─── Ejecución confirmada (endpoint /agent/execute) ────────────────────────────

/**
 * Ejecuta una acción previamente propuesta, verificando el token de confirmación.
 *
 * @param {string}  confirmationToken - token devuelto por planAction
 * @param {string}  uuidDeUsuario     - debe coincidir con el del token
 * @param {boolean} confirmed         - el usuario dijo "sí"
 * @returns {Promise<object>}         - siempre devuelve un action_result o error
 */
async function executeConfirmed(confirmationToken, uuidDeUsuario, confirmed, paramsOverrides = {}) {
  // El usuario rechazó
  if (!confirmed) {
    return builder.buildResult({
      intent: "cancelled",
      module: "agent",
      tool: "none",
      success: false,
      result: null,
      message: "Acción cancelada. ¿En qué más puedo ayudarte?",
    });
  }

  // Verificar y decodificar token
  let tokenPayload;
  try {
    tokenPayload = verifyToken(confirmationToken);
  } catch (err) {
    return builder.buildError(err.code || "TOKEN_INVALID", err.message);
  }

  // Verificar que el usuario del token coincide
  if (tokenPayload.uuidDeUsuario !== uuidDeUsuario) {
    return builder.buildError("OWNERSHIP_DENIED", "Este token no pertenece a tu sesión");
  }

  let { toolName, params } = tokenPayload;
  const tool = registry.getByName(toolName);

  if (!tool) {
    return builder.buildError("TOOL_NOT_FOUND", `Tool '${toolName}' no encontrada`);
  }

  // Si hay overrides, fusionar y revalidar
  if (paramsOverrides && Object.keys(paramsOverrides).length > 0) {
    const mergedParams = { ...params, ...paramsOverrides };
    const { valid, errors, normalizedParams } = validator.validate(tool, mergedParams);
    if (!valid) {
      return builder.buildError("PARAMS_INVALID", "Los parámetros modificados son inválidos: " + errors.join(". "));
    }
    params = normalizedParams;
  }

  // Re-ejecutar guardrails antes de ejecutar (defensa en profundidad)
  try {
    await guardrails.runAll(tool, params, uuidDeUsuario, true);
  } catch (err) {
    return builder.buildError(err.code || "GUARDRAIL_ERROR", err.message);
  }

  // Ejecutar el handler real
  try {
    const result = await tool.handler(params);
    return builder.buildResult({
      intent: toolName,
      module: tool.module,
      tool: toolName,
      success: true,
      result,
      message: buildResultMessage(tool, result, true),
    });
  } catch (err) {
    console.error(`[orchestrator] Error ejecutando ${toolName}:`, err);
    return builder.buildResult({
      intent: toolName,
      module: tool.module,
      tool: toolName,
      success: false,
      result: null,
      message: buildResultMessage(tool, null, false),
    });
  }
}

module.exports = { planAction, executeConfirmed };
