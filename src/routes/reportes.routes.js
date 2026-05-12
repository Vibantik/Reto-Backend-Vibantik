// src/routes/reportes.routes.js
const express = require("express");
const { generarReporte } = require("../controllers/reportes.controller");
 
const router = express.Router();
 
// POST /api/reportes/generar
// Body: { anio: number, mes: number, useIA: boolean }
router.post("/generar", generarReporte);
 
module.exports = router;
 