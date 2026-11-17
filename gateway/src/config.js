require("dotenv").config();

module.exports = {
  port: parseInt(process.env.PORT || "3000", 10),
  besuRpcUrl: process.env.BESU_RPC_URL || "http://127.0.0.1:8545",
  apiKey: process.env.API_KEY || "",
  adminPrivateKey: process.env.ADMIN_PRIVATE_KEY || "0x8f2a55949038a9610f50fb23b5883af3b4ecb3c3bb792cbcefbd1542c692be63",
  wydenCoinAddress: process.env.WYDENCOIN_ADDRESS || "0xa50a51c09a5c451C52BB714527E1974b686D8e77",
  redemptionManagerAddress: process.env.REDEMPTION_MANAGER_ADDRESS || "0x9a3DBCa554e9f6b9257aAa24010DA8377C57c17e"
};
