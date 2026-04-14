const {
  getUserSettings,
  updateAjuste,
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

const updateUserAjuste = async (req, res) => {
  try {
    const {
      uuid_de_usuario,
      activ_presupuestos,
      activ_reportes,
      activ_ia,
      activ_alertas,
      activ_metas,
      activ_categ,
    } = req.body;

    const ajuste = {
      uuid_de_usuario,
      activ_presupuestos,
      activ_reportes,
      activ_ia,
      activ_alertas,
      activ_metas,
      activ_categ,
    };

    const result = await updateAjuste(ajuste);

    if (!result) {
      return res.status(404).json({
        message: "Preferencia no encontrada",
      });
    }

    res.status(200).json({
      message: "Preferencia actualizada exitosamente",
      data: result,
    });
  } catch (error) {
    console.error("Error al actualizar preferencia:", error.message || error);
    res.status(500).json({
      message: "Error interno del servidor",
    });
  }
};

module.exports = {
  getSettings,
  updateUserAjuste,
};