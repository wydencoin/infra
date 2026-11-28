require("dotenv").config();

module.exports = {
  port: parseInt(process.env.PORT || "3000", 10),
  besuRpcUrl: process.env.BESU_RPC_URL || "http://127.0.0.1:8545",
  apiKey: process.env.API_KEY || "",
  adminPrivateKey: process.env.ADMIN_PRIVATE_KEY || "",
  wydenCoinAddress: process.env.WYDENCOIN_ADDRESS || "0xdB6371a89E3C840a14DE470Dd0247cC7459Fa2A2",
  redemptionManagerAddress: process.env.REDEMPTION_MANAGER_ADDRESS || "0x6023FF0A8203ea32E737819B301D1672Dd2ECBE0"
};
