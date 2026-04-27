const {
  getAllPresupuestos,
  getPresupuestoById,
  createPresupuesto: createPresupuestoService,
  updatePresupuesto: updatePresupuestoService,
  deletePresupuesto: deletePresupuestoService,
  vincularTransaccion: vincularTransaccionService,
} = require("../services/presupuestos.service");

const getPresupuestos = async (req, res) => {
  try {
    const uuid = req.query.uuid;
    if (!uuid) {
      return res.status(400).json({ message: "uuid es requerido" });
    }
    const soloActivos = req.query.activos === "true";
    const result = await getAllPresupuestos(uuid, { soloActivos });
    res.status(200).json(result);
  } catch (error) {
    console.error("Error al obtener presupuestos:", error.message || error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

const getPresupuesto = async (req, res) => {
  try {
    const presupuesto = await getPresupuestoById(req.params.id);
    if (!presupuesto) {
      return res.status(404).json({ message: "Presupuesto no encontrado" });
    }
    res.status(200).json(presupuesto);
  } catch (error) {
    console.error("Error al obtener presupuesto:", error.message || error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

const createPresupuesto = async (req, res) => {
  try {
    const uuid = req.body.uuid_de_usuario;
    if (!uuid) {
      return res.status(400).json({ message: "uuid_de_usuario es requerido" });
    }
    const { nombre, monto_limite } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ message: "nombre es requerido" });
    }
    if (monto_limite === undefined || monto_limite <= 0) {
      return res.status(400).json({ message: "monto_limite debe ser mayor a 0" });
    }
    const result = await createPresupuestoService(uuid, req.body);
    res.status(201).json(result);
  } catch (error) {
    console.error("Error al crear presupuesto:", error.message || error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

const updatePresupuesto = async (req, res) => {
  try {
    const result = await updatePresupuestoService(req.params.id, req.body);
    if (!result) {
      return res.status(404).json({ message: "Presupuesto no encontrado" });
    }
    res.status(200).json(result);
  } catch (error) {
    console.error("Error al actualizar presupuesto:", error.message || error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

const deletePresupuesto = async (req, res) => {
  try {
    const deleted = await deletePresupuestoService(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Presupuesto no encontrado" });
    }
    res.status(200).json({ message: "Presupuesto eliminado" });
  } catch (error) {
    console.error("Error al eliminar presupuesto:", error.message || error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

const vincularTransaccion = async (req, res) => {
  try {
    const { id_transaccion } = req.body;
    if (!id_transaccion) {
      return res.status(400).json({ message: "id_transaccion es requerido" });
    }
    const result = await vincularTransaccionService(req.params.id, id_transaccion);
    if (!result) {
      return res.status(409).json({ message: "La transacción ya está vinculada" });
    }
    res.status(201).json(result);
  } catch (error) {
    console.error("Error al vincular transacción:", error.message || error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

module.exports = {
  getPresupuestos,
  getPresupuesto,
  createPresupuesto,
  updatePresupuesto,
  deletePresupuesto,
  vincularTransaccion,
};
