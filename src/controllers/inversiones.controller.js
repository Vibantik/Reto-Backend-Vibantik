// src/controllers/inversiones.controller.js
const {
  getAllInversiones,
  getInversionById: getInversionByIdService,
  getInversionesByUser: getInversionesByUserService
} = require("../services/inversiones.service");

const getInversiones = async (req, res) => {
  try {
    const result = await getAllInversiones();
    res.status(200).json(result);
  } catch (error) {
    console.error("Error al obtener inversiones:", error.message || error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

const getInversionesByUser = async (req, res) => {
  try {
    const uuid = req.params.uuid;
    if (!uuid) {
      return res.status(400).json({ message: "uuid es requerido" });
    }
    const result = await getInversionesByUserService(uuid);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error al obtener inversiones por usuario:", error.message || error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

const getInversionById = async (req, res) => {
  try {
    const inversion = await getInversionByIdService(req.params.id);
    if (!inversion) {
      return res.status(404).json({ message: "Inversión no encontrada" });
    }
    res.status(200).json(inversion);
  } catch (error) {
    console.error("Error al obtener inversión:", error.message || error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

module.exports = { getInversiones, getInversionesByUser, getInversionById };