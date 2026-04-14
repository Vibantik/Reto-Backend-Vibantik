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

// TODO: Return latency in JSON
app.get("/api/ping", (req, res) => { res.send("Pong!") });

app.use("/api/transactions", transactionsRoutes);

module.exports = app;