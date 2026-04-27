const { getMetasByUser } = require("../services/metas.service");

async function getMetas(req, res) {
  try {
    const { uuid_de_usuario } = req.query;

    if (!uuid_de_usuario) {
      return res.status(400).json({ message: "uuid_de_usuario es requerido" });
    }

    const metas = await getMetasByUser(uuid_de_usuario);
    return res.status(200).json(metas);
  } catch (error) {
    console.error("Error en getMetas:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

module.exports = {
  getMetas,
};