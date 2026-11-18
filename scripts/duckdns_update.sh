#!/usr/bin/env bash
# ==============================================================================
# Script de Atualização Automática do DuckDNS para a VM 4 (RPC Gateway)
# ==============================================================================
# Este script pode ser agendado no crontab da VM para manter o domínio
# sempre sincronizado com o IP público da instância.
#
# Uso no Crontab (rodar a cada 2 horas):
#   0 */2 * * * /home/ubuntu/duckdns_update.sh >/dev/null 2>&1
# ==============================================================================

set -o errexit
set -o nounset
set -o pipefail

DUCKDNS_DOMAIN="wydencoin-rpc"
DUCKDNS_TOKEN="57999490-7bd9-49e6-9e08-a5fc0f216020"

LOG_DIR="${HOME}/duckdns"
mkdir -p "${LOG_DIR}"

RESPONSE=$(curl -s -k "https://www.duckdns.org/update?domains=${DUCKDNS_DOMAIN}&token=${DUCKDNS_TOKEN}&ip=")

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Atualizacao DuckDNS (${DUCKDNS_DOMAIN}.duckdns.org): ${RESPONSE}" >> "${LOG_DIR}/duck.log"

if [[ "${RESPONSE}" == "OK" ]]; then
  exit 0
else
  echo "[ERRO] Resposta do DuckDNS inesperada: ${RESPONSE}" >&2
  exit 1
fi
