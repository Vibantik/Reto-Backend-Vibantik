const {
  getAllTransactions,
  getTransactionById,
} = require("../services/transactions.service");

const getTransactions = async (req, res) => {
  const result = await getAllTransactions(req.query);
  res.status(200).json(result);
};

const getTransaction = (req, res) => {
  const transaction = getTransactionById(req.params.id);

  if (!transaction) {
    return res.status(404).json({
      message: "Transacción no encontrada",
    });
  }

  res.status(200).json(transaction);
};

module.exports = {
  getTransactions,
  getTransaction,
};