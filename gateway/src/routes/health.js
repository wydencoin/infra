const express = require("express");
const blockchain = require("../services/blockchain");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const health = await blockchain.getHealth();
    return res.status(200).json(health);
  } catch (error) {
    return res.status(503).json({
      status: "DOWN",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
