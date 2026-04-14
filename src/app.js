const express = require("express");
const cors = require("cors");
const transactionsRoutes = require("./routes/transactions.routes");
const chatRoutes = require("./routes/chat.routes");
const chatIA = require("./routes/IA.routes");
const settingsRoutes = require("./routes/ajustes.routes");

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
app.use("/api/chat", chatRoutes);
app.use("/api/ia", chatIA)
app.use("/api/settings", settingsRoutes);

module.exports = app;