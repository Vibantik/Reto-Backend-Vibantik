const express = require("express");
const {
  getTransactions,
  getTransaction,
} = require("../controllers/transactions.controller");
const { streamTransactions } = require("../controllers/sse.controller");

const router = express.Router();

router.get("/", getTransactions);
router.get("/stream", streamTransactions);
router.get("/:id", getTransaction);

module.exports = router;