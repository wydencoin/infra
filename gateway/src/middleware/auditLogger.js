const fs = require("node:fs");
const path = require("node:path");
const config = require("../config");

let logFilePath = null;

function initAuditLogFile() {
  if (!config.auditLogDir) {
    return null;
  }
  try {
    fs.mkdirSync(config.auditLogDir, { recursive: true });
    return path.join(config.auditLogDir, "access.log");
  } catch (err) {
    console.error(`[AUDIT] Falha ao criar diretorio de logs (${config.auditLogDir}): ${err.message}`);
    return null;
  }
}

logFilePath = initAuditLogFile();

function extractClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function auditLogger(req, res, next) {
  const startNs = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startNs) / 1e6;
    const entry = {
      timestamp: new Date().toISOString(),
      ip: extractClientIp(req),
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      userAgent: req.headers["user-agent"] || ""
    };

    const line = JSON.stringify(entry);
    console.log(`[AUDIT] ${line}`);

    if (!logFilePath) {
      return;
    }

    fs.appendFile(logFilePath, `${line}\n`, (err) => {
      if (err) {
        console.error(`[AUDIT] Erro ao gravar log em arquivo: ${err.message}`);
      }
    });
  });

  next();
}

module.exports = auditLogger;
