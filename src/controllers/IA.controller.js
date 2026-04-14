const { Readable } = require('stream');

const OLLAMA_URL = process.env.OLLAMA_URL +"api/chat";
const MODEL = process.env.MODEL;
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT_CHATINIT;

const startChatbot = async (req, res) => {
    try {
    const { messages } = req.body; 
    const ollamaRes = await fetch(OLLAMA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT }, 
            ...messages 
          ],
          stream: true, 
          think: true 
        })
      });

      if (!ollamaRes.ok) {
        return res.status(500).json({ message: "Error conectando a Ollama" });
      }

      //MANDA A FRONT!
      res.setHeader("Content-Type", "text/plain");
      res.setHeader("Transfer-Encoding", "chunked");
      Readable.fromWeb(ollamaRes.body).pipe(res);

    } catch (error) {
        console.error("Error en IA controller:", error);
        return res.status(500).json({ message: "Error interno del servidor" });
    }
}

module.exports = {
  startChatbot
};
