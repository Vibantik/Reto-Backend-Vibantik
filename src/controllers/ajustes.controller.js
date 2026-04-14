const {
  getUserSettings,
} = require("../services/ajustes.service");

const getSettings = async (req, res) => {
  try {
    const result = await getUserSettings(req.params.id);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error al obtener configuración del usuario:", error.message || error);
    res.status(500).json({
      message: "Error interno del servidor",
    });
  }
};

module.exports = {
  getSettings
};