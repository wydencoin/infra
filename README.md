# infra — WydenCoin

Como o sistema roda na VM Oracle Always Free. Responsáveis: **Professor** e **Carlos** (Besu).

| Serviço | Imagem | Observação |
| --- | --- | --- |
| besu | hyperledger/besu:25.5.0 | 1 BootNode, 3 validadores QBFT, 1 RPC |
| [gateway](gateway/GATEWAY_API.md) | node:22-alpine | Middleware REST com autenticação (API Key) para o nó Besu |
| api / indexer | ghcr.io/wydencoin/api | mesma imagem, comandos diferentes |
| [grafana / prometheus](monitoring/README.md) | grafana-oss / prometheus | Telemetria em tempo real do Besu QBFT e da Gateway API (Porta 3000) |
| cloudflared | cloudflare/cloudflared | única saída para a internet |

```bash
cp .env.example .env            # token do túnel
cp ../api/.env.example .env.api # segredos da API
docker compose up -d
```
Backups: `scripts/backup.sh` no cron diário. Teste a restauração antes do piloto.

Plano completo: documento "Implantação do WydenCoin na Nuvem".
