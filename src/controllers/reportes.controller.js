// src/controllers/reportes.controller.js
const {
  getTransaccionesMes,
  buildReporteEstandar,
  getAnalisisIA,
} = require("../services/reportes.service");
 
const generarReporte = async (req, res) => {
  const { anio, mes, useIA = false } = req.body;
 
  // CA0601: Validar que se reciban mes y año
  if (!anio || !mes) {
    return res.status(400).json({ message: "Se requiere mes y año para generar el reporte." });
  }
 
  const anioNum = parseInt(anio);
  const mesNum  = parseInt(mes);
 
  if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12) {
    return res.status(400).json({ message: "Mes o año inválido." });
  }
 
  try {
    // Obtener transacciones del mes
    const transacciones = await getTransaccionesMes(anioNum, mesNum);
 
    // CA0605: Validar que existan datos en ese mes
    if (transacciones.length === 0) {
      return res.status(404).json({
        message: `No se encontraron movimientos en ${String(mesNum).padStart(2, "0")}/${anioNum}. Registra algunos movimientos primero.`,
        sinDatos: true,
      });
    }
 
    // Construir reporte estándar (CA0603)
    const reporte = buildReporteEstandar(transacciones, anioNum, mesNum);
 
    // CA0604: Si useIA, agregar análisis
    if (useIA) {
      try {
        const analisisIA = await getAnalisisIA(reporte);
        reporte.analisisIA = analisisIA;
      } catch (iaErr) {
        console.error("Error en análisis IA:", iaErr.message);
        // No rompe el reporte — entrega estándar con aviso
        reporte.analisisIA = null;
        reporte.iaError = "El análisis con IA no está disponible en este momento. Se entrega el reporte estándar.";
      }
    }
 
    return res.status(200).json(reporte);
  } catch (error) {
    console.error("Error generando reporte:", error);
    return res.status(500).json({ message: "Error interno al generar el reporte." });
  }
};
 
module.exports = { generarReporte };
 