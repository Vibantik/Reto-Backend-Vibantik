
// src/routes/inversiones.routes.js
const express = require("express");
const {
  getInversiones,
  getInversionById,
  getInversionesByUser
} = require("../controllers/inversiones.controller");

const router = express.Router();

router.get("/", getInversiones);
router.get("/:id", getInversionById);
router.get("/u/:uuid", getInversionesByUser);

module.exports = router;