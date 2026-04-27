const express = require("express");
const {
  getCategorias,
  getCategoria,
  createCategoria,
  updateCategoria,
  deleteCategoria,
} = require("../controllers/categorias.controller");

const router = express.Router();

router.get("/", getCategorias);
router.get("/:id", getCategoria);
router.post("/", createCategoria);
router.put("/:id", updateCategoria);
router.delete("/:id", deleteCategoria);

module.exports = router;
