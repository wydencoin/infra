const express = require("express");
const { register } = require("../middleware/metrics");

const router = express.Router();

/**
 * GET /metrics
 * Endpoint padrão para consumo de métricas pelo Prometheus.
 * Retorna telemetria em formato texto padrão OpenMetrics.
 */
router.get("/", async (req, res, next) => {
  try {
    res.setHeader("Content-Type", register.contentType);
    const metrics = await register.metrics();
    return res.status(200).send(metrics);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
