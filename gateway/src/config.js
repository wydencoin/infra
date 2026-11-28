require("dotenv").config();

module.exports = {
  port: parseInt(process.env.PORT || "3000", 10),
  besuRpcUrl: process.env.BESU_RPC_URL || "http://127.0.0.1:8545",
  apiKey: process.env.API_KEY || "",
  adminPrivateKey: process.env.ADMIN_PRIVATE_KEY || "",
  wydenCoinAddress: process.env.WYDENCOIN_ADDRESS || "",
  redemptionManagerAddress: process.env.REDEMPTION_MANAGER_ADDRESS || "",
  auditLogDir: process.env.AUDIT_LOG_DIR || ""
};
