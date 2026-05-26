const { chatStream } = require("../services/ai-provider");

const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT_CHATINIT;

//https://www.ocrwebservice.com/api/restguide  + https://ocr.space/OCRAPI
//https://www.opswat.com/docs/mdcloud/metadefender-cloud-api-v4#file-lookupbydataid

const startChatbot = async (req, res) => {
    try {
    const { messages } = req.body; 

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
}

module.exports = {
  startChatbot
};
