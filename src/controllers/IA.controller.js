const { chat } = require("../services/ai-provider");
const { planAgenticResponse } = require("../services/AI.service");

const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT_CHATINIT;

//https://www.ocrwebservice.com/api/restguide  + https://ocr.space/OCRAPI
//https://www.opswat.com/docs/mdcloud/metadefender-cloud-api-v4#file-lookupbydataid

const startChatbot = async (req, res) => {
  try {
    const {
      messages,
      uuid_de_usuario,
      conversation_id,
      agent_preferences,
    } = req.body;

    const lastMsg = [...(messages || [])].reverse().find((m) => m?.role === "user")?.content;
    console.log(`[startChatbot] incoming message: "${lastMsg}" | uuid=${uuid_de_usuario || "anon"}`);

    const toolPlan = await planAgenticResponse(messages, {
      userUuid: uuid_de_usuario || null,
      conversationId: conversation_id || null,
      agentPreferences: agent_preferences || {},
    });

    console.log("[startChatbot] toolPlan:", toolPlan ? `type=${toolPlan.type} source=${toolPlan.meta?.source || "n/a"}` : "null → fallback to chat()");

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

    const fullMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];

    console.log("[startChatbot] calling chat() (Ollama/Gemini provider)...");
    const rawText = await chat(fullMessages);
    console.log("[startChatbot] chat() raw response (first 200 chars):", String(rawText).slice(0, 200));

    let responseChunk;
    try {
      const parsed = JSON.parse(rawText);
      if (parsed.componente_ui) {
        responseChunk = {
          type: "ui_tool",
          tool: parsed.componente_ui,
          data: parsed.datos_ui || {},
          message: { content: parsed.mensaje_texto || "" },
        };
      } else {
        responseChunk = {
          type: "assistant_text",
          message: { role: "assistant", content: parsed.mensaje_texto || rawText },
          done: true,
        };
      }
    } catch {
      responseChunk = {
        type: "assistant_text",
        message: { role: "assistant", content: rawText },
        done: true,
      };
    }

    res.setHeader("Content-Type", "application/x-ndjson");
    res.write(`${JSON.stringify(responseChunk)}\n`);
    return res.end();

  } catch (error) {
      console.error("Error en IA controller:", error);
      if (!res.headersSent) {
        return res.status(500).json({ message: "Error interno del servidor" });
      }
  }
};

module.exports = {
  startChatbot
};
