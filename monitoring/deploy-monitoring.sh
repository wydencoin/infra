#!/usr/bin/env bash
# ==============================================================================
# deploy-monitoring.sh - Deploy da Stack de Telemetria (Prometheus + Grafana)
# ==============================================================================
# Uso:
#   ./deploy-monitoring.sh --local          # Inicia localmente via Docker Compose
#   ./deploy-monitoring.sh --remote <IP>    # Transfere e sobe na VM remota (ex: VM 4)
#   ./deploy-monitoring.sh --status         # Exibe status dos containers
#   ./deploy-monitoring.sh --stop           # Encerra os containers
# ==============================================================================

set -o errexit
set -o nounset
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd -P)"
REMOTE_HOST="wydencoin-rpc.duckdns.org"
REMOTE_USER="ubuntu"
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
      echo "Opção inválida: $1" >&2
      exit 1
      ;;
  esac
done

if [[ "${ACTION}" == "local" ]]; then
  echo "-> Subindo stack de monitoramento localmente..."
  cd "${SCRIPT_DIR}"
  docker compose up -d
  echo "[OK] Prometheus e Grafana ativos!"
  echo "     Grafana: http://localhost:3000 (admin / wyden2026besu)"
  echo "     Prometheus: http://localhost:9090"
  exit 0
fi

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

if [[ "${ACTION}" == "remote" ]]; then
  echo "=================================================================="
  echo "  Deploy de Monitoramento para a VM Remota: ${REMOTE_HOST}"
  echo "=================================================================="

  TMP_TAR="/tmp/wydencoin-monitoring.tar.gz"
  echo "-> Compactando arquivos de configuração..."
  tar -czf "${TMP_TAR}" -C "${SCRIPT_DIR}" \
    docker-compose.yml \
    prometheus \
    grafana

  echo "-> Enviando pacote para ${REMOTE_USER}@${REMOTE_HOST}:~/monitoring..."
  ssh "${REMOTE_USER}@${REMOTE_HOST}" "mkdir -p ~/monitoring"
  scp "${TMP_TAR}" "${REMOTE_USER}@${REMOTE_HOST}:~/monitoring/monitoring.tar.gz"
  rm -f "${TMP_TAR}"

  echo "-> Descompactando e iniciando containers na VM..."
  ssh "${REMOTE_USER}@${REMOTE_HOST}" "bash -c '
    cd ~/monitoring && \
    tar -xzf monitoring.tar.gz && \
    docker compose up -d && \
    rm -f monitoring.tar.gz
  '"

  echo ""
  echo "=================================================================="
  echo "  [OK] Monitoramento implantado com sucesso na VM 4!"
  echo "  - Grafana: http://${REMOTE_HOST}:3000"
  echo "    Usuário: admin"
  echo "    Senha:   wyden2026besu"
  echo "  - Dashboards pré-carregados:"
  echo "    1. Hyperledger Besu - WydenCoin Cluster Overview"
  echo "    2. WydenCoin Gateway - API Metrics & Latency"
  echo "=================================================================="
fi
