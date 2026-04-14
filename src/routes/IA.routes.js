const express = require ("express");
const IAController= require ("../controllers/IA.controller")

const router= express.Router();

router.post("/agentic", IAController.startChatbot);


module.exports =router;