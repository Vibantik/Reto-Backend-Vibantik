const { chatStream } = require("../services/ai-provider");
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

    const fullMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];

    await chatStream(fullMessages, res);

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
