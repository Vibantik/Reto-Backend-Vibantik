/**
 * agent.routes.js
 *
 * Rutas HTTP para el agente Vibantik.
 *
 *   POST /api/agent/chat     → punto de entrada principal del chatbot agentic
 *   POST /api/agent/execute  → confirmar y ejecutar una acción propuesta
 *   GET  /api/agent/tools    → listar todas las tools disponibles
 */

const express = require("express");
const { agentChat, agentExecute, listTools } = require("../controllers/agent.controller");

const router = express.Router();

router.post("/chat", agentChat);
router.post("/execute", agentExecute);
router.get("/tools", listTools);

module.exports = router;
