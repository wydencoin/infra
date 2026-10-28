#!/usr/bin/env bash
# Backup diário (cron 03:00) do banco e dos dados do Besu para o Cloudflare R2, guardando 7 dias.
# Requer: pg_dump, rclone configurado com um remote "r2", e SUPABASE_DB_URL no ambiente.
set -euo pipefail
DIA=$(date +%F)
pg_dump "$SUPABASE_DB_URL" | gzip > /tmp/banco-$DIA.sql.gz
docker run --rm -v wydencoin_besu-data:/data -v /tmp:/out alpine tar czf /out/besu-$DIA.tgz -C /data .
rclone copy /tmp/banco-$DIA.sql.gz r2:wydencoin-backups/banco/
rclone copy /tmp/besu-$DIA.tgz     r2:wydencoin-backups/besu/
rclone delete --min-age 7d r2:wydencoin-backups/
rm -f /tmp/banco-$DIA.sql.gz /tmp/besu-$DIA.tgz
