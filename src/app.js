const express = require("express");
const cors = require("cors");
const transactionsRoutes = require("./routes/transactions.routes");
const chatRoutes = require("./routes/chat.routes");
const chatIA = require("./routes/IA.routes");
const settingsRoutes = require("./routes/ajustes.routes");
const inversionesRoutes = require("./routes/inversiones.routes");
const categoriasRoutes = require("./routes/categorias.routes");
const presupuestosRoutes = require("./routes/presupuestos.routes");
const metasRoutes = require("./routes/metas.routes");
const webhookRoutes = require("./routes/webhook.routes");
const reportesRoutes = require("./routes/reportes.routes");


const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "API de Vibantik funcionando",
  });
});

app.get("/api/ping", (req, res) => { res.send("Pong!") });

app.use("/api/transactions", transactionsRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/ia", chatIA)
app.use("/api/settings", settingsRoutes);
app.use("/api/inversiones", inversionesRoutes);
app.use("/api/categorias", categoriasRoutes);
app.use("/api/presupuestos", presupuestosRoutes);
app.use("/api", metasRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/reportes", reportesRoutes);


module.exports = app;