#!/usr/bin/env bash
# ==============================================================================
# deploy-monitoring.sh - Deploy da Stack de Telemetria (Prometheus + Grafana)
# ==============================================================================
# Uso:
#   ./deploy-monitoring.sh --local                  # Sobe localmente via Docker Compose
#   ./deploy-monitoring.sh --remote <HOST_OU_IP>    # Transfere e sobe na VM remota
#   ./deploy-monitoring.sh --status                 # Exibe status dos containers
#   ./deploy-monitoring.sh --stop                   # Encerra os containers
#
# Configuracao obrigatoria em monitoring/.env (veja .env.example).
# ==============================================================================

set -o errexit
set -o nounset
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd -P)"

if [[ -f "${SCRIPT_DIR}/.env" ]]; then
  # shellcheck source=/dev/null
  source "${SCRIPT_DIR}/.env"
fi

REMOTE_HOST="${REMOTE_HOST:-}"
REMOTE_USER="${REMOTE_USER:-ubuntu}"
ACTION="local"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --local)
      ACTION="local"
      shift
      ;;
    --remote)
      ACTION="remote"
      if [[ $# -gt 1 && ! "$2" =~ ^-- ]]; then
        REMOTE_HOST="$2"
        shift 2
      else
        shift
      fi
      ;;
    --user)
      REMOTE_USER="$2"
      shift 2
      ;;
    --status)
      ACTION="status"
      shift
      ;;
    --stop)
      ACTION="stop"
      shift
      ;;
    *)
      echo "[ERRO] Opcao invalida: $1" >&2
      exit 1
      ;;
  esac
done

render_prometheus_config() {
  local template="${SCRIPT_DIR}/prometheus/prometheus.yml.template"
  local output="${SCRIPT_DIR}/prometheus/prometheus.yml"
  local validators_yaml=""

  if [[ -n "${VALIDATOR_1_IP:-}" || -n "${VALIDATOR_2_IP:-}" || -n "${VALIDATOR_3_IP:-}" ]]; then
    validators_yaml="- job_name: \"besu-validators\"\n    metrics_path: \"/metrics\"\n    static_configs:"
    [[ -n "${VALIDATOR_1_IP:-}" ]] && validators_yaml="${validators_yaml}\n      - targets: [\"${VALIDATOR_1_IP}:9545\"]\n        labels:\n          instance: \"vm1-bootnode\"\n          role: \"validator-1\"\n          cluster: \"wydencoin-qbft\""
    [[ -n "${VALIDATOR_2_IP:-}" ]] && validators_yaml="${validators_yaml}\n      - targets: [\"${VALIDATOR_2_IP}:9545\"]\n        labels:\n          instance: \"vm2\"\n          role: \"validator-2\"\n          cluster: \"wydencoin-qbft\""
    [[ -n "${VALIDATOR_3_IP:-}" ]] && validators_yaml="${validators_yaml}\n      - targets: [\"${VALIDATOR_3_IP}:9545\"]\n        labels:\n          instance: \"vm3\"\n          role: \"validator-3\"\n          cluster: \"wydencoin-qbft\""
  fi

  python3 -c "
import sys
template_path, out_path, block = sys.argv[1], sys.argv[2], sys.argv[3]
content = open(template_path, encoding='utf-8').read()
decoded = block.encode('utf-8').decode('unicode_escape')
content = content.replace('# __VALIDATORS_BLOCK__', decoded)
open(out_path, 'w', encoding='utf-8').write(content)
" "${template}" "${output}" "${validators_yaml}"
}

if [[ "${ACTION}" == "status" ]]; then
  cd "${SCRIPT_DIR}"
  docker compose ps
  exit 0
fi

if [[ "${ACTION}" == "stop" ]]; then
  cd "${SCRIPT_DIR}"
  docker compose down
  echo "[OK] Monitoramento encerrado."
  exit 0
fi

if [[ ! -f "${SCRIPT_DIR}/.env" ]]; then
  echo "[ERRO] Arquivo monitoring/.env nao encontrado. Copie .env.example para .env e preencha as variaveis." >&2
  exit 1
fi

render_prometheus_config

if [[ "${ACTION}" == "local" ]]; then
  echo "-> Subindo stack de monitoramento localmente..."
  cd "${SCRIPT_DIR}"
  docker compose up -d
  echo "[OK] Prometheus e Grafana ativos."
  echo "     Grafana:    ${GRAFANA_ROOT_URL:-http://localhost:3000} (credenciais definidas no .env)"
  echo "     Prometheus: http://127.0.0.1:9090"
  exit 0
fi

if [[ "${ACTION}" == "remote" ]]; then
  if [[ -z "${REMOTE_HOST}" ]]; then
    echo "[ERRO] Informe --remote <HOST_OU_IP> ou defina REMOTE_HOST no monitoring/.env." >&2
    exit 1
  fi

  echo "=================================================================="
  echo "  Deploy de Monitoramento para a VM Remota: ${REMOTE_HOST}"
  echo "=================================================================="

  TMP_TAR="/tmp/wydencoin-monitoring.tar.gz"
  echo "-> Compactando arquivos de configuracao..."
  tar -czf "${TMP_TAR}" -C "${SCRIPT_DIR}" \
    docker-compose.yml \
    .env \
    prometheus/prometheus.yml \
    grafana

  echo "-> Enviando pacote para ${REMOTE_USER}@${REMOTE_HOST}:~/monitoring..."
  ssh "${REMOTE_USER}@${REMOTE_HOST}" "mkdir -p ~/monitoring"
  scp "${TMP_TAR}" "${REMOTE_USER}@${REMOTE_HOST}:~/monitoring/monitoring.tar.gz"
  rm -f "${TMP_TAR}"

  echo "-> Descompactando e iniciando containers na VM..."
  ssh "${REMOTE_USER}@${REMOTE_HOST}" "bash -c '
    cd ~/monitoring && \
    tar -xzf monitoring.tar.gz && \
    chmod 600 .env && \
    docker compose up -d && \
    rm -f monitoring.tar.gz
  '"

  echo "[OK] Monitoramento implantado com sucesso em ${REMOTE_HOST}."
fi
