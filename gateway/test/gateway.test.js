const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

// Configura variaveis de teste apontando para o no Besu remoto
process.env.BESU_RPC_URL = "http://wydencoin-rpc.duckdns.org:8545";
process.env.API_KEY = "test-token-123";
process.env.PORT = "3099";

const app = require("../src/server");

let server;
const BASE_URL = "http://127.0.0.1:3099";

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
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
    await new Promise((resolve) => {
      server = app.listen(3099, "127.0.0.1", resolve);
    });
  });

  after(async () => {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  });

  test("GET /health deve responder 200 OK sem necessidade de autenticacao", async () => {
    const res = await request("/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "UP");
    assert.equal(res.body.network.chainId, 381660001);
    assert.ok(res.body.network.blockNumber > 40000);
    assert.ok(res.body.network.peers >= 1);
  });

  test("GET /metrics deve expor metricas Prometheus em formato texto", async () => {
    const res = await request("/metrics");
    assert.equal(res.status, 200);
    assert.match(res.body, /gateway_http_requests_total/);
    assert.match(res.body, /gateway_process_cpu_user_seconds_total/);
  });

  test("GET /api/v1/saldo/:aluno deve retornar 401 Unauthorized se token nao for enviado", async () => {
    const res = await request("/api/v1/saldo/0xfe3b557e8fb62b89f4916b721be55ceb828dbd73");
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  test("GET /api/v1/saldo/:aluno deve retornar 401 se token for incorreto", async () => {
    const res = await request("/api/v1/saldo/0xfe3b557e8fb62b89f4916b721be55ceb828dbd73", {
      headers: { "X-API-KEY": "token-invalido" }
    });
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  test("GET /api/v1/saldo/:aluno deve retornar 200 e saldo correto com X-API-KEY valido", async () => {
    const res = await request("/api/v1/saldo/0xfe3b557e8fb62b89f4916b721be55ceb828dbd73", {
      headers: { "X-API-KEY": "test-token-123" }
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.aluno, "0xfe3b557e8fb62b89f4916b721be55ceb828dbd73");
    assert.equal(typeof res.body.saldo, "number");
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
    assert.ok(typeof res.body.result === "string");
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
      body: { alunos: ["0xfe3b557e8fb62b89f4916b721be55ceb828dbd73"] }
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
});
