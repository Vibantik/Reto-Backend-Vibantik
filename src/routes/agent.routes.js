const express = require("express");
const { executeAction } = require("../controllers/agent.controller");

const router = express.Router();

router.post("/execute", executeAction);

module.exports = router;
