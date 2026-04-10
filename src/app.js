const express = require("express");
const cors = require("cors");
const transactionsRoutes = require("./routes/transactions.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "API de Vibantik funcionando",
  });
});

app.use("/api/transactions", transactionsRoutes);

module.exports = app;