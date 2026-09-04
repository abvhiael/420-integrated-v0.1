#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RPC_URL="${MEDIA420_RPC_URL:-http://127.0.0.1:8545}"
GOV_ADDR="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
OP_ADDR="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
ZERO="0x0000000000000000000000000000000000000000000000000000000000000000"
ANVIL_LOG="${TMPDIR:-/tmp}/420media-anvil.log"

ANVIL_PID=""
cleanup() {
  if [[ -n "$ANVIL_PID" ]]; then kill "$ANVIL_PID" >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT

stage() {
  printf '\n==> 420Media Anvil: %s\n' "$1"
}

fail() {
  echo "420Media Anvil integration failed: $*" >&2
  if [[ -f "$ANVIL_LOG" ]]; then
    echo "--- anvil log tail ---" >&2
    tail -n 80 "$ANVIL_LOG" >&2 || true
  fi
  exit 1
}

stage "starting local Anvil"
anvil --silent --host 127.0.0.1 --port 8545 >"$ANVIL_LOG" 2>&1 &
ANVIL_PID=$!
READY=0
for _ in $(seq 1 100); do
  if cast block-number --rpc-url "$RPC_URL" >/dev/null 2>&1; then
    READY=1
    break
  fi
  if ! kill -0 "$ANVIL_PID" >/dev/null 2>&1; then
    fail "Anvil exited before becoming ready"
  fi
  sleep 0.05
done
[[ "$READY" == "1" ]] || fail "Anvil did not become ready"

stage "building Phase 1 media contracts"
pushd "$ROOT/contracts" >/dev/null
forge build --force \
  src/media/MediaCapabilityRegistry420.sol \
  src/media/MediaOperatorRegistry420.sol \
  src/media/MediaSLA420.sol \
  src/media/MediaSettlement420.sol \
  src/media/MediaJobMarket420.sol

deploy() {
  local target="$1"
  local out
  echo "deploying $target" >&2
  out=$(forge create "$target" --broadcast --unlocked --from "$GOV_ADDR" --rpc-url "$RPC_URL" --constructor-args "$GOV_ADDR")
  awk '/Deployed to:/ {print $3}' <<<"$out"
}

stage "deploying media protocol fixtures"
CAP_REG=$(deploy "src/media/MediaCapabilityRegistry420.sol:MediaCapabilityRegistry420")
OP_REG=$(deploy "src/media/MediaOperatorRegistry420.sol:MediaOperatorRegistry420")
SLA_REG=$(deploy "src/media/MediaSLA420.sol:MediaSLA420")
SETTLEMENT=$(deploy "src/media/MediaSettlement420.sol:MediaSettlement420")
MARKET=$(deploy "src/media/MediaJobMarket420.sol:MediaJobMarket420")
popd >/dev/null

for v in CAP_REG OP_REG SLA_REG SETTLEMENT MARKET; do
  [[ -n "${!v}" ]] || fail "failed to deploy $v"
done

CAP_ID=$(cast keccak "420MEDIA_ANVIL_CAP")
OP_ID=$(cast keccak "420MEDIA_ANVIL_OPERATOR")
STAKE_REF=$(cast keccak "420MEDIA_ANVIL_STAKE")
JOB_KIND=$(cast keccak "420MEDIA_ANVIL_TRANSCODE")
INPUT_REF=$(cast keccak "420MEDIA_ANVIL_INPUT")
CREATED_JOB=$(cast keccak "420MEDIA_ANVIL_CREATED_JOB")
FUNDED_JOB=$(cast keccak "420MEDIA_ANVIL_FUNDED_JOB")
VAULT_REF=$(cast keccak "420MEDIA_ANVIL_VAULT")
FUNDING_REF=$(cast keccak "420MEDIA_ANVIL_FUNDING")
OUTPUT_REF=$(cast keccak "420MEDIA_ANVIL_OUTPUT")
DEADLINE=$(( $(date +%s) + 900 ))

send_gov() { cast send --rpc-url "$RPC_URL" --from "$GOV_ADDR" --unlocked "$@" >/dev/null; }
send_op() { cast send --rpc-url "$RPC_URL" --from "$OP_ADDR" --unlocked "$@" >/dev/null; }

stage "binding protocol dependencies"
send_gov "$OP_REG" "bindCapabilityRegistry(address)" "$CAP_REG"
send_gov "$SETTLEMENT" "bindJobMarket(address)" "$MARKET"
send_gov "$SETTLEMENT" "bindVaultAdapter(address)" "$GOV_ADDR"
send_gov "$SETTLEMENT" "bindPayoutAdapter(address)" "$GOV_ADDR"
send_gov "$MARKET" "bindDependencies(address,address,address)" "$OP_REG" "$SLA_REG" "$SETTLEMENT"
send_gov "$CAP_REG" "registerCapability(bytes32,bytes32)" "$CAP_ID" "$ZERO"

stage "registering operator fixture"
send_op "$OP_REG" "registerOperator(bytes32,address,address,bytes32,bytes32,bytes32)" "$OP_ID" "$OP_ADDR" "$OP_ADDR" "$ZERO" "$ZERO" "$STAKE_REF"
send_op "$OP_REG" "setCapability(bytes32,bytes32,bool)" "$OP_ID" "$CAP_ID" true
send_op "$OP_REG" "activate(bytes32)" "$OP_ID"

stage "creating CREATED and FUNDED job fixtures"
send_gov "$MARKET" "createJob(bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,uint256,uint64)" "$CREATED_JOB" "$ZERO" "$JOB_KIND" "$CAP_ID" "$ZERO" "$INPUT_REF" 420000000 "$DEADLINE"
send_gov "$MARKET" "createJob(bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,uint256,uint64)" "$FUNDED_JOB" "$ZERO" "$JOB_KIND" "$CAP_ID" "$ZERO" "$INPUT_REF" 420000000 "$DEADLINE"
send_op "$MARKET" "acceptJob(bytes32,bytes32)" "$FUNDED_JOB" "$OP_ID"
send_gov "$SETTLEMENT" "confirmVaultFunding(bytes32,address,bytes32,address,bytes32,bytes32,uint256)" "$FUNDED_JOB" "$GOV_ADDR" "$OP_ID" "$OP_ADDR" "$VAULT_REF" "$FUNDING_REF" 420000000

export MEDIA420_ANVIL=1
export MEDIA420_RPC_URL="$RPC_URL"
export MEDIA420_MARKET="$MARKET"
export MEDIA420_OPERATOR_ACCOUNT="$OP_ADDR"
export MEDIA420_OPERATOR_ID="$OP_ID"
export MEDIA420_CREATED_JOB="$CREATED_JOB"
export MEDIA420_FUNDED_JOB="$FUNDED_JOB"
export MEDIA420_OUTPUT_REF="$OUTPUT_REF"
export MEDIA420_JOBS_SELECTOR="$(cast sig 'jobs(bytes32)')"
export MEDIA420_ACCEPT_SELECTOR="$(cast sig 'acceptJob(bytes32,bytes32)')"
export MEDIA420_MARK_RUNNING_SELECTOR="$(cast sig 'markRunning(bytes32)')"
export MEDIA420_COMMIT_RESULT_SELECTOR="$(cast sig 'commitResult(bytes32,bytes32)')"
export MEDIA420_JOB_CREATED_TOPIC="$(cast keccak 'JobCreated(bytes32,address,bytes32,bytes32,bytes32,bytes32,uint256,uint64)')"

stage "running live Go adapter lifecycle test"
cd "$ROOT"
go test ./media/node/ethadapter -run TestAnvilMediaJobAdapterLifecycle -count=1 -v

stage "completed successfully"
