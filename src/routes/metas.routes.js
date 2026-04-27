const express = require("express");
const { getMetas, postMeta } = require("../controllers/metas.controller");

const router = express.Router();

router.get("/metas", getMetas);
router.post("/metas", postMeta);

module.exports = router;