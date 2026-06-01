
// src/routes/inversiones.routes.js
const express = require("express");
const {
  getInversiones,
  getInversionById,
  getInversionesByUser
} = require("../controllers/inversiones.controller");

const router = express.Router();

router.get("/", getInversiones);
router.get("/u/:uuid", getInversionesByUser);
router.get("/:id", getInversionById);

module.exports = router;
