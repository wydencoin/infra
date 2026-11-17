const { ethers } = require("ethers");
const config = require("../config");

const WYDENCOIN_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function mintReward(address aluno, uint256 valor, bytes32 motivo) external",
  "function mintRewardBatch(address[] calldata alunos, uint256[] calldata valores, bytes32[] calldata motivos) external",
  "function approve(address spender, uint256 value) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

const REDEMPTION_MANAGER_ABI = [
  "function resgatar(uint256 beneficioId, uint256 valor, uint64 expiraEm) external returns (uint256 id)",
  "function confirmarUso(uint256 id) external",
  "function cancelar(uint256 id) external",
  "function expirar(uint256 id) external",
  "function resgates(uint256 id) view returns (address aluno, uint256 beneficioId, uint256 valor, uint64 expiraEm, uint8 status)",
  "event ResgateCriado(uint256 indexed id, address indexed aluno, uint256 beneficioId, uint256 valor, uint64 expiraEm)"
];

const STATUS_LABELS = ["Resgatado", "Utilizado", "Cancelado", "Expirado"];
const TX_GAS_LIMIT = 500000n;
const BATCH_GAS_LIMIT = 3000000n;

class BlockchainService {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.besuRpcUrl);
    this.adminWallet = new ethers.Wallet(config.adminPrivateKey, this.provider);
    
    this.wc = new ethers.Contract(config.wydenCoinAddress, WYDENCOIN_ABI, this.adminWallet);
    this.rm = new ethers.Contract(config.redemptionManagerAddress, REDEMPTION_MANAGER_ABI, this.adminWallet);
  }

  async getHealth() {
    const [network, blockNumber, peerCountHex, syncing] = await Promise.all([
      this.provider.getNetwork(),
      this.provider.getBlockNumber(),
      this.provider.send("net_peerCount", []),
      this.provider.send("eth_syncing", [])
    ]);

    return {
      status: "UP",
      network: {
        chainId: Number(network.chainId),
        blockNumber,
        peers: parseInt(peerCountHex, 16),
        syncing: Boolean(syncing)
      },
      contracts: {
        wydenCoin: config.wydenCoinAddress,
        redemptionManager: config.redemptionManagerAddress
      },
      timestamp: new Date().toISOString()
    };
  }

  async getBalance(alunoAddress) {
    if (!ethers.isAddress(alunoAddress)) {
      throw new Error(`Endereco invalido: ${alunoAddress}`);
    }
    const balance = await this.wc.balanceOf(alunoAddress);
    return {
      aluno: alunoAddress,
      saldo: Number(balance),
      unidade: "WC"
    };
  }

  async mintReward(alunoAddress, valor, motivo) {
    if (!ethers.isAddress(alunoAddress)) {
      throw new Error(`Endereco de aluno invalido: ${alunoAddress}`);
    }
    if (!valor || valor <= 0) {
      throw new Error("O valor da recompensa deve ser maior que zero");
    }

    const motivoBytes = ethers.encodeBytes32String(motivo || "RECOMPENSA");
    const tx = await this.wc.mintReward(alunoAddress, BigInt(valor), motivoBytes, {
      gasLimit: TX_GAS_LIMIT
    });
    const receipt = await tx.wait();

    return {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      aluno: alunoAddress,
      valor: Number(valor),
      motivo
    };
  }

  async mintRewardBatch(itens) {
    if (!Array.isArray(itens) || itens.length === 0) {
      throw new Error("A lista de itens para emissao em lote nao pode ser vazia");
    }

    const alunos = [];
    const valores = [];
    const motivos = [];

    for (const item of itens) {
      if (!ethers.isAddress(item.aluno)) {
        throw new Error(`Endereco invalido no lote: ${item.aluno}`);
      }
      alunos.push(item.aluno);
      valores.push(BigInt(item.valor));
      motivos.push(ethers.encodeBytes32String(item.motivo || "RECOMPENSA"));
    }

    const tx = await this.wc.mintRewardBatch(alunos, valores, motivos, {
      gasLimit: BATCH_GAS_LIMIT
    });
    const receipt = await tx.wait();

    return {
      totalItens: itens.length,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber
    };
  }

  async createRedemption(alunoPrivateKey, beneficioId, valor, horasValidade = 24) {
    if (!alunoPrivateKey) {
      throw new Error("Chave privada do aluno e necessaria para assinar o resgate");
    }

    const alunoWallet = new ethers.Wallet(alunoPrivateKey, this.provider);
    const rmAluno = new ethers.Contract(config.redemptionManagerAddress, REDEMPTION_MANAGER_ABI, alunoWallet);

    const expiraEm = Math.floor(Date.now() / 1000) + (horasValidade * 3600);
    const tx = await rmAluno.resgatar(BigInt(beneficioId), BigInt(valor), BigInt(expiraEm), {
      gasLimit: TX_GAS_LIMIT
    });
    const receipt = await tx.wait();

    let idResgate = null;
    for (const log of receipt.logs) {
      try {
        const parsed = rmAluno.interface.parseLog(log);
        if (parsed.name === "ResgateCriado") {
          idResgate = Number(parsed.args[0]);
          break;
        }
      } catch (_) {}
    }

    return {
      idResgate,
      beneficioId: Number(beneficioId),
      valor: Number(valor),
      expiraEm,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber
    };
  }

  async getRedemption(id) {
    const r = await this.rm.resgates(BigInt(id));
    const statusCode = Number(r[4]);

    return {
      id: Number(id),
      aluno: r[0],
      beneficioId: Number(r[1]),
      valor: Number(r[2]),
      expiraEm: Number(r[3]),
      status: STATUS_LABELS[statusCode] || "Desconhecido",
      statusCode
    };
  }

  async confirmRedemption(id) {
    const tx = await this.rm.confirmarUso(BigInt(id), { gasLimit: TX_GAS_LIMIT });
    const receipt = await tx.wait();
    return {
      id: Number(id),
      status: "Utilizado",
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber
    };
  }

  async cancelRedemption(id) {
    const tx = await this.rm.cancelar(BigInt(id), { gasLimit: TX_GAS_LIMIT });
    const receipt = await tx.wait();
    return {
      id: Number(id),
      status: "Cancelado",
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber
    };
  }

  async expireRedemption(id) {
    const tx = await this.rm.expirar(BigInt(id), { gasLimit: TX_GAS_LIMIT });
    const receipt = await tx.wait();
    return {
      id: Number(id),
      status: "Expirado",
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber
    };
  }

  async forwardRpc(method, params = []) {
    return this.provider.send(method, params);
  }
}

module.exports = new BlockchainService();
