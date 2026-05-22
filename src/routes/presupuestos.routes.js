const express = require("express");
const {
  getPresupuestos,
  getLastPresupuesto,
  getPresupuesto,
  createPresupuesto,
  updatePresupuesto,
  deletePresupuesto,
  vincularTransaccion,
} = require("../controllers/presupuestos.controller");

const router = express.Router();

router.get("/", getPresupuestos);
router.get("/last-month", getLastPresupuesto);
router.get("/:id", getPresupuesto);
router.post("/", createPresupuesto);
router.put("/:id", updatePresupuesto);
router.delete("/:id", deletePresupuesto);
router.post("/:id/transaccion", vincularTransaccion);

module.exports = router;
