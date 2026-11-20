#!/usr/bin/env bash
# ==============================================================================
# Script de Atualização Automática do DuckDNS para a VM 4 (RPC Gateway)
# ==============================================================================
# Este script pode ser agendado no crontab da VM para manter o domínio
# sempre sincronizado com o IP público da instância.
#
# Configuração:
#   Defina a variável DUCKDNS_TOKEN no ambiente ou em ~/.duckdns.env:
#   echo 'DUCKDNS_TOKEN="seu_token_aqui"' > ~/.duckdns.env && chmod 600 ~/.duckdns.env
#
# Uso no Crontab (rodar a cada 2 horas):
#   0 */2 * * * /home/ubuntu/infra/scripts/duckdns_update.sh >/dev/null 2>&1
# ==============================================================================

set -o errexit
set -o nounset
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd -P)"

# Carrega arquivo de ambiente local se existir (.env.duckdns ou ~/.duckdns.env)
if [[ -f "${SCRIPT_DIR}/.env.duckdns" ]]; then
  # shellcheck source=/dev/null
  source "${SCRIPT_DIR}/.env.duckdns"
elif [[ -f "${HOME}/.duckdns.env" ]]; then
  # shellcheck source=/dev/null
  source "${HOME}/.duckdns.env"
fi

DUCKDNS_DOMAIN="${DUCKDNS_DOMAIN:-wydencoin-rpc}"
DUCKDNS_TOKEN="${DUCKDNS_TOKEN:-${1:-}}"
TARGET_IP="${TARGET_IP:-129.146.55.236}"

if [[ -z "${DUCKDNS_TOKEN}" ]]; then
  echo "[ERRO] DUCKDNS_TOKEN não configurado." >&2
  echo "Defina a variável de ambiente DUCKDNS_TOKEN ou crie o arquivo ~/.duckdns.env com:" >&2
  echo "DUCKDNS_TOKEN=\"seu_token_do_duckdns\"" >&2
  exit 1
fi

LOG_DIR="${HOME}/duckdns"
mkdir -p "${LOG_DIR}"

# Força o envio do IP fixo da VM 4 (evita sobrescrever com o IP da máquina local)
RESPONSE=$(curl -s -k "https://www.duckdns.org/update?domains=${DUCKDNS_DOMAIN}&token=${DUCKDNS_TOKEN}&ip=${TARGET_IP}")

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Atualizacao DuckDNS (${DUCKDNS_DOMAIN}.duckdns.org): ${RESPONSE}" >> "${LOG_DIR}/duck.log"

if [[ "${RESPONSE}" == "OK" ]]; then
  exit 0
else
  echo "[ERRO] Resposta do DuckDNS inesperada: ${RESPONSE}" >&2
  exit 1
fi
