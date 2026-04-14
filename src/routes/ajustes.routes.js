const express = require("express");
const {
  getSettings
} = require("../controllers/ajustes.controller");

const router = express.Router();

router.get("/:id", getSettings);

module.exports = router;