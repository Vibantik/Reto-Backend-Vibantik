const {
  getAllCategorias,
  getCategoriaById,
  createCategoria: createCategoriaService,
  updateCategoria: updateCategoriaService,
  deleteCategoria: deleteCategoriaService,
} = require("../services/categorias.service");

const getCategorias = async (req, res) => {
  try {
    const result = await getAllCategorias();
    res.status(200).json(result);
  } catch (error) {
    console.error("Error al obtener categorías:", error.message || error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

const getCategoria = async (req, res) => {
  try {
    const categoria = await getCategoriaById(req.params.id);
    if (!categoria) {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }
    res.status(200).json(categoria);
  } catch (error) {
    console.error("Error al obtener categoría:", error.message || error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

const createCategoria = async (req, res) => {
  try {
    const { nombre_categ, icon, color } = req.body;
    if (!nombre_categ || !nombre_categ.trim()) {
      return res.status(400).json({ message: "nombre_categ es requerido" });
    }
    const nueva = await createCategoriaService({ nombre_categ: nombre_categ.trim(), icon, color });
    res.status(201).json(nueva);
  } catch (error) {
    console.error("Error al crear categoría:", error.message || error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

const updateCategoria = async (req, res) => {
  try {
    const updated = await updateCategoriaService(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }
    res.status(200).json(updated);
  } catch (error) {
    console.error("Error al actualizar categoría:", error.message || error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

const deleteCategoria = async (req, res) => {
  try {
    const deleted = await deleteCategoriaService(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }
    res.status(200).json({ message: "Categoría eliminada" });
  } catch (error) {
    console.error("Error al eliminar categoría:", error.message || error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

module.exports = {
  getCategorias,
  getCategoria,
  createCategoria,
  updateCategoria,
  deleteCategoria,
};
