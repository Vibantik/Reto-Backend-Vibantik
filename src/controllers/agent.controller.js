/**
 * agent.controller.js
 *
 * Controller HTTP para los endpoints del agente.
 *
 * POST /api/agent/chat
 *   Analiza el mensaje y devuelve action_proposal, action_result o null
 *   (en cuyo caso el cliente debe usar el endpoint de stream /api/ia/agentic).
 *
 * POST /api/agent/execute
 *   Confirma y ejecuta una acción previamente propuesta.
 *
 * GET  /api/agent/tools
 *   Lista todas las tools registradas (útil para debug / documentación).
 */

const orchestrator = require("../agent/orchestrator");
const registry     = require("../agent/tool-registry");
const { chatStream } = require("../services/ai-provider");

const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT_CHATINIT || "";

// ─── POST /api/agent/chat ─────────────────────────────────────────────────────

/**
 * Punto de entrada principal del chatbot agentic.
 *
 * Body:
 *   {
 *     messages: [{ role: "user"|"assistant", content: string }],
 *     uuid_de_usuario: string,
 *     context?: { modulo_activo?: string }
 *   }
 *
 * Respuesta:
 *   - Si hay intención detectada → JSON { type, intent, tool, params, ... }
 *   - Si no hay intención        → stream de texto (mismo formato que /ia/agentic)
 */
const agentChat = async (req, res) => {
  try {
    const { messages, uuid_de_usuario, context } = req.body;

    // Validaciones básicas
    if (!uuid_de_usuario) {
      return res.status(400).json({ message: "uuid_de_usuario es requerido" });
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: "messages debe ser un array no vacío" });
    }

    // Intentar detectar intención y planificar acción
    const plan = await orchestrator.planAction(messages, uuid_de_usuario);

    if (plan) {
      // Hay acción (proposal, result, o error de parámetros incompletos)
      return res.status(200).json(plan);
    }

    // Sin intención agentic → fallback a stream de chat normal
    const fullMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ].filter((m) => m.content);

    await chatStream(fullMessages, res);
  } catch (error) {
    console.error("[agent/chat] Error:", error);
    if (!res.headersSent) {
      return res.status(500).json({ message: "Error interno del servidor" });
    }
    res.end();
  }
};

// ─── POST /api/agent/execute ──────────────────────────────────────────────────

/**
 * Confirma (o rechaza) y ejecuta una acción propuesta.
 *
 * Body:
 *   {
 *     confirmation_token: string,  ← token devuelto por /agent/chat
 *     uuid_de_usuario: string,
 *     confirmed: boolean           ← true = ejecutar, false = cancelar
 *   }
 *
 * Respuesta:
 *   { type: "action_result", success, result, message, ... }
 */
const agentExecute = async (req, res) => {
  try {
    const { confirmation_token, uuid_de_usuario, confirmed, params } = req.body;

    if (!uuid_de_usuario) {
      return res.status(400).json({ message: "uuid_de_usuario es requerido" });
    }

    if (!confirmation_token) {
      return res.status(400).json({ message: "confirmation_token es requerido" });
    }

    if (typeof confirmed !== "boolean") {
      return res.status(400).json({ message: "confirmed debe ser true o false" });
    }

    const result = await orchestrator.executeConfirmed(
      confirmation_token,
      uuid_de_usuario,
      confirmed,
      params
    );

    // Si el token era inválido, devolver 400; si fue error de ejecución, 200 (el result lo indica)
    const statusCode =
      result.type === "agent_error" &&
      ["TOKEN_INVALID", "TOKEN_EXPIRED", "OWNERSHIP_DENIED"].includes(result.code)
        ? 400
        : 200;

    return res.status(statusCode).json(result);
  } catch (error) {
    console.error("[agent/execute] Error:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

// ─── GET /api/agent/tools ─────────────────────────────────────────────────────

/**
 * Lista todas las tools disponibles (sin handlers, solo metadata).
 * Útil para debug, documentación y el frontend.
 */
const listTools = (req, res) => {
  const tools = registry.getAll().map(({ name, module, description, requiresConfirmation, isDestructive, parameters }) => ({
    name,
    module,
    description,
    requiresConfirmation,
    isDestructive,
    requiredParams: parameters?.required || [],
  }));

  return res.status(200).json({ tools });
};

module.exports = { agentChat, agentExecute, listTools };
