const express = require("express");
const {
  getSettings,
  updateUserAjuste,
} = require("../controllers/ajustes.controller");

const router = express.Router();

router.get("/:id", getSettings);
router.put("/update", updateUserAjuste);

module.exports = router;