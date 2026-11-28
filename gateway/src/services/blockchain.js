const { ethers } = require("ethers");
const config = require("../config");

const WYDENCOIN_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function mintReward(address aluno, uint256 valor, bytes32 motivo) external",
  "function mintRewardBatch(address[] calldata alunos, uint256[] calldata valores, bytes32[] calldata motivos) external",
  "function approve(address spender, uint256 value) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function periodoExpiracao() view returns (uint64)",
  "function setPeriodoExpiracao(uint64 novoPeriodo) external",
  "function saldoExpiravel(address conta) view returns (uint256)",
  "function lotesAtivos(address conta) view returns (tuple(uint128 valor, uint64 recebidoEm, uint64 expiraEm)[])",
  "function expirarSaldo(address conta) external returns (uint256)",
  "function expirarSaldoBatch(address[] calldata contas) external returns (uint256)",
  "event TokensExpirados(address indexed aluno, uint256 valorQueimado)",
  "event PeriodoExpiracaoAtualizado(uint64 periodoAnterior, uint64 novoPeriodo, address indexed atualizadoPor)"
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
const BATCH_GAS_LIMIT = 10000000n;
const SEGUNDOS_POR_DIA = 86400;

class BlockchainService {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.besuRpcUrl);

    if (config.adminPrivateKey) {
      this.adminWallet = new ethers.Wallet(config.adminPrivateKey, this.provider);
      this.wc = new ethers.Contract(config.wydenCoinAddress, WYDENCOIN_ABI, this.adminWallet);
      this.rm = new ethers.Contract(config.redemptionManagerAddress, REDEMPTION_MANAGER_ABI, this.adminWallet);
    } else {
      this.adminWallet = null;
      this.wc = new ethers.Contract(config.wydenCoinAddress, WYDENCOIN_ABI, this.provider);
      this.rm = new ethers.Contract(config.redemptionManagerAddress, REDEMPTION_MANAGER_ABI, this.provider);
    }
  }

  _checkAdminWallet() {
    if (!this.adminWallet) {
      throw new Error("ADMIN_PRIVATE_KEY nao configurada no servidor para assinar transacoes.");
    }
  }

  _createBadRequestError(message) {
    const err = new Error(message);
    err.status = 400;
    return err;
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
        blockNumber: Number(blockNumber),
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
      throw this._createBadRequestError(`Endereco invalido: ${alunoAddress}`);
    }
    const balance = await this.wc.balanceOf(alunoAddress);
    return {
      aluno: alunoAddress,
      saldo: Number(balance),
      unidade: "WC"
    };
  }

  async getStudentLots(alunoAddress) {
    if (!ethers.isAddress(alunoAddress)) {
      throw this._createBadRequestError(`Endereco invalido: ${alunoAddress}`);
    }

    const [saldoValido, saldoExpiravel, lotes, periodoExpiracao] = await Promise.all([
      this.wc.balanceOf(alunoAddress),
      this.wc.saldoExpiravel(alunoAddress),
      this.wc.lotesAtivos(alunoAddress),
      this.wc.periodoExpiracao()
    ]);

    return {
      aluno: alunoAddress,
      saldoValido: Number(saldoValido),
      saldoExpiravel: Number(saldoExpiravel),
      unidade: "WC",
      periodoExpiracaoSegundos: Number(periodoExpiracao),
      lotes: lotes.map((l) => {
        const expiraEm = Number(l.expiraEm);
        return {
          valor: Number(l.valor),
          recebidoEm: Number(l.recebidoEm),
          recebidoEmIso: new Date(Number(l.recebidoEm) * 1000).toISOString(),
          expiraEm,
          expiraEmIso: expiraEm > 0 ? new Date(expiraEm * 1000).toISOString() : null
        };
      })
    };
  }

  async getExpirationPolicy() {
    const periodo = Number(await this.wc.periodoExpiracao());
    return {
      periodoSegundos: periodo,
      periodoDias: Math.floor(periodo / SEGUNDOS_POR_DIA),
      ativo: periodo > 0
    };
  }

  async setExpirationPolicy({ dias, segundos, directorPrivateKey } = {}) {
    let novoPeriodoSegundos;

    if (segundos !== undefined && segundos !== null) {
      novoPeriodoSegundos = Number(segundos);
    } else if (dias !== undefined && dias !== null) {
      novoPeriodoSegundos = Number(dias) * SEGUNDOS_POR_DIA;
    } else {
      throw this._createBadRequestError("Informe 'dias' ou 'segundos' (inteiro >= 0; 0 desativa expiracao).");
    }

    if (!Number.isInteger(novoPeriodoSegundos) || novoPeriodoSegundos < 0) {
      throw this._createBadRequestError("O periodo de expiracao deve ser um numero inteiro >= 0.");
    }

    let wcSigner = this.wc;
    if (directorPrivateKey) {
      const directorWallet = new ethers.Wallet(directorPrivateKey, this.provider);
      wcSigner = new ethers.Contract(config.wydenCoinAddress, WYDENCOIN_ABI, directorWallet);
    } else {
      this._checkAdminWallet();
    }

    const tx = await wcSigner.setPeriodoExpiracao(BigInt(novoPeriodoSegundos), { gasLimit: TX_GAS_LIMIT });
    const receipt = await tx.wait();

    return {
      periodoSegundos: novoPeriodoSegundos,
      periodoDias: Math.floor(novoPeriodoSegundos / SEGUNDOS_POR_DIA),
      ativo: novoPeriodoSegundos > 0,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber
    };
  }

  async executeExpiration(contas) {
    this._checkAdminWallet();
    if (!Array.isArray(contas) || contas.length === 0) {
      throw this._createBadRequestError("Informe ao menos um endereco de aluno em 'aluno' ou 'alunos'.");
    }

    for (const addr of contas) {
      if (!ethers.isAddress(addr)) {
        throw this._createBadRequestError(`Endereco de aluno invalido: ${addr}`);
      }
    }

    const tx = contas.length === 1
      ? await this.wc.expirarSaldo(contas[0], { gasLimit: TX_GAS_LIMIT })
      : await this.wc.expirarSaldoBatch(contas, { gasLimit: BATCH_GAS_LIMIT });
    const receipt = await tx.wait();

    const detalhes = [];
    let totalQueimado = 0;

    for (const log of receipt.logs) {
      try {
        const parsed = this.wc.interface.parseLog(log);
        if (parsed && parsed.name === "TokensExpirados") {
          const valorQueimado = Number(parsed.args[1]);
          totalQueimado += valorQueimado;
          detalhes.push({ aluno: parsed.args[0], valorQueimado });
        }
      } catch (_) {}
    }

    return {
      totalContasVerificadas: contas.length,
      totalQueimado,
      detalhes,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber
    };
  }

  async mintReward(alunoAddress, valor, motivo) {
    this._checkAdminWallet();
    if (!ethers.isAddress(alunoAddress)) {
      throw this._createBadRequestError(`Endereco de aluno invalido: ${alunoAddress}`);
    }
    if (!valor || valor <= 0) {
      throw this._createBadRequestError("O valor da recompensa deve ser maior que zero");
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
    this._checkAdminWallet();
    if (!Array.isArray(itens) || itens.length === 0) {
      throw this._createBadRequestError("A lista de itens para emissao em lote nao pode ser vazia");
    }

    const alunos = [];
    const valores = [];
    const motivos = [];

    for (const item of itens) {
      if (!ethers.isAddress(item.aluno)) {
        throw this._createBadRequestError(`Endereco invalido no lote: ${item.aluno}`);
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
      throw this._createBadRequestError("Chave privada do aluno e necessaria para assinar o resgate");
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
    this._checkAdminWallet();
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
    this._checkAdminWallet();
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
    this._checkAdminWallet();
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
