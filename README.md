# infra — WydenCoin

Como o sistema roda na VM Oracle Always Free. Responsáveis: **Professor** e **Carlos** (Besu).

| Serviço | Imagem | Observação |
| --- | --- | --- |
| besu | hyperledger/besu:25.5.0 | 1 validador QBFT no piloto, RPC só na rede interna do Docker |
| api / indexer | ghcr.io/wydencoin/api | mesma imagem, comandos diferentes |
| grafana | grafana-oss | dashboard, publicado via túnel atrás do Cloudflare Access |
| cloudflared | cloudflare/cloudflared | única saída para a internet |

```bash
cp .env.example .env            # token do túnel
cp ../api/.env.example .env.api # segredos da API
docker compose up -d
```
Backups: `scripts/backup.sh` no cron diário. Teste a restauração antes do piloto.

Plano completo: documento "Implantação do WydenCoin na Nuvem".
