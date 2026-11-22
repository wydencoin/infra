# Guia Operacional da Rede Hyperledger Besu Multi-Node (4 VMs)

Procedimento operacional para inicializar, distribuir, verificar e manter a rede privada Hyperledger Besu (QBFT) em **4 máquinas virtuais (VMs) independentes**.

---

## 1. Topologia e Placeholders

Substitua os placeholders `<node1-ip>`, `<node2-ip>`, `<node3-ip>`, `<rpc-ip>` e `<usuario>` pelos valores correspondentes ao ambiente de implantação.

| Máquina | Papel na Rede | Endereço | Portas Principais |
| :--- | :--- | :--- | :--- |
| **VM 1** | Coordenador + Validador 1 (Bootnode) | `<node1-ip>` | `30303` (P2P TCP/UDP), `8545` (RPC Local) |
| **VM 2** | Validador 2 (QBFT) | `<node2-ip>` | `30303` (P2P TCP/UDP), `8545` (RPC Local) |
| **VM 3** | Validador 3 (QBFT) | `<node3-ip>` | `30303` (P2P TCP/UDP), `8545` (RPC Local) |
| **VM 4** | Nó RPC e Gateway | `<rpc-ip>` | `30303` (P2P), `8545` (RPC), `8645` (WS), `9545` (Metrics) |

> Os nós validadores 1 a 3 participam do consenso QBFT e produzem blocos a cada 2 segundos. O nó RPC (VM 4) atua exclusivamente como interface de leitura e submissão de transações, isolando os validadores do tráfego de aplicações.

---

## 2. Pré-requisitos em Todas as Máquinas

Em todas as 4 VMs, garanta que o Docker e o Docker Compose estejam instalados:

```bash
chmod +x ./besu/scripts/install-docker.sh
./besu/scripts/install-docker.sh
```

### Regras de Firewall (UFW)
* **Em todas as máquinas (P2P):**
  ```bash
  sudo ufw allow 30303/tcp
  sudo ufw allow 30303/udp
  ```
* **Na VM 4 (conforme a política de exposição adotada):**
  ```bash
  sudo ufw allow 8546/tcp # Gateway REST autenticado
  # Opcional (apenas se acesso direto ao Besu for necessário em rede interna):
  # sudo ufw allow 8545/tcp
  # sudo ufw allow 8645/tcp
  ```

---

## 3. Inicialização da VM 1 (Coordenadora / Bootnode)

A VM 1 gera as chaves criptográficas dos nós, o arquivo `genesis.json`, as listas de permissão e os pacotes `.tar.gz` das demais máquinas.

```bash
cd besu
./deploy/setup-coordinator.sh --bootnode-ip <node1-ip>
```

O script executa automaticamente:
1. Geração das chaves dos 3 validadores usando a imagem `hyperledger/besu:25.5.0`.
2. Criação do `genesis.json` configurado para QBFT (2s por bloco, Chain ID `381660001`, gas zerado).
3. Empacotamento dos bundles em `besu/dist/` (`node1/`, `node2.tar.gz`, `node3.tar.gz`, `rpc-node.tar.gz`).
4. Inicialização do container do Validador 1.

Verificação inicial na VM 1:
```bash
cd dist/node1
./check.sh
```

---

## 4. Distribuição dos Pacotes via SCP

A partir da VM 1, transfira os pacotes gerados para as demais máquinas:

```bash
scp dist/node2.tar.gz <usuario>@<node2-ip>:~/
scp dist/node3.tar.gz <usuario>@<node3-ip>:~/
scp dist/rpc-node.tar.gz <usuario>@<rpc-ip>:~/
```

---

## 5. Inicialização das VMs 2 e 3 (Validadores QBFT)

### VM 2 (Validador 2)
```bash
tar -xzf ~/node2.tar.gz
cd ~/node2
./run.sh
./check.sh
```

### VM 3 (Validador 3)
```bash
tar -xzf ~/node3.tar.gz
cd ~/node3
./run.sh
./check.sh
```

Com a maioria qualificada de validadores online, o consenso QBFT inicia automaticamente a produção contínua de blocos. Para acompanhar os logs em tempo real:

```bash
docker compose logs -f
```

---

## 6. Inicialização da VM 4 (Nó RPC)

```bash
tar -xzf ~/rpc-node.tar.gz
cd ~/rpc-node
./run.sh
./check.sh
```

### Validação JSON-RPC Local na VM 4

```bash
# Bloco atual (retorna hexadecimal)
curl -s -X POST --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  -H "Content-Type: application/json" http://127.0.0.1:8545

# Validadores ativos no último bloco
curl -s -X POST --data '{"jsonrpc":"2.0","method":"qbft_getValidatorsByBlockNumber","params":["latest"],"id":1}' \
  -H "Content-Type: application/json" http://127.0.0.1:8545
```

---

## 7. Operação e Manutenção Diária

Cada pacote extraído contém os seguintes utilitários padronizados:

| Script / Comando | Ação | Descrição |
| :--- | :--- | :--- |
| `./run.sh` | Iniciar nó | Executa `docker compose up -d` utilizando o `.env` local |
| `./stop.sh` | Parar nó | Encerra e remove o container (`docker compose down`) |
| `./check.sh` | Diagnóstico | Consulta `net_peerCount`, `eth_blockNumber`, sincronização e logs |
| `docker compose logs -f` | Logs | Exibe a saída do processo Besu em tempo real |

### Reset Completo da Rede (Ambiente de Laboratório)
1. Em todas as máquinas, execute `./stop.sh && rm -rf data/DATABASE/`.
2. Na VM 1, execute novamente `./deploy/setup-coordinator.sh --bootnode-ip <node1-ip>`.
3. Reenvie e extraia os novos pacotes `.tar.gz` nas VMs 2, 3 e 4.
