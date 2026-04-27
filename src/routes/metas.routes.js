const express = require("express");
const { getMetas } = require("../controllers/metas.controller");

const router = express.Router();

router.get("/metas", getMetas);

module.exports = router;