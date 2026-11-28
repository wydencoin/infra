const rateLimit = require("express-rate-limit");
const config = require("../config");

function buildRateLimitHandler(message) {
  return (req, res) => {
    res.status(429).json({
      success: false,
      error: message
    });
  };
}

// Limite geral para todas as rotas sob /api/v1 (por IP e janela de tempo)
const apiRateLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: buildRateLimitHandler("Limite de requisicoes excedido. Tente novamente em instantes.")
});

// Limite mais restritivo para operacoes de escrita on-chain (POST/PUT)
const writeRateLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitWriteMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS",
  handler: buildRateLimitHandler("Limite de requisicoes de escrita excedido. Aguarde antes de enviar novas transacoes.")
});

module.exports = {
  apiRateLimiter,
  writeRateLimiter
};
