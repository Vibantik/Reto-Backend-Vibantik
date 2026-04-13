const express = require("express");
const chatController = require("../controllers/chat.controller");

const router = express.Router();

// nueva convo
router.post("/conversation", chatController.createConversation);
router.get("/conversations", chatController.getConversations);
// TODO : ruta get y update para imagenes y de update conversacion y msjs. 

// guardar msjs
router.post("/message", chatController.saveMessage);
router.get("/messages", chatController.getMessages);

module.exports = router;
