const {
  getMetasByUser,
  addMeta,
  updateMetaById,
  deleteMetaById,
} = require("../services/metas.service");

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

async function postMeta(req, res) {
  try {
    const {
      uuid_de_usuario,
      monto_meta,
      fecha_inicio,
      fecha_fin,
      plazo_dias,
      nombre_meta,
      nombreMeta,
    } = req.body;

    const nombreMetaValue = nombreMeta ?? nombre_meta;

    if (
      !uuid_de_usuario ||
      monto_meta == null ||
      !fecha_inicio ||
      !fecha_fin ||
      plazo_dias == null ||
      nombreMetaValue == null ||
      nombreMetaValue === ""
    ) {
      return res.status(400).json({
        message:
          "Faltan campos: uuid_de_usuario, nombreMeta, monto_meta, fecha_inicio, fecha_fin, plazo_dias",
      });
    }

    const nuevaMeta = await addMeta({
      uuidDeUsuario: uuid_de_usuario,
      nombreMeta: nombreMetaValue,
      montoMeta: monto_meta,
      fechaInicio: fecha_inicio,
      fechaFin: fecha_fin,
      plazoDias: plazo_dias,
    });

    return res.status(201).json(nuevaMeta);
  } catch (error) {
    console.error("POST /metas error:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

async function putMeta(req, res) {
  try {
    const idMeta = Number(req.params.id_meta);
    const {
      uuid_de_usuario,
      monto_meta,
      fecha_inicio,
      fecha_fin,
      plazo_dias,
      nombre_meta,
      nombreMeta,
    } = req.body;

    const nombreMetaValue = nombreMeta ?? nombre_meta;

    if (!Number.isInteger(idMeta) || idMeta <= 0) {
      return res.status(400).json({ message: "id_meta invalido" });
    }

    if (
      !uuid_de_usuario ||
      monto_meta == null ||
      !fecha_inicio ||
      !fecha_fin ||
      plazo_dias == null ||
      nombreMetaValue == null ||
      nombreMetaValue === ""
    ) {
      return res.status(400).json({
        message:
          "Faltan campos: uuid_de_usuario, nombreMeta, monto_meta, fecha_inicio, fecha_fin, plazo_dias",
      });
    }

    const metaActualizada = await updateMetaById({
      idMeta,
      uuidDeUsuario: uuid_de_usuario,
      nombreMeta: nombreMetaValue,
      montoMeta: monto_meta,
      fechaInicio: fecha_inicio,
      fechaFin: fecha_fin,
      plazoDias: plazo_dias,
    });

    if (!metaActualizada) {
      return res.status(404).json({ message: "Meta no encontrada" });
    }

    return res.status(200).json(metaActualizada);
  } catch (error) {
    console.error("PUT /metas/:id_meta error:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

async function deleteMeta(req, res) {
  try {
    const idMeta = Number(req.params.id_meta);
    const { uuid_de_usuario } = req.body;

    if (!Number.isInteger(idMeta) || idMeta <= 0) {
      return res.status(400).json({ message: "id_meta invalido" });
    }

    if (!uuid_de_usuario) {
      return res.status(400).json({ message: "uuid_de_usuario es requerido" });
    }

    const metaEliminada = await deleteMetaById({
      idMeta,
      uuidDeUsuario: uuid_de_usuario,
    });

    if (!metaEliminada) {
      return res.status(404).json({ message: "Meta no encontrada" });
    }

    return res.status(200).json({
      message: "Meta eliminada exitosamente",
      data: metaEliminada,
    });
  } catch (error) {
    console.error("DELETE /metas/:id_meta error:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

module.exports = {
  getMetas,
  postMeta,
  putMeta,
  deleteMeta,
};