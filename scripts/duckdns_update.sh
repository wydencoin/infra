#!/usr/bin/env bash
# ==============================================================================
# Script de Atualizacao Automatica do DuckDNS
# ==============================================================================
# Configuracao obrigatoria via variaveis de ambiente ou arquivo ~/.duckdns.env
# (copie scripts/.env.duckdns.example para ~/.duckdns.env e defina chmod 600).
#
# Uso no Crontab (rodar a cada 2 horas):
#   0 */2 * * * /caminho/para/infra/scripts/duckdns_update.sh >/dev/null 2>&1
# ==============================================================================

set -o errexit
set -o nounset
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd -P)"

if [[ -f "${SCRIPT_DIR}/.env.duckdns" ]]; then
  # shellcheck source=/dev/null
  source "${SCRIPT_DIR}/.env.duckdns"
elif [[ -f "${HOME}/.duckdns.env" ]]; then
  # shellcheck source=/dev/null
  source "${HOME}/.duckdns.env"
fi

DUCKDNS_DOMAIN="${DUCKDNS_DOMAIN:-}"
DUCKDNS_TOKEN="${DUCKDNS_TOKEN:-}"
TARGET_IP="${TARGET_IP:-}"

if [[ -z "${DUCKDNS_DOMAIN}" || -z "${DUCKDNS_TOKEN}" || -z "${TARGET_IP}" ]]; then
  echo "[ERRO] Variaveis obrigatorias ausentes (DUCKDNS_DOMAIN, DUCKDNS_TOKEN e TARGET_IP)." >&2
  echo "Configure no ambiente ou em ~/.duckdns.env (veja scripts/.env.duckdns.example)." >&2
  exit 1
fi

LOG_DIR="${DUCKDNS_LOG_DIR:-${HOME}/duckdns}"
mkdir -p "${LOG_DIR}"

RESPONSE=$(curl -s -k "https://www.duckdns.org/update?domains=${DUCKDNS_DOMAIN}&token=${DUCKDNS_TOKEN}&ip=${TARGET_IP}")

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Atualizacao DuckDNS: ${RESPONSE}" >> "${LOG_DIR}/duck.log"

if [[ "${RESPONSE}" == "OK" ]]; then
  exit 0
else
  echo "[ERRO] Resposta do DuckDNS inesperada: ${RESPONSE}" >&2
  exit 1
fi
