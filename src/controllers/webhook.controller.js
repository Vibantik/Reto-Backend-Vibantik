const { getTransactionById } = require("../services/transactions.service");
const sseEmitter = require("../services/sse.service");

const handleNewTransaction = async (req, res) => {
  try {
    const { transaction_id } = req.body;

    if (!transaction_id) {
      return res.status(400).json({
        message: "Falta el campo transaction_id en el cuerpo de la solicitud",
      });
    }

    const transaction = await getTransactionById(transaction_id);

    if (!transaction) {
      return res.status(404).json({
        message: "Transacción no encontrada",
      });
    }

    sseEmitter.emit("new-transaction", transaction);

    res.status(200).json({
      message: "Webhook recibido correctamente",
      transaction,
    });
  } catch (error) {
    console.error("Error en webhook de transacciones:", error.message || error);
    res.status(500).json({
      message: "Error interno del servidor",
    });
  }
};

module.exports = {
  handleNewTransaction,
};
