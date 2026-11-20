const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const config = require("./config");
const { metricsMiddleware } = require("./middleware/metrics");
const healthRouter = require("./routes/health");
const metricsRouter = require("./routes/metrics");
const apiRouter = require("./routes/api");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(metricsMiddleware);

// Rotas
app.use("/health", healthRouter);
app.use("/metrics", metricsRouter);
app.use("/api/v1", apiRouter);

// Tratamento de rotas nao encontradas
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Rota nao encontrada: ${req.method} ${req.originalUrl}`
  });
});

// Middleware Global de Tratamento de Erros
app.use((err, req, res, next) => {
  console.error(`[ERRO] ${req.method} ${req.originalUrl}:`, err.message);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message || "Erro interno do servidor Gateway"
  });
});

if (require.main === module) {
  const server = app.listen(config.port, "0.0.0.0", () => {
    console.log(`[+] Wydencoin RPC Gateway ativo na porta ${config.port}`);
    console.log(`[+] Besu RPC Target: ${config.besuRpcUrl}`);
    console.log(`[+] Autenticacao por API_KEY: ${config.apiKey ? "HABILITADA" : "DESABILITADA"}`);
  });

  const shutdown = () => {
    console.log("\n[!] Encerrando Gateway com seguranca...");
    server.close(() => {
      console.log("[OK] Servidor finalizado.");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

module.exports = app;
