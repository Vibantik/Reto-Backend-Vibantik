const express = require("express");
const {
	getMetas,
	postMeta,
	putMeta,
	deleteMeta,
} = require("../controllers/metas.controller");

const router = express.Router();

router.get("/metas", getMetas);
router.post("/metas", postMeta);
router.put("/metas/:id_meta", putMeta);
router.delete("/metas/:id_meta", deleteMeta);

module.exports = router;