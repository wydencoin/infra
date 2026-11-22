# Guia do Cliente SDK JavaScript (`gateway_client.js`)

Manual de uso da classe `WydencoinGatewayClient` ([`gateway_client.js`](gateway_client.js)) para integração de aplicações Node.js com a **WydenCoin RPC Gateway API**.

> Para especificações HTTP/JSON puras (cURL, Python, Dart ou `fetch` manual), consulte [`GUIA_CHAMADAS_JSON.md`](GUIA_CHAMADAS_JSON.md).

---

## 1. Visão Geral e Pré-requisitos

O arquivo `gateway_client.js` encapsula todas as rotas REST do Gateway em métodos assíncronos simples (`async/await`), utilizando o `fetch` nativo do Node.js sem dependências externas.

* **Pré-requisito:** Node.js v18 ou superior.

---

## 2. Configuração e Importação

O cliente lê por padrão duas variáveis de ambiente, que também podem ser informadas diretamente no construtor:

| Variável de Ambiente | Descrição | Padrão |
| :--- | :--- | :--- |
| `BLOCKCHAIN_GATEWAY_URL` | URL base da Gateway API | `http://wydencoin-rpc.duckdns.org:8546` |
| `BLOCKCHAIN_GATEWAY_TOKEN` | Chave secreta enviada no cabeçalho `X-API-KEY` | *(vazio — obrigatório para rotas autenticadas)* |

### Importação em um Projeto Node.js

Copie `gateway_client.js` para a camada de serviços da aplicação (ex.: `src/services/gateway_client.js`) e instancie a classe:

```javascript
const { WydencoinGatewayClient } = require("./services/gateway_client");

// Usa BLOCKCHAIN_GATEWAY_URL e BLOCKCHAIN_GATEWAY_TOKEN do ambiente
const client = new WydencoinGatewayClient();

// Ou passa URL e token explicitamente
const clientCustom = new WydencoinGatewayClient(
  process.env.BLOCKCHAIN_GATEWAY_URL,
  process.env.BLOCKCHAIN_GATEWAY_TOKEN
);
```

### Execução do Teste Integrado via Terminal

O arquivo possui uma rotina demonstrativa executada apenas quando chamado diretamente:

```bash
cd gateway
BLOCKCHAIN_GATEWAY_TOKEN="<SUA_API_KEY>" node gateway_client.js
```

O script verifica `/health`, consulta o saldo de uma carteira de exemplo, emite moedas de teste e imprime o hash da transação e o bloco minerado.

---

## 3. Referência dos Métodos

Todos os métodos retornam uma `Promise` resolvida com o objeto JSON de resposta e lançam `Error` em respostas HTTP fora da faixa `2xx`.

| Método | Parâmetros | Retorno Principal |
| :--- | :--- | :--- |
| `getHealth()` | — | `{ status, network, contracts, timestamp }` |
| `getSaldo(alunoAddress)` | `string` | `{ success, aluno, saldo, unidade }` |
| `getLotesSaldo(alunoAddress)` | `string` | `{ success, aluno, saldoValido, saldoExpiravel, lotes }` |
| `getPoliticaExpiracao()` | — | `{ success, periodoSegundos, periodoDias, ativo }` |
| `alterarPeriodoExpiracao(opcoes)` | `{ dias?, segundos?, directorPrivateKey? }` | `{ success, periodoSegundos, periodoDias, ativo, txHash }` |
| `executarExpiracao(alunos)` | `string \| string[]` | `{ success, totalContasVerificadas, totalQueimado, detalhes, txHash }` |
| `emitirRecompensa(aluno, valor, motivo)` | `string, number, string?` | `{ success, txHash, blockNumber, aluno, valor, motivo }` |
| `emitirLoteRecompensas(itens)` | `Array<{ aluno, valor, motivo }>` | `{ success, totalItens, txHash, blockNumber }` |
| `solicitarResgate(key, beneficioId, valor, horas)` | `string, number, number, number?` | `{ success, idResgate, beneficioId, valor, expiraEm, txHash, blockNumber }` |
| `consultarResgate(id)` | `number` | `{ success, id, aluno, beneficioId, valor, expiraEm, status, statusCode }` |
| `confirmarUsoVoucher(id)` | `number` | `{ success, id, status, txHash, blockNumber }` |
| `cancelarVoucher(id)` | `number` | `{ success, id, status, txHash, blockNumber }` |
| `expirarVoucher(id)` | `number` | `{ success, id, status, txHash, blockNumber }` |
| `chamadaRpcBruta(method, params)` | `string, Array?` | `{ success, result }` |

---

## 4. Exemplos por Operação

### 4.1. Saúde da Rede (`getHealth`)

```javascript
const saude = await client.getHealth();
console.log("Status:", saude.status);
console.log("Bloco atual:", saude.network.blockNumber);
console.log("Peers:", saude.network.peers);
```

### 4.2. Consulta de Saldo (`getSaldo`)

```javascript
const carteiraAluno = "0xFE3B557E8Fb62b89F4916B721be55cEb828dBd73";
const resposta = await client.getSaldo(carteiraAluno);
console.log(`Saldo: ${resposta.saldo} ${resposta.unidade}`);
```

### 4.3. Emissão Individual (`emitirRecompensa`)

Códigos de motivo suportados pelo contrato: `SIA_15D`, `PRES_15D`, `SIMULADO`, `DIG_ESTUDO`, `VOLTOU`, `CR_SEM`.

```javascript
const tx = await client.emitirRecompensa(
  "0xFE3B557E8Fb62b89F4916B721be55cEb828dBd73",
  30,
  "SIMULADO"
);
console.log("TxHash:", tx.txHash, "Bloco:", tx.blockNumber);
```

### 4.4. Emissão em Lote (`emitirLoteRecompensas`)

```javascript
const lote = [
  { aluno: "0x1111111111111111111111111111111111111111", valor: 20, motivo: "SIA_15D" },
  { aluno: "0x2222222222222222222222222222222222222222", valor: 50, motivo: "PRES_15D" },
  { aluno: "0x3333333333333333333333333333333333333333", valor: 40, motivo: "CR_SEM" }
];

const resultado = await client.emitirLoteRecompensas(lote);
console.log(`Lote confirmado (${resultado.totalItens} itens):`, resultado.txHash);
```

### 4.5. Ciclo de Vida de Resgates (`solicitarResgate`, `consultarResgate`, `confirmarUsoVoucher`, `cancelarVoucher`, `expirarVoucher`)

```javascript
// 1. Criar voucher sob custódia
const resgate = await client.solicitarResgate(alunoPrivateKey, 101, 50, 24);

// 2. Consultar status atual ("Resgatado", "Utilizado", "Cancelado" ou "Expirado")
const voucher = await client.consultarResgate(resgate.idResgate);

// 3. Confirmar uso no estabelecimento (queima permanente)
await client.confirmarUsoVoucher(resgate.idResgate);

// Alternativas de estorno (para vouchers ainda pendentes):
// await client.cancelarVoucher(resgate.idResgate);
// await client.expirarVoucher(resgate.idResgate);
```

### 4.6. Gestão de Expiração (`getLotesSaldo`, `getPoliticaExpiracao`, `alterarPeriodoExpiracao`, `executarExpiracao`)

```javascript
// Consultar lotes ativos e datas de vencimento de um aluno
const detalhes = await client.getLotesSaldo("0xFE3B557E8Fb62b89F4916B721be55cEb828dBd73");
console.log("Saldo válido:", detalhes.saldoValido, "Expirável:", detalhes.saldoExpiravel);
console.log("Lotes ativos:", detalhes.lotes);

// Consultar e alterar prazo de expiração (requer DIRECTOR_ROLE)
const politica = await client.getPoliticaExpiracao();
console.log("Prazo atual (dias):", politica.periodoDias);
await client.alterarPeriodoExpiracao({ dias: 180 });

// Executar queima on-chain de lotes vencidos (rotina cron)
const purga = await client.executarExpiracao([
  "0xFE3B557E8Fb62b89F4916B721be55cEb828dBd73"
]);
console.log("Total queimado:", purga.totalQueimado);
```

### 4.7. Chamada JSON-RPC Direta (`chamadaRpcBruta`)

```javascript
const blocoHex = await client.chamadaRpcBruta("eth_blockNumber", []);
console.log("Bloco decimal:", parseInt(blocoHex.result, 16));
```

---

## 5. Exemplo de Integração em API Express

```javascript
const express = require("express");
const { WydencoinGatewayClient } = require("./services/gateway_client");

const app = express();
app.use(express.json());

const blockchain = new WydencoinGatewayClient();

app.get("/api/alunos/:carteira/saldo", async (req, res) => {
  try {
    const dados = await blockchain.getSaldo(req.params.carteira);
    return res.json({ saldo: dados.saldo });
  } catch (erro) {
    return res.status(500).json({ erro: erro.message });
  }
});

app.post("/api/recompensas/bonificar", async (req, res) => {
  try {
    const { carteiraAluno, valor, motivo } = req.body;
    const tx = await blockchain.emitirRecompensa(carteiraAluno, valor, motivo);
    return res.json({ sucesso: true, txHash: tx.txHash, bloco: tx.blockNumber });
  } catch (erro) {
    return res.status(400).json({ erro: erro.message });
  }
});

app.post("/api/cantina/validar/:id", async (req, res) => {
  try {
    const resultado = await blockchain.confirmarUsoVoucher(Number(req.params.id));
    return res.json({ sucesso: true, status: resultado.status });
  } catch (erro) {
    return res.status(400).json({ erro: erro.message });
  }
});

app.listen(8080, () => console.log("API em execução na porta 8080"));
```
