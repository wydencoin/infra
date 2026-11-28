# Infraestrutura de Rede Hyperledger Besu (Multi-Node QBFT - 4 VMs)

Módulo de implantação e orquestração da rede privada Ethereum/Besu do projeto **WydenCoin**, estruturado para execução local em máquina única ou distribuída em **4 máquinas virtuais (VMs) independentes**.

---

## Visão Geral da Arquitetura (4 VMs)

A rede utiliza o algoritmo de consenso bizantino **QBFT (Quorum Byzantine Fault Tolerance)** com tempo de bloco de **2 segundos**, política de taxa zero (`min-gas-price=0`), conta deployer pré-financiada no bloco gênese e separação entre nós validadores e nó RPC:

```text
                  +-----------------------------------+
                  |          VM 1 (Coordenadora)      |
                  |     Validador 1 / Bootnode QBFT   |
                  |      P2P Port: 30303 (TCP/UDP)    |
                  +-----------------+-----------------+
                                    |
          +-------------------------+-------------------------+
          |                                                   |
          v                                                   v
+-------------------+                               +-------------------+
|       VM 2        |                               |       VM 3        |
|   Validador 2     |<=============================>|   Validador 3     |
|   (Consenso QBFT) |                               |   (Consenso QBFT) |
+-------------------+                               +-------------------+
          \                                                   /
           \                                                 /
            +-----------------------+-----------------------+
                                    |
                                    v
                  +-----------------------------------+
                  |               VM 4                |
                  |           Nó RPC / Gateway        |
                  |  HTTP 8545 | WS 8645 | Metrics 9545
                  |     (DApps, Benchmarks, APIs)     |
                  +-----------------------------------+
```

Para detalhes de topologia, papéis e regras de firewall, consulte [docs/arquitetura-multi-node.md](docs/arquitetura-multi-node.md).

---

## Guias de Implantação com Scripts Modulares

A implantação é dividida em etapas granulares com scripts `.sh` independentes para facilitar o aprendizado, a depuração e o controle de cada nó:

* **[lab-single-node/README.md](lab-single-node/README.md):** implantação dos 4 nós em **máquina única** (verificação de requisitos, geração de chaves, inicialização individual e diagnóstico consolidado).
* **[lab-multi-node/README.md](lab-multi-node/README.md):** implantação distribuída em **4 VMs** (VM 1 coordenadora, transferência via SCP, validadores nas VMs 2 e 3, e nó RPC na VM 4).
* **[docs/steps-multi-node.md](docs/steps-multi-node.md):** referência operacional resumida para manutenção e reset do cluster multi-node.

---

## Estrutura de Diretórios

```text
besu/
├── lab-single-node/                # Laboratório passo a passo em máquina única
│   ├── 01-install-requirements.sh
│   ├── 02-generate-network.sh
│   ├── 03-start-node1.sh
│   ├── 04-start-node2.sh
│   ├── 05-start-node3.sh
│   ├── 06-start-rpcnode.sh
│   ├── 07-check-network.sh
│   ├── 08-stop-network.sh
│   └── README.md
│
├── lab-multi-node/                 # Laboratório passo a passo em 4 VMs
│   ├── 01-install-requirements.sh
│   ├── 02-setup-vm1-coordinator.sh
│   ├── 03-transfer-to-vms.sh
│   ├── 04-check-network.sh
│   ├── 05-stop-network.sh
│   └── README.md
│
├── configs/                        # Modelos declarativos e configurações base
│   ├── genesis_QBFT.json           # Bloco gênese (3 validadores QBFT, 2s block time)
│   ├── network-topology.yaml.example
│   └── permissions.template.toml   # Modelo de permissões de nós e contas
│
├── core/                           # Scripts de geração criptográfica e empacotamento
│   ├── 01-generate-network.sh      # Cria chaves, genesis.json e enodes
│   └── 02-package-nodes.sh         # Gera pacotes autônomos (.tar.gz) por VM
│
├── deploy/                         # Orquestradores de implantação por papel
│   ├── setup-coordinator.sh        # Gera a rede e inicia o Nó 1 na VM 1
│   ├── setup-validator.sh          # Inicializa nós validadores (VM 2 e VM 3)
│   ├── setup-rpc.sh                # Inicializa o nó RPC (VM 4)
│   └── test-single-machine.sh      # Validação automatizada em máquina única
│
├── docker/                         # Artefatos Docker padronizados
│   ├── Dockerfile                  # Imagem baseada em hyperledger/besu:25.5.0
│   ├── docker-compose.node.yaml    # Template Compose parametrizado via .env
│   └── node.env.example            # Exemplo de variáveis de ambiente do nó
│
├── docs/                           # Documentação arquitetural e operacional
│   ├── arquitetura-multi-node.md
│   └── steps-multi-node.md
│
├── scripts/                        # Utilitários de apoio
│   ├── check-node.sh               # Diagnóstico de saúde, peers e altura de bloco
│   ├── install-docker.sh           # Instalação do Docker e Docker Compose
│   └── stop-node.sh                # Parada e remoção limpa de contêineres
│
└── dist/                           # Artefatos gerados em tempo de execução (ignorado pelo Git)
    ├── node1/
    ├── node2.tar.gz
    ├── node3.tar.gz
    └── rpc-node.tar.gz
```
