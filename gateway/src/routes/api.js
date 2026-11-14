const express = require("express");
const blockchain = require("../services/blockchain");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// Aplica autenticacao em todas as rotas sob /api/v1
router.use(authMiddleware);

// --- SALDO ---
router.get("/saldo/:aluno", async (req, res, next) => {
  try {
    const data = await blockchain.getBalance(req.params.aluno);
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
});

// --- RECOMPENSAS (MINT) ---
router.post("/recompensas/mint", async (req, res, next) => {
  try {
    const { aluno, valor, motivo } = req.body;
    const data = await blockchain.mintReward(aluno, valor, motivo);
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
});

router.post("/recompensas/mint-batch", async (req, res, next) => {
  try {
    const { itens } = req.body;
    const data = await blockchain.mintRewardBatch(itens);
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
});

// --- RESGATES ---
router.post("/resgates", async (req, res, next) => {
  try {
    const { alunoPrivateKey, beneficioId, valor, horasValidade } = req.body;
    const data = await blockchain.createRedemption(alunoPrivateKey, beneficioId, valor, horasValidade);
    return res.status(201).json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
});

router.get("/resgates/:id", async (req, res, next) => {
  try {
    const data = await blockchain.getRedemption(req.params.id);
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
});

router.post("/resgates/:id/confirmar", async (req, res, next) => {
  try {
    const data = await blockchain.confirmRedemption(req.params.id);
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
});

router.post("/resgates/:id/cancelar", async (req, res, next) => {
  try {
    const data = await blockchain.cancelRedemption(req.params.id);
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
});

router.post("/resgates/:id/expirar", async (req, res, next) => {
  try {
    const data = await blockchain.expireRedemption(req.params.id);
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
});

// --- PROXY RPC AUTENTICADO ---
router.post("/rpc", async (req, res, next) => {
  try {
    const { method, params } = req.body;
    if (!method) {
      return res.status(400).json({ success: false, error: "Metodo RPC nao informado" });
    }
    const result = await blockchain.forwardRpc(method, params);
    return res.status(200).json({ success: true, result });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
