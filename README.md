# Infraestrutura — WydenCoin

Configuração e operação dos serviços de infraestrutura da rede privada **Hyperledger Besu (QBFT)**, **RPC Gateway API** e **Stack de Observabilidade** do projeto WydenCoin.

## Visão Geral dos Serviços

| Serviço | Tecnologia / Imagem | Documentação | Descrição |
| :--- | :--- | :--- | :--- |
| Rede Blockchain | `hyperledger/besu:25.5.0` | [besu/README.md](besu/README.md) | Cluster QBFT distribuído em 4 VMs (3 validadores e 1 nó RPC) |
| RPC Gateway | `node:22-alpine` | [gateway/GATEWAY_API.md](gateway/GATEWAY_API.md) | Camada REST autenticada (`X-API-KEY`) que isola o nó Besu |
| Monitoramento | `prom/prometheus` / `grafana/grafana-oss` | [monitoring/README.md](monitoring/README.md) | Coleta de métricas e dashboards do Besu, Gateway e SO |
| API / Indexer | `ghcr.io/wydencoin/api` | `docker-compose.yml` | Serviços de aplicação e indexação de eventos on-chain |
| Túnel Externo | `cloudflare/cloudflared` | `docker-compose.yml` | Exposição controlada de tráfego externo via Cloudflare Tunnel |

## Estrutura do Repositório

```text
infra/
├── besu/           # Automação e guias do cluster Hyperledger Besu (single-node e multi-node)
├── gateway/        # API Gateway REST, SDK cliente e guias de integração
├── monitoring/     # Stack Prometheus, Grafana e Node Exporter
├── scripts/        # Scripts operacionais (ex.: atualização de DNS dinâmico)
└── docker-compose.yml
```

## Execução do Compose Base

```bash
cp .env.example .env            # variáveis de ambiente de infraestrutura
cp ../api/.env.example .env.api # variáveis da API
docker compose up -d
```

Para procedimentos detalhados de cada módulo (cluster Besu em 4 VMs, Gateway RPC ou Monitoramento), consulte o `README.md` do respectivo diretório.
