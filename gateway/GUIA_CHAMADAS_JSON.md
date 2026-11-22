# Guia de Chamadas HTTP/JSON (WydenCoin RPC Gateway)

Especificação completa para consumo direto da **WydenCoin RPC Gateway API** por meio de requisições HTTP enviando e recebendo JSON, sem dependência de SDKs ou bibliotecas Web3.

Compatível com qualquer cliente HTTP: `curl`, Postman, Insomnia, `fetch`, Python `requests`, Dart/Flutter `http`, Java ou PHP.

> Para consumo programático em Node.js utilizando o cliente encapsulado (`gateway_client.js`), consulte [`GUIA_CHAMADAS_GATEWAY_CLIENT.md`](GUIA_CHAMADAS_GATEWAY_CLIENT.md).

---

## 1. Configuração Base e Autenticação

* **URL Base:** `http://<host-do-gateway>:8546` (em ambiente de nuvem: `http://wydencoin-rpc.duckdns.org:8546`; em ambiente local via túnel SSH: `http://localhost:8546`).
* **Cabeçalhos Obrigatórios (rotas `/api/v1/*`):**
  ```http
  Content-Type: application/json
  X-API-KEY: <SUA_API_KEY>
  ```
  Alternativamente, o token pode ser enviado no cabeçalho `Authorization: Bearer <SUA_API_KEY>`.

---

## 2. Índice de Endpoints

| Método | Endpoint | Autenticação | Descrição |
| :--- | :--- | :---: | :--- |
| `GET` | `/health` | Pública | Saúde da API, rede Besu e endereços dos contratos |
| `GET` | `/metrics` | Interna | Métricas Prometheus em formato texto |
| `GET` | `/api/v1/saldo/:aluno` | `X-API-KEY` | Consulta de saldo válido de WydenCoins (`WC`) |
| `GET` | `/api/v1/saldo/:aluno/lotes` | `X-API-KEY` | Consulta de lotes ativos e datas de expiração da carteira |
| `GET` | `/api/v1/config/expiracao` | `X-API-KEY` | Consulta do prazo vigente de expiração de moedas |
| `PUT` | `/api/v1/config/expiracao` | `X-API-KEY` | Altera o prazo de expiração para novas emissões (`DIRECTOR_ROLE`) |
| `POST` | `/api/v1/expiracao/executar` | `X-API-KEY` | Executa queima on-chain de lotes expirados (individual ou lote) |
| `POST` | `/api/v1/recompensas/mint` | `X-API-KEY` | Emissão de moedas para 1 aluno |
| `POST` | `/api/v1/recompensas/mint-batch` | `X-API-KEY` | Emissão atômica em lote |
| `POST` | `/api/v1/resgates` | `X-API-KEY` | Criação de resgate / voucher sob custódia |
| `GET` | `/api/v1/resgates/:id` | `X-API-KEY` | Consulta de dados e status do voucher |
| `POST` | `/api/v1/resgates/:id/confirmar` | `X-API-KEY` | Confirmação de uso e queima (`burn`) on-chain |
| `POST` | `/api/v1/resgates/:id/cancelar` | `X-API-KEY` | Cancelamento administrativo com devolução de saldo |
| `POST` | `/api/v1/resgates/:id/expirar` | `X-API-KEY` | Expiração de voucher vencido com devolução de saldo |
| `POST` | `/api/v1/rpc` | `X-API-KEY` | Proxy JSON-RPC nativo para o nó Besu |

---

## 3. Especificação dos Endpoints

### 3.1. `GET /health`

Verifica a disponibilidade do Gateway e o estado de sincronização do nó Besu.

* **Autenticação:** Pública.
* **Body:** Nenhum.

**Resposta (`200 OK`):**
```json
{
  "status": "UP",
  "network": {
    "chainId": 381660001,
    "blockNumber": 165620,
    "peers": 2,
    "syncing": false
  },
  "contracts": {
    "wydenCoin": "0xa50a51c09a5c451C52BB714527E1974b686D8e77",
    "redemptionManager": "0x9a3DBCa554e9f6b9257aAa24010DA8377C57c17e"
  },
  "timestamp": "2026-11-17T17:50:00.000Z"
}
```

**Exemplo cURL:**
```bash
curl -X GET http://wydencoin-rpc.duckdns.org:8546/health
```

---

### 3.2. `GET /api/v1/saldo/:aluno`

Retorna o saldo atual de WydenCoins da carteira informada no parâmetro de rota `:aluno`.

* **Autenticação:** `X-API-KEY`.
* **Body:** Nenhum.

**Resposta (`200 OK`):**
```json
{
  "success": true,
  "aluno": "0xFE3B557E8Fb62b89F4916B721be55cEb828dBd73",
  "saldo": 70,
  "unidade": "WC"
}
```

**Exemplo cURL:**
```bash
curl -X GET http://wydencoin-rpc.duckdns.org:8546/api/v1/saldo/0xFE3B557E8Fb62b89F4916B721be55cEb828dBd73 \
  -H "X-API-KEY: $API_KEY"
```

---

### 3.3. `POST /api/v1/recompensas/mint`

Emite unidades inteiras de WydenCoin para a carteira de um aluno, registrando o código do motivo on-chain.

* **Autenticação:** `X-API-KEY`.

**Payload de Requisição:**
```json
{
  "aluno": "0xFE3B557E8Fb62b89F4916B721be55cEb828dBd73",
  "valor": 10,
  "motivo": "SIA_15D"
}
```

* `aluno` *(string, obrigatório)*: endereço hexadecimal da carteira (`0x...`).
* `valor` *(number, obrigatório)*: quantidade inteira maior que zero.
* `motivo` *(string, opcional)*: código do motivo (ex.: `SIA_15D`, `PRES_15D`, `SIMULADO`, `DIG_ESTUDO`, `VOLTOU`, `CR_SEM`). Padrão: `RECOMPENSA`.

**Resposta (`200 OK`):**
```json
{
  "success": true,
  "txHash": "0x285263135888b78ee8f6946079850d2f790c58716da5c13fcdc202bb7b27bd93",
  "blockNumber": 165576,
  "aluno": "0xFE3B557E8Fb62b89F4916B721be55cEb828dBd73",
  "valor": 10,
  "motivo": "SIA_15D"
}
```

**Exemplo cURL:**
```bash
curl -X POST http://wydencoin-rpc.duckdns.org:8546/api/v1/recompensas/mint \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: $API_KEY" \
  -d '{
    "aluno": "0xFE3B557E8Fb62b89F4916B721be55cEb828dBd73",
    "valor": 10,
    "motivo": "SIA_15D"
  }'
```

---

### 3.4. `POST /api/v1/recompensas/mint-batch`

Emite moedas para múltiplos alunos em uma única transação atômica. Indicado para fechamentos periódicos em lote.

* **Autenticação:** `X-API-KEY`.

**Payload de Requisição:**
```json
{
  "itens": [
    {
      "aluno": "0xFE3B557E8Fb62b89F4916B721be55cEb828dBd73",
      "valor": 10,
      "motivo": "SIA_15D"
    },
    {
      "aluno": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      "valor": 10,
      "motivo": "PRES_15D"
    },
    {
      "aluno": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      "valor": 30,
      "motivo": "SIMULADO"
    }
  ]
}
```

**Resposta (`200 OK`):**
```json
{
  "success": true,
  "totalItens": 3,
  "txHash": "0x3c21a4f00b991ef2340bfa15f79a9cd89031ef091a13c983c21f98bc1901ab21",
  "blockNumber": 165580
}
```

**Exemplo cURL:**
```bash
curl -X POST http://wydencoin-rpc.duckdns.org:8546/api/v1/recompensas/mint-batch \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: $API_KEY" \
  -d '{
    "itens": [
      { "aluno": "0xFE3B557E8Fb62b89F4916B721be55cEb828dBd73", "valor": 10, "motivo": "SIA_15D" },
      { "aluno": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "valor": 10, "motivo": "PRES_15D" }
    ]
  }'
```

---

### 3.5. `POST /api/v1/resgates`

Transfere as moedas da carteira do aluno para a custódia do contrato `RedemptionManager`, gerando um voucher pendente.

* **Autenticação:** `X-API-KEY`.

**Payload de Requisição:**
```json
{
  "alunoPrivateKey": "0x<CHAVE_PRIVADA_DO_ALUNO>",
  "beneficioId": 101,
  "valor": 15,
  "horasValidade": 24
}
```

* `alunoPrivateKey` *(string, obrigatório)*: chave privada da carteira do aluno para assinatura da transação de resgate.
* `beneficioId` *(number, obrigatório)*: identificador do benefício no banco de dados da aplicação.
* `valor` *(number, obrigatório)*: custo do benefício em WydenCoins.
* `horasValidade` *(number, opcional, padrão: `24`)*: prazo de expiração do voucher em horas.

**Resposta (`201 Created`):**
```json
{
  "success": true,
  "idResgate": 1,
  "beneficioId": 101,
  "valor": 15,
  "expiraEm": 1763481600,
  "txHash": "0x1d4ef289a0bc9882aef9120934bd081cde91209384bbfa890123ef89021cd981",
  "blockNumber": 165585
}
```

**Exemplo cURL:**
```bash
curl -X POST http://wydencoin-rpc.duckdns.org:8546/api/v1/resgates \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: $API_KEY" \
  -d '{
    "alunoPrivateKey": "0x<CHAVE_PRIVADA_DO_ALUNO>",
    "beneficioId": 101,
    "valor": 15,
    "horasValidade": 24
  }'
```

---

### 3.6. `GET /api/v1/resgates/:id`

Consulta os dados e o estado atual de um voucher on-chain.

* **Autenticação:** `X-API-KEY`.
* **Body:** Nenhum.

**Resposta (`200 OK`):**
```json
{
  "success": true,
  "id": 1,
  "aluno": "0xFE3B557E8Fb62b89F4916B721be55cEb828dBd73",
  "beneficioId": 101,
  "valor": 15,
  "expiraEm": 1763481600,
  "status": "Resgatado",
  "statusCode": 0
}
```

Tabela de estados (`statusCode` / `status`):

| `statusCode` | `status` | Significado |
| :---: | :--- | :--- |
| `0` | `Resgatado` | Pendente de validação (tokens sob custódia) |
| `1` | `Utilizado` | Confirmado no estabelecimento (tokens queimados) |
| `2` | `Cancelado` | Cancelado administrativamente (saldo estornado) |
| `3` | `Expirado` | Prazo ultrapassado (saldo estornado) |

**Exemplo cURL:**
```bash
curl -X GET http://wydencoin-rpc.duckdns.org:8546/api/v1/resgates/1 \
  -H "X-API-KEY: $API_KEY"
```

---

### 3.7. `POST /api/v1/resgates/:id/confirmar`

Confirma a utilização do voucher no estabelecimento parceiro e executa a queima permanente (`burn`) das moedas custodiadas.

* **Autenticação:** `X-API-KEY`.
* **Body:** Vazio ou `{}`.

**Resposta (`200 OK`):**
```json
{
  "success": true,
  "id": 1,
  "status": "Utilizado",
  "txHash": "0x98fba100c8a2b34de5912389012cae98120398bbde90123890123abcdfe98012",
  "blockNumber": 165590
}
```

**Exemplo cURL:**
```bash
curl -X POST http://wydencoin-rpc.duckdns.org:8546/api/v1/resgates/1/confirmar \
  -H "X-API-KEY: $API_KEY"
```

---

### 3.8. `POST /api/v1/resgates/:id/cancelar`

Cancela um voucher pendente e devolve integralmente as moedas para a carteira do aluno.

* **Autenticação:** `X-API-KEY`.
* **Body:** Vazio ou `{}`.

**Resposta (`200 OK`):**
```json
{
  "success": true,
  "id": 1,
  "status": "Cancelado",
  "txHash": "0xaa12bc34de56fa780912bcde349012ca981230491823abce891023cd891023bc",
  "blockNumber": 165595
}
```

**Exemplo cURL:**
```bash
curl -X POST http://wydencoin-rpc.duckdns.org:8546/api/v1/resgates/1/cancelar \
  -H "X-API-KEY: $API_KEY"
```

---

### 3.9. `POST /api/v1/resgates/:id/expirar`

Processa a expiração de um voucher cujo prazo (`expiraEm`) já foi ultrapassado, devolvendo o saldo ao aluno.

* **Autenticação:** `X-API-KEY`.
* **Body:** Vazio ou `{}`.

**Resposta (`200 OK`):**
```json
{
  "success": true,
  "id": 1,
  "status": "Expirado",
  "txHash": "0xbb9876543210fedcba0987654321fedcba0987654321fedcba0987654321fedc",
  "blockNumber": 165600
}
```

**Exemplo cURL:**
```bash
curl -X POST http://wydencoin-rpc.duckdns.org:8546/api/v1/resgates/1/expirar \
  -H "X-API-KEY: $API_KEY"
```

---

### 3.10. `POST /api/v1/rpc`

Encaminha chamadas padrão Ethereum JSON-RPC diretamente para o nó Hyperledger Besu autenticado.

* **Autenticação:** `X-API-KEY`.

**Payload de Requisição:**
```json
{
  "method": "eth_blockNumber",
  "params": []
}
```

**Resposta (`200 OK`):**
```json
{
  "success": true,
  "result": "0x286c9"
}
```

**Exemplo cURL:**
```bash
curl -X POST http://wydencoin-rpc.duckdns.org:8546/api/v1/rpc \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: $API_KEY" \
  -d '{
    "method": "eth_blockNumber",
    "params": []
  }'
```

#### Exemplos de Métodos JSON-RPC Suportados

| Finalidade | Payload JSON |
| :--- | :--- |
| Número do bloco atual | `{"method": "eth_blockNumber", "params": []}` |
| Recibo de transação | `{"method": "eth_getTransactionReceipt", "params": ["0x<txHash>"]}` |
| Detalhes do último bloco | `{"method": "eth_getBlockByNumber", "params": ["latest", false]}` |
| Quantidade de peers | `{"method": "net_peerCount", "params": []}` |
| Chain ID da rede | `{"method": "eth_chainId", "params": []}` |

---

### 3.11. `GET /api/v1/saldo/:aluno/lotes`

Retorna o saldo válido, o total expirável pendente de queima e a lista detalhada de lotes ativos da carteira ordenados pela data de expiração mais próxima (FEFO).

* **Autenticação:** `X-API-KEY`.

**Resposta (`200 OK`):**
```json
{
  "success": true,
  "aluno": "0xFE3B557E8Fb62b89F4916B721be55cEb828dBd73",
  "saldoValido": 440,
  "saldoExpiravel": 60,
  "unidade": "WC",
  "periodoExpiracaoSegundos": 31536000,
  "lotes": [
    {
      "valor": 440,
      "recebidoEm": 1763481600,
      "recebidoEmIso": "2025-11-18T16:00:00.000Z",
      "expiraEm": 1795017600,
      "expiraEmIso": "2026-11-18T16:00:00.000Z"
    }
  ]
}
```

**Exemplo cURL:**
```bash
curl -X GET http://wydencoin-rpc.duckdns.org:8546/api/v1/saldo/0xFE3B557E8Fb62b89F4916B721be55cEb828dBd73/lotes \
  -H "X-API-KEY: $API_KEY"
```

---

### 3.12. `GET /api/v1/config/expiracao` e `PUT /api/v1/config/expiracao`

Consulta ou altera o prazo de expiração aplicado às **novas emissões** de WydenCoin. A alteração exige assinatura por carteira detentora da role `DIRECTOR_ROLE` (por padrão a chave configurada no Gateway ou uma `directorPrivateKey` opcional enviada no payload). Informe `0` para desativar a expiração em novas emissões.

* **Autenticação:** `X-API-KEY`.

**Payload de Atualização (`PUT`):**
```json
{
  "dias": 180
}
```
*(Também aceita `"segundos": 15552000` e opcionalmente `"directorPrivateKey": "0x<CHAVE_PRIVADA_DIRETOR>"`.)*

**Resposta (`200 OK`):**
```json
{
  "success": true,
  "periodoSegundos": 15552000,
  "periodoDias": 180,
  "ativo": true,
  "txHash": "0xabc123...",
  "blockNumber": 165610
}
```

**Exemplo cURL:**
```bash
curl -X PUT http://wydencoin-rpc.duckdns.org:8546/api/v1/config/expiracao \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: $API_KEY" \
  -d '{ "dias": 180 }'
```

---

### 3.13. `POST /api/v1/expiracao/executar`

Executa a queima on-chain (`_burn`) dos lotes vencidos para um aluno ou lista de alunos, atualizando `totalSupply` e emitindo o evento `TokensExpirados`. Adequado para rotinas agendadas (cron).

* **Autenticação:** `X-API-KEY`.

**Payload de Requisição:**
```json
{
  "alunos": [
    "0xFE3B557E8Fb62b89F4916B721be55cEb828dBd73",
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
  ]
}
```

**Resposta (`200 OK`):**
```json
{
  "success": true,
  "totalContasVerificadas": 2,
  "totalQueimado": 60,
  "detalhes": [
    {
      "aluno": "0xFE3B557E8Fb62b89F4916B721be55cEb828dBd73",
      "valorQueimado": 60
    }
  ],
  "txHash": "0xdef456...",
  "blockNumber": 165612
}
```

**Exemplo cURL:**
```bash
curl -X POST http://wydencoin-rpc.duckdns.org:8546/api/v1/expiracao/executar \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: $API_KEY" \
  -d '{
    "alunos": ["0xFE3B557E8Fb62b89F4916B721be55cEb828dBd73"]
  }'
```

---

## 4. Padrão de Erros HTTP

Todas as falhas retornam um objeto JSON padronizado:

```json
{
  "success": false,
  "error": "Descrição do motivo do erro"
}
```

| Status HTTP | Causa | Exemplo de Resposta |
| :---: | :--- | :--- |
| `400 Bad Request` | Parâmetro ausente ou malformado | `{"success": false, "error": "Endereco de aluno invalido: 0x123"}` |
| `401 Unauthorized` | Cabeçalho `X-API-KEY` ou `Bearer` ausente/inválido | `{"success": false, "error": "Acesso nao autorizado. Header X-API-KEY ou Bearer token invalido."}` |
| `404 Not Found` | Rota inexistente | `{"success": false, "error": "Rota nao encontrada: POST /api/v1/inexistente"}` |
| `500 Internal Error` | Reversão de contrato ou indisponibilidade do Besu | `{"success": false, "error": "execution reverted: Saldo insuficiente"}` |

---

## 5. Exemplos em Diferentes Linguagens

### JavaScript (`fetch` nativo — Node.js 18+)

```javascript
const resposta = await fetch("http://wydencoin-rpc.duckdns.org:8546/api/v1/recompensas/mint", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-KEY": process.env.BLOCKCHAIN_GATEWAY_TOKEN
  },
  body: JSON.stringify({
    aluno: "0xFE3B557E8Fb62b89F4916B721be55cEb828dBd73",
    valor: 10,
    motivo: "SIA_15D"
  })
});

const dados = await resposta.json();
console.log("TxHash:", dados.txHash);
```

### Python (`requests`)

```python
import os
import requests

url = "http://wydencoin-rpc.duckdns.org:8546/api/v1/recompensas/mint"
headers = {
    "Content-Type": "application/json",
    "X-API-KEY": os.environ["BLOCKCHAIN_GATEWAY_TOKEN"],
}
payload = {
    "aluno": "0xFE3B557E8Fb62b89F4916B721be55cEb828dBd73",
    "valor": 10,
    "motivo": "SIA_15D",
}

response = requests.post(url, json=payload, headers=headers, timeout=30)
response.raise_for_status()
print(response.json())
```

### Dart / Flutter (`http`)

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

Future<void> emitirMoeda(String apiKey) async {
  final url = Uri.parse('http://wydencoin-rpc.duckdns.org:8546/api/v1/recompensas/mint');
  final response = await http.post(
    url,
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
    },
    body: jsonEncode({
      'aluno': '0xFE3B557E8Fb62b89F4916B721be55cEb828dBd73',
      'valor': 10,
      'motivo': 'SIA_15D',
    }),
  );

  print(jsonDecode(response.body));
}
```
