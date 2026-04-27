const express = require("express");
const {
  handleNewTransaction,
} = require("../controllers/webhook.controller");

const router = express.Router();

router.post("/transactions", handleNewTransaction);

module.exports = router;
