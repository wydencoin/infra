# Laboratório Hyperledger Besu QBFT: Implantação em Máquina Única (`lab-single-node`)

Guia passo a passo para executar a rede privada Hyperledger Besu (QBFT) localmente em um único host utilizando scripts modulares (`.sh`), permitindo acompanhar cada etapa de inicialização da rede.

---

## 1. Arquitetura Local

Para reproduzir a topologia multi-node em uma única máquina, o laboratório sobe **4 instâncias Docker do Hyperledger Besu** (**3 validadores QBFT** e **1 nó RPC**) com portas separadas na interface local (`127.0.0.1`):

| Nó | Papel no Consenso | Porta P2P | Porta JSON-RPC HTTP | Porta WebSockets |
| :--- | :--- | :---: | :---: | :---: |
| `besu-node1` | Validador 1 / Bootnode | `30303` | `8541` | — |
| `besu-node2` | Validador 2 | `30304` | `8542` | — |
| `besu-node3` | Validador 3 | `30305` | `8543` | — |
| `besu-rpcnode` | Nó RPC / Membro | `30306` | `8545` | `8645` |

O nó `besu-rpcnode` expõe a porta padrão `8545`, permitindo conectar contratos Hardhat, clientes Web3 e o RPC Gateway em `http://127.0.0.1:8545`.

---

## 2. Execução Passo a Passo

A partir da raiz do repositório `infra`, acesse o diretório do laboratório:

```bash
cd besu/lab-single-node
```

### Etapa 1: Validação de Pré-requisitos

```bash
./01-install-requirements.sh
```

Verifica a disponibilidade do daemon Docker, do plugin Docker Compose e das permissões do usuário atual.

### Etapa 2: Geração Criptográfica e Bloco Gênese QBFT

```bash
./02-generate-network.sh
```

Este script executa:
1. Geração das chaves dos 3 validadores (`operator generate-blockchain-config`) com Chain ID `381660001` e intervalo de bloco de 2s.
2. Extração do Enode do Nó 1 (`enode://...127.0.0.1:30303`).
3. Criação do arquivo `permissions_config.toml` com a conta deployer e os nós autorizados.
4. Geração dos diretórios em `../dist/` (`node1`, `node2`, `node3` e `rpc-node`).

### Etapa 3: Iniciar Nó 1 (Validador 1 / Bootnode)

```bash
./03-start-node1.sh
```

Inicia o container `besu-node1` na porta P2P `30303`, servindo como bootnode para os demais nós.

### Etapa 4: Iniciar Nó 2 (Validador 2)

```bash
./04-start-node2.sh
```

Inicia o container `besu-node2` na porta `30304`, conectando-se automaticamente ao Nó 1.

### Etapa 5: Iniciar Nó 3 (Validador 3) — Ativação do Quorum QBFT

```bash
./05-start-node3.sh
```

> **Quorum QBFT:** o consenso QBFT requer maioria qualificada de pelo menos `2F + 1` assinaturas dentre os validadores configurados. Com os 3 validadores ativos, a produção de blocos inicia automaticamente a cada 2 segundos.

### Etapa 6: Iniciar Nó 4 (Nó RPC)

```bash
./06-start-rpcnode.sh
```

Inicia o container `besu-rpcnode` na porta P2P `30306`, sincroniza a cadeia e expõe JSON-RPC HTTP em `127.0.0.1:8545` e WebSockets em `127.0.0.1:8645`.

### Etapa 7: Diagnóstico Consolidado

```bash
./07-check-network.sh
```

Resultados esperados:
* Status `healthy` nos 4 containers.
* `Peers Conectados: 3 (0x3)` no nó RPC.
* Altura de bloco incrementando a cada 2 segundos.
* Lista com os 3 endereços validadores retornada pelo método QBFT.

### Etapa 8: Parada e Limpeza

Para encerrar todos os nós:

```bash
./08-stop-network.sh
```

Para apagar os dados locais e reiniciar a blockchain do bloco gênese:

```bash
rm -rf ../dist/*/data/DATABASE ../dist/*/data/caches
```

---

## 3. Operação Individual por Nó (`dist/`)

Cada diretório gerado em `besu/dist/` pode ser operado de forma independente:

```bash
# Iniciar nó individual
cd ../dist/node1 && ./run.sh

# Diagnóstico de nó individual
cd ../dist/node1 && ./check.sh

# Parar nó individual
cd ../dist/node1 && ./stop.sh

# Acompanhar logs em tempo real
cd ../dist/node1 && docker compose logs -f
```
