const chatService = require("../services/chat.service");

const createConversation = async (req, res) => {
  try {
    const { uuid_de_usuario } = req.body;

    if (!uuid_de_usuario) {
      return res.status(400).json({ message: "uuid_de_usuario es requerido" });
    }

    const conversationId = await chatService.startConversation(uuid_de_usuario);
    return res.status(201).json({ id_conv: conversationId });
  } catch (error) {
    console.error("Error al crear la conversación:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

const getConversations = async (req, res) => {
  try {
    const { uuid_de_usuario } = req.body;

    if (!uuid_de_usuario) {
      return res.status(400).json({ message: "uuid_de_usuario es requerido" });
    }
    const conversations = await chatService.getConversations(uuid_de_usuario);
    return res.status(200).json(conversations);
  } catch (error) {
    console.error("Error al obtener las conversaciones:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

const getMessages = async (req, res) => {
  try {
    const { id_conv } = req.body;

    if (!id_conv) {
      return res.status(400).json({ message: "id_conv es requerido" });
    }

    const messages = await chatService.getMessages(id_conv);
    return res.status(200).json(messages);
  } catch (error) {
    console.error("Error al obtener los mensajes:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};  

const saveMessage = async (req, res) => {
  try {
    const { id_conv, mensaje_usuario, respuesta_ia } = req.body;

    if (!id_conv || !mensaje_usuario || !respuesta_ia) {
      return res.status(400).json({ message: "id_conv, mensaje_usuario y respuesta_ia son requeridos" });
    }

    const messageId = await chatService.saveMessage(id_conv, mensaje_usuario, respuesta_ia);
    return res.status(201).json({ id_msj: messageId });
  } catch (error) {
    console.error("Error al guardar el mensaje:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

module.exports = {
  createConversation,
  saveMessage,
  getConversations,
  getMessages
};
