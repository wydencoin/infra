const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");

const MOCK_RPC_PORT = 18545;
const TEST_GATEWAY_PORT = 3099;
const TEST_WALLET = "0x0000000000000000000000000000000000000001";
const TEST_WC_CONTRACT = "0x0000000000000000000000000000000000000010";
const TEST_RM_CONTRACT = "0x0000000000000000000000000000000000000020";
const TEMP_LOG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "wydencoin-gw-audit-"));

// Configura variaveis de teste isoladas (sem dependencia de IPs/dominios reais)
process.env.BESU_RPC_URL = `http://127.0.0.1:${MOCK_RPC_PORT}`;
process.env.API_KEY = "test-token-123";
process.env.PORT = String(TEST_GATEWAY_PORT);
process.env.WYDENCOIN_ADDRESS = TEST_WC_CONTRACT;
process.env.REDEMPTION_MANAGER_ADDRESS = TEST_RM_CONTRACT;
process.env.AUDIT_LOG_DIR = TEMP_LOG_DIR;

const app = require("../src/server");

let server;
let mockRpcServer;
const BASE_URL = `http://127.0.0.1:${TEST_GATEWAY_PORT}`;

function encodeUint256(value) {
  return "0x" + BigInt(value).toString(16).padStart(64, "0");
}

function handleMockRpcCall(payload) {
  const { id, method, params } = payload;

  if (method === "eth_chainId") {
    return { jsonrpc: "2.0", id, result: "0x16bfab61" };
  }
  if (method === "eth_blockNumber") {
    return { jsonrpc: "2.0", id, result: "0x186a0" }; // 100000
  }
  if (method === "net_peerCount") {
    return { jsonrpc: "2.0", id, result: "0x2" };
  }
  if (method === "eth_syncing") {
    return { jsonrpc: "2.0", id, result: false };
  }
  if (method === "eth_call") {
    const data = params?.[0]?.data || "";
    // balanceOf(address) -> selector 0x70a08231
    if (data.startsWith("0x70a08231")) {
      return { jsonrpc: "2.0", id, result: encodeUint256(440) };
    }
    // paused() -> selector 0x5c975abb
    if (data.startsWith("0x5c975abb")) {
      return { jsonrpc: "2.0", id, result: encodeUint256(0) };
    }
    // periodoExpiracao() -> selector 0x... (fallback 365 dias)
    return { jsonrpc: "2.0", id, result: encodeUint256(31536000) };
  }

  return { jsonrpc: "2.0", id, result: "0x0" };
}

function startMockRpcServer() {
  return new Promise((resolve) => {
    mockRpcServer = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        const parsed = JSON.parse(body);
        const response = Array.isArray(parsed)
          ? parsed.map(handleMockRpcCall)
          : handleMockRpcCall(parsed);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(response));
      });
    });
    mockRpcServer.listen(MOCK_RPC_PORT, "127.0.0.1", resolve);
  });
}

function request(routePath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(routePath, BASE_URL);
    const reqOptions = {
      method: options.method || "GET",
      headers: options.headers || {}
    };

    const req = http.request(url, reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        let body = null;
        try {
          body = JSON.parse(data);
        } catch (_) {
          body = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body });
      });
    });

    req.on("error", reject);
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

describe("Wydencoin RPC Gateway Test Suite", () => {
  before(async () => {
    await startMockRpcServer();
    await new Promise((resolve) => {
      server = app.listen(TEST_GATEWAY_PORT, "127.0.0.1", resolve);
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => mockRpcServer.close(resolve));
    fs.rmSync(TEMP_LOG_DIR, { recursive: true, force: true });
  });

  test("GET /health deve responder 200 OK sem necessidade de autenticacao", async () => {
    const res = await request("/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "UP");
    assert.equal(res.body.network.chainId, 381660001);
    assert.equal(res.body.network.blockNumber, 100000);
    assert.equal(res.body.network.peers, 2);
  });

  test("GET /metrics deve expor metricas Prometheus em formato texto", async () => {
    const res = await request("/metrics");
    assert.equal(res.status, 200);
    assert.match(res.body, /gateway_http_requests_total/);
    assert.match(res.body, /gateway_process_cpu_user_seconds_total/);
  });

  test("GET /api/v1/saldo/:aluno deve retornar 401 Unauthorized se token nao for enviado", async () => {
    const res = await request(`/api/v1/saldo/${TEST_WALLET}`);
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  test("GET /api/v1/saldo/:aluno deve retornar 401 se token for incorreto", async () => {
    const res = await request(`/api/v1/saldo/${TEST_WALLET}`, {
      headers: { "X-API-KEY": "token-invalido" }
    });
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  test("GET /api/v1/saldo/:aluno deve retornar 200 e saldo correto com X-API-KEY valido", async () => {
    const res = await request(`/api/v1/saldo/${TEST_WALLET}`, {
      headers: { "X-API-KEY": "test-token-123" }
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.aluno, TEST_WALLET);
    assert.equal(res.body.saldo, 440);
    assert.equal(res.body.unidade, "WC");
  });

  test("POST /api/v1/rpc deve encaminhar chamada autenticada e responder com o resultado", async () => {
    const res = await request("/api/v1/rpc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer test-token-123"
      },
      body: { method: "eth_blockNumber", params: [] }
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.result, "0x186a0");
  });

  test("GET /api/v1/saldo/:aluno/lotes deve retornar 400 para endereco invalido", async () => {
    const res = await request("/api/v1/saldo/endereco-invalido/lotes", {
      headers: { "X-API-KEY": "test-token-123" }
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  test("PUT /api/v1/config/expiracao deve retornar 400 quando dias/segundos nao forem informados ou negativos", async () => {
    const resVazio = await request("/api/v1/config/expiracao", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": "test-token-123"
      },
      body: {}
    });
    assert.equal(resVazio.status, 400);
    assert.equal(resVazio.body.success, false);

    const resNegativo = await request("/api/v1/config/expiracao", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": "test-token-123"
      },
      body: { dias: -10 }
    });
    assert.equal(resNegativo.status, 400);
    assert.equal(resNegativo.body.success, false);
  });

  test("POST /api/v1/expiracao/executar deve exigir autenticacao e validar lista de alunos", async () => {
    const resSemAuth = await request("/api/v1/expiracao/executar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: { alunos: [TEST_WALLET] }
    });
    assert.equal(resSemAuth.status, 401);

    const resSemAdmin = await request("/api/v1/expiracao/executar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": "test-token-123"
      },
      body: { alunos: [] }
    });
    assert.equal(resSemAdmin.body.success, false);
  });

  test("GET /api/v1/emergencia/status deve retornar estado de pausa do contrato", async () => {
    const res = await request("/api/v1/emergencia/status", {
      headers: { "X-API-KEY": "test-token-123" }
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.pausado, false);
  });

  test("auditLogger deve persistir registros JSON Lines no diretorio AUDIT_LOG_DIR", async () => {
    await request("/health");
    await new Promise((r) => setTimeout(r, 50));
    const logPath = path.join(TEMP_LOG_DIR, "access.log");
    assert.ok(fs.existsSync(logPath), "Arquivo access.log nao foi criado");
    const lines = fs.readFileSync(logPath, "utf-8").trim().split("\n");
    assert.ok(lines.length > 0);
    const lastEntry = JSON.parse(lines[lines.length - 1]);
    assert.equal(lastEntry.method, "GET");
    assert.equal(lastEntry.path, "/health");
    assert.equal(lastEntry.status, 200);
    assert.ok(typeof lastEntry.ip === "string");
  });
});
