const config = require("../config");

function authMiddleware(req, res, next) {
  // Se nenhuma chave de API estiver configurada no servidor, ignora validacao
  if (!config.apiKey) {
    return next();
  }

  const tokenHeader = req.headers["x-api-key"];
  const authHeader = req.headers["authorization"];

  let token = tokenHeader;
  if (!token && authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  }

  if (token === config.apiKey) {
    return next();
  }

  return res.status(401).json({
    success: false,
    error: "Acesso nao autorizado. Header X-API-KEY ou Bearer token invalido."
  });
}

module.exports = authMiddleware;
