#!/usr/bin/env bash
# ==============================================================================
# 01-generate-network.sh
# Gera a genese QBFT, pares de chaves dos nos e arquivo de permissoes da rede.
# ==============================================================================
set -o errexit
set -o nounset
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd -P)"
REDE_DIR="$(cd "${SCRIPT_DIR}/.." &>/dev/null && pwd -P)"
CONFIGS_DIR="${REDE_DIR}/configs"
BUILD_DIR="${REDE_DIR}/build"

# Carrega variaveis de ambiente locais se existir .env no diretorio besu/
if [[ -f "${REDE_DIR}/.env" ]]; then
  # shellcheck source=/dev/null
  source "${REDE_DIR}/.env"
fi

BOOTNODE_IP="${BOOTNODE_IP:-}"
P2P_PORT="${P2P_PORT:-30303}"
DEPLOYER_ADDRESS="${DEPLOYER_ADDRESS:-}"

function show_help() {
  cat <<EOF
Uso: $(basename "${0}") [OPCOES]

Opcoes:
  -b, --bootnode-ip <IP>         (Obrigatorio ou via BOOTNODE_IP no .env) IP acessivel do No 1 (Bootnode).
  -p, --port <PORTA>             (Opcional) Porta P2P do Bootnode (default: 30303).
  -d, --deployer-address <0x...> (Opcional ou via DEPLOYER_ADDRESS no .env) Conta deployer pre-alocada no genesis.
  -h, --help                     Exibe esta mensagem de ajuda.

Exemplo:
  DEPLOYER_ADDRESS=0x... $(basename "${0}") --bootnode-ip <ip-bootnode>
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -b|--bootnode-ip)
      BOOTNODE_IP="$2"
      shift 2
      ;;
    -p|--port)
      P2P_PORT="$2"
      shift 2
      ;;
    -d|--deployer-address)
      DEPLOYER_ADDRESS="$2"
      shift 2
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      if [[ -z "${BOOTNODE_IP}" ]]; then
        BOOTNODE_IP="$1"
        shift
      else
        echo "[ERRO] Opcao desconhecida: $1" >&2
        show_help
        exit 1
      fi
      ;;
  esac
done

if [[ -z "${BOOTNODE_IP}" ]]; then
  echo "[AVISO] Nenhum IP de Bootnode informado. Detectando IP local..."
  BOOTNODE_IP=$(ip -o route get to 8.8.8.8 2>/dev/null | awk '{print $7}' || hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")
  echo "[INFO] IP detectado: ${BOOTNODE_IP}"
fi

if [[ -n "${DEPLOYER_ADDRESS}" && ! "${DEPLOYER_ADDRESS}" =~ ^0x[0-9a-fA-F]{40}$ ]]; then
  echo "[ERRO] DEPLOYER_ADDRESS invalido: ${DEPLOYER_ADDRESS} (esperado 0x seguido de 40 caracteres hex)." >&2
  exit 1
fi

echo "================================================================="
echo "   GERACAO DA REDE HYPERLEDGER BESU (QBFT - MULTI-NODE)          "
echo "================================================================="
echo "Bootnode IP : ${BOOTNODE_IP}"
echo "Porta P2P   : ${P2P_PORT}"
echo "Deployer    : ${DEPLOYER_ADDRESS:-<nao informado>}"
echo "Genese      : ${CONFIGS_DIR}/genesis_QBFT.json"
echo "Diretorio   : ${BUILD_DIR}"
echo "-----------------------------------------------------------------"

rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"
cp "${CONFIGS_DIR}/genesis_QBFT.json" "${BUILD_DIR}/genesis_QBFT.json"

# Injeta conta deployer no alloc do genesis quando fornecida via .env ou --deployer-address
if [[ -n "${DEPLOYER_ADDRESS}" ]]; then
  DEPLOYER_NO_PREFIX="$(echo "${DEPLOYER_ADDRESS#0x}" | tr '[:upper:]' '[:lower:]')"
  if command -v jq &>/dev/null; then
    jq --arg addr "${DEPLOYER_NO_PREFIX}" \
      '.genesis.alloc[$addr] = {"balance": "0xad78ebc5ac6200000"}' \
      "${BUILD_DIR}/genesis_QBFT.json" > "${BUILD_DIR}/genesis_QBFT.tmp.json"
    mv "${BUILD_DIR}/genesis_QBFT.tmp.json" "${BUILD_DIR}/genesis_QBFT.json"
  elif command -v python3 &>/dev/null; then
    python3 -c "
import json, sys
path, addr = sys.argv[1], sys.argv[2]
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)
data['genesis']['alloc'][addr] = {'balance': '0xad78ebc5ac6200000'}
with open(path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)
" "${BUILD_DIR}/genesis_QBFT.json" "${DEPLOYER_NO_PREFIX}"
  else
    echo "[ERRO] Instale 'jq' ou 'python3' para injetar DEPLOYER_ADDRESS no genesis." >&2
    exit 1
  fi
  echo "[OK] Conta deployer ${DEPLOYER_ADDRESS} injetada no bloco genese."
else
  echo "[AVISO] DEPLOYER_ADDRESS nao informado; nenhuma conta pre-alocada em genesis.alloc."
fi

echo "[1/4] Gerando chaves criptograficas e genesis.json via Besu Docker..."
docker run --rm \
  -u "$(id -u):$(id -g)" \
  -v "${BUILD_DIR}:/data" \
  hyperledger/besu:25.5.0 \
  operator generate-blockchain-config \
  --config-file=/data/genesis_QBFT.json \
  --to=/data/networkFiles \
  --private-key-file-name=key

cp "${BUILD_DIR}/networkFiles/genesis.json" "${BUILD_DIR}/genesis.json"

echo "[2/4] Identificando chaves geradas e calculando Enodes..."
KEYS_DIR="${BUILD_DIR}/networkFiles/keys"
node_index=1
nodes_allowlist=()
accounts_allowlist=()
bootnode_enode=""

if [[ -n "${DEPLOYER_ADDRESS}" ]]; then
  accounts_allowlist+=("\"${DEPLOYER_ADDRESS}\"")
fi

for key_folder in $(ls -d "${KEYS_DIR}"/0x* | sort); do
  account_id="$(basename "${key_folder}")"
  pub_key=$(sed 's/^0x//' "${key_folder}/key.pub")

  NODE_DATA_DIR="${BUILD_DIR}/nodes/node${node_index}/data"
  mkdir -p "${NODE_DATA_DIR}"
  cp "${key_folder}/key" "${NODE_DATA_DIR}/key"
  cp "${key_folder}/key.pub" "${NODE_DATA_DIR}/key.pub"
  echo "${account_id}" > "${BUILD_DIR}/nodes/node${node_index}/address.txt"

  if [[ ${node_index} -eq 1 ]]; then
    bootnode_enode="enode://${pub_key}@${BOOTNODE_IP}:${P2P_PORT}"
    echo "${bootnode_enode}" > "${BUILD_DIR}/bootnode.enode"
    nodes_allowlist+=("\"${bootnode_enode}\"")
  fi

  accounts_allowlist+=("\"${account_id}\"")
  echo "   -> Node ${node_index}: ${account_id}"
  node_index=$((node_index + 1))
done

echo "[3/4] Gerando arquivo permissions_config.toml..."
cat <<EOF > "${BUILD_DIR}/permissions_config.toml"
# Allowlist de nos da rede
nodes-allowlist=[
  $(IFS=,; echo "${nodes_allowlist[*]}")
]

# Allowlist de contas autorizadas (Deployer + Validadores)
accounts-allowlist=[
  $(IFS=,; echo "${accounts_allowlist[*]}")
]
EOF

echo "[4/4] Genese gerada com sucesso!"
echo "-----------------------------------------------------------------"
echo "Bootnode Enode: $(cat "${BUILD_DIR}/bootnode.enode")"
echo "Genesis Path  : ${BUILD_DIR}/genesis.json"
echo "Proximo passo : Executar ./core/02-package-nodes.sh para empacotar os nos."
echo "================================================================="
