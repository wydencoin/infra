const client = require("prom-client");

// Cria um registro dedicado para as métricas da Gateway API
const register = new client.Registry();

// Habilita a coleta de métricas padrão do Node.js (CPU, Memória Heap, Event Loop Lag, GC)
client.collectDefaultMetrics({
  register,
  prefix: "gateway_"
});

// Métrica: Contador de requisições HTTP por rota, método e status code
const httpRequestsTotal = new client.Counter({
  name: "gateway_http_requests_total",
  help: "Total de requisições HTTP processadas pelo Gateway",
  labelNames: ["method", "route", "status_code"],
  registers: [register]
});

// Métrica: Histograma de duração das requisições HTTP em segundos
const httpRequestDurationSeconds = new client.Histogram({
  name: "gateway_http_request_duration_seconds",
  help: "Duração das requisições HTTP no Gateway em segundos",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register]
});

// Middleware Express que intercepta cada requisição para alimentar as métricas
function metricsMiddleware(req, res, next) {
  // Ignora métricas da própria rota /metrics para não distorcer estatísticas
  if (req.path === "/metrics") {
    return next();
  }

  const start = process.hrtime();

  res.on("finish", () => {
    const diff = process.hrtime(start);
    const durationInSeconds = diff[0] + diff[1] / 1e9;
    
    // Normaliza rota para evitar explosão de cardinalidade (ex: /saldo/0x123 -> /saldo/:aluno)
    let route = req.route ? req.route.path : req.baseUrl + (req.path || "");
    if (!route || route === "") {
      route = req.path || "unknown";
    }

    const labels = {
      method: req.method,
      route,
      status_code: res.statusCode.toString()
    };

    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, durationInSeconds);
  });

  next();
}

module.exports = {
  register,
  metricsMiddleware,
  httpRequestsTotal,
  httpRequestDurationSeconds
};
