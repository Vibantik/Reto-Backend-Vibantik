const {
  getAllTransactions,
  getTransactionById,
} = require("../services/transactions.service");

const getTransactions = async (req, res) => {
  try {
    const result = await getAllTransactions(req.query);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error al obtener transacciones:", error.message || error);
    res.status(500).json({
      message: "Error interno del servidor",
    });
  }
};

const getTransaction = async (req, res) => {
  try {
    const transaction = await getTransactionById(req.params.id);

    if (!transaction) {
      return res.status(404).json({
        message: "Transacción no encontrada",
      });
    }

    res.status(200).json(transaction);
  } catch (error) {
    console.error("Error al obtener transacción:", error.message || error);
    res.status(500).json({
      message: "Error interno del servidor",
    });
  }
};

module.exports = {
  getTransactions,
  getTransaction,
};