/**
 * IA.controller.js
 *
 * Endpoint heredado /api/ia/agentic.
 * Ahora delega al orchestrator central que cubre todos los módulos.
 * Se mantiene por compatibilidad con clientes que ya usan esta ruta.
 * Los clientes nuevos deben usar /api/agent/chat.
 */

const { chatStream } = require("../services/ai-provider");
const orchestrator = require("../agent/orchestrator");

const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT_CHATINIT || "";

const startChatbot = async (req, res) => {
  try {
    const { messages, uuid_de_usuario } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: "messages es requerido" });
    const {
      messages,
      uuid_de_usuario,
      conversation_id,
      agent_preferences,
    } = req.body;

    const toolPlan = await planAgenticResponse(messages, {
      userUuid: uuid_de_usuario || null,
      conversationId: conversation_id || null,
      agentPreferences: agent_preferences || {},
    });

    if (toolPlan) {
      res.setHeader("Content-Type", "application/x-ndjson");
      if (toolPlan.type === "assistant_text") {
        res.write(
          `${JSON.stringify({
            type: "assistant_text",
            message: {
              role: "assistant",
              content: toolPlan.message?.content || "",
            },
            done: true,
            meta: toolPlan.meta || {},
          })}\n`
        );
      } else {
        res.write(`${JSON.stringify(toolPlan)}\n`);
      }
      return res.end();
    }

    // Intentar detección agentic con el nuevo orchestrator universal
    if (uuid_de_usuario) {
      const plan = await orchestrator.planAction(messages, uuid_de_usuario);

      if (plan) {
        res.setHeader("Content-Type", "application/x-ndjson");
        res.write(`${JSON.stringify(plan)}\n`);
        return res.end();
      }
    }

    // Fallback: stream de chat normal
    const fullMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ].filter((m) => m.content);

    await chatStream(fullMessages, res);
  } catch (error) {
    console.error("Error en IA controller:", error);
    if (!res.headersSent) {
      return res.status(500).json({ message: "Error interno del servidor" });
    }
    res.end();
  }
};

module.exports = { startChatbot };
